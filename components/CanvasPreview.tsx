"use client";

import {
  forwardRef,
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
}

export interface CanvasPreviewRef {
  downloadAsPng: () => void;
}

const CanvasPreview = forwardRef<CanvasPreviewRef, CanvasPreviewProps>(
  ({ watchSrc, strapASrc, strapBSrc, partA, partB, style }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string>("");

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

    return (
      <div className="rounded-2xl border border-line p-4">
        <canvas
          ref={canvasRef}
          className="aspect-square w-full rounded-xl border border-line bg-white"
        />
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }
);

CanvasPreview.displayName = "CanvasPreview";

export default CanvasPreview;
