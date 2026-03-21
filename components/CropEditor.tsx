"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";

const VIEWPORT_SIZE = 480;
const DEFAULT_CROP_SIZE = 360;
const MIN_CROP_SIZE = 220;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

type DragMode =
  | { type: "image"; startX: number; startY: number; offsetX: number; offsetY: number }
  | {
      type: "resize";
      corner: "nw" | "ne" | "sw" | "se";
      startX: number;
      startY: number;
      cropX: number;
      cropY: number;
      cropSize: number;
    };

interface CropEditorProps {
  file: File;
  sourceUrl: string;
  onApply: (file: File, previewUrl: string) => void;
  onClose: () => void;
}

export default function CropEditor({ file, sourceUrl, onApply, onClose }: CropEditorProps) {
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [cropSize, setCropSize] = useState(DEFAULT_CROP_SIZE);
  const [cropX, setCropX] = useState((VIEWPORT_SIZE - DEFAULT_CROP_SIZE) / 2);
  const [cropY, setCropY] = useState((VIEWPORT_SIZE - DEFAULT_CROP_SIZE) / 2);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [statusText, setStatusText] = useState("Drag the image and resize the crop box to frame the watch.");
  const [viewportScale, setViewportScale] = useState(1);
  const dragRef = useRef<DragMode | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setCropSize(DEFAULT_CROP_SIZE);
    setCropX((VIEWPORT_SIZE - DEFAULT_CROP_SIZE) / 2);
    setCropY((VIEWPORT_SIZE - DEFAULT_CROP_SIZE) / 2);
  }, [sourceUrl]);

  const layout = useMemo(() => {
    if (!naturalSize) return null;
    const scale = Math.max(VIEWPORT_SIZE / naturalSize.width, VIEWPORT_SIZE / naturalSize.height) * zoom;
    const drawWidth = naturalSize.width * scale;
    const drawHeight = naturalSize.height * scale;
    const baseX = (VIEWPORT_SIZE - drawWidth) / 2;
    const baseY = (VIEWPORT_SIZE - drawHeight) / 2;
    const limitX = Math.max(0, (drawWidth - VIEWPORT_SIZE) / 2);
    const limitY = Math.max(0, (drawHeight - VIEWPORT_SIZE) / 2);
    return {
      scale,
      drawWidth,
      drawHeight,
      baseX,
      baseY,
      limitX,
      limitY
    };
  }, [naturalSize, zoom]);

  useEffect(() => {
    if (!layout) return;
    setOffsetX((prev) => clamp(prev, -layout.limitX, layout.limitX));
    setOffsetY((prev) => clamp(prev, -layout.limitY, layout.limitY));
  }, [layout]);

  useEffect(() => {
    setCropSize((prev) => clamp(prev, MIN_CROP_SIZE, VIEWPORT_SIZE - 40));
  }, []);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setViewportScale(Math.min(1, w / VIEWPORT_SIZE));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setCropX((prev) => clamp(prev, 0, VIEWPORT_SIZE - cropSize));
    setCropY((prev) => clamp(prev, 0, VIEWPORT_SIZE - cropSize));
  }, [cropSize]);

  const beginImageDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!layout) return;
    dragRef.current = {
      type: "image",
      startX: event.clientX,
      startY: event.clientY,
      offsetX,
      offsetY
    };
    setStatusText("Repositioning the watch inside the crop.");
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const beginResizeDrag =
    (corner: "nw" | "ne" | "sw" | "se") => (event: PointerEvent<HTMLButtonElement>) => {
      dragRef.current = {
        type: "resize",
        corner,
        startX: event.clientX,
        startY: event.clientY,
        cropX,
        cropY,
        cropSize
      };
      setStatusText("Resizing the crop box.");
      event.stopPropagation();
      viewportRef.current?.setPointerCapture(event.pointerId);
    };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !layout) return;

    const deltaX = (event.clientX - drag.startX) / viewportScale;
    const deltaY = (event.clientY - drag.startY) / viewportScale;

    if (drag.type === "image") {
      setOffsetX(clamp(drag.offsetX + deltaX, -layout.limitX, layout.limitX));
      setOffsetY(clamp(drag.offsetY + deltaY, -layout.limitY, layout.limitY));
      return;
    }

    const left = drag.cropX;
    const top = drag.cropY;
    const right = drag.cropX + drag.cropSize;
    const bottom = drag.cropY + drag.cropSize;

    if (drag.corner === "nw") {
      const nextLeft = clamp(left + deltaX, 0, right - MIN_CROP_SIZE);
      const nextTop = clamp(top + deltaY, 0, bottom - MIN_CROP_SIZE);
      const nextSize = clamp(Math.min(right - nextLeft, bottom - nextTop), MIN_CROP_SIZE, Math.min(right, bottom));
      setCropSize(nextSize);
      setCropX(right - nextSize);
      setCropY(bottom - nextSize);
      return;
    }

    if (drag.corner === "ne") {
      const nextRight = clamp(right + deltaX, left + MIN_CROP_SIZE, VIEWPORT_SIZE);
      const nextTop = clamp(top + deltaY, 0, bottom - MIN_CROP_SIZE);
      const nextSize = clamp(Math.min(nextRight - left, bottom - nextTop), MIN_CROP_SIZE, Math.min(VIEWPORT_SIZE - left, bottom));
      setCropSize(nextSize);
      setCropX(left);
      setCropY(bottom - nextSize);
      return;
    }

    if (drag.corner === "sw") {
      const nextLeft = clamp(left + deltaX, 0, right - MIN_CROP_SIZE);
      const nextBottom = clamp(bottom + deltaY, top + MIN_CROP_SIZE, VIEWPORT_SIZE);
      const nextSize = clamp(Math.min(right - nextLeft, nextBottom - top), MIN_CROP_SIZE, Math.min(right, VIEWPORT_SIZE - top));
      setCropSize(nextSize);
      setCropX(right - nextSize);
      setCropY(top);
      return;
    }

    const nextRight = clamp(right + deltaX, left + MIN_CROP_SIZE, VIEWPORT_SIZE);
    const nextBottom = clamp(bottom + deltaY, top + MIN_CROP_SIZE, VIEWPORT_SIZE);
    const nextSize = clamp(Math.min(nextRight - left, nextBottom - top), MIN_CROP_SIZE, Math.min(VIEWPORT_SIZE - left, VIEWPORT_SIZE - top));
    setCropSize(nextSize);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    setStatusText("Drag the image and resize the crop box to frame the watch.");
    if (viewportRef.current?.hasPointerCapture(event.pointerId)) {
      viewportRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const applyCrop = async () => {
    if (!layout || !naturalSize) return;
    const bitmap = await createImageBitmap(file);
    const cropSourceX = clamp((cropX - (layout.baseX + offsetX)) / layout.scale, 0, bitmap.width);
    const cropSourceY = clamp((cropY - (layout.baseY + offsetY)) / layout.scale, 0, bitmap.height);
    const cropSourceSize = Math.min(
      cropSize / layout.scale,
      bitmap.width - cropSourceX,
      bitmap.height - cropSourceY
    );
    const outputSize = 1200;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(
      bitmap,
      cropSourceX,
      cropSourceY,
      cropSourceSize,
      cropSourceSize,
      0,
      0,
      outputSize,
      outputSize
    );
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((nextBlob) => resolve(nextBlob), "image/png")
    );
    if (!blob) return;
    const stem = file.name.replace(/\.[^.]+$/, "") || "watch-crop";
    const nextFile = new File([blob], `${stem}-cropped.png`, { type: "image/png" });
    const nextUrl = URL.createObjectURL(blob);
    onApply(nextFile, nextUrl);
  };

  const cropRight = VIEWPORT_SIZE - cropX - cropSize;
  const cropBottom = VIEWPORT_SIZE - cropY - cropSize;

  return (
    <div className="glass-card rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-ink">Crop Photo</p>
          <p className="mt-1 text-sm text-muted">
            Drag the image and resize the crop box to frame the watch before preview.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setOffsetX(0);
              setOffsetY(0);
              setCropSize(DEFAULT_CROP_SIZE);
              setCropX((VIEWPORT_SIZE - DEFAULT_CROP_SIZE) / 2);
              setCropY((VIEWPORT_SIZE - DEFAULT_CROP_SIZE) / 2);
            }}
            className="neo-button rounded-xl px-4 py-2 text-sm font-medium text-ink"
          >
            Reset Crop
          </button>
          <button
            type="button"
            onClick={onClose}
            className="neo-button rounded-xl px-4 py-2 text-sm font-medium text-ink"
          >
            Close
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,540px),1fr] xl:items-center">
        <div className="mx-auto w-full max-w-[540px]">
          <div
            ref={outerRef}
            className="relative mx-auto aspect-square w-full max-w-[480px] overflow-hidden rounded-[28px]"
          >
          <div
            ref={viewportRef}
            className="absolute top-0 left-0 border border-slate-300 bg-canvas/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_20px_40px_rgba(15,23,42,0.14)]"
            onPointerDown={beginImageDrag}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            role="application"
            aria-label="Crop tool. Drag image or resize the crop box to frame the watch."
            style={{
              width: VIEWPORT_SIZE,
              height: VIEWPORT_SIZE,
              transformOrigin: "top left",
              transform: `scale(${viewportScale})`,
              borderRadius: "28px"
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sourceUrl}
              alt="Crop source"
              onLoad={(event) =>
                setNaturalSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight
                })
              }
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
              style={
                layout
                  ? {
                      width: `${layout.drawWidth}px`,
                      height: `${layout.drawHeight}px`,
                      left: `${layout.baseX + offsetX}px`,
                      top: `${layout.baseY + offsetY}px`
                    }
                  : undefined
              }
            />

            <div
              className="pointer-events-none absolute left-0 top-0 bg-slate-900/28"
              style={{ width: "100%", height: `${cropY}px` }}
            />
            <div
              className="pointer-events-none absolute left-0 bg-slate-900/28"
              style={{ top: `${cropY}px`, width: `${cropX}px`, height: `${cropSize}px` }}
            />
            <div
              className="pointer-events-none absolute right-0 bg-slate-900/28"
              style={{ top: `${cropY}px`, width: `${cropRight}px`, height: `${cropSize}px` }}
            />
            <div
              className="pointer-events-none absolute bottom-0 left-0 bg-slate-900/28"
              style={{ width: "100%", height: `${cropBottom}px` }}
            />

            <div
              className="pointer-events-none absolute rounded-[24px] border-2 border-[#30486c] shadow-[0_0_0_1px_rgba(255,255,255,0.75),0_0_0_999px_rgba(255,255,255,0.02)]"
              style={{ left: `${cropX}px`, top: `${cropY}px`, width: `${cropSize}px`, height: `${cropSize}px` }}
            >
              <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-[#30486c] bg-white/92 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#30486c] shadow-[0_4px_10px_rgba(15,23,42,0.12)]">
                Crop
              </div>
              {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                <button
                  key={corner}
                  type="button"
                  aria-label={`Resize crop ${corner}`}
                  onPointerDown={beginResizeDrag(corner)}
                  className="pointer-events-auto absolute h-5 w-5 rounded-full border-2 border-[#30486c] bg-white shadow-[0_4px_10px_rgba(15,23,42,0.16)]"
                  style={{
                    left: corner.includes("w") ? "-10px" : undefined,
                    right: corner.includes("e") ? "-10px" : undefined,
                    top: corner.includes("n") ? "-10px" : undefined,
                    bottom: corner.includes("s") ? "-10px" : undefined,
                    cursor:
                      corner === "nw" || corner === "se"
                        ? "nwse-resize"
                        : "nesw-resize"
                  }}
                />
              ))}
            </div>
          </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="neo-control rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-base font-semibold text-ink">Crop Zoom</span>
              <span className="text-sm text-muted">{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={2.4}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="range-slider range-slider--stepped"
              aria-label="Crop zoom"
            />
            <div className="range-ticks mt-3" aria-hidden="true">
              {Array.from({ length: 9 }).map((_, index) => (
                <span key={index} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={applyCrop}
              className="neo-button neo-button--primary rounded-2xl px-5 py-3 text-base font-semibold text-white"
            >
              Apply Crop
            </button>
            <button
              type="button"
              onClick={onClose}
              className="neo-button rounded-2xl px-5 py-3 text-base font-semibold text-ink"
            >
              Cancel
            </button>
            <div className="rounded-2xl border border-line bg-canvas/70 px-4 py-3 text-sm text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              {statusText}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
