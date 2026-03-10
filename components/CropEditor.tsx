"use client";

import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";

const VIEWPORT_SIZE = 360;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

interface CropEditorProps {
  file: File;
  sourceUrl: string;
  onApply: (file: File, previewUrl: string) => void;
}

export default function CropEditor({ file, sourceUrl, onApply }: CropEditorProps) {
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
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

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!layout) return;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX,
      offsetY
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!layout || !dragRef.current) return;
    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;
    setOffsetX(clamp(dragRef.current.offsetX + deltaX, -layout.limitX, layout.limitX));
    setOffsetY(clamp(dragRef.current.offsetY + deltaY, -layout.limitY, layout.limitY));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const applyCrop = async () => {
    if (!layout || !naturalSize) return;
    const bitmap = await createImageBitmap(file);
    const cropX = clamp(-(layout.baseX + offsetX) / layout.scale, 0, bitmap.width);
    const cropY = clamp(-(layout.baseY + offsetY) / layout.scale, 0, bitmap.height);
    const cropSize = Math.min(bitmap.width - cropX, bitmap.height - cropY, VIEWPORT_SIZE / layout.scale);
    const outputSize = 1200;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(bitmap, cropX, cropY, cropSize, cropSize, 0, 0, outputSize, outputSize);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((nextBlob) => resolve(nextBlob), "image/png")
    );
    if (!blob) return;
    const stem = file.name.replace(/\.[^.]+$/, "") || "watch-crop";
    const nextFile = new File([blob], `${stem}-cropped.png`, { type: "image/png" });
    const nextUrl = URL.createObjectURL(blob);
    onApply(nextFile, nextUrl);
  };

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-ink">Crop Photo</p>
          <p className="mt-1 text-sm text-muted">
            Drag to frame the watch. Use zoom to tighten the crop before preview.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setZoom(1);
            setOffsetX(0);
            setOffsetY(0);
          }}
          className="neo-button rounded-xl px-4 py-2 text-sm font-medium text-ink"
        >
          Reset Crop
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,420px),1fr] lg:items-center">
        <div className="mx-auto w-full max-w-[420px]">
          <div
            className="relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-[28px] border border-line bg-canvas/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_20px_40px_rgba(15,23,42,0.14)]"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            role="application"
            aria-label="Crop tool. Drag image to position the watch inside the square."
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
            <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-white/60 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08),inset_0_0_0_999px_rgba(255,255,255,0.06)]" />
            <div className="pointer-events-none absolute inset-[18px] rounded-[22px] border border-white/70 shadow-[0_0_0_1px_rgba(15,23,42,0.06)]" />
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
            <div className="rounded-2xl border border-line bg-canvas/70 px-4 py-3 text-sm text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              {isDragging ? "Repositioning crop..." : "Square crop keeps the dial centered for preview."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
