"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import CanvasPreview, { CanvasPreviewRef } from "@/components/CanvasPreview";
import ImageUploader from "@/components/ImageUploader";
import Stepper from "@/components/Stepper";
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

const STEPS = ["Upload Dial", "Select Strap Category", "Preview & Scroll"];
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export default function Home() {
  const [watchSrc, setWatchSrc] = useState("/mock-dial.svg");
  const [watchPreviewSrc, setWatchPreviewSrc] = useState("/mock-dial.svg");
  const [category, setCategory] = useState<StrapCategory>("All categories");
  const [strapIndex, setStrapIndex] = useState(0);
  const [partA, setPartA] = useState<PartTransform | null>(null);
  const [partB, setPartB] = useState<PartTransform | null>(null);
  const [dialScale, setDialScale] = useState(1);
  const [isAutoAligning, setIsAutoAligning] = useState(false);
  const [isCleaningDial, setIsCleaningDial] = useState(false);

  const canvasRef = useRef<CanvasPreviewRef>(null);

  const strapsInCategory = getStrapsForCategory(category);
  const currentStrap: StrapVariant = strapsInCategory[strapIndex] ?? strapsInCategory[0];

  const currentStep = !watchSrc ? 1 : !currentStrap ? 2 : 3;

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
    // Recompute placement whenever dial or strap selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchSrc, category, strapIndex]);

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

  const adjustGap = (direction: "in" | "out") => {
    if (!partA || !partB) return;
    const centerY = (partA.y + partB.y) / 2;
    const halfGap = (partB.y - partA.y) / 2;
    const step = 18;
    const minHalfGap = 250;
    const maxHalfGap = 520;
    const nextHalfGap = clamp(
      halfGap + (direction === "in" ? -step : step),
      minHalfGap,
      maxHalfGap
    );
    setPartA((prev) => (prev ? { ...prev, y: centerY - nextHalfGap } : prev));
    setPartB((prev) => (prev ? { ...prev, y: centerY + nextHalfGap } : prev));
  };

  const adjustStrapScale = (direction: "in" | "out") => {
    const step = 5;
    const nextA = clamp((partA?.scale ?? 80) + (direction === "in" ? step : -step), 30, 230);
    const nextB = clamp((partB?.scale ?? 80) + (direction === "in" ? step : -step), 30, 230);
    setPartA((prev) => (prev ? { ...prev, scale: nextA } : prev));
    setPartB((prev) => (prev ? { ...prev, scale: nextB } : prev));
  };

  const adjustDialScale = (direction: "in" | "out") => {
    setDialScale((prev) => clamp(prev + (direction === "in" ? 0.05 : -0.05), 0.7, 1.35));
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 md:px-10 md:py-12">
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">
          Watch Strap Visualizer
        </h1>
        <p className="mt-2 text-base text-muted">Inspiration Mode</p>
      </header>

      <section className="mt-8">
        <Stepper currentStep={currentStep} steps={STEPS} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[380px,1fr]">
        <aside className="space-y-5">
          <ImageUploader
            id="watch"
            label="1. Upload Watch Dial Photo"
            previewUrl={watchPreviewSrc}
            onFileSelect={(file) => void onUploadDial(file, setWatchPreviewSrc)}
          />

          <div className="rounded-2xl border border-line p-6">
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

            <div className="mt-4 rounded-xl border border-line bg-canvas p-4">
              <p className="text-sm uppercase tracking-[0.12em] text-muted">Current Strap</p>
              <p className="mt-2 text-xl font-semibold text-ink">{currentStrap.label}</p>
              <p className="mt-2 text-sm text-muted">
                Hover preview and scroll to cycle straps with a clicky step motion.
              </p>
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
          <div className="mb-2 flex items-center justify-center gap-2 text-center text-sm font-medium text-muted">
            <button
              type="button"
              onClick={() => onCycleStrap(-1)}
              className="rounded-md border border-line px-2 py-1 text-base text-ink hover:bg-canvas"
              aria-label="Previous strap"
            >
              ↑
            </button>
            <span>Scroll Up / Down To Change Strap</span>
          </div>
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
            onDragPartsChange={(nextA, nextB) => {
              setPartA(nextA);
              setPartB(nextB);
            }}
            onCycleStrap={onCycleStrap}
            controls={
              <div className="rounded-xl border border-line bg-canvas p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  Preview Controls
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <ControlRow
                    label="Strap Gap"
                    onMinus={() => adjustGap("in")}
                    onPlus={() => adjustGap("out")}
                  />
                  <ControlRow
                    label="Strap Size"
                    onMinus={() => adjustStrapScale("out")}
                    onPlus={() => adjustStrapScale("in")}
                  />
                  <ControlRow
                    label="Dial Size"
                    onMinus={() => adjustDialScale("out")}
                    onPlus={() => adjustDialScale("in")}
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
          <div className="mt-2 flex items-center justify-center gap-2 text-center text-sm font-medium text-muted">
            <button
              type="button"
              onClick={() => onCycleStrap(1)}
              className="rounded-md border border-line px-2 py-1 text-base text-ink hover:bg-canvas"
              aria-label="Next strap"
            >
              ↓
            </button>
            <span>Scroll Up / Down To Change Strap</span>
          </div>

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

interface ControlRowProps {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
}

function ControlRow({ label, onMinus, onPlus }: ControlRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2">
      <span className="text-sm text-ink">{label}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onMinus}
          className="rounded-md border border-line px-2 py-1 text-sm text-ink hover:bg-canvas"
          aria-label={`${label} decrease`}
        >
          -
        </button>
        <button
          type="button"
          onClick={onPlus}
          className="rounded-md border border-line px-2 py-1 text-sm text-ink hover:bg-canvas"
          aria-label={`${label} increase`}
        >
          +
        </button>
      </div>
    </div>
  );
}
