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
  STRAP_LIBRARY,
  StrapCategory,
  StrapVariant
} from "@/lib/strapLibrary";

const STEPS = ["Upload Dial", "Select Strap Category", "Preview & Scroll"];

export default function Home() {
  const [watchSrc, setWatchSrc] = useState("/sample-watch.svg");
  const [watchPreviewSrc, setWatchPreviewSrc] = useState("/sample-watch.svg");
  const [category, setCategory] = useState<StrapCategory>("Leather");
  const [strapIndex, setStrapIndex] = useState(0);
  const [partA, setPartA] = useState<PartTransform | null>(null);
  const [partB, setPartB] = useState<PartTransform | null>(null);
  const [isAutoAligning, setIsAutoAligning] = useState(false);
  const [isCleaningDial, setIsCleaningDial] = useState(false);

  const canvasRef = useRef<CanvasPreviewRef>(null);

  const strapsInCategory = STRAP_LIBRARY[category];
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Watch Strap Visualizer
        </h1>
        <p className="mt-2 text-sm text-muted">Inspiration Mode</p>
      </header>

      <section className="mt-8">
        <Stepper currentStep={currentStep} steps={STEPS} />
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <ImageUploader
          id="watch"
          label="1. Upload Watch Dial Photo"
          previewUrl={watchPreviewSrc}
          onFileSelect={(file) => void onUploadDial(file, setWatchPreviewSrc)}
        />

        <div className="rounded-2xl border border-line p-5">
          <label htmlFor="strap-category" className="text-sm font-medium text-ink">
            2. Select Strap Category
          </label>
          <select
            id="strap-category"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as StrapCategory);
              setStrapIndex(0);
            }}
            className="mt-3 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
          >
            {STRAP_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <div className="mt-4 rounded-xl border border-line bg-canvas p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted">Current Strap</p>
            <p className="mt-1 text-sm font-semibold text-ink">{currentStrap.label}</p>
            <p className="mt-2 text-xs text-muted">
              Hover preview and scroll mouse wheel to cycle strap options in this category.
            </p>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => void autoAlignStraps()}
              className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition hover:bg-canvas"
            >
              {isAutoAligning ? "Auto-aligning..." : "Re-center Strap"}
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.downloadAsPng()}
              className="rounded-lg border border-ink bg-ink px-4 py-2 text-sm text-white hover:opacity-90"
            >
              Download PNG
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.15em] text-muted">
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
            onDragPartsChange={(nextA, nextB) => {
              setPartA(nextA);
              setPartB(nextB);
            }}
            onCycleStrap={onCycleStrap}
          />
        ) : (
          <div className="rounded-2xl border border-line bg-canvas p-4 text-sm text-muted">
            Upload a watch image to start previewing straps.
          </div>
        )}

        <p className="mt-3 text-sm text-muted">
          Visual inspiration only. Final fit depends on lug width &amp; strap model.
        </p>
      </section>
    </main>
  );
}
