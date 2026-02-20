"use client";

import {
  forwardRef,
  PointerEvent,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { PartTransform, StrapStyle, renderComposition } from "@/lib/compose";

interface CanvasPreviewProps {
  watchSrc: string;
  strapASrc: string;
  strapBSrc: string;
  partA: PartTransform;
  partB: PartTransform;
  style: StrapStyle;
  dragTarget: "a" | "b";
  onDragPositionChange: (target: "a" | "b", x: number, y: number) => void;
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
      dragTarget,
      onDragPositionChange
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string>("");
    const dragStateRef = useRef<{
      pointerId: number;
      target: "a" | "b";
      startCanvasX: number;
      startCanvasY: number;
      originX: number;
      originY: number;
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

      const origin = dragTarget === "a" ? partA : partB;
      dragStateRef.current = {
        pointerId: event.pointerId,
        target: dragTarget,
        startCanvasX: canvasPoint.x,
        startCanvasY: canvasPoint.y,
        originX: origin.x,
        originY: origin.y
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
      onDragPositionChange(drag.target, drag.originX + deltaX, drag.originY + deltaY);
    };

    const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
      if (dragStateRef.current?.pointerId !== event.pointerId) return;
      dragStateRef.current = null;
      canvasRef.current?.releasePointerCapture(event.pointerId);
    };

    return (
      <div className="rounded-2xl border border-line p-4">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="aspect-square w-full cursor-grab rounded-xl border border-line bg-white active:cursor-grabbing"
          style={{ touchAction: "none" }}
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }
);

CanvasPreview.displayName = "CanvasPreview";

export default CanvasPreview;
