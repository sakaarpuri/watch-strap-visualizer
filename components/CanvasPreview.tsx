"use client";

import {
  forwardRef,
  PointerEvent,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  WheelEvent
} from "react";
import { PartTransform, StrapStyle, renderComposition } from "@/lib/compose";

interface CanvasPreviewProps {
  watchSrc: string;
  strapASrc: string;
  strapBSrc: string;
  partA: PartTransform;
  partB: PartTransform;
  style: StrapStyle;
  onDragPartsChange: (nextPartA: PartTransform, nextPartB: PartTransform) => void;
  onCycleStrap: (direction: 1 | -1) => void;
}

export interface CanvasPreviewRef {
  downloadAsPng: () => void;
}

const CanvasPreview = forwardRef<CanvasPreviewRef, CanvasPreviewProps>(
  (
    {
      watchSrc,
      strapASrc,
      strapBSrc,
      partA,
      partB,
      style,
      onDragPartsChange,
      onCycleStrap
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string>("");
    const lastWheelAtRef = useRef(0);
    const dragStateRef = useRef<{
      pointerId: number;
      startCanvasX: number;
      startCanvasY: number;
      startPartAX: number;
      startPartAY: number;
      startPartBX: number;
      startPartBY: number;
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
            style
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
    }, [watchSrc, strapASrc, strapBSrc, partA, partB, style]);

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

      dragStateRef.current = {
        pointerId: event.pointerId,
        startCanvasX: canvasPoint.x,
        startCanvasY: canvasPoint.y,
        startPartAX: partA.x,
        startPartAY: partA.y,
        startPartBX: partB.x,
        startPartBY: partB.y
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
      onDragPartsChange(
        { ...partA, x: drag.startPartAX + deltaX, y: drag.startPartAY + deltaY },
        { ...partB, x: drag.startPartBX + deltaX, y: drag.startPartBY + deltaY }
      );
    };

    const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
      if (dragStateRef.current?.pointerId !== event.pointerId) return;
      dragStateRef.current = null;
      canvasRef.current?.releasePointerCapture(event.pointerId);
    };

    const onWheel = (event: WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const now = Date.now();
      if (now - lastWheelAtRef.current < 160) return;
      lastWheelAtRef.current = now;

      const direction: 1 | -1 = event.deltaY > 0 ? 1 : -1;
      onCycleStrap(direction);
    };

    return (
      <div className="rounded-2xl border border-line p-4">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
          className="aspect-square w-full cursor-grab rounded-xl border border-line bg-white active:cursor-grabbing"
          style={{ touchAction: "none" }}
          aria-label="Preview canvas. Drag to move straps. Scroll to cycle strap designs."
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }
);

CanvasPreview.displayName = "CanvasPreview";

export default CanvasPreview;
