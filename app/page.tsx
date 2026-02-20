"use client";

import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import CanvasPreview, { CanvasPreviewRef } from "@/components/CanvasPreview";
import ImageUploader from "@/components/ImageUploader";
import Stepper from "@/components/Stepper";
import {
  combineStrapParts,
  DEFAULT_PART_A,
  DEFAULT_PART_B,
  PartTransform,
  STRAP_STYLES
} from "@/lib/compose";

const createPart = (part: PartTransform): PartTransform => ({ ...part });
const DEFAULT_STYLE = STRAP_STYLES[0];

export default function Home() {
  const [watchSrc, setWatchSrc] = useState("/sample-watch.svg");
  const [strapASrc, setStrapASrc] = useState("/sample-strap-a.png");
  const [strapBSrc, setStrapBSrc] = useState("/sample-strap-b.png");
  const [combinedSrc, setCombinedSrc] = useState<string>("");
  const [partA, setPartA] = useState<PartTransform>(createPart(DEFAULT_PART_A));
  const [partB, setPartB] = useState<PartTransform>(createPart(DEFAULT_PART_B));
  const [combining, setCombining] = useState(false);

  const canvasRef = useRef<CanvasPreviewRef>(null);

  const currentStep = !watchSrc
    ? 1
    : !strapASrc || !strapBSrc
      ? 2
      : 3;

  const onUpload = (
    file: File,
    setter: Dispatch<SetStateAction<string>>
  ) => {
    const url = URL.createObjectURL(file);
    setter(url);
  };

  const updatePart = (
    which: "a" | "b",
    key: keyof PartTransform,
    value: number
  ) => {
    if (which === "a") {
      setPartA((prev) => ({ ...prev, [key]: value }));
      return;
    }
    setPartB((prev) => ({ ...prev, [key]: value }));
  };

  const onCombine = async () => {
    setCombining(true);
    try {
      const combined = await combineStrapParts(strapASrc, strapBSrc);
      setCombinedSrc(combined);
    } finally {
      setCombining(false);
    }
  };

  const onReset = () => {
    setPartA(createPart(DEFAULT_PART_A));
    setPartB(createPart(DEFAULT_PART_B));
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Watch Strap Visualizer
        </h1>
        <p className="mt-2 text-sm text-muted">Inspiration Mode</p>
      </header>

      <section className="mt-8">
        <Stepper currentStep={currentStep} />
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        <ImageUploader
          id="watch"
          label="1. Upload / Select Watch"
          previewUrl={watchSrc}
          onFileSelect={(file) => onUpload(file, setWatchSrc)}
        />

        <ImageUploader
          id="strap-a"
          label="2A. Upload Strap Part A (12 o'clock)"
          previewUrl={strapASrc}
          onFileSelect={(file) => onUpload(file, setStrapASrc)}
        />

        <ImageUploader
          id="strap-b"
          label="2B. Upload Strap Part B (6 o'clock)"
          previewUrl={strapBSrc}
          onFileSelect={(file) => onUpload(file, setStrapBSrc)}
        />
      </section>

      <section className="mt-5 rounded-2xl border border-line p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onCombine}
            className="rounded-lg border border-ink px-4 py-2 text-sm text-ink transition hover:bg-ink hover:text-white"
          >
            {combining ? "Combining..." : "Combine strap parts"}
          </button>
          <span className="text-xs text-muted">Creates a quick single strap reference.</span>
        </div>
        {combinedSrc ? (
          <div className="mt-4 flex items-center justify-center rounded-xl border border-line bg-canvas p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={combinedSrc}
              alt="Combined strap preview"
              className="max-h-44 w-auto rounded-md object-contain"
            />
          </div>
        ) : null}
      </section>

      <section className="mt-8 space-y-6">
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.15em] text-muted">
            3. Generate Preview
          </h2>
          <CanvasPreview
            ref={canvasRef}
            watchSrc={watchSrc}
            strapASrc={strapASrc}
            strapBSrc={strapBSrc}
            partA={partA}
            partB={partB}
            style={DEFAULT_STYLE}
          />
          <p className="mt-3 text-sm text-muted">
            Visual inspiration only. Final fit depends on lug width &amp; strap model.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-canvas"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => canvasRef.current?.downloadAsPng()}
              className="rounded-lg border border-ink bg-ink px-4 py-2 text-sm text-white hover:opacity-90"
            >
              Download Result as PNG
            </button>
          </div>
        </div>

        <aside className="grid gap-5 md:grid-cols-2">
          <ControlPanel
            title="Strap Part A (12 o'clock)"
            value={partA}
            onChange={(key, value) => updatePart("a", key, value)}
          />
          <ControlPanel
            title="Strap Part B (6 o'clock)"
            value={partB}
            onChange={(key, value) => updatePart("b", key, value)}
          />
        </aside>
      </section>
    </main>
  );
}

interface ControlPanelProps {
  title: string;
  value: PartTransform;
  onChange: (key: keyof PartTransform, value: number) => void;
}

function ControlPanel({ title, value, onChange }: ControlPanelProps) {
  const controls: Array<{
    key: keyof PartTransform;
    label: string;
    min: number;
    max: number;
    step: number;
  }> = [
    { key: "scale", label: "Scale", min: 30, max: 230, step: 1 },
    { key: "x", label: "X Position", min: -340, max: 340, step: 1 },
    { key: "y", label: "Y Position", min: -340, max: 340, step: 1 },
    { key: "rotation", label: "Rotation", min: -180, max: 180, step: 1 },
    { key: "opacity", label: "Opacity", min: 0.05, max: 1, step: 0.01 }
  ];

  return (
    <div className="rounded-2xl border border-line p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4 space-y-3">
        {controls.map((control) => (
          <label key={control.key} className="block">
            <div className="mb-1 text-xs">{control.label}</div>
            <input
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={value[control.key]}
              onChange={(e) => onChange(control.key, Number(e.target.value))}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
