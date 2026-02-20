"use client";

import {
  CSSProperties,
  forwardRef,
  PointerEvent,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import {
  CANVAS_SIZE,
  loadImage,
  PartTransform,
  StrapStyle,
  renderComposition
} from "@/lib/compose";

interface CanvasPreviewProps {
  watchSrc: string;
  strapASrc: string;
  strapBSrc: string;
  partA: PartTransform;
  partB: PartTransform;
  style: StrapStyle;
  watchScale: number;
  onDragPartsChange: (nextPartA: PartTransform, nextPartB: PartTransform) => void;
  onCycleStrap: (direction: 1 | -1) => void;
  controls?: ReactNode;
}

export interface CanvasPreviewRef {
  downloadAsPng: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const CanvasPreview = forwardRef<CanvasPreviewRef, CanvasPreviewProps>(
  (
    {
      watchSrc,
      strapASrc,
      strapBSrc,
      partA,
      partB,
      style,
      watchScale,
      onDragPartsChange,
      onCycleStrap,
      controls
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string>("");
    const [isTicking, setIsTicking] = useState(false);
    const [cursor, setCursor] = useState<CSSProperties["cursor"]>("grab");
    const strapImageSizeRef = useRef<{ aW: number; aH: number; bW: number; bH: number } | null>(
      null
    );
    const dragStateRef = useRef<{
      pointerId: number;
      mode: "move" | "resize";
      startCanvasX: number;
      startCanvasY: number;
      startPartAX: number;
      startPartAY: number;
      startPartBX: number;
      startPartBY: number;
      startScaleA: number;
      startScaleB: number;
    } | null>(null);

    useEffect(() => {
      let active = true;

      const draw = async () => {
        if (!canvasRef.current || !watchSrc || !strapASrc || !strapBSrc) return;
        try {
          await renderComposition(
            canvasRef.current,
            watchSrc,
            strapASrc,
            strapBSrc,
            partA,
            partB,
            style,
            watchScale
          );
          if (active) setError("");
        } catch {
          if (active) setError("Could not render preview. Please try different images.");
        }
      };

      void draw();
      return () => {
        active = false;
      };
    }, [watchSrc, strapASrc, strapBSrc, partA, partB, style, watchScale]);

    useEffect(() => {
      let active = true;
      const loadSizes = async () => {
        try {
          const [a, b] = await Promise.all([loadImage(strapASrc), loadImage(strapBSrc)]);
          if (!active) return;
          strapImageSizeRef.current = {
            aW: a.width,
            aH: a.height,
            bW: b.width,
            bH: b.height
          };
        } catch {
          strapImageSizeRef.current = null;
        }
      };
      void loadSizes();
      return () => {
        active = false;
      };
    }, [strapASrc, strapBSrc]);

    useImperativeHandle(ref, () => ({
      downloadAsPng: () => {
        if (!canvasRef.current) return;
        const url = canvasRef.current.toDataURL("image/png");
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "watch-strap-preview.png";
        anchor.click();
      }
    }));

    const getCanvasPoint = (
      event: PointerEvent<HTMLCanvasElement>
    ): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      return { x, y };
    };

    const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
      const canvasPoint = getCanvasPoint(event);
      if (!canvasPoint || !canvasRef.current) return;

      const size = strapImageSizeRef.current;
      let mode: "move" | "resize" = "move";
      if (size) {
        const getRect = (part: PartTransform, imgW: number, imgH: number) => {
          const w = imgW * (part.scale / 100);
          const h = imgH * (part.scale / 100);
          const cx = CANVAS_SIZE / 2 + part.x;
          const cy = CANVAS_SIZE / 2 + part.y;
          return { left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2 };
        };
        const inRect = (
          p: { x: number; y: number },
          r: { left: number; right: number; top: number; bottom: number }
        ) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
        const nearEdge = (
          p: { x: number; y: number },
          r: { left: number; right: number; top: number; bottom: number }
        ) => {
          const edgeBand = 28;
          return (
            p.y >= r.top &&
            p.y <= r.bottom &&
            (Math.abs(p.x - r.left) <= edgeBand || Math.abs(p.x - r.right) <= edgeBand)
          );
        };

        const rectA = getRect(partA, size.aW, size.aH);
        const rectB = getRect(partB, size.bW, size.bH);
        if (nearEdge(canvasPoint, rectA) || nearEdge(canvasPoint, rectB)) {
          mode = "resize";
          setCursor("ew-resize");
        } else if (inRect(canvasPoint, rectA) || inRect(canvasPoint, rectB)) {
          mode = "move";
          setCursor("grabbing");
        }
      }

      dragStateRef.current = {
        pointerId: event.pointerId,
        mode,
        startCanvasX: canvasPoint.x,
        startCanvasY: canvasPoint.y,
        startPartAX: partA.x,
        startPartAY: partA.y,
        startPartBX: partB.x,
        startPartBY: partB.y,
        startScaleA: partA.scale,
        startScaleB: partB.scale
      };
      canvasRef.current.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const canvasPoint = getCanvasPoint(event);
      if (!canvasPoint) return;

      const deltaX = canvasPoint.x - drag.startCanvasX;
      const deltaY = canvasPoint.y - drag.startCanvasY;
      if (drag.mode === "resize") {
        const scaleDelta = deltaX * 0.09;
        const nextA = clamp(drag.startScaleA + scaleDelta, 30, 250);
        const nextB = clamp(drag.startScaleB + scaleDelta, 30, 250);
        onDragPartsChange(
          { ...partA, scale: nextA },
          { ...partB, scale: nextB }
        );
      } else {
        onDragPartsChange(
          { ...partA, x: drag.startPartAX + deltaX, y: drag.startPartAY + deltaY },
          { ...partB, x: drag.startPartBX + deltaX, y: drag.startPartBY + deltaY }
        );
      }
    };

    const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
      if (dragStateRef.current?.pointerId !== event.pointerId) return;
      dragStateRef.current = null;
      canvasRef.current?.releasePointerCapture(event.pointerId);
      setCursor("grab");
    };

    return (
      <div
        className={`rounded-2xl border p-4 transition ${
          isTicking ? "border-ink" : "border-line"
        }`}
      >
        <div className={controls ? "grid gap-3 lg:grid-cols-[1fr,220px]" : ""}>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsTicking(true);
                window.setTimeout(() => setIsTicking(false), 90);
                onCycleStrap(-1);
              }}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-line bg-white/95 px-3 py-2 text-lg text-ink shadow-sm hover:bg-canvas"
              aria-label="Previous strap"
            >
              ←
            </button>
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="aspect-square w-full rounded-xl border border-line bg-white"
              style={{ touchAction: "none", cursor }}
              aria-label="Preview canvas. Drag strap body to move. Drag strap edges to resize."
            />
            <button
              type="button"
              onClick={() => {
                setIsTicking(true);
                window.setTimeout(() => setIsTicking(false), 90);
                onCycleStrap(1);
              }}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-line bg-white/95 px-3 py-2 text-lg text-ink shadow-sm hover:bg-canvas"
              aria-label="Next strap"
            >
              →
            </button>
          </div>
          {controls ? <div className="self-start">{controls}</div> : null}
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }
);

CanvasPreview.displayName = "CanvasPreview";

export default CanvasPreview;
