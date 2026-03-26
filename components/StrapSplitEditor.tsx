"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

interface SplitPreview {
  file: File;
  url: string;
}

type SplitAxis = "horizontal" | "vertical";

interface StrapSplitEditorProps {
  file: File;
  sourceUrl: string;
  onApply: (payload: { partA: SplitPreview; partB: SplitPreview }) => void;
  onClose: () => void;
}

const averageColor = (samples: Array<{ r: number; g: number; b: number }>) => {
  const total = samples.reduce(
    (acc, sample) => ({
      r: acc.r + sample.r,
      g: acc.g + sample.g,
      b: acc.b + sample.b
    }),
    { r: 0, g: 0, b: 0 }
  );
  return {
    r: total.r / samples.length,
    g: total.g / samples.length,
    b: total.b / samples.length
  };
};

const colorDistance = (
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

interface ForegroundComponent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
  centerX: number;
  centerY: number;
}

const prepareTransparentCanvas = async (file: File) => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare strap split.");
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue: number[] = [];

  const sampleRadius = 12;
  const corners = [
    { x: sampleRadius, y: sampleRadius },
    { x: width - sampleRadius - 1, y: sampleRadius },
    { x: sampleRadius, y: height - sampleRadius - 1 },
    { x: width - sampleRadius - 1, y: height - sampleRadius - 1 }
  ];

  const cornerSamples = corners.map(({ x, y }) => {
    const index = (y * width + x) * 4;
    return {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2]
    };
  });
  const background = averageColor(cornerSamples);
  const backgroundThreshold = 92;

  const isBackground = (index: number) => {
    const offset = index * 4;
    const alpha = data[offset + 3];
    if (alpha < 8) return true;
    const pixel = {
      r: data[offset],
      g: data[offset + 1],
      b: data[offset + 2]
    };
    const bright = Math.max(pixel.r, pixel.g, pixel.b) > 226;
    return colorDistance(pixel, background) <= backgroundThreshold || bright;
  };

  const enqueue = (index: number) => {
    if (index < 0 || index >= total || visited[index]) return;
    if (!isBackground(index)) return;
    visited[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + (width - 1));
  }

  let cursor = 0;
  while (cursor < queue.length) {
    const index = queue[cursor++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x < width - 1) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y < height - 1) enqueue(index + width);
  }

  for (const index of queue) {
    data[index * 4 + 3] = 0;
  }

  ctx.putImageData(imageData, 0, 0);
  return { canvas, width, height, data };
};

