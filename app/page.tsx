"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CanvasPreview, { CanvasPreviewRef } from "@/components/CanvasPreview";
import ImageUploader from "@/components/ImageUploader";
import { calculateAutoPlacement, PartTransform } from "@/lib/compose";
import {
  STRAP_CATEGORIES,
  getStrapsForCategory,
  StrapCategory,
  StrapVariant
} from "@/lib/strapLibrary";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const STRAP_SCALE_MIN = 60;
const STRAP_SCALE_MAX = 165;
const strapScaleToUi = (scale: number) => {
  const t = clamp((scale - STRAP_SCALE_MIN) / (STRAP_SCALE_MAX - STRAP_SCALE_MIN), 0, 1);
  return Math.cbrt(t) * 100;
};
const uiToStrapScale = (uiValue: number) => {
  const t = clamp(uiValue / 100, 0, 1);
  return STRAP_SCALE_MIN + t * t * t * (STRAP_SCALE_MAX - STRAP_SCALE_MIN);
};

type AiToolKey = "cleanup" | "rescue" | "final" | "explore";

interface AiToolState {
  loading: boolean;
  error: string | null;
}

interface AiResult {
  title: string;
  description: string;
  imageDataUrl: string;
  downloadName: string;
}

const defaultToolState = (): Record<AiToolKey, AiToolState> => ({
  cleanup: { loading: false, error: null },
  rescue: { loading: false, error: null },
  final: { loading: false, error: null },
  explore: { loading: false, error: null }
});

const fileFromSrc = async (src: string, filename: string) => {
  const response = await fetch(src);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
};

const postToolForm = async (url: string, formData: FormData) => {
  const response = await fetch(url, {
    method: "POST",
    body: formData
  });
  const payload = (await response.json()) as { error?: string; imageDataUrl?: string };
  if (!response.ok || !payload.imageDataUrl) {
    throw new Error(payload.error || "AI tool failed");
  }
  return payload.imageDataUrl;
};

const formatAiError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "AI tool failed";
  if (message.includes("KIE_API_KEY is not configured")) {
    return "Kie API key is missing on this deployment. Add KIE_API_KEY in Netlify environment variables and redeploy.";
  }
  return message;
};

const downloadDataUrl = (dataUrl: string, fileName: string) => {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  anchor.click();
};

