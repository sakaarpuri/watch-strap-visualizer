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
  detectPreviewLugGuides,
  JoinShape,
  loadStrapImage,
  PartTransform,
  PreviewLugGuideOverrides,
  PreviewLugGuides,
  renderStrapOverlay,
  renderWatchOnlyComposition,
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
  joinShape?: JoinShape;
  watchScale: number;
  sceneZoom: number;
  locked: boolean;
  onDragPartsChange: (nextPartA: PartTransform, nextPartB: PartTransform) => void;
  onCycleStrap: (direction: 1 | -1) => void;
  showCycleControls?: boolean;
  controls?: ReactNode;
  showLugGuides?: boolean;
  lugGuideOverrides?: PreviewLugGuideOverrides | null;
  onLugGuidesChange?: (overrides: PreviewLugGuideOverrides) => void;
}

export interface CanvasPreviewRef {
  downloadAsPng: () => void;
  getPngBlob: () => Promise<Blob | null>;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const PART_SCALE_MIN = 5;
const PART_SCALE_MAX = 260;
const GUIDE_MIN_WIDTH = 48;

type GuideDragMode = "move" | "resize-left" | "resize-right";

const scalePairByAverage = (
  startScaleA: number,
  startScaleB: number,
  targetAverageScale: number
) => {
  const currentAverage = (startScaleA + startScaleB) / 2;
  if (currentAverage <= 0) {
    const bounded = clamp(targetAverageScale, PART_SCALE_MIN, PART_SCALE_MAX);
    return { nextA: bounded, nextB: bounded };
  }

  const boundedTarget = clamp(targetAverageScale, PART_SCALE_MIN, PART_SCALE_MAX);
  const factor = boundedTarget / currentAverage;
  const minFactor = Math.max(PART_SCALE_MIN / startScaleA, PART_SCALE_MIN / startScaleB);
  const maxFactor = Math.min(PART_SCALE_MAX / startScaleA, PART_SCALE_MAX / startScaleB);
  const boundedFactor = clamp(factor, minFactor, maxFactor);
  return {
    nextA: startScaleA * boundedFactor,
    nextB: startScaleB * boundedFactor
  };
};

const CanvasPreview = forwardRef<CanvasPreviewRef, CanvasPreviewProps>(
  (
    {
      watchSrc,
      strapASrc,
      strapBSrc,
      partA,
      partB,
      style,
      joinShape = "flat",
      watchScale,
      sceneZoom,
      locked,
      onDragPartsChange,
      onCycleStrap,
      showCycleControls = true,
      controls,
      showLugGuides = false,
      lugGuideOverrides,
      onLugGuidesChange
    },
    ref
  ) => {
    const watchCanvasRef = useRef<HTMLCanvasElement>(null);
    const strapCanvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string>("");
    const [isTicking, setIsTicking] = useState(false);
    const [cursor, setCursor] = useState<CSSProperties["cursor"]>("grab");
    const [lugGuides, setLugGuides] = useState<PreviewLugGuides | null>(null);
    const [strapTransition, setStrapTransition] = useState<{
      direction: 1 | -1;
      previousSrc: string;
    } | null>(null);
    const lugDragRef = useRef<{
      pointerId: number;
      guide: "top" | "bottom";
      mode: GuideDragMode;
      startX: number;
      startY: number;
      initialCenterX: number;
      initialTopY: number;
      initialBottomY: number;
      initialTopWidth: number;
      initialBottomWidth: number;
    } | null>(null);
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
        if (!watchCanvasRef.current || !strapCanvasRef.current || !watchSrc || !strapASrc || !strapBSrc) return;
        try {
          await Promise.all([
            renderWatchOnlyComposition(watchCanvasRef.current, watchSrc, watchScale, sceneZoom),
            renderStrapOverlay(
              strapCanvasRef.current,
              strapASrc,
              strapBSrc,
              partA,
              partB,
              style,
              joinShape,
              sceneZoom
            )
          ]);
          if (active) setError("");
        } catch {
          if (active) setError("Could not render preview. Please try different images.");
        }
      };

      void draw();
      return () => {
        active = false;
      };
    }, [watchSrc, strapASrc, strapBSrc, partA, partB, style, joinShape, watchScale, sceneZoom]);

    useEffect(() => {
      if (!strapTransition) return undefined;
      const timeout = window.setTimeout(() => setStrapTransition(null), 240);
      return () => window.clearTimeout(timeout);
    }, [strapTransition]);

    useEffect(() => {
      let active = true;
      const loadGuides = async () => {
        try {
          const guides = await detectPreviewLugGuides(watchSrc, watchScale);
          if (!active) return;
          setLugGuides(guides);
        } catch {
          if (!active) return;
          setLugGuides(null);
        }
      };
      void loadGuides();
      return () => {
        active = false;
      };
    }, [watchSrc, watchScale]);

    const effectiveLugGuides =
      lugGuides
        ? {
            ...lugGuides,
            centerX: lugGuideOverrides?.centerX ?? lugGuides.centerX,
            topY: lugGuideOverrides?.topY ?? lugGuides.topY,
            bottomY: lugGuideOverrides?.bottomY ?? lugGuides.bottomY,
            topWidth: lugGuideOverrides?.topWidth ?? lugGuides.topWidth,
            bottomWidth: lugGuideOverrides?.bottomWidth ?? lugGuides.bottomWidth
          }
        : null;

    useEffect(() => {
      let active = true;
      const loadSizes = async () => {
        try {
          const [a, b] = await Promise.all([loadStrapImage(strapASrc), loadStrapImage(strapBSrc)]);
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
        const exportCanvas = document.createElement("canvas");
        void renderComposition(
          exportCanvas,
          watchSrc,
          strapASrc,
          strapBSrc,
          partA,
          partB,
          style,
          joinShape,
          watchScale,
          sceneZoom
        ).then(() => {
          const url = exportCanvas.toDataURL("image/png");
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = "watch-strap-preview.png";
          anchor.click();
        });
      },
      getPngBlob: () =>
        new Promise((resolve) => {
          const exportCanvas = document.createElement("canvas");
          void renderComposition(
            exportCanvas,
            watchSrc,
            strapASrc,
            strapBSrc,
            partA,
            partB,
            style,
            joinShape,
            watchScale,
            sceneZoom
          ).then(() => {
            exportCanvas.toBlob((blob) => resolve(blob), "image/png");
          });
        })
    }));

    const getCanvasPoint = (
      event: PointerEvent<HTMLCanvasElement>
    ): { x: number; y: number } | null => {
      const canvas = strapCanvasRef.current;
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
      if (!canvasPoint || !strapCanvasRef.current) return;
      if (locked) return;

      if (showLugGuides && effectiveLugGuides && onLugGuidesChange) {
        const hitGuide = getGuideHitTarget(canvasPoint, effectiveLugGuides, sceneZoom);
        if (hitGuide) {
          lugDragRef.current = {
            pointerId: event.pointerId,
            guide: hitGuide.guide,
            mode: hitGuide.mode,
            startX: canvasPoint.x,
            startY: canvasPoint.y,
            initialCenterX: effectiveLugGuides.centerX,
            initialTopY: effectiveLugGuides.topY,
            initialBottomY: effectiveLugGuides.bottomY,
            initialTopWidth: effectiveLugGuides.topWidth,
            initialBottomWidth: effectiveLugGuides.bottomWidth
          };
          setCursor(hitGuide.mode === "move" ? "move" : "ew-resize");
          strapCanvasRef.current.setPointerCapture(event.pointerId);
          return;
        }
      }

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
      strapCanvasRef.current.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
      const drag = dragStateRef.current;
      const guideDrag = lugDragRef.current;
      if (guideDrag?.pointerId === event.pointerId && effectiveLugGuides && onLugGuidesChange) {
        const canvasPoint = getCanvasPoint(event);
        if (!canvasPoint) return;
        const deltaX = (canvasPoint.x - guideDrag.startX) / sceneZoom;
        const deltaY = (canvasPoint.y - guideDrag.startY) / sceneZoom;
        const nextCenterXBase = clamp(
          guideDrag.initialCenterX + deltaX,
          CANVAS_SIZE * 0.2,
          CANVAS_SIZE * 0.8
        );
        if (guideDrag.guide === "top") {
          const nextTopY = clamp(
            guideDrag.initialTopY + deltaY,
            CANVAS_SIZE * 0.12,
            guideDrag.initialBottomY - 60
          );
          const nextTopWidthState = getNextGuideWidthState(
            guideDrag.mode,
            guideDrag.initialCenterX,
            guideDrag.initialTopWidth,
            deltaX
          );
          onLugGuidesChange({
            centerX: nextTopWidthState?.centerX ?? nextCenterXBase,
            topY: nextTopY,
            bottomY: effectiveLugGuides.bottomY,
            topWidth: nextTopWidthState?.width ?? effectiveLugGuides.topWidth,
            bottomWidth: effectiveLugGuides.bottomWidth
          });
        } else {
          const nextBottomY = clamp(
            guideDrag.initialBottomY + deltaY,
            guideDrag.initialTopY + 60,
            CANVAS_SIZE * 0.88
          );
          const nextBottomWidthState = getNextGuideWidthState(
            guideDrag.mode,
            guideDrag.initialCenterX,
            guideDrag.initialBottomWidth,
            deltaX
          );
          onLugGuidesChange({
            centerX: nextBottomWidthState?.centerX ?? nextCenterXBase,
            topY: effectiveLugGuides.topY,
            bottomY: nextBottomY,
            topWidth: effectiveLugGuides.topWidth,
            bottomWidth: nextBottomWidthState?.width ?? effectiveLugGuides.bottomWidth
          });
        }
        return;
      }
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (locked) return;

      const canvasPoint = getCanvasPoint(event);
      if (!canvasPoint) return;

      const deltaX = canvasPoint.x - drag.startCanvasX;
      const deltaY = canvasPoint.y - drag.startCanvasY;
      if (drag.mode === "resize") {
        const scaleDelta = deltaX * 0.09;
        const targetAverageScale = (drag.startScaleA + drag.startScaleB) / 2 + scaleDelta;
        const { nextA, nextB } = scalePairByAverage(
          drag.startScaleA,
          drag.startScaleB,
          targetAverageScale
        );
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
      if (lugDragRef.current?.pointerId === event.pointerId) {
        lugDragRef.current = null;
        strapCanvasRef.current?.releasePointerCapture(event.pointerId);
        setCursor("grab");
        return;
      }
      if (dragStateRef.current?.pointerId !== event.pointerId) return;
      dragStateRef.current = null;
      strapCanvasRef.current?.releasePointerCapture(event.pointerId);
      setCursor("grab");
    };

    return (
      <div
        className={`rounded-2xl border p-2.5 transition sm:p-3 ${
          isTicking ? "border-slate-500" : "border-white/70"
        }`}
        style={{
          background:
            "linear-gradient(150deg, color-mix(in srgb, var(--canvas-bg) 62%, white 38%), color-mix(in srgb, var(--canvas-bg) 84%, white 16%))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.8), 0 12px 30px rgba(15,23,42,.08)",
          backdropFilter: "blur(8px)"
        }}
      >
        <div className={controls ? "grid gap-3 xl:grid-cols-[minmax(0,1fr),220px]" : ""}>
          <div className="relative">
            {showCycleControls ? (
              <button
                type="button"
                onClick={() => {
                  setIsTicking(true);
                  window.setTimeout(() => setIsTicking(false), 90);
                  const previousSrc = strapCanvasRef.current?.toDataURL("image/png");
                  if (previousSrc) {
                    setStrapTransition({ direction: -1, previousSrc });
                  }
                  onCycleStrap(-1);
                }}
                disabled={locked}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-cyan-200/80 bg-gradient-to-b from-white/95 to-cyan-50/85 px-3 py-2 text-lg text-slate-700 shadow-[0_10px_20px_rgba(59,130,246,.2)] hover:from-white hover:to-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Previous strap"
              >
                ←
              </button>
            ) : null}
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-line bg-canvas">
              <canvas
                ref={watchCanvasRef}
                className="absolute inset-0 h-full w-full bg-canvas"
                aria-hidden="true"
              />
              <canvas
                ref={strapCanvasRef}
                data-testid="preview-canvas"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className={`absolute inset-0 h-full w-full bg-transparent ${
                  strapTransition
                    ? strapTransition.direction === 1
                      ? "strap-layer-enter-right"
                      : "strap-layer-enter-left"
                    : ""
                }`}
                style={{ touchAction: "none", cursor: locked ? "default" : cursor }}
                aria-label="Preview canvas. Drag strap body to move. Drag strap edges to resize."
              />
              {strapTransition ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={strapTransition.previousSrc}
                  alt=""
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 h-full w-full ${
                    strapTransition.direction === 1
                      ? "strap-layer-exit-right"
                      : "strap-layer-exit-left"
                  }`}
                />
              ) : null}
            </div>
            {showLugGuides && effectiveLugGuides ? (
              <LugGuideOverlay guides={effectiveLugGuides} sceneZoom={sceneZoom} />
            ) : null}
            {showCycleControls ? (
              <button
                type="button"
                onClick={() => {
                  setIsTicking(true);
                  window.setTimeout(() => setIsTicking(false), 90);
                  const previousSrc = strapCanvasRef.current?.toDataURL("image/png");
                  if (previousSrc) {
                    setStrapTransition({ direction: 1, previousSrc });
                  }
                  onCycleStrap(1);
                }}
                disabled={locked}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-fuchsia-200/80 bg-gradient-to-b from-white/95 to-fuchsia-50/85 px-3 py-2 text-lg text-slate-700 shadow-[0_10px_20px_rgba(217,70,239,.2)] hover:from-white hover:to-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Next strap"
              >
                →
              </button>
            ) : null}
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

const getGuideHitTarget = (
  point: { x: number; y: number },
  guides: PreviewLugGuides,
  sceneZoom: number
): { guide: "top" | "bottom"; mode: GuideDragMode } | null => {
  const toScreen = (value: number) => CANVAS_SIZE / 2 + (value - CANVAS_SIZE / 2) * sceneZoom;
  const centerX = toScreen(guides.centerX);
  const topY = toScreen(guides.topY);
  const bottomY = toScreen(guides.bottomY);
  const topWidth = guides.topWidth * sceneZoom;
  const bottomWidth = guides.bottomWidth * sceneZoom;
  const hitBand = 18;
  const handleBand = 16;
  const inHorizontalRange = (x: number, width: number) =>
    x >= centerX - width / 2 - 12 && x <= centerX + width / 2 + 12;
  const topLeft = centerX - topWidth / 2;
  const topRight = centerX + topWidth / 2;
  const bottomLeft = centerX - bottomWidth / 2;
  const bottomRight = centerX + bottomWidth / 2;

  if (Math.abs(point.x - topLeft) <= handleBand && Math.abs(point.y - topY) <= handleBand) {
    return { guide: "top", mode: "resize-left" };
  }
  if (Math.abs(point.x - topRight) <= handleBand && Math.abs(point.y - topY) <= handleBand) {
    return { guide: "top", mode: "resize-right" };
  }
  if (Math.abs(point.y - topY) <= hitBand && inHorizontalRange(point.x, topWidth)) {
    return { guide: "top", mode: "move" };
  }
  if (Math.abs(point.x - bottomLeft) <= handleBand && Math.abs(point.y - bottomY) <= handleBand) {
    return { guide: "bottom", mode: "resize-left" };
  }
  if (Math.abs(point.x - bottomRight) <= handleBand && Math.abs(point.y - bottomY) <= handleBand) {
    return { guide: "bottom", mode: "resize-right" };
  }
  if (Math.abs(point.y - bottomY) <= hitBand && inHorizontalRange(point.x, bottomWidth)) {
    return { guide: "bottom", mode: "move" };
  }
  return null;
};

const getNextGuideWidthState = (
  mode: GuideDragMode,
  initialCenterX: number,
  initialWidth: number,
  deltaX: number
) => {
  if (mode === "move") return null;
  const initialLeft = initialCenterX - initialWidth / 2;
  const initialRight = initialCenterX + initialWidth / 2;
  if (mode === "resize-left") {
    const nextLeft = clamp(initialLeft + deltaX, CANVAS_SIZE * 0.08, initialRight - GUIDE_MIN_WIDTH);
    const width = initialRight - nextLeft;
    return { centerX: (nextLeft + initialRight) / 2, width };
  }
  const nextRight = clamp(initialRight + deltaX, initialLeft + GUIDE_MIN_WIDTH, CANVAS_SIZE * 0.92);
  const width = nextRight - initialLeft;
  return { centerX: (initialLeft + nextRight) / 2, width };
};

function LugGuideOverlay({
  guides,
  sceneZoom
}: {
  guides: PreviewLugGuides;
  sceneZoom: number;
}) {
  const toScreen = (value: number) => CANVAS_SIZE / 2 + (value - CANVAS_SIZE / 2) * sceneZoom;
  const centerX = toScreen(guides.centerX);
  const topY = toScreen(guides.topY);
  const bottomY = toScreen(guides.bottomY);
  const topWidth = guides.topWidth * sceneZoom;
  const bottomWidth = guides.bottomWidth * sceneZoom;
  const confident = guides.confidence >= 0.72;

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden rounded-xl">
      <GuideLine
        label={confident ? "Top lug fit" : "Top lug guide"}
        centerX={centerX}
        y={topY}
        width={topWidth}
        tone="cyan"
      />
      <GuideLine
        label={confident ? "Bottom lug fit" : "Bottom lug guide"}
        centerX={centerX}
        y={bottomY}
        width={bottomWidth}
        tone="cyan"
      />
      {!confident ? (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-amber-200 bg-white/92 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
          Auto-fit is reading estimated lug positions.
        </div>
      ) : null}
    </div>
  );
}

function GuideLine({
  label,
  centerX,
  y,
  width,
  tone
}: {
  label: string;
  centerX: number;
  y: number;
  width: number;
  tone: "cyan" | "fuchsia";
}) {
  const colorClasses =
    tone === "cyan"
      ? "border-cyan-300 bg-cyan-400/12 text-cyan-700"
      : "border-fuchsia-300 bg-fuchsia-400/12 text-fuchsia-700";
  const lineWidth = Math.max(32, width);
  const lineLeft = centerX - lineWidth / 2;
  const lineRight = lineLeft + lineWidth;

  return (
    <>
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1={lineLeft}
          y1={y}
          x2={lineRight}
          y2={y}
          stroke={tone === "cyan" ? "#67e8f9" : "#f0abfc"}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div
        className={`absolute rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colorClasses}`}
        style={{
          left: `${centerX + lineWidth / 2 + 10}px`,
          top: `${y - 11}px`
        }}
      >
        {label}
      </div>
      <div
        className={`absolute rounded-full border bg-white ${colorClasses}`}
        style={{
          left: `${lineLeft}px`,
          top: `${y}px`,
          width: "14px",
          height: "14px",
          transform: "translate(-50%, -50%)"
        }}
      />
      <div
        className={`absolute rounded-full border bg-white ${colorClasses}`}
        style={{
          left: `${lineRight}px`,
          top: `${y}px`,
          width: "14px",
          height: "14px",
          transform: "translate(-50%, -50%)"
        }}
      />
    </>
  );
}
