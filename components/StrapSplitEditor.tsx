"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

interface SplitPreview {
  file: File;
  url: string;
}

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

const makeTransparentPairCuts = async (
  file: File,
  splitRatio: number,
  gapRatio: number
): Promise<{ partA: SplitPreview; partB: SplitPreview }> => {
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
  const backgroundThreshold = 70;

  const isBackground = (index: number) => {
    const offset = index * 4;
    const alpha = data[offset + 3];
    if (alpha < 8) return true;
    const pixel = {
      r: data[offset],
      g: data[offset + 1],
      b: data[offset + 2]
    };
    const bright = Math.max(pixel.r, pixel.g, pixel.b) > 240;
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

  const findBounds = (fromY: number, toY: number) => {
    let minX = width;
    let minY = toY;
    let maxX = -1;
    let maxY = fromY;
    for (let y = fromY; y < toY; y += 1) {
      for (let x = 0; x < width; x += 1) {
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
    const pad = 8;
    return {
      x: clamp(minX - pad, 0, width - 1),
      y: clamp(minY - pad, 0, height - 1),
      w: clamp(maxX - minX + 1 + pad * 2, 1, width),
      h: clamp(maxY - minY + 1 + pad * 2, 1, height)
    };
  };

  const splitY = Math.round(height * splitRatio);
  const halfGap = Math.round(height * gapRatio * 0.5);
  const topBottom = clamp(splitY - halfGap, 1, height - 2);
  const bottomTop = clamp(splitY + halfGap, topBottom + 1, height - 1);

  ctx.putImageData(imageData, 0, 0);

  const topBounds = findBounds(0, topBottom);
  const bottomBounds = findBounds(bottomTop, height);
  if (!topBounds || !bottomBounds) {
    throw new Error("Could not isolate both strap halves. Try a cleaner pair image.");
  }

  const toPreview = async (bounds: { x: number; y: number; w: number; h: number }, filename: string) => {
    const out = document.createElement("canvas");
    out.width = bounds.w;
    out.height = bounds.h;
    const outCtx = out.getContext("2d");
    if (!outCtx) throw new Error("Could not create strap preview.");
    outCtx.clearRect(0, 0, out.width, out.height);
    outCtx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob((next) => resolve(next), "image/png"));
    if (!blob) throw new Error("Could not export strap half.");
    return {
      file: new File([blob], filename, { type: "image/png" }),
      url: URL.createObjectURL(blob)
    };
  };

  const stem = file.name.replace(/\.[^.]+$/, "") || "uploaded-strap";
  return {
    partA: await toPreview(topBounds, `${stem}-part-a.png`),
    partB: await toPreview(bottomBounds, `${stem}-part-b.png`)
  };
};

export default function StrapSplitEditor({
  file,
  sourceUrl,
  onApply,
  onClose
}: StrapSplitEditorProps) {
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [gapRatio, setGapRatio] = useState(0.08);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [preview, setPreview] = useState<{ partA: SplitPreview; partB: SplitPreview } | null>(null);
  const [busy, setBusy] = useState(false);
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    setSplitRatio(0.5);
    setGapRatio(0.08);
  }, [sourceUrl]);

  useEffect(() => {
    let active = true;
    const updatePreview = async () => {
      setBusy(true);
      try {
        const nextPreview = await makeTransparentPairCuts(file, splitRatio, gapRatio);
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
  }, [file, splitRatio, gapRatio]);

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );

  const overlay = useMemo(() => {
    if (!naturalSize) return null;
    const splitY = naturalSize.height * splitRatio;
    const halfGap = naturalSize.height * gapRatio * 0.5;
    return {
      topHeight: clamp(((splitY - halfGap) / naturalSize.height) * 100, 0, 100),
      bottomStart: clamp(((splitY + halfGap) / naturalSize.height) * 100, 0, 100)
    };
  }, [gapRatio, naturalSize, splitRatio]);

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-ink">Split Your Strap</p>
          <p className="mt-1 text-sm text-muted">
            Confirm the top buckle side and bottom tail side from one clean pair image.
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
                <>
                  <div
                    className="pointer-events-none absolute left-2 right-2 top-2 rounded-xl border border-emerald-300/80 bg-emerald-300/10"
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