export default function Home() {
  const [watchSrc, setWatchSrc] = useState("/mock-dial.svg");
  const [watchPreviewSrc, setWatchPreviewSrc] = useState("/mock-dial.svg");
  const [originalWatchSrc, setOriginalWatchSrc] = useState<string | null>(null);
  const [uploadedWatchFile, setUploadedWatchFile] = useState<File | null>(null);
  const [category, setCategory] = useState<StrapCategory>("All categories");
  const [strapIndex, setStrapIndex] = useState(0);
  const [partA, setPartA] = useState<PartTransform | null>(null);
  const [partB, setPartB] = useState<PartTransform | null>(null);
  const [dialScale, setDialScale] = useState(1);
  const [sceneZoom, setSceneZoom] = useState(1);
  const [preserveSettings, setPreserveSettings] = useState(true);
  const [lockView, setLockView] = useState(false);
  const [isAutoAligning, setIsAutoAligning] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [aiTools, setAiTools] = useState<Record<AiToolKey, AiToolState>>(defaultToolState);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);

  const canvasRef = useRef<CanvasPreviewRef>(null);

  const strapsInCategory = getStrapsForCategory(category);
  const currentStrap: StrapVariant = strapsInCategory[strapIndex] ?? strapsInCategory[0];
  const hasUserUpload = Boolean(uploadedWatchFile && originalWatchSrc);
  const isAnyToolRunning = Object.values(aiTools).some((tool) => tool.loading);

  const onUploadDial = (file: File) => {
    const uploadedUrl = URL.createObjectURL(file);
    setUploadedWatchFile(file);
    setOriginalWatchSrc(uploadedUrl);
    setWatchPreviewSrc(uploadedUrl);
    setWatchSrc(uploadedUrl);
    setAiResult(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchSrc]);

  useEffect(() => {
    if (!partA || !partB || !preserveSettings) {
      void autoAlignStraps();
    }
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

  const setToolLoading = (tool: AiToolKey, loading: boolean, error: string | null = null) => {
    setAiTools((prev) => ({
      ...prev,
      [tool]: { loading, error }
    }));
  };

  const applyProcessedWatch = (nextSrc: string, title: string, description: string) => {
    setWatchSrc(nextSrc);
    setWatchPreviewSrc(nextSrc);
    setAiResult({
      title,
      description,
      imageDataUrl: nextSrc,
      downloadName: `${title.toLowerCase().replace(/\s+/g, "-")}.png`
    });
  };

  const runCleanupFallback = async () => {
    if (!uploadedWatchFile) return;
    setToolLoading("cleanup", true);
    try {
      const formData = new FormData();
      formData.append("image", uploadedWatchFile);
      const imageDataUrl = await postToolForm("/api/kie/cleanup", formData);
      applyProcessedWatch(
        imageDataUrl,
        "Dial Cleanup Fallback",
        "AI removed as much background as possible from the uploaded watch photo."
      );
      setToolLoading("cleanup", false);
    } catch (error) {
      setToolLoading("cleanup", false, formatAiError(error));
    }
  };

  const runRescueMode = async () => {
    if (!uploadedWatchFile) return;
    setToolLoading("rescue", true);
    try {
      const formData = new FormData();
      formData.append("image", uploadedWatchFile);
      const imageDataUrl = await postToolForm("/api/kie/rescue", formData);
      applyProcessedWatch(
        imageDataUrl,
        "User Upload Rescue Mode",
        "AI rebuilt a cleaner watch-head cutout for a better strap preview source."
      );
      setToolLoading("rescue", false);
    } catch (error) {
      setToolLoading("rescue", false, formatAiError(error));
    }
  };

  const runFinalRender = async () => {
    if (!canvasRef.current) return;
    setToolLoading("final", true);
    try {
      const previewBlob = await canvasRef.current.getPngBlob();
      if (!previewBlob) {
        throw new Error("Preview image was not available");
      }

      const formData = new FormData();
      formData.append("preview", new File([previewBlob], "preview.png", { type: "image/png" }));
      formData.append("watch", await fileFromSrc(watchSrc, "watch-source.png"));
      formData.append("strapA", await fileFromSrc(currentStrap.strapASrc, "strap-a.png"));
      formData.append("strapB", await fileFromSrc(currentStrap.strapBSrc, "strap-b.png"));
      formData.append("strapLabel", currentStrap.label);

      const imageDataUrl = await postToolForm("/api/kie/final-render", formData);
      setAiResult({
        title: "Final Photoreal Render",
        description:
          "AI generated a polished hero mockup using the current preview composition as the reference.",
        imageDataUrl,
        downloadName: "watch-strap-final-render.png"
      });
      setToolLoading("final", false);
    } catch (error) {
      setToolLoading("final", false, formatAiError(error));
    }
  };

  const runStyleExploration = async () => {
    setToolLoading("explore", true);
    try {
      const formData = new FormData();
      formData.append("strapA", await fileFromSrc(currentStrap.strapASrc, "strap-a.png"));
      formData.append("strapB", await fileFromSrc(currentStrap.strapBSrc, "strap-b.png"));
      formData.append("strapLabel", currentStrap.label);
      formData.append("category", currentStrap.category);

      const imageDataUrl = await postToolForm("/api/kie/style-explore", formData);
      setAiResult({
        title: "Style Exploration",
        description:
          "AI proposed one adjacent strap concept inspired by the currently selected library style.",
        imageDataUrl,
        downloadName: "watch-strap-style-exploration.png"
      });
      setToolLoading("explore", false);
    } catch (error) {
      setToolLoading("explore", false, formatAiError(error));
    }
  };

  const strapGap = partA && partB ? (partB.y - partA.y) / 2 : 320;
  const strapScale = partA && partB ? (partA.scale + partB.scale) / 2 : 90;
  const strapSizeUi = strapScaleToUi(strapScale);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("watch-theme") : null;
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      return;
    }
    if (typeof window !== "undefined") {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("watch-theme", theme);
  }, [theme]);

  return (
    <main className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-12">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Watch Strap Visualizer
          </h1>
          <p className="mt-2 text-base text-muted">Inspiration Mode</p>
        </div>
        <button
          type="button"
          onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
          className="glass-card rounded-xl px-4 py-2 text-sm font-medium text-ink"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? "Night Theme" : "Day Theme"}
        </button>
      </header>

      <section className="mt-6 grid gap-5 lg:mt-8 lg:grid-cols-[340px,1fr]">
        <aside className="space-y-5">
          <div className="glass-card rounded-2xl p-4 sm:p-6">
            <p className="text-lg font-medium text-ink">
              2. Select Strap Category
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STRAP_CATEGORIES.map((option) => {
                const active = option === category;
                const count = getStrapsForCategory(option).length;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setCategory(option);
                      setStrapIndex(0);
                    }}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]"
                        : "border-line bg-canvas text-ink hover:border-slate-300 hover:bg-white"
                    }`}
                    aria-pressed={active}
                  >
                    {option}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20 text-white" : "bg-slate-200/70 text-slate-700"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-line bg-canvas/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
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
                    : "border-line bg-canvas"
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
                className="rounded-lg border border-line bg-canvas px-4 py-2.5 text-base text-ink transition hover:opacity-90"
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
              {hasUserUpload && originalWatchSrc && watchSrc !== originalWatchSrc ? (
                <button
                  type="button"
                  onClick={() => {
                    setWatchSrc(originalWatchSrc);
                    setWatchPreviewSrc(originalWatchSrc);
                  }}
                  className="rounded-lg border border-line bg-canvas px-4 py-2.5 text-base text-ink transition hover:opacity-90"
                >
                  Restore Original Upload
                </button>
              ) : null}
            </div>
          </div>

          {aiResult ? (
            <div className="glass-card rounded-2xl p-4 sm:p-6">
              <p className="text-lg font-medium text-ink">{aiResult.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{aiResult.description}</p>
              <div className="mt-4 overflow-hidden rounded-xl border border-line bg-canvas">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={aiResult.imageDataUrl}
                  alt={aiResult.title}
                  className="h-auto w-full object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => downloadDataUrl(aiResult.imageDataUrl, aiResult.downloadName)}
                className="mt-4 rounded-lg border border-ink bg-ink px-4 py-2.5 text-base text-white hover:opacity-90"
              >
                Download AI Result
              </button>
            </div>
          ) : null}
        </aside>

        <section className="min-w-0">
          <h2 className="mb-3 text-base font-medium uppercase tracking-[0.15em] text-muted">
            4. Live Preview
          </h2>
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
                <div className="space-y-3">
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
                        step={0.02}
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
                        min={0.35}
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

                  <div className="glass-card rounded-xl p-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                      AI Tools
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      Cleanup and rescue replace the active dial source. Final render and style
                      exploration create separate result images.
                    </p>
                    <div className="mt-3 grid gap-2">
                      <ToolButton
                        title="Dial Cleanup"
                        description="Background-removal pass for cleaner retailer screenshots or isolated product photos."
                        disabled={!hasUserUpload}
                        loading={aiTools.cleanup.loading}
                        onClick={() => void runCleanupFallback()}
                      />
                      {aiTools.cleanup.error ? <ErrorText message={aiTools.cleanup.error} /> : null}

                      <ToolButton
                        title="Rescue Mode"
                        description="Rebuild a cleaner watch-head cutout from a messy wrist shot."
                        disabled={!hasUserUpload}
                        loading={aiTools.rescue.loading}
                        onClick={() => void runRescueMode()}
                      />
                      {aiTools.rescue.error ? <ErrorText message={aiTools.rescue.error} /> : null}

                      <ToolButton
                        title="Final Render"
                        description="Generate a polished hero mockup from the current preview composition."
                        disabled={!canRender}
                        loading={aiTools.final.loading}
                        onClick={() => void runFinalRender()}
                      />
                      {aiTools.final.error ? <ErrorText message={aiTools.final.error} /> : null}

                      <ToolButton
                        title="Style Explore"
                        description="Create one adjacent strap concept based on the current library selection."
                        disabled={!currentStrap}
                          loading={aiTools.explore.loading}
                          onClick={() => void runStyleExploration()}
                      />
                      {aiTools.explore.error ? <ErrorText message={aiTools.explore.error} /> : null}
                    </div>
                  </div>
                </div>
              }
            />
          ) : (
            <div className="rounded-2xl border border-line bg-canvas p-4 text-sm text-muted">
              Upload a watch image to start previewing straps.
            </div>
          )}
          <div className="mt-4">
            <ImageUploader
              id="watch"
              label="1. Upload Watch Dial Photo"
              helperText="Best results come from clear, front-facing watch photos on a plain background. Product shots or retailer website screenshots usually work best because the dial is centered and well lit."
              previewUrl={watchPreviewSrc}
              onFileSelect={onUploadDial}
              compact
            />
          </div>
          {isAnyToolRunning ? (
            <div className="glass-card ai-pulse mt-4 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="ai-orbit" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">AI tool running</p>
                  <p className="text-xs text-muted">
                    Generating the next result. This can take a few seconds.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <p className="mt-3 text-sm text-muted">
            Visual inspiration only. Final fit depends on lug width &amp; strap model.
          </p>
          <p className="mt-1 text-xs text-muted">
            AI cleanup tools are optional and work best on clear, front-facing product-style photos.
          </p>
        </section>
      </section>
    </main>
  );
}

function ErrorText({ message }: { message: string }) {
  return <p className="text-xs text-rose-600">{message}</p>;
}

function ToolButton({
  title,
  description,
  disabled,
  loading,
  onClick
}: {
  title: string;
  description: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-canvas p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-medium text-ink">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading}
          className={`rounded-lg border px-3 py-2 text-sm font-medium text-ink transition disabled:cursor-not-allowed disabled:opacity-50 ${
            loading
              ? "ai-pulse border-slate-300 bg-slate-100"
              : "border-line bg-white hover:bg-canvas"
          }`}
        >
          {loading ? "Running..." : "Run"}
        </button>
      </div>
    </div>
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
    <div className="rounded-lg border border-line bg-canvas p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-base font-medium text-ink">{label}</span>
        <span className="text-sm text-muted">
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

function ToggleControl({
  label,
  description,
  enabled,
  onToggle
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-canvas p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-medium text-ink">{label}</p>
          <p className="text-xs text-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={enabled}
          className={`relative h-9 w-16 rounded-full border transition ${
            enabled
              ? "border-cyan-400/60 bg-gradient-to-r from-cyan-300/50 to-blue-300/50"
              : "border-line bg-canvas"
          }`}
        >
          <span
            className={`absolute left-1 top-1 h-7 w-7 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-7" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
