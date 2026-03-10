"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CanvasPreview, { CanvasPreviewRef } from "@/components/CanvasPreview";
import CropEditor from "@/components/CropEditor";
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
const STRAP_SCALE_MIN = 5;
const STRAP_SCALE_MAX = 260;
const DIAL_SCALE_MIN = 0.7;
const DIAL_SCALE_MAX = 1.8;
const strapScaleToUi = (scale: number) => {
  const t = clamp((scale - STRAP_SCALE_MIN) / (STRAP_SCALE_MAX - STRAP_SCALE_MIN), 0, 1);
  return Math.cbrt(t) * 100;
};
const uiToStrapScale = (uiValue: number) => {
  const t = clamp(uiValue / 100, 0, 1);
  return STRAP_SCALE_MIN + t * t * t * (STRAP_SCALE_MAX - STRAP_SCALE_MIN);
};

const getAverageScale = (partA: PartTransform, partB: PartTransform) =>
  (partA.scale + partB.scale) / 2;

const applyScaleToPair = (
  partA: PartTransform,
  partB: PartTransform,
  targetAverageScale: number
) => {
  const boundedTarget = clamp(targetAverageScale, STRAP_SCALE_MIN, STRAP_SCALE_MAX);
  const currentAverage = getAverageScale(partA, partB);
  if (currentAverage <= 0) {
    return {
      partA: { ...partA, scale: boundedTarget },
      partB: { ...partB, scale: boundedTarget }
    };
  }

  const factor = boundedTarget / currentAverage;
  const minFactor = Math.max(STRAP_SCALE_MIN / partA.scale, STRAP_SCALE_MIN / partB.scale);
  const maxFactor = Math.min(STRAP_SCALE_MAX / partA.scale, STRAP_SCALE_MAX / partB.scale);
  const boundedFactor = clamp(factor, minFactor, maxFactor);
  return {
    partA: {
      ...partA,
      scale: partA.scale * boundedFactor
    },
    partB: {
      ...partB,
      scale: partB.scale * boundedFactor
    }
  };
};

const applyGapToPair = (
  partA: PartTransform,
  partB: PartTransform,
  nextHalfGap: number
) => {
  const centerY = (partA.y + partB.y) / 2;
  const boundedGap = clamp(nextHalfGap, 250, 900);
  return {
    partA: { ...partA, y: centerY - boundedGap },
    partB: { ...partB, y: centerY + boundedGap }
  };
};

type AiToolKey = "cleanup" | "rescue" | "final" | "explore";

interface AiToolState {
  loading: boolean;
  error: string | null;
}

interface ActiveAiStatus {
  tool: AiToolKey | null;
  label: string;
  stage: string;
}