const getForegroundComponents = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = 14
): ForegroundComponent[] => {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  const components: ForegroundComponent[] = [];

  for (let index = 0; index < total; index += 1) {
    if (visited[index]) continue;
    const alpha = data[index * 4 + 3];
    if (alpha <= alphaThreshold) continue;
    visited[index] = 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = index;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let area = 0;
    let sumX = 0;
    let sumY = 0;

    while (head < tail) {
      const current = queue[head++];
      const x = current % width;
      const y = Math.floor(current / width);
      area += 1;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [
        x > 0 ? current - 1 : -1,
        x < width - 1 ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y < height - 1 ? current + width : -1
      ];

      for (const next of neighbors) {
        if (next < 0 || visited[next]) continue;
        const nextAlpha = data[next * 4 + 3];
        if (nextAlpha <= alphaThreshold) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }

    if (area >= 600) {
      components.push({
        minX,
        minY,
        maxX,
        maxY,
        area,
        centerX: sumX / area,
        centerY: sumY / area
      });
    }
  }

  return components.sort((a, b) => b.area - a.area);
};

const detectSplitLayout = (
  data: Uint8ClampedArray,
  width: number,
  height: number
): { axis: SplitAxis; splitRatio: number; gapRatio: number } => {
  const components = getForegroundComponents(data, width, height).slice(0, 2);
  if (components.length < 2) {
    return { axis: "horizontal", splitRatio: 0.5, gapRatio: 0.08 };
  }

  const [first, second] = components;
  const axis: SplitAxis =
    Math.abs(first.centerX - second.centerX) >= Math.abs(first.centerY - second.centerY)
      ? "vertical"
      : "horizontal";

  if (axis === "vertical") {
    const [left, right] = [first, second].sort((a, b) => a.centerX - b.centerX);
    const splitPx = (left.maxX + right.minX) * 0.5;
    const gapPx = Math.max(0, right.minX - left.maxX - 1);
    return {
      axis,
      splitRatio: clamp(splitPx / width, 0.2, 0.8),
      gapRatio: clamp(gapPx / width, 0.02, 0.18)
    };
  }

  const [top, bottom] = [first, second].sort((a, b) => a.centerY - b.centerY);
  const splitPx = (top.maxY + bottom.minY) * 0.5;
  const gapPx = Math.max(0, bottom.minY - top.maxY - 1);
  return {
    axis,
    splitRatio: clamp(splitPx / height, 0.2, 0.8),
    gapRatio: clamp(gapPx / height, 0.02, 0.18)
  };
};

const makeTransparentPairCuts = async (
  file: File,
  splitRatio: number,
  gapRatio: number,
  splitAxis: SplitAxis
): Promise<{ partA: SplitPreview; partB: SplitPreview }> => {
  const { canvas, width, height, data } = await prepareTransparentCanvas(file);

  const findBounds = (fromX: number, toX: number, fromY: number, toY: number) => {
    let minX = toX;
    let minY = toY;
    let maxX = -1;
    let maxY = -1;
    for (let y = fromY; y < toY; y += 1) {
      for (let x = fromX; x < toX; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 14) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < minX || maxY < minY) return null;
    const pad = 4;
    return {
      x: clamp(minX - pad, 0, width - 1),
      y: clamp(minY - pad, 0, height - 1),
      w: clamp(maxX - minX + 1 + pad * 2, 1, width - clamp(minX - pad, 0, width - 1)),
      h: clamp(maxY - minY + 1 + pad * 2, 1, height - clamp(minY - pad, 0, height - 1))
    };
  };

  const rotateCanvas180 = (source: HTMLCanvasElement) => {
    const out = document.createElement("canvas");
    out.width = source.width;
    out.height = source.height;
    const outCtx = out.getContext("2d");
    if (!outCtx) throw new Error("Could not rotate strap preview.");
    outCtx.clearRect(0, 0, out.width, out.height);
    outCtx.translate(out.width / 2, out.height / 2);
    outCtx.rotate(Math.PI);
    outCtx.drawImage(source, -source.width / 2, -source.height / 2);
    return out;
  };

  const trimCanvas = (source: HTMLCanvasElement) => {
    const ctx = source.getContext("2d");
    if (!ctx) return source;
    const imageData = ctx.getImageData(0, 0, source.width, source.height);
    const { data: pixels } = imageData;
    let minX = source.width;
    let minY = source.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const offset = (y * source.width + x) * 4;
        const alpha = pixels[offset + 3];
        const r = pixels[offset];
        const g = pixels[offset + 1];
        const b = pixels[offset + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const lowSaturation = max - min < 22;
        if (alpha > 30 && !(lowSaturation && max > 242)) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < minX || maxY < minY) return source;
    const pad = 2;
    const cropX = clamp(minX - pad, 0, source.width - 1);
    const cropY = clamp(minY - pad, 0, source.height - 1);
    const cropW = clamp(maxX - minX + 1 + pad * 2, 1, source.width - cropX);
    const cropH = clamp(maxY - minY + 1 + pad * 2, 1, source.height - cropY);
    const out = document.createElement("canvas");
    out.width = cropW;
    out.height = cropH;
    const outCtx = out.getContext("2d");
    if (!outCtx) return source;
    outCtx.clearRect(0, 0, cropW, cropH);
    outCtx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    return out;
  };

  const getRowWidth = (source: HTMLCanvasElement, yRatio: number) => {
    const ctx = source.getContext("2d");
    if (!ctx) return 0;
    const y = clamp(Math.round((source.height - 1) * yRatio), 0, source.height - 1);
    const { data: row } = ctx.getImageData(0, y, source.width, 1);
    let minX = source.width;
    let maxX = -1;
    for (let x = 0; x < source.width; x += 1) {
      const offset = x * 4;
      if (row[offset + 3] > 30) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    return maxX >= minX ? maxX - minX + 1 : 0;
  };

  const normalizeBottomHalf = (source: HTMLCanvasElement) => {
    const trimmed = trimCanvas(source);
    const topWidth = getRowWidth(trimmed, 0.16);
    const bottomWidth = getRowWidth(trimmed, 0.84);
    return topWidth + 4 < bottomWidth ? rotateCanvas180(trimmed) : trimmed;
  };

  const toPreview = async (
    bounds: { x: number; y: number; w: number; h: number },
    filename: string,
    options?: { normalizeBottomHalf?: boolean }
  ) => {
    const out = document.createElement("canvas");
    out.width = bounds.w;
    out.height = bounds.h;
    const outCtx = out.getContext("2d");
    if (!outCtx) throw new Error("Could not create strap preview.");
    outCtx.clearRect(0, 0, out.width, out.height);
    outCtx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
    const finalCanvas = options?.normalizeBottomHalf ? normalizeBottomHalf(out) : trimCanvas(out);
    const blob = await new Promise<Blob | null>((resolve) => finalCanvas.toBlob((next) => resolve(next), "image/png"));
    if (!blob) throw new Error("Could not export strap half.");
    return {
      file: new File([blob], filename, { type: "image/png" }),
      url: URL.createObjectURL(blob)
    };
  };

  const stem = file.name.replace(/\.[^.]+$/, "") || "uploaded-strap";
  if (splitAxis === "vertical") {
    const splitX = Math.round(width * splitRatio);
    const halfGap = Math.round(width * gapRatio * 0.5);
    const leftRight = clamp(splitX - halfGap, 1, width - 2);
    const rightLeft = clamp(splitX + halfGap, leftRight + 1, width - 1);
    const leftBounds = findBounds(0, leftRight, 0, height);
    const rightBounds = findBounds(rightLeft, width, 0, height);
    if (!leftBounds || !rightBounds) {
      throw new Error("Could not isolate both strap halves. Try a cleaner pair image.");
    }
    return {
      partA: await toPreview(leftBounds, `${stem}-part-a.png`),
      partB: await toPreview(rightBounds, `${stem}-part-b.png`, { normalizeBottomHalf: true })
    };
  }

  const splitY = Math.round(height * splitRatio);
  const halfGap = Math.round(height * gapRatio * 0.5);
  const topBottom = clamp(splitY - halfGap, 1, height - 2);
  const bottomTop = clamp(splitY + halfGap, topBottom + 1, height - 1);
  const topBounds = findBounds(0, width, 0, topBottom);
  const bottomBounds = findBounds(0, width, bottomTop, height);
  if (!topBounds || !bottomBounds) {
    throw new Error("Could not isolate both strap halves. Try a cleaner pair image.");
  }
  return {
    partA: await toPreview(topBounds, `${stem}-part-a.png`),
    partB: await toPreview(bottomBounds, `${stem}-part-b.png`, { normalizeBottomHalf: true })
  };
};

export default function StrapSplitEditor({
  file,
  sourceUrl,
  onApply,
  onClose
}: StrapSplitEditorProps) {
  const [splitAxis, setSplitAxis] = useState<SplitAxis>("horizontal");
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [gapRatio, setGapRatio] = useState(0.08);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [preview, setPreview] = useState<{ partA: SplitPreview; partB: SplitPreview } | null>(null);
  const [busy, setBusy] = useState(false);
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    let active = true;
    const detectLayout = async () => {
      try {
        const { width, height, data } = await prepareTransparentCanvas(file);
        if (!active) return;
        const layout = detectSplitLayout(data, width, height);
        setSplitAxis(layout.axis);
        setSplitRatio(layout.splitRatio);
        setGapRatio(layout.gapRatio);
      } catch {
        if (!active) return;
        setSplitAxis("horizontal");
        setSplitRatio(0.5);
        setGapRatio(0.08);
      }
    };
    void detectLayout();
    return () => {
      active = false;
    };
  }, [file, sourceUrl]);

  useEffect(() => {
    let active = true;
    const updatePreview = async () => {
      setBusy(true);
      try {
        const nextPreview = await makeTransparentPairCuts(file, splitRatio, gapRatio, splitAxis);
        if (!active) {
          URL.revokeObjectURL(nextPreview.partA.url);
          URL.revokeObjectURL(nextPreview.partB.url);
          return;
        }
        previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        previewUrlsRef.current = [nextPreview.partA.url, nextPreview.partB.url];
        setPreview(nextPreview);
      } catch {
        if (!active) return;
        previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        previewUrlsRef.current = [];
        setPreview(null);
      } finally {
        if (active) setBusy(false);
      }
    };
    void updatePreview();
    return () => {
      active = false;
    };
  }, [file, splitRatio, gapRatio, splitAxis]);

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );

  const overlay = useMemo(() => {
    if (!naturalSize) return null;
    if (splitAxis === "vertical") {
      const splitX = naturalSize.width * splitRatio;
      const halfGap = naturalSize.width * gapRatio * 0.5;
      return {
        axis: splitAxis,
        leftWidth: clamp(((splitX - halfGap) / naturalSize.width) * 100, 0, 100),
        rightStart: clamp(((splitX + halfGap) / naturalSize.width) * 100, 0, 100)
      };
    }
    const splitY = naturalSize.height * splitRatio;
    const halfGap = naturalSize.height * gapRatio * 0.5;
    return {
      axis: splitAxis,
      topHeight: clamp(((splitY - halfGap) / naturalSize.height) * 100, 0, 100),
      bottomStart: clamp(((splitY + halfGap) / naturalSize.height) * 100, 0, 100)
    };
  }, [gapRatio, naturalSize, splitAxis, splitRatio]);

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-ink">Split Your Strap</p>
          <p className="mt-1 text-sm text-muted">
            Confirm the buckle half and tail half from one clean pair image.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="neo-button rounded-xl px-4 py-2 text-sm font-medium text-ink"
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,380px),minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-line bg-white/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <div className="relative overflow-hidden rounded-[1.25rem]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sourceUrl}
                alt="Uploaded strap source"
                className="max-h-[28rem] w-full object-contain"
                onLoad={(event) =>
                  setNaturalSize({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight
                  })
                }
              />
              {overlay ? (
                overlay.axis === "vertical" ? (
                  <>
                    <div
                      className="pointer-events-none absolute bottom-2 left-2 top-2 rounded-xl border border-[#d7c1a3]/80 bg-[#fbf3e8]"
                      style={{ width: `calc(${overlay.leftWidth}% - 0.75rem)` }}
                    />
                    <div
                      className="pointer-events-none absolute bottom-2 right-2 top-2 rounded-xl border border-fuchsia-300/80 bg-fuchsia-300/10"
                      style={{ left: `calc(${overlay.rightStart}% + 0.75rem)` }}
                    />
                    <div
                      className="pointer-events-none absolute bottom-3 top-3 border-l-2 border-dashed border-slate-700/50"
                      style={{ left: `${splitRatio * 100}%` }}
                    />
                  </>
                ) : (
                  <>
                    <div
                      className="pointer-events-none absolute left-2 right-2 top-2 rounded-xl border border-[#d7c1a3]/80 bg-[#fbf3e8]"
                      style={{ height: `calc(${overlay.topHeight}% - 0.75rem)` }}
                    />
                    <div
                      className="pointer-events-none absolute left-2 right-2 bottom-2 rounded-xl border border-fuchsia-300/80 bg-fuchsia-300/10"
                      style={{ top: `calc(${overlay.bottomStart}% + 0.75rem)` }}
                    />
                    <div
                      className="pointer-events-none absolute left-3 right-3 border-t-2 border-dashed border-slate-700/50"
                      style={{ top: `${splitRatio * 100}%` }}
                    />
                  </>
                )
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="neo-control rounded-2xl p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">Split line</span>
                <span className="text-xs text-muted">{Math.round(splitRatio * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.35}
                max={0.65}
                step={0.01}
                value={splitRatio}
                onChange={(event) => setSplitRatio(Number(event.target.value))}
                className="range-slider"
                aria-label="Split line"
              />
            </div>
            <div className="neo-control rounded-2xl p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">Center trim</span>
                <span className="text-xs text-muted">{Math.round(gapRatio * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.02}
                max={0.18}
                step={0.01}
                value={gapRatio}
                onChange={(event) => setGapRatio(Number(event.target.value))}
                className="range-slider"
                aria-label="Center trim"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Part A · buckle side", previewUrl: preview?.partA.url },
              { label: "Part B · tail side", previewUrl: preview?.partB.url }
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-line bg-canvas/75 p-3">
                <p className="text-sm font-semibold text-ink">{item.label}</p>
                <div className="mt-3 flex h-56 items-center justify-center overflow-hidden rounded-[1.25rem] border border-line bg-slate-50">
                  {item.previewUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.previewUrl} alt={item.label} className="h-full w-full object-contain p-2" />
                  ) : (
                    <p className="px-4 text-center text-sm text-muted">
                      {busy ? "Cutting strap..." : "Use a cleaner pair image for the split."}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => preview && onApply(preview)}
              disabled={!preview || busy}
              className="neo-button neo-button--primary rounded-2xl px-5 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use This Strap
            </button>
            <p className="text-sm text-muted">
              Keep the pair straight and evenly lit. This stays only in your current session.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
