"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import CanvasPreview, { CanvasPreviewRef } from "@/components/CanvasPreview";
import ImageUploader from "@/components/ImageUploader";
import {
  autoCleanDialImage,
  calculateAutoPlacement,
  PartTransform
} from "@/lib/compose";
import {
  STRAP_CATEGORIES,
  getStrapsForCategory,
  StrapCategory,
  StrapVariant
} from "@/lib/strapLibrary";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const STRAP_SCALE_MIN = 55;
const STRAP_SCALE_MAX = 175;
const strapScaleToUi = (scale: number) => {
  const t = clamp((scale - STRAP_SCALE_MIN) / (STRAP_SCALE_MAX - STRAP_SCALE_MIN), 0, 1);
  return Math.sqrt(t) * 100;
};
const uiToStrapScale = (uiValue: number) => {
  const t = clamp(uiValue / 100, 0, 1);
  return STRAP_SCALE_MIN + t * t * (STRAP_SCALE_MAX - STRAP_SCALE_MIN);
};

export default function Home() {
  const [watchSrc, setWatchSrc] = useState("/mock-dial.svg");
  const [watchPreviewSrc, setWatchPreviewSrc] = useState("/mock-dial.svg");
  const [category, setCategory] = useState<StrapCategory>("All categories");
  const [strapIndex, setStrapIndex] = useState(0);
  const [partA, setPartA] = useState<PartTransform | null>(null);
  const [partB, setPartB] = useState<PartTransform | null>(null);
  const [dialScale, setDialScale] = useState(1);
  const [sceneZoom, setSceneZoom] = useState(1);
  const [preserveSettings, setPreserveSettings] = useState(true);
  const [lockView, setLockView] = useState(false);
  const [isAutoAligning, setIsAutoAligning] = useState(false);
  const [isCleaningDial, setIsCleaningDial] = useState(false);

  const canvasRef = useRef<CanvasPreviewRef>(null);

  const strapsInCategory = getStrapsForCategory(category);
  const currentStrap: StrapVariant = strapsInCategory[strapIndex] ?? strapsInCategory[0];

  const onUploadDial = async (
    file: File,
    previewSetter: Dispatch<SetStateAction<string>>
  ) => {
    previewSetter(URL.createObjectURL(file));
    setIsCleaningDial(true);
    try {
      const cleaned = await autoCleanDialImage(file);
      setWatchSrc(cleaned);
    } finally {
      setIsCleaningDial(false);
    }
  };

  const autoAlignStraps = async () => {
    if (!currentStrap) return;
    setIsAutoAligning(true);
    try {
      const aligned = await calculateAutoPlacement(
        watchSrc,
        currentStrap.strapASrc,
        currentStrap.strapBSrc
      );
      setPartA(aligned.partA);
      setPartB(aligned.partB);
    } finally {
      setIsAutoAligning(false);
    }
  };

  useEffect(() => {
    void autoAlignStraps();
    // Always recompute when watch image changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchSrc]);

  useEffect(() => {
    if (!partA || !partB || !preserveSettings) {
      void autoAlignStraps();
    }
    // Preserve user transforms by default on strap changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, strapIndex, preserveSettings]);

  const onCycleStrap = (direction: 1 | -1) => {
    setStrapIndex((prev) => {
      const total = strapsInCategory.length;
      return (prev + direction + total) % total;
    });
  };

  const canRender = useMemo(
    () => Boolean(partA && partB && currentStrap),
    [partA, partB, currentStrap]
  );

  const setGapHalf = (nextHalfGap: number) => {
    if (!partA || !partB) return;
    const centerY = (partA.y + partB.y) / 2;
    const minHalfGap = 250;
    const maxHalfGap = 900;
    const boundedGap = clamp(nextHalfGap, minHalfGap, maxHalfGap);
    setPartA((prev) => (prev ? { ...prev, y: centerY - boundedGap } : prev));
    setPartB((prev) => (prev ? { ...prev, y: centerY + boundedGap } : prev));
  };

  const setStrapScale = (nextScale: number) => {
    const boundedScale = clamp(nextScale, 30, 250);
    setPartA((prev) => (prev ? { ...prev, scale: boundedScale } : prev));
    setPartB((prev) => (prev ? { ...prev, scale: boundedScale } : prev));
  };

  const setDialScaleValue = (nextScale: number) => {
    setDialScale(clamp(nextScale, 0.7, 1.35));
  };

  const strapGap = partA && partB ? (partB.y - partA.y) / 2 : 320;
  const strapScale = partA && partB ? (partA.scale + partB.scale) / 2 : 90;
  const strapSizeUi = strapScaleToUi(strapScale);

  return (
    <main className="mx-auto max-w-[96rem] px-6 py-10 md:px-10 md:py-12">
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">
          Watch Strap Visualizer
        </h1>
        <p className="mt-2 text-base text-muted">Inspiration Mode</p>
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="space-y-5">
          <ImageUploader
            id="watch"
            label="1. Upload Watch Dial Photo"
            previewUrl={watchPreviewSrc}
            onFileSelect={(file) => void onUploadDial(file, setWatchPreviewSrc)}
          />

          <div className="glass-card rounded-2xl p-6">
            <label htmlFor="strap-category" className="text-lg font-medium text-ink">
              2. Select Strap Category
            </label>
            <select
              id="strap-category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as StrapCategory);
                setStrapIndex(0);
              }}
              className="mt-3 w-full rounded-lg border border-line bg-white px-3 py-3 text-base text-ink"
            >
              {STRAP_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <div className="mt-4 rounded-xl border border-white/70 bg-white/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <p className="text-sm uppercase tracking-[0.12em] text-muted">Current Strap</p>
              <p className="mt-2 text-xl font-semibold text-ink">{currentStrap.label}</p>
              <p className="mt-2 text-sm text-muted">
                Use left/right arrows in preview to switch straps.
              </p>
            </div>

            <div className="neo-toggle mt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Keep Adjustments</p>
                <p className="text-xs text-muted">Apply current gap/size settings to next strap</p>
              </div>
              <button
                type="button"
                onClick={() => setPreserveSettings((prev) => !prev)}
                aria-pressed={preserveSettings}
                className={`relative h-8 w-14 rounded-full border transition ${
                  preserveSettings
                    ? "border-emerald-500/40 bg-emerald-400/30"
                    : "border-slate-300 bg-white/70"
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
                    preserveSettings ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void autoAlignStraps()}
                className="rounded-lg border border-line px-4 py-2.5 text-base text-ink transition hover:bg-canvas"
              >
                {isAutoAligning ? "Auto-aligning..." : "Re-center Strap"}
              </button>
              <button
                type="button"
                onClick={() => canvasRef.current?.downloadAsPng()}
                className="rounded-lg border border-ink bg-ink px-4 py-2.5 text-base text-white hover:opacity-90"
              >
                Download PNG
              </button>
            </div>

          </div>
        </aside>

        <section>
          <h2 className="mb-3 text-base font-medium uppercase tracking-[0.15em] text-muted">
            3. Live Preview
          </h2>
        {isCleaningDial ? (
          <div className="rounded-2xl border border-line bg-canvas p-4 text-sm text-muted">
            Cleaning uploaded dial background...
          </div>
        ) : null}

        {canRender ? (
          <CanvasPreview
            ref={canvasRef}
            watchSrc={watchSrc}
            strapASrc={currentStrap.strapASrc}
            strapBSrc={currentStrap.strapBSrc}
            partA={partA as PartTransform}
            partB={partB as PartTransform}
            style={currentStrap.tint}
            watchScale={dialScale}
            sceneZoom={sceneZoom}
            locked={lockView}
            onDragPartsChange={(nextA, nextB) => {
              setPartA(nextA);
              setPartB(nextB);
            }}
            onCycleStrap={onCycleStrap}
            controls={
              <div className="glass-card rounded-xl p-3">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                  Preview Controls
                </p>
                <div className="mt-2 grid gap-2">
                  <SliderControl
                    label="Strap Gap"
                    min={250}
                    max={900}
                    step={1}
                    value={strapGap}
                    onChange={setGapHalf}
                    disabled={lockView}
                  />
                  <SliderControl
                    label="Strap Size"
                    min={0}
                    max={100}
                    step={0.1}
                    value={strapSizeUi}
                    onChange={(uiVal) => setStrapScale(uiToStrapScale(uiVal))}
                    displayValue={Math.round(strapScale).toString()}
                    disabled={lockView}
                  />
                  <SliderControl
                    label="Dial Size"
                    min={0.7}
                    max={1.35}
                    step={0.01}
                    value={dialScale}
                    onChange={setDialScaleValue}
                    disabled={lockView}
                  />
                  <SliderControl
                    label="View Zoom"
                    min={0.62}
                    max={1.05}
                    step={0.01}
                    value={sceneZoom}
                    onChange={setSceneZoom}
                    displayValue={`${Math.round(sceneZoom * 100)}%`}
                  />
                  <ToggleControl
                    label="Lock View"
                    description="Freeze strap/dial transforms and only allow view zoom"
                    enabled={lockView}
                    onToggle={() => setLockView((prev) => !prev)}
                  />
                </div>
              </div>
            }
          />
        ) : (
          <div className="rounded-2xl border border-line bg-canvas p-4 text-sm text-muted">
            Upload a watch image to start previewing straps.
          </div>
        )}
        <p className="mt-3 text-sm text-muted">
          Visual inspiration only. Final fit depends on lug width &amp; strap model.
        </p>
        <p className="mt-1 text-xs text-muted">
          Auto background clean is best effort. Wrist/background photos may need manual crop for perfect results.
        </p>
        </section>
      </section>
    </main>
  );
}

interface SliderControlProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  displayValue?: string;
  disabled?: boolean;
}

function SliderControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
  displayValue,
  disabled
}: SliderControlProps) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-base font-medium text-ink">{label}</span>
        <span className="text-sm text-slate-600">
          {displayValue ?? (label === "Dial Size" ? `${Math.round(value * 100)}%` : Math.round(value))}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full"
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}

interface ToggleControlProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

function ToggleControl({ label, description, enabled, onToggle }: ToggleControlProps) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-medium text-ink">{label}</p>
          <p className="text-xs text-slate-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={enabled}
          className={`relative h-9 w-16 rounded-full border transition ${
            enabled
              ? "border-cyan-400/60 bg-gradient-to-r from-cyan-300/50 to-blue-300/50"
              : "border-slate-300 bg-slate-100"
          }`}
        >
          <span
            className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition ${
              enabled ? "left-8" : "left-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