interface GeneratedResultState {
  final: string | null;
  explore: string | null;
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
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const isImageFile = (file: File) => file.type.startsWith("image/");
const isTransientTimeoutLike = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes("inactivity timeout") ||
    lower.includes("timed out") ||
    lower.includes("failed to fetch") ||
    lower.includes("network error")
  );
};
const prepareAiInput = async (
  file: File,
  { maxSide, quality }: { maxSide: number; quality: number }
) => {
  if (!isImageFile(file)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const largest = Math.max(bitmap.width, bitmap.height);
    if (largest <= maxSide) return file;
    const ratio = maxSide / largest;
    const targetW = Math.max(1, Math.round(bitmap.width * ratio));
    const targetH = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((nextBlob) => resolve(nextBlob), "image/jpeg", quality)
    );
    if (!blob) return file;
    const stem = file.name.replace(/\.[^.]+$/, "") || "ai-upload";
    return new File([blob], `${stem}-ai.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
};

const toSnippet = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 240);
const toProxyPreviewSrc = (imageUrl: string) => {
  const value = imageUrl.trim();
  if (!/^https?:\/\//i.test(value)) return value;
  return `/api/kie/proxy-image?url=${encodeURIComponent(value)}`;
};

const getEndpointLabel = (url: string) => {
  if (url.includes("/rescue")) return "Rescue API";
  if (url.includes("/cleanup")) return "Cleanup API";
  if (url.includes("/final-render")) return "Final Render API";
  if (url.includes("/style-explore")) return "Style Explore API";
  return "AI API";
};

const postToolForm = async (url: string, formData: FormData) => {
  const response = await fetch(url, {
    method: "POST",
    body: formData
  });
  const endpointLabel = getEndpointLabel(url);
  const rawBody = await response.text();
  let payload: { error?: unknown; message?: unknown; imageUrl?: unknown } | null = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as { error?: unknown; message?: unknown; imageUrl?: unknown };
    } catch {
      payload = null;
    }
  }

  const payloadError =
    payload && typeof payload.error === "string" && payload.error.trim()
      ? payload.error.trim()
      : null;
  const payloadMessage =
    payload && typeof payload.message === "string" && payload.message.trim()
      ? payload.message.trim()
      : null;
  const textFallback = rawBody.trim() ? toSnippet(rawBody) : null;
  const httpFallback = response.status
    ? `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`
    : null;

  const bestError =
    payloadError || payloadMessage || textFallback || httpFallback || "AI tool failed";

  if (!response.ok) {
    throw new Error(`${endpointLabel}: ${bestError}`);
  }

  const imageUrl =
    payload && typeof payload.imageUrl === "string" ? payload.imageUrl.trim() : "";
  if (!imageUrl) {
    throw new Error(`${endpointLabel}: ${bestError}`);
  }
  return imageUrl;
};

const parseApiResponse = async (response: Response) => {
  const rawBody = await response.text();
  let payload: Record<string, unknown> | null = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      payload = null;
    }
  }

  const payloadError =
    payload && typeof payload.error === "string" && payload.error.trim()
      ? payload.error.trim()
      : null;
  const payloadMessage =
    payload && typeof payload.message === "string" && payload.message.trim()
      ? payload.message.trim()
      : null;
  const textFallback = rawBody.trim() ? toSnippet(rawBody) : null;
  const httpFallback = response.status
    ? `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`
    : null;

  const bestError =
    payloadError || payloadMessage || textFallback || httpFallback || "AI tool failed";
  return { payload, bestError };
};

const formatAiError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "AI tool failed";
  if (message.includes("KIE_API_KEY is not configured")) {
    return "Kie API key is missing on this deployment. Add KIE_API_KEY in Netlify environment variables and redeploy.";
  }
  if (message.includes("Failed to fetch")) {
    return "Network error while contacting AI service. Please retry once.";
  }
  if (message.includes("did not match the expected pattern")) {
    return "The AI provider returned an invalid image URL format. Please retry once; if it repeats, the provider response needs fallback handling.";
  }
  return message;
};

export default function Home() {
  const [watchSrc, setWatchSrc] = useState("/mock-dial.svg");
  const [watchPreviewSrc, setWatchPreviewSrc] = useState("/mock-dial.svg");
  const [originalWatchSrc, setOriginalWatchSrc] = useState<string | null>(null);
  const [originalWatchFile, setOriginalWatchFile] = useState<File | null>(null);
  const [uploadedWatchFile, setUploadedWatchFile] = useState<File | null>(null);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
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
  const [generatedResults, setGeneratedResults] = useState<GeneratedResultState>({
    final: null,
    explore: null
  });
  const [activeAiStatus, setActiveAiStatus] = useState<ActiveAiStatus>({
    tool: null,
    label: "",
    stage: ""
  });

  const canvasRef = useRef<CanvasPreviewRef>(null);

  const strapsInCategory = getStrapsForCategory(category);
  const currentStrap: StrapVariant = strapsInCategory[strapIndex] ?? strapsInCategory[0];
  const hasUserUpload = Boolean(uploadedWatchFile && originalWatchSrc);

  const onUploadDial = (file: File) => {
    const uploadedUrl = URL.createObjectURL(file);
    setOriginalWatchFile(file);
    setUploadedWatchFile(file);
    setOriginalWatchSrc(uploadedUrl);
    setWatchPreviewSrc(uploadedUrl);
    setWatchSrc(uploadedUrl);
    setCropSourceUrl(uploadedUrl);
  };

  const applyWatchAsset = (file: File, sourceUrl: string) => {
    setUploadedWatchFile(file);
    setWatchPreviewSrc(sourceUrl);
    setWatchSrc(sourceUrl);
  };

  const applyCroppedDial = (file: File, previewUrl: string) => {
    applyWatchAsset(file, previewUrl);
    setCropSourceUrl(null);
  };

  const autoAlignStraps = async () => {
    if (!currentStrap) return;
    setIsAutoAligning(true);
    try {
      let aligned = await calculateAutoPlacement(
        watchSrc,
        currentStrap.strapASrc,
        currentStrap.strapBSrc
      );

      if (partA && partB && preserveSettings) {
        const preservedHalfGap = (partB.y - partA.y) / 2;
        const preservedAverageScale = getAverageScale(partA, partB);
        aligned = applyScaleToPair(aligned.partA, aligned.partB, preservedAverageScale);
        aligned = applyGapToPair(aligned.partA, aligned.partB, preservedHalfGap);
      }

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
    void autoAlignStraps();
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
    const nextPair = applyGapToPair(partA, partB, nextHalfGap);
    setPartA(nextPair.partA);
    setPartB(nextPair.partB);
  };

  const setStrapScale = (nextScale: number) => {
    if (!partA || !partB) return;
    const nextPair = applyScaleToPair(partA, partB, nextScale);
    setPartA(nextPair.partA);
    setPartB(nextPair.partB);
  };

  const setDialScaleValue = (nextScale: number) => {
    setDialScale(clamp(nextScale, DIAL_SCALE_MIN, DIAL_SCALE_MAX));
  };

  const setToolLoading = (tool: AiToolKey, loading: boolean, error: string | null = null) => {
    setAiTools((prev) => ({
      ...prev,
      [tool]: { loading, error }
    }));
    if (!loading) {
      setActiveAiStatus((prev) => (prev.tool === tool ? { tool: null, label: "", stage: "" } : prev));
    }
  };

  const setAiStage = (tool: AiToolKey, label: string, stage: string) => {
    setActiveAiStatus({ tool, label, stage });
  };

  const applyProcessedWatch = (nextSrc: string) => {
    const previewSrc = toProxyPreviewSrc(nextSrc);
    setWatchSrc(previewSrc);
    setWatchPreviewSrc(previewSrc);
  };

  const runCleanupFallback = async () => {
    if (!uploadedWatchFile) return;
    setToolLoading("cleanup", true);
    try {
      setAiStage("cleanup", "Clean Photo", "Uploading");
      const preparedFile = await prepareAiInput(uploadedWatchFile, {
        maxSide: 1200,
        quality: 0.86
      });
      const formData = new FormData();
      formData.append("image", preparedFile);
      setAiStage("cleanup", "Clean Photo", "Removing background");
      const imageUrl = await postToolForm("/api/kie/cleanup", formData);
      setAiStage("cleanup", "Clean Photo", "Applying result");
      applyProcessedWatch(imageUrl);
      setToolLoading("cleanup", false);
    } catch (error) {
      setToolLoading("cleanup", false, formatAiError(error));
    }
  };

  const runRescueMode = async () => {
    if (!uploadedWatchFile) return;
    setToolLoading("rescue", true);
    try {
      setAiStage("rescue", "Fix Wrist Photo", "Uploading");
      const preparedFile = await prepareAiInput(uploadedWatchFile, {
        maxSide: 768,
        quality: 0.8
      });
      let startPayload: Record<string, unknown> = {};
      let startSucceeded = false;
      let lastStartError = "Rescue start failed.";

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const startForm = new FormData();
        startForm.append("image", preparedFile);
        const startResponse = await fetch("/api/kie/rescue/start", {
          method: "POST",
          body: startForm
        });
        setAiStage("rescue", "Fix Wrist Photo", "Generating watch");
        const startParsed = await parseApiResponse(startResponse);
        if (startResponse.ok) {
          startPayload = (startParsed.payload || {}) as Record<string, unknown>;
          startSucceeded = true;
          break;
        }

        lastStartError = startParsed.bestError;
        if (attempt < 2 && isTransientTimeoutLike(startParsed.bestError)) {
          await sleep(1200 * (attempt + 1));
          continue;
        }
        throw new Error(`Rescue API: ${startParsed.bestError}`);
      }

      if (!startSucceeded) {
        throw new Error(`Rescue API: ${lastStartError}`);
      }

      const generationTaskId =
        typeof startPayload.generationTaskId === "string"
          ? startPayload.generationTaskId
          : "";
      if (!generationTaskId) {
        throw new Error("Rescue API: Missing generation task id.");
      }

      let imageUrl = "";
      const maxPolls = 180;
      let transientPollErrors = 0;
      for (let attempt = 0; attempt < maxPolls; attempt += 1) {
        await sleep(2000);
        setAiStage("rescue", "Fix Wrist Photo", "Refining cutout");
        let pollResponse: Response;
        try {
          pollResponse = await fetch("/api/kie/rescue/poll", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ generationTaskId })
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Network error";
          if (isTransientTimeoutLike(message) && transientPollErrors < 6) {
            transientPollErrors += 1;
            continue;
          }
          throw new Error(`Rescue API: ${message}`);
        }

        const pollParsed = await parseApiResponse(pollResponse);
        if (!pollResponse.ok) {
          if (isTransientTimeoutLike(pollParsed.bestError) && transientPollErrors < 6) {
            transientPollErrors += 1;
            continue;
          }
          throw new Error(`Rescue API: ${pollParsed.bestError}`);
        }
        transientPollErrors = 0;
        const pollPayload = pollParsed.payload || {};
        const status = typeof pollPayload.status === "string" ? pollPayload.status : "";

        if (status === "completed" && typeof pollPayload.imageUrl === "string") {
          imageUrl = pollPayload.imageUrl.trim();
          break;
        }
      }

      if (!imageUrl) {
        throw new Error(
          "Rescue API: Timed out waiting for AI output. Please retry with a cleaner front-facing photo."
        );
      }

      setAiStage("rescue", "Fix Wrist Photo", "Applying result");
      applyProcessedWatch(imageUrl);
      setToolLoading("rescue", false);
    } catch (error) {
      setToolLoading("rescue", false, formatAiError(error));
    }
  };

  const runFinalRender = async () => {
    if (!canvasRef.current) return;
    setToolLoading("final", true);
    try {
      setAiStage("final", "Product Mockup", "Packaging preview");
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

      setAiStage("final", "Product Mockup", "Rendering buckled display");
      const imageUrl = await postToolForm("/api/kie/final-render", formData);
      setGeneratedResults((prev) => ({ ...prev, final: imageUrl }));
      setToolLoading("final", false);
    } catch (error) {
      setToolLoading("final", false, formatAiError(error));
    }
  };

  const runStyleExploration = async () => {
    setToolLoading("explore", true);
    try {
      setAiStage("explore", "More Like This", "Preparing references");
      const formData = new FormData();
      formData.append("strapA", await fileFromSrc(currentStrap.strapASrc, "strap-a.png"));
      formData.append("strapB", await fileFromSrc(currentStrap.strapBSrc, "strap-b.png"));
      formData.append("strapLabel", currentStrap.label);
      formData.append("category", currentStrap.category);

      setAiStage("explore", "More Like This", "Generating option");
      const imageUrl = await postToolForm("/api/kie/style-explore", formData);
      setGeneratedResults((prev) => ({ ...prev, explore: imageUrl }));
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

      <section className="mt-4">
        <ImageUploader
          id="watch"
          label="1. Upload Watch Dial Photo"
          helperText="Front-facing watch photos work best. Product-page screenshots usually give the cleanest result."
          previewUrl={watchPreviewSrc}
          onFileSelect={onUploadDial}
          compact
        />
        {cropSourceUrl && originalWatchFile ? (
          <div className="mt-4">
            <CropEditor
              file={originalWatchFile}
              sourceUrl={cropSourceUrl}
              onApply={applyCroppedDial}
            />
          </div>
        ) : null}
      </section>

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
                    data-testid={`category-${option.toLowerCase().replace(/\s+/g, "-")}`}
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

            <div className="mt-4 rounded-xl border border-line bg-canvas/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                Straps In {category}
              </p>
              <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                {strapsInCategory.map((strap, index) => {
                  const active = index === strapIndex;
                  return (
                    <button
                      key={strap.id}
                      type="button"
                      onClick={() => setStrapIndex(index)}
                      data-testid={`strap-${strap.id}`}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white shadow-[0_8px_20px_rgba(15,23,42,0.25)]"
                          : "border-line bg-white/70 text-ink hover:bg-white"
                      }`}
                      aria-pressed={active}
                    >
                      <p className="text-sm font-medium">{strap.label}</p>
                      {category === "All categories" ? (
                        <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-white/20 text-white" : "bg-slate-200/70 text-slate-700"}`}>
                          {strap.category}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
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
                    if (originalWatchFile && originalWatchSrc) {
                      setUploadedWatchFile(originalWatchFile);
                      setCropSourceUrl(originalWatchSrc);
                    }
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
                        step={10}
                        value={strapGap}
                        onChange={setGapHalf}
                        disabled={lockView}
                      />
                      <SliderControl
                        label="Strap Size"
                        min={0}
                        max={100}
                        step={1}
                        value={strapSizeUi}
                        onChange={(uiVal) => setStrapScale(uiToStrapScale(uiVal))}
                        displayValue={Math.round(strapScale).toString()}
                        disabled={lockView}
                      />
                      <SliderControl
                        label="Dial Size"
                        min={DIAL_SCALE_MIN}
                        max={DIAL_SCALE_MAX}
                        step={0.02}
                        value={dialScale}
                        onChange={setDialScaleValue}
                        disabled={lockView}
                      />
                      <SliderControl
                        label="View Zoom"
                        min={0.2}
                        max={1.4}
                        step={0.02}
                        value={sceneZoom}
                        onChange={setSceneZoom}
                        displayValue={`${Math.round(sceneZoom * 100)}%`}
                      />
                      <ToggleControl
                        label="Lock Position"
                        description="Freeze strap and dial placement while you only zoom the view"
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
                      Clean Photo and Fix Wrist Photo update the watch image in preview. Product
                      Mockup and More Like This create separate AI images.
                    </p>
                    {activeAiStatus.tool ? (
                      <CompactAiStatus label={activeAiStatus.label} stage={activeAiStatus.stage} />
                    ) : null}
                    <div className="mt-3 grid gap-2">
                      <ToolButton
                        title="Clean Photo"
                        description="Removes most of the background from a clean product-style watch photo."
                        disabled={!hasUserUpload}
                        loading={aiTools.cleanup.loading}
                        onClick={() => void runCleanupFallback()}
                      />
                      {aiTools.cleanup.error ? <ErrorText message={aiTools.cleanup.error} /> : null}

                      <ToolButton
                        title="Fix Wrist Photo"
                        description="Tries to pull just the watch from a casual wrist photo."
                        disabled={!hasUserUpload}
                        loading={aiTools.rescue.loading}
                        onClick={() => void runRescueMode()}
                      />
                      {aiTools.rescue.error ? <ErrorText message={aiTools.rescue.error} /> : null}

                      <ToolButton
                        title="Product Mockup"
                        description="Shows your watch and strap together like a retailer product display."
                        disabled={!canRender}
                        loading={aiTools.final.loading}
                        onClick={() => void runFinalRender()}
                      />
                      {generatedResults.final ? (
                        <ResultActions url={generatedResults.final} label="Open mockup" />
                      ) : null}
                      {aiTools.final.error ? <ErrorText message={aiTools.final.error} /> : null}

                      <ToolButton
                        title="More Like This"
                        description="Creates another strap idea inspired by the current one."
                        disabled={!currentStrap}
                        loading={aiTools.explore.loading}
                        onClick={() => void runStyleExploration()}
                      />
                      {generatedResults.explore ? (
                        <ResultActions url={generatedResults.explore} label="Open idea" />
                      ) : null}
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

function CompactAiStatus({ label, stage }: { label: string; stage: string }) {
  return (
    <div className="compact-ai-status mt-3 flex items-center gap-3 rounded-2xl px-3 py-2">
      <div className="ai-orbit ai-orbit--small" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{label}</p>
        <p className="text-xs text-muted">{stage}</p>
      </div>
    </div>
  );
}

function ResultActions({ url, label }: { url: string; label: string }) {
  return (
    <div className="ml-1 flex gap-2">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="neo-button rounded-xl px-3 py-2 text-sm font-medium text-ink"
      >
        {label}
      </a>
      <a
        href={url}
        download
        className="neo-button rounded-xl px-3 py-2 text-sm font-medium text-ink"
      >
        Download
      </a>
    </div>
  );
}

function ErrorText({ message }: { message: string }) {
  return <p className="text-xs text-rose-600">{message}</p>;
}

const snapToStep = (value: number, min: number, step: number) => {
  if (step <= 0) return value;
  const snapped = Math.round((value - min) / step) * step + min;
  return Number(snapped.toFixed(4));
};

const pulseHaptic = () => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(8);
  }
};

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
    <div className="neo-control rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-ink">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading}
          className={`neo-button min-w-[88px] rounded-xl px-4 py-2.5 text-sm font-semibold text-ink transition disabled:cursor-not-allowed disabled:opacity-50 ${
            loading
              ? "ai-pulse border-slate-300/80 bg-slate-100"
              : "hover:opacity-90"
          }`}
        >
          {loading ? "Working" : "Run"}
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
  const lastSnapRef = useRef<number>(snapToStep(value, min, step));

  useEffect(() => {
    lastSnapRef.current = snapToStep(value, min, step);
  }, [value, min, step]);

  const handleValueChange = (nextRawValue: number) => {
    const snapped = clamp(snapToStep(nextRawValue, min, step), min, max);
    if (snapped !== lastSnapRef.current) {
      pulseHaptic();
      lastSnapRef.current = snapped;
    }
    onChange(snapped);
  };

  return (
    <div className="neo-control rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-lg font-semibold text-ink">{label}</span>
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
        onChange={(event) => handleValueChange(Number(event.target.value))}
        onPointerUp={() => pulseHaptic()}
        className="range-slider range-slider--stepped"
        disabled={disabled}
        aria-label={label}
      />
      <div className="range-ticks mt-3" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
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
    <div className="neo-control rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-ink">{label}</p>
          <p className="text-sm text-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={enabled}
          className={`relative h-12 w-20 rounded-full border transition ${
            enabled
              ? "border-cyan-400/60 bg-gradient-to-r from-cyan-300/60 to-blue-300/60"
              : "border-line bg-canvas shadow-[inset_6px_6px_12px_rgba(15,23,42,0.12),inset_-6px_-6px_12px_rgba(255,255,255,0.45)]"
          }`}
        >
          <span
            className={`absolute left-1 top-1 h-9 w-9 rounded-full bg-white shadow-[0_10px_18px_rgba(15,23,42,0.18)] transition-transform ${
              enabled ? "translate-x-9" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
