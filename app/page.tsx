"use client";

import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import CanvasPreview, { CanvasPreviewRef } from "@/components/CanvasPreview";
import CropEditor from "@/components/CropEditor";
import ImageUploader from "@/components/ImageUploader";
import StrapSplitEditor from "@/components/StrapSplitEditor";
import {
  CANVAS_SIZE,
  calculateAutoPlacement,
  detectPreviewLugGuides,
  loadStrapImage,
  PartTransform,
  PreviewLugGuideOverrides,
  PreviewLugGuides,
  renderWatchOnlyComposition
} from "@/lib/compose";
import {
  STRAP_CATEGORIES,
  getStrapsForCategory,
  StrapCategory,
  StrapVariant
} from "@/lib/strapLibrary";
import type { SimilarProductCard } from "@/lib/shopping";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const STRAP_SCALE_MIN = 5;
const STRAP_SCALE_MAX = 260;
const DIAL_SCALE_MIN = 0.7;
const DIAL_SCALE_MAX = 1.8;
const DEFAULT_WATCH_PREVIEW_SCALE = 0.64;
const DEFAULT_SCENE_ZOOM = 0.75;
const DEFAULT_STRAP_AUTO_FIT_WIDTH_FACTOR = 0.28;
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

const applyCenterToPair = (
  partA: PartTransform,
  partB: PartTransform,
  nextCenterX: number,
  nextCenterY: number
) => {
  const currentCenterX = (partA.x + partB.x) / 2;
  const currentCenterY = (partA.y + partB.y) / 2;
  const deltaX = nextCenterX - currentCenterX;
  const deltaY = nextCenterY - currentCenterY;
  return {
    partA: { ...partA, x: partA.x + deltaX, y: partA.y + deltaY },
    partB: { ...partB, x: partB.x + deltaX, y: partB.y + deltaY }
  };
};

type AiToolKey = "cleanup" | "rescue" | "final";
type StrapSourceMode = "library" | "uploaded";
type FitState = "auto" | "adjusted" | "locked";
type GuideDragMode = "move" | "resize-left" | "resize-right";

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
}

interface UploadGuideItem {
  title: string;
  verdict: string;
  tone: "ideal" | "good" | "weak" | "avoid";
  imageSrc: string;
}

interface StrapThumbProps {
  strap: StrapVariant;
  active: boolean;
  showCategory: boolean;
  onClick: () => void;
}

interface UploadedSplitPart {
  file: File;
  url: string;
}

const defaultToolState = (): Record<AiToolKey, AiToolState> => ({
  cleanup: { loading: false, error: null },
  rescue: { loading: false, error: null },
  final: { loading: false, error: null }
});

const CONTROL_COACHMARK_STORAGE_KEY = "watchstrapper-gap-size-coachmark-seen";
const LUG_GUIDE_TIP_STORAGE_KEY = "watchstrapper-lug-guide-tip-seen";
const BOUTIQUE_PRIORITY = [
  "sapphire",
  "emerald",
  "oxblood",
  "aubergine",
  "mustard",
  "jaipur",
  "indigo",
  "holi",
  "oaxaca",
  "talavera",
  "bourbon",
  "taupe",
  "forest",
  "slate",
  "seatbelt",
  "bond",
  "stripe",
  "nato"
];

const getStrapSortScore = (strap: StrapVariant) => {
  const haystack = `${strap.id} ${strap.label}`.toLowerCase();
  const priorityIndex = BOUTIQUE_PRIORITY.findIndex((token) => haystack.includes(token));
  return priorityIndex === -1 ? BOUTIQUE_PRIORITY.length : priorityIndex;
};

const ALL_CATEGORY_PRIORITY: StrapCategory[] = [
  "Fabric",
  "Leather",
  "Rubber",
  "Metal",
  "Women"
];

const fileFromSrc = async (src: string, filename: string) => {
  const response = await fetch(src);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
};
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const isImageFile = (file: File) => file.type.startsWith("image/");
const saveBlob = async (blob: Blob, filename: string) => {
  if (typeof window === "undefined") return;
  const picker = (window as Window & {
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  }).showSaveFilePicker;

  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [
          {
            description: "PNG image",
            accept: { "image/png": [".png"] }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch {
      // Fall back to browser download if the picker is cancelled or unsupported.
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const saveUrlAsPng = async (url: string, filename: string) => {
  const response = await fetch(toProxyPreviewSrc(url));
  const blob = await response.blob();
  await saveBlob(blob, filename);
};

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

const prepareSrcForAi = async (
  src: string,
  filename: string,
  options: { maxSide: number; quality: number }
) => {
  const file = await fileFromSrc(src, filename);
  return prepareAiInput(file, options);
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

const startPolledTask = async (url: string, formData: FormData) => {
  const response = await fetch(url, {
    method: "POST",
    body: formData
  });
  const parsed = await parseApiResponse(response);
  const endpointLabel = getEndpointLabel(url);
  if (!response.ok) {
    throw new Error(`${endpointLabel}: ${parsed.bestError}`);
  }
  const taskId =
    parsed.payload && typeof parsed.payload.taskId === "string" ? parsed.payload.taskId.trim() : "";
  if (!taskId) {
    throw new Error(`${endpointLabel}: Missing task id.`);
  }
  return taskId;
};

const pollTaskResult = async (
  url: string,
  taskId: string,
  { maxPolls = 180, delayMs = 2000 }: { maxPolls?: number; delayMs?: number } = {}
) => {
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    await sleep(delayMs);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId })
    });
    const parsed = await parseApiResponse(response);
    const endpointLabel = getEndpointLabel(url);
    if (!response.ok) {
      throw new Error(`${endpointLabel}: ${parsed.bestError}`);
    }
    const payload = parsed.payload || {};
    const status = typeof payload.status === "string" ? payload.status : "";
    if (status === "completed" && typeof payload.imageUrl === "string" && payload.imageUrl.trim()) {
      return payload.imageUrl.trim();
    }
  }
  throw new Error(`${getEndpointLabel(url)}: Timed out waiting for AI output.`);
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

const UPLOAD_GUIDE_ITEMS: UploadGuideItem[] = [
  {
    title: "Ideal",
    verdict: "Best results",
    tone: "ideal",
    imageSrc: "/upload-guide/ideal-straight.webp"
  },
  {
    title: "Good",
    verdict: "Usually workable",
    tone: "good",
    imageSrc: "/upload-guide/straight-noisy.webp"
  },
  {
    title: "Difficult",
    verdict: "Needs fixing",
    tone: "weak",
    imageSrc: "/upload-guide/too-rotated.webp"
  },
  {
    title: "Skip It",
    verdict: "Do not upload",
    tone: "avoid",
    imageSrc: "/upload-guide/dont-even-try.webp"
  }
];

function UploadGuideCard({ item }: { item: UploadGuideItem }) {
  const shellTone =
    item.tone === "ideal"
      ? "from-emerald-50 to-cyan-50 border-emerald-200"
      : item.tone === "good"
        ? "from-sky-50 to-slate-50 border-sky-200"
        : item.tone === "weak"
          ? "from-amber-50 to-stone-50 border-amber-200"
          : "from-rose-50 to-stone-50 border-rose-200";

  const chipTone =
    item.tone === "ideal"
      ? "bg-emerald-600/10 text-emerald-700"
      : item.tone === "good"
        ? "bg-sky-600/10 text-sky-700"
        : item.tone === "weak"
          ? "bg-amber-600/10 text-amber-700"
          : "bg-rose-600/10 text-rose-700";

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${shellTone} p-2`}>
      <div className="rounded-[1rem] border border-white/70 bg-white/85 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <div className="relative h-20 overflow-hidden rounded-[0.85rem] bg-[linear-gradient(160deg,#f9fafb,#eef2f7)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageSrc}
            alt={`${item.title} upload example`}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
      <div className="mt-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-slate-900">{item.title}</p>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${chipTone}`}>
            {item.verdict}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [watchSrc, setWatchSrc] = useState("/mock-dial.svg");
  const [watchPreviewSrc, setWatchPreviewSrc] = useState("");
  const [originalWatchSrc, setOriginalWatchSrc] = useState<string | null>(null);
  const [originalWatchFile, setOriginalWatchFile] = useState<File | null>(null);
  const [uploadedWatchFile, setUploadedWatchFile] = useState<File | null>(null);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [strapSourceMode, setStrapSourceMode] = useState<StrapSourceMode>("library");
  const [uploadedStrapSheetFile, setUploadedStrapSheetFile] = useState<File | null>(null);
  const [uploadedStrapSheetUrl, setUploadedStrapSheetUrl] = useState<string | null>(null);
  const [strapSplitSourceUrl, setStrapSplitSourceUrl] = useState<string | null>(null);
  const [uploadedStrapPartA, setUploadedStrapPartA] = useState<UploadedSplitPart | null>(null);
  const [uploadedStrapPartB, setUploadedStrapPartB] = useState<UploadedSplitPart | null>(null);
  const [category, setCategory] = useState<StrapCategory>("All categories");
  const [strapIndex, setStrapIndex] = useState(0);
  const [hasSelectedLibraryStrap, setHasSelectedLibraryStrap] = useState(false);
  const [partA, setPartA] = useState<PartTransform | null>(null);
  const [partB, setPartB] = useState<PartTransform | null>(null);
  const [dialScale, setDialScale] = useState(DEFAULT_WATCH_PREVIEW_SCALE);
  const [sceneZoom, setSceneZoom] = useState(DEFAULT_SCENE_ZOOM);
  const [preserveSettings, setPreserveSettings] = useState(true);
  const [lockView, setLockView] = useState(false);
  const [fitState, setFitState] = useState<FitState>("auto");
  const [fitConfidence, setFitConfidence] = useState(0);
  const [showFitBench, setShowFitBench] = useState(false);
  const [isAutoAligning, setIsAutoAligning] = useState(false);
  const [aiTools, setAiTools] = useState<Record<AiToolKey, AiToolState>>(defaultToolState);
  const [generatedResults, setGeneratedResults] = useState<GeneratedResultState>({
    final: null
  });
  const [inlineMockupUrl, setInlineMockupUrl] = useState<string | null>(null);
  const [showUploadGuide, setShowUploadGuide] = useState(false);
  const [highlightUploadGuide, setHighlightUploadGuide] = useState(true);
  const [highlightPreviewWindow, setHighlightPreviewWindow] = useState(false);
  const [hasAutoOpenedUploadGuide, setHasAutoOpenedUploadGuide] = useState(false);
  const [showControlCoachmark, setShowControlCoachmark] = useState(false);
  const [lugGuideOverrides, setLugGuideOverrides] = useState<PreviewLugGuideOverrides | null>(null);
  const [showLugGuides, setShowLugGuides] = useState(true);
  const [showLugGuideOnboarding, setShowLugGuideOnboarding] = useState(false);
  const [similarProducts, setSimilarProducts] = useState<SimilarProductCard[]>([]);
  const [similarProductsLoading, setSimilarProductsLoading] = useState(false);
  const [mockupReadyHighlight, setMockupReadyHighlight] = useState(false);
  const [animateDrawerReveal, setAnimateDrawerReveal] = useState(false);
  const [animateStrapSettle, setAnimateStrapSettle] = useState(false);
  const [activeAiStatus, setActiveAiStatus] = useState<ActiveAiStatus>({
    tool: null,
    label: "",
    stage: ""
  });

  const canvasRef = useRef<CanvasPreviewRef>(null);
  const previewSectionRef = useRef<HTMLElement | null>(null);
  const changeWatchInputRef = useRef<HTMLInputElement>(null);
  const strapUploadInputRef = useRef<HTMLInputElement>(null);
  const latestPartARef = useRef<PartTransform | null>(null);
  const latestPartBRef = useRef<PartTransform | null>(null);
  const preserveSettingsRef = useRef(true);
  const lockViewRef = useRef(false);
  const previousDialScaleRef = useRef(dialScale);
  const mockupReadyTimeoutRef = useRef<number | null>(null);
  const strapSettleTimeoutRef = useRef<number | null>(null);
  const drawerRevealTimeoutRef = useRef<number | null>(null);
  const firstRenderedStrapRef = useRef(false);

  const clearMockupReadyHighlight = () => {
    setMockupReadyHighlight(false);
    if (mockupReadyTimeoutRef.current) {
      window.clearTimeout(mockupReadyTimeoutRef.current);
      mockupReadyTimeoutRef.current = null;
    }
  };

  const handleLugGuidesChange = (nextOverrides: PreviewLugGuideOverrides) => {
    setLugGuideOverrides((prev) => {
      if (!Object.keys(nextOverrides).length) return null;
      const merged = { ...(prev ?? {}), ...nextOverrides };
      const syncedWidth =
        nextOverrides.topWidth ?? nextOverrides.bottomWidth ?? merged.topWidth ?? merged.bottomWidth;
      if (typeof syncedWidth === "number") {
        merged.topWidth = syncedWidth;
        merged.bottomWidth = syncedWidth;
      }
      if (typeof merged.centerX !== "number") {
        delete merged.centerX;
      }
      return merged;
    });
    setFitState(lockViewRef.current ? "locked" : "adjusted");
  };

  const dismissLugGuideOnboarding = () => {
    setShowLugGuideOnboarding(false);
    try {
      window.localStorage.setItem(LUG_GUIDE_TIP_STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures and just hide it for the current session.
    }
  };

  const strapsInCategory = useMemo(() => {
    const straps = [...getStrapsForCategory(category)];
    return straps.sort((a, b) => {
      if (category === "All categories") {
        const categoryDiff =
          ALL_CATEGORY_PRIORITY.indexOf(a.category) - ALL_CATEGORY_PRIORITY.indexOf(b.category);
        if (categoryDiff !== 0) return categoryDiff;
      }
      const scoreDiff = getStrapSortScore(a) - getStrapSortScore(b);
      if (scoreDiff !== 0) return scoreDiff;
      return a.label.localeCompare(b.label);
    });
  }, [category]);
  const currentStrap: StrapVariant = strapsInCategory[strapIndex] ?? strapsInCategory[0];
  const hasUserUpload = Boolean(uploadedWatchFile && originalWatchSrc);
  const hasUploadedStrap = Boolean(uploadedStrapPartA && uploadedStrapPartB);
  const activeLibraryStrap = hasSelectedLibraryStrap ? currentStrap : null;
  const activeStrapASrc =
    strapSourceMode === "uploaded" && uploadedStrapPartA ? uploadedStrapPartA.url : activeLibraryStrap?.strapASrc;
  const activeStrapBSrc =
    strapSourceMode === "uploaded" && uploadedStrapPartB ? uploadedStrapPartB.url : activeLibraryStrap?.strapBSrc;
  const activeStrapLabel =
    strapSourceMode === "uploaded" ? "Your Strap" : activeLibraryStrap?.label || "Selected strap";
  const activeJoinShape = strapSourceMode === "uploaded" ? "flat" : activeLibraryStrap?.joinShape;
  const activeAutoFitWidthFactor =
    strapSourceMode === "uploaded"
      ? DEFAULT_STRAP_AUTO_FIT_WIDTH_FACTOR
      : activeLibraryStrap?.autoFitWidthFactor ?? DEFAULT_STRAP_AUTO_FIT_WIDTH_FACTOR;
  const activeAutoGapFactor =
    strapSourceMode === "uploaded" ? undefined : activeLibraryStrap?.autoGapFactor;
  const canRender = useMemo(
    () => Boolean(partA && partB && activeStrapASrc && activeStrapBSrc),
    [partA, partB, activeStrapASrc, activeStrapBSrc]
  );
  const canShowLiveLugGuides = showLugGuides && !lockView && firstRenderedStrapRef.current;
  const canShowWatchOnlyPreview = hasUserUpload && !canRender;
  const previewStageTitle = canRender
    ? "3. Live Preview"
    : cropSourceUrl
      ? "1. Crop your watch"
      : canShowWatchOnlyPreview
        ? "1. Watch head view"
        : "";
  const previewStageHint = canRender
    ? "Your strap is on the bench. Lock the fit, save the view, or open the bench if you want to refine."
    : cropSourceUrl
      ? "Frame the watch in this same stage, then apply the crop."
      : canShowWatchOnlyPreview
        ? "Your watch is ready. Line up the lug guides if needed, then pick a strap."
        : "";

  const triggerDrawerReveal = () => {
    setAnimateDrawerReveal(false);
    window.requestAnimationFrame(() => {
      setAnimateDrawerReveal(true);
      if (drawerRevealTimeoutRef.current) {
        window.clearTimeout(drawerRevealTimeoutRef.current);
      }
      drawerRevealTimeoutRef.current = window.setTimeout(() => {
        setAnimateDrawerReveal(false);
        drawerRevealTimeoutRef.current = null;
      }, 700);
    });
  };

  useEffect(() => {
    latestPartARef.current = partA;
    latestPartBRef.current = partB;
  }, [partA, partB]);

  useEffect(() => {
    preserveSettingsRef.current = preserveSettings;
  }, [preserveSettings]);

  useEffect(() => {
    lockViewRef.current = lockView;
  }, [lockView]);

  useEffect(() => {
    const previous = previousDialScaleRef.current;
    if (!lugGuideOverrides || previous === dialScale) {
      previousDialScaleRef.current = dialScale;
      return;
    }
    const ratio = dialScale / previous;
    setLugGuideOverrides((current) => {
      if (!current) return current;
      return {
        centerX:
          typeof current.centerX === "number"
            ? CANVAS_SIZE / 2 + (current.centerX - CANVAS_SIZE / 2) * ratio
            : current.centerX,
        topY:
          typeof current.topY === "number"
            ? CANVAS_SIZE / 2 + (current.topY - CANVAS_SIZE / 2) * ratio
            : current.topY,
        bottomY:
          typeof current.bottomY === "number"
            ? CANVAS_SIZE / 2 + (current.bottomY - CANVAS_SIZE / 2) * ratio
            : current.bottomY,
        topWidth:
          typeof current.topWidth === "number" ? current.topWidth * ratio : current.topWidth,
        bottomWidth:
          typeof current.bottomWidth === "number"
            ? current.bottomWidth * ratio
            : current.bottomWidth
      };
    });
    previousDialScaleRef.current = dialScale;
  }, [dialScale, lugGuideOverrides]);

  const onUploadDial = (file: File) => {
    const uploadedUrl = URL.createObjectURL(file);
    setOriginalWatchFile(file);
    setUploadedWatchFile(file);
    setOriginalWatchSrc(uploadedUrl);
    setWatchPreviewSrc(uploadedUrl);
    setWatchSrc(uploadedUrl);
    setDialScale(DEFAULT_WATCH_PREVIEW_SCALE);
    setSceneZoom(DEFAULT_SCENE_ZOOM);
    previousDialScaleRef.current = DEFAULT_WATCH_PREVIEW_SCALE;
    setCropSourceUrl(uploadedUrl);
    setPartA(null);
    setPartB(null);
    setLockView(false);
    setFitState("auto");
    setShowFitBench(false);
    setLugGuideOverrides(null);
    setShowLugGuides(true);
    setShowLugGuideOnboarding(false);
    setShowUploadGuide(false);
    setHighlightUploadGuide(true);
    if (!hasAutoOpenedUploadGuide) {
      setHasAutoOpenedUploadGuide(true);
    }
  };

  const onUploadStrapSheet = (file: File) => {
    const nextUrl = URL.createObjectURL(file);
    setUploadedStrapSheetFile(file);
    setUploadedStrapSheetUrl(nextUrl);
    setStrapSplitSourceUrl(nextUrl);
    setUploadedStrapPartA(null);
    setUploadedStrapPartB(null);
    setStrapSourceMode("uploaded");
  };

  const applySplitStrap = (payload: { partA: UploadedSplitPart; partB: UploadedSplitPart }) => {
    setUploadedStrapPartA({
      file: payload.partA.file,
      url: URL.createObjectURL(payload.partA.file)
    });
    setUploadedStrapPartB({
      file: payload.partB.file,
      url: URL.createObjectURL(payload.partB.file)
    });
    setStrapSplitSourceUrl(null);
    setStrapSourceMode("uploaded");
    setShowFitBench(false);
    setFitState("auto");
    triggerStrapSettle();
  };

  useEffect(() => {
    if (!highlightUploadGuide) return undefined;
    const timeout = window.setTimeout(() => setHighlightUploadGuide(false), 10000);
    return () => window.clearTimeout(timeout);
  }, [highlightUploadGuide]);

  useEffect(() => {
    if (!highlightPreviewWindow) return undefined;
    const timeout = window.setTimeout(() => setHighlightPreviewWindow(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [highlightPreviewWindow]);

  useEffect(() => {
    triggerDrawerReveal();
    return undefined;
  }, []);

  useEffect(() => {
    if (strapSourceMode !== "library") return;
    triggerDrawerReveal();
    return undefined;
  }, [category, strapSourceMode]);

  useEffect(() => {
    if (!hasUserUpload || strapSourceMode !== "library") return;
    triggerDrawerReveal();
    return undefined;
  }, [hasUserUpload, strapSourceMode]);

  useEffect(() => {
    return () => {
      if (mockupReadyTimeoutRef.current) {
        window.clearTimeout(mockupReadyTimeoutRef.current);
      }
      if (strapSettleTimeoutRef.current) {
        window.clearTimeout(strapSettleTimeoutRef.current);
      }
      if (drawerRevealTimeoutRef.current) {
        window.clearTimeout(drawerRevealTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!canRender || showControlCoachmark) return;
    try {
      if (window.localStorage.getItem(CONTROL_COACHMARK_STORAGE_KEY) === "1") return;
      const timer = window.setTimeout(() => setShowControlCoachmark(true), 450);
      return () => window.clearTimeout(timer);
    } catch {
      const timer = window.setTimeout(() => setShowControlCoachmark(true), 450);
      return () => window.clearTimeout(timer);
    }
  }, [canRender, showControlCoachmark]);

  useEffect(() => {
    if (!canShowWatchOnlyPreview || !hasUserUpload) return;
    try {
      if (window.localStorage.getItem(LUG_GUIDE_TIP_STORAGE_KEY) === "1") return;
    } catch {
      // Ignore storage failures; we can still show the tip for this session.
    }
    const timer = window.setTimeout(() => setShowLugGuideOnboarding(true), 220);
    return () => window.clearTimeout(timer);
  }, [canShowWatchOnlyPreview, hasUserUpload, watchSrc]);

  useEffect(() => {
    if (!canRender) {
      firstRenderedStrapRef.current = false;
      return;
    }
    if (!firstRenderedStrapRef.current) {
      setShowLugGuides(false);
      firstRenderedStrapRef.current = true;
    }
    if (showLugGuideOnboarding) {
      dismissLugGuideOnboarding();
    }
  }, [canRender, showLugGuideOnboarding]);

  const dismissControlCoachmark = () => {
    setShowControlCoachmark(false);
    try {
      window.localStorage.setItem(CONTROL_COACHMARK_STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures and just hide for the current session.
    }
  };

  const onSavePreviewImage = async () => {
    const blob = await canvasRef.current?.getPngBlob();
    if (!blob) return;
    await saveBlob(blob, "watch-strap-preview.png");
  };

  const onSaveMockupImage = async (url: string) => {
    clearMockupReadyHighlight();
    await saveUrlAsPng(url, "watch-strap-catalogue.png");
  };

  const triggerStrapSettle = () => {
    setAnimateStrapSettle(false);
    window.requestAnimationFrame(() => {
      setAnimateStrapSettle(true);
      if (strapSettleTimeoutRef.current) {
        window.clearTimeout(strapSettleTimeoutRef.current);
      }
      strapSettleTimeoutRef.current = window.setTimeout(() => {
        setAnimateStrapSettle(false);
        strapSettleTimeoutRef.current = null;
      }, 520);
    });
  };

  const applyWatchAsset = (file: File, sourceUrl: string) => {
    setUploadedWatchFile(file);
    setWatchPreviewSrc(sourceUrl);
    setWatchSrc(sourceUrl);
    setPartA(null);
    setPartB(null);
    setDialScale(DEFAULT_WATCH_PREVIEW_SCALE);
    setSceneZoom(DEFAULT_SCENE_ZOOM);
    previousDialScaleRef.current = DEFAULT_WATCH_PREVIEW_SCALE;
    setLockView(false);
    setFitState("auto");
    setShowFitBench(false);
    setLugGuideOverrides(null);
    setShowLugGuides(true);
    setHighlightPreviewWindow(true);
    window.setTimeout(() => {
      previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const applyCroppedDial = (file: File, previewUrl: string) => {
    applyWatchAsset(file, previewUrl);
    setCropSourceUrl(null);
  };

  const reCropCurrentWatch = () => {
    if (!originalWatchFile || !originalWatchSrc) return;
    setUploadedWatchFile(originalWatchFile);
    setCropSourceUrl(originalWatchSrc);
    setLockView(false);
    setShowFitBench(false);
  };

  const toggleLockView = () => {
    setLockView((prev) => {
      const next = !prev;
      setFitState(next ? "locked" : showFitBench ? "adjusted" : "auto");
      return next;
    });
  };

  const autoAlignStraps = async () => {
    if (!activeStrapASrc || !activeStrapBSrc) return;
    setIsAutoAligning(true);
    try {
      const latestPartA = latestPartARef.current;
      const latestPartB = latestPartBRef.current;
      const shouldPreserve = Boolean(
        latestPartA &&
          latestPartB &&
          !lugGuideOverrides &&
          (preserveSettingsRef.current || lockViewRef.current)
      );
      const aligned = await calculateAutoPlacement(
        watchSrc,
        activeStrapASrc,
        activeStrapBSrc,
        activeAutoFitWidthFactor,
        activeAutoGapFactor,
        dialScale,
        lugGuideOverrides ?? undefined
      );
      let nextPartA = aligned.partA;
      let nextPartB = aligned.partB;

      if (shouldPreserve && latestPartA && latestPartB) {
        const preservedHalfGap = (latestPartB.y - latestPartA.y) / 2;
        const preservedAverageScale = getAverageScale(latestPartA, latestPartB);
        const preservedCenterX = (latestPartA.x + latestPartB.x) / 2;
        const preservedCenterY = (latestPartA.y + latestPartB.y) / 2;
        let preserved = applyScaleToPair(nextPartA, nextPartB, preservedAverageScale);
        preserved = applyGapToPair(preserved.partA, preserved.partB, preservedHalfGap);
        preserved = applyCenterToPair(
          preserved.partA,
          preserved.partB,
          preservedCenterX,
          preservedCenterY
        );
        nextPartA = preserved.partA;
        nextPartB = preserved.partB;
      }

      setPartA(nextPartA);
      setPartB(nextPartB);
      setFitConfidence(aligned.confidence);
      setFitState(lockViewRef.current ? "locked" : shouldPreserve ? "adjusted" : "auto");
    } finally {
      setIsAutoAligning(false);
    }
  };

  useEffect(() => {
    void autoAlignStraps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchSrc, activeStrapASrc, activeStrapBSrc, activeAutoFitWidthFactor, activeAutoGapFactor, dialScale, lugGuideOverrides]);

  useEffect(() => {
    if (strapSourceMode !== "library" || !hasSelectedLibraryStrap) return;
    const total = strapsInCategory.length;
    if (!total) return;
    const neighborIndices = [
      strapIndex,
      (strapIndex + 1) % total,
      (strapIndex - 1 + total) % total
    ];
    const uniqueIndices = [...new Set(neighborIndices)];
    void Promise.all(
      uniqueIndices.flatMap((index) => {
        const strap = strapsInCategory[index];
        if (!strap) return [];
        return [loadStrapImage(strap.strapASrc), loadStrapImage(strap.strapBSrc)];
      })
    ).catch(() => undefined);
  }, [category, strapIndex, strapSourceMode, hasSelectedLibraryStrap]);

  const onCycleStrap = (direction: 1 | -1) => {
    if (strapSourceMode !== "library" || !hasSelectedLibraryStrap) return;
    triggerStrapSettle();
    setStrapIndex((prev) => {
      const total = strapsInCategory.length;
      return (prev + direction + total) % total;
    });
  };

  const setGapHalf = (nextHalfGap: number) => {
    if (!partA || !partB) return;
    const nextPair = applyGapToPair(partA, partB, nextHalfGap);
    setPartA(nextPair.partA);
    setPartB(nextPair.partB);
    setFitState("adjusted");
  };

  const setStrapScale = (nextScale: number) => {
    if (!partA || !partB) return;
    const nextPair = applyScaleToPair(partA, partB, nextScale);
    setPartA(nextPair.partA);
    setPartB(nextPair.partB);
    setFitState("adjusted");
  };

  const setDialScaleValue = (nextScale: number) => {
    setDialScale(clamp(nextScale, DIAL_SCALE_MIN, DIAL_SCALE_MAX));
    setFitState("adjusted");
  };

  const setSceneZoomValue = (nextScale: number) => {
    setSceneZoom(nextScale);
    setFitState("adjusted");
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
    setSceneZoom(DEFAULT_SCENE_ZOOM);
  };

  useEffect(() => {
    if (strapSourceMode !== "library" || !lockView || !activeLibraryStrap?.id) {
      setSimilarProducts([]);
      setSimilarProductsLoading(false);
      return;
    }

    let active = true;
    setSimilarProductsLoading(true);
    fetch(`/api/products/similar?strapId=${encodeURIComponent(activeLibraryStrap.id)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load shopping matches.");
        return response.json() as Promise<{ products?: SimilarProductCard[] }>;
      })
      .then((payload) => {
        if (!active) return;
        setSimilarProducts(Array.isArray(payload.products) ? payload.products : []);
      })
      .catch(() => {
        if (!active) return;
        setSimilarProducts([]);
      })
      .finally(() => {
        if (!active) return;
        setSimilarProductsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeLibraryStrap?.id, strapSourceMode, lockView]);

  const runCleanupFallback = async () => {
    if (!uploadedWatchFile) return;
    setToolLoading("cleanup", true);
    try {
      setAiStage("cleanup", "Extract Watch", "Uploading");
      const preparedFile = await prepareAiInput(uploadedWatchFile, {
        maxSide: 1200,
        quality: 0.86
      });
      const formData = new FormData();
      formData.append("image", preparedFile);
      setAiStage("cleanup", "Extract Watch", "Removing background");
      const imageUrl = await postToolForm("/api/kie/cleanup", formData);
      setAiStage("cleanup", "Extract Watch", "Applying result");
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
      setAiStage("rescue", "Wrist Rescue", "Uploading");
      const preparedFile = await prepareAiInput(uploadedWatchFile, {
        maxSide: 640,
        quality: 0.72
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
        setAiStage("rescue", "Wrist Rescue", "Generating watch");
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
        setAiStage("rescue", "Wrist Rescue", "Refining cutout");
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

      setAiStage("rescue", "Wrist Rescue", "Applying result");
      applyProcessedWatch(imageUrl);
      setToolLoading("rescue", false);
    } catch (error) {
      try {
        // Fallback path for transient start/poll issues in serverless runtime.
        setAiStage("rescue", "Wrist Rescue", "Retrying with fallback");
        const preparedFallbackFile = await prepareAiInput(uploadedWatchFile, {
          maxSide: 640,
          quality: 0.72
        });
        const fallbackFormData = new FormData();
        fallbackFormData.append("image", preparedFallbackFile);
        const fallbackUrl = await postToolForm("/api/kie/rescue", fallbackFormData);
        setAiStage("rescue", "Wrist Rescue", "Applying result");
        applyProcessedWatch(fallbackUrl);
        setToolLoading("rescue", false);
      } catch (fallbackError) {
        setToolLoading("rescue", false, formatAiError(fallbackError || error));
      }
    }
  };

  const runFinalRender = async () => {
    if (!canvasRef.current) return;
    setToolLoading("final", true);
    try {
      setAiStage("final", "Create Catalogue Image", "Packaging preview");
      const previewBlob = await canvasRef.current.getPngBlob();
      if (!previewBlob) {
        throw new Error("Preview image was not available");
      }

      const preparedPreview = await prepareAiInput(
        new File([previewBlob], "preview.png", { type: "image/png" }),
        {
          maxSide: 768,
          quality: 0.74
        }
      );
      if (!activeStrapASrc || !activeStrapBSrc) {
        throw new Error("Strap preview was not available");
      }

      const [preparedWatch, preparedStrapA, preparedStrapB] = await Promise.all([
        prepareSrcForAi(watchSrc, "watch-source.png", { maxSide: 768, quality: 0.76 }),
        prepareSrcForAi(activeStrapASrc, "strap-a.png", { maxSide: 768, quality: 0.76 }),
        prepareSrcForAi(activeStrapBSrc, "strap-b.png", { maxSide: 768, quality: 0.76 })
      ]);

      let taskId = "";
      let lastStartError = "Product mockup could not start.";
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const formData = new FormData();
        formData.append("preview", preparedPreview);
        formData.append("watch", preparedWatch);
        formData.append("strapA", preparedStrapA);
        formData.append("strapB", preparedStrapB);
        formData.append("strapLabel", activeStrapLabel);

        setAiStage("final", "Create Catalogue Image", attempt === 0 ? "Starting render" : "Retrying render");
        try {
          taskId = await startPolledTask("/api/kie/final-render/start", formData);
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Final render start failed";
          lastStartError = message;
          if (attempt < 2 && isTransientTimeoutLike(message)) {
            await sleep(1200 * (attempt + 1));
            continue;
          }
          throw error;
        }
      }
      if (!taskId) {
        throw new Error(lastStartError);
      }

      setAiStage("final", "Create Catalogue Image", "Rendering buckled display");
      const imageUrl = await pollTaskResult("/api/kie/final-render/poll", taskId, {
        maxPolls: 180,
        delayMs: 2500
      });
      setGeneratedResults((prev) => ({ ...prev, final: imageUrl }));
      setInlineMockupUrl(imageUrl);
      clearMockupReadyHighlight();
      setMockupReadyHighlight(true);
      mockupReadyTimeoutRef.current = window.setTimeout(() => {
        setMockupReadyHighlight(false);
        mockupReadyTimeoutRef.current = null;
      }, 7000);
      setToolLoading("final", false);
    } catch (error) {
      setToolLoading("final", false, formatAiError(error));
    }
  };

  const strapGap = partA && partB ? (partB.y - partA.y) / 2 : 320;
  const strapScale = partA && partB ? (partA.scale + partB.scale) / 2 : 90;
  const strapSizeUi = strapScaleToUi(strapScale);

  return (
      <main className="mx-auto max-w-[92rem] px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8 lg:px-8">
      <header className="mb-10 text-center sm:mb-12">
        <p className="font-serif text-[2.3rem] leading-none tracking-tight text-[#2b241d] sm:text-[2.9rem]">
          Watchstrapper
        </p>
        <h1 className="mt-4 font-['Instrument_Sans',ui-sans-serif,system-ui,sans-serif] text-[1.4rem] font-medium leading-[1.02] tracking-[-0.04em] text-ink sm:text-[2.2rem]">
          See any strap on your watch before you buy.
        </h1>
      </header>

      {strapSplitSourceUrl && uploadedStrapSheetFile ? (
        <section className="mx-auto mb-6 w-full max-w-[920px]">
          <StrapSplitEditor
            file={uploadedStrapSheetFile}
            sourceUrl={strapSplitSourceUrl}
            onApply={applySplitStrap}
            onClose={() => setStrapSplitSourceUrl(null)}
          />
        </section>
      ) : null}

      <input
        ref={changeWatchInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const nextFile = event.target.files?.[0];
          if (!nextFile) return;
          onUploadDial(nextFile);
          event.currentTarget.value = "";
        }}
      />

      <section
        className={`mt-10 grid gap-5 xl:mt-20 xl:items-start ${
          hasUserUpload
            ? "xl:grid-cols-[18.5rem_minmax(0,1fr)_15.25rem]"
            : "xl:grid-cols-[18.5rem_minmax(0,1fr)]"
        }`}
      >
        <aside className="order-2 space-y-3 xl:order-1 xl:pt-14">
          <div className="glass-card atelier-card-soft rounded-[1.9rem] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7c7165]">
                  Strap Drawer
                </p>
                <p className="mt-2 text-[1.55rem] font-serif leading-none text-[#2b241d]">
                  Browse the strap box
                </p>
              </div>
              {hasUserUpload ? (
                <span className="atelier-accent-soft rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
                  Ready
                </span>
              ) : null}
            </div>
            <div className="mt-4 inline-flex rounded-full border border-line bg-canvas p-1">
              {[
                { mode: "library" as const, label: "Library" },
                { mode: "uploaded" as const, label: "Your Strap" }
              ].map((option) => {
                const active = strapSourceMode === option.mode;
                return (
                  <button
                    key={option.mode}
                    type="button"
                    onClick={() => setStrapSourceMode(option.mode)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "atelier-pill-active"
                        : "text-ink hover:bg-white"
                    }`}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {strapSourceMode === "library" ? (
              <>
                <div className="mt-4 flex flex-wrap gap-1.5">
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
                          setHasSelectedLibraryStrap(false);
                          setShowFitBench(false);
                          setFitState("auto");
                        }}
                        data-testid={`category-${option.toLowerCase().replace(/\s+/g, "-")}`}
                        className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                          active
                            ? "atelier-pill-active"
                            : "border-line bg-canvas text-ink hover:border-[#d7c1a3] hover:bg-white"
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

                <div className="mt-3 rounded-[1.35rem] border border-line bg-canvas/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
                    {category === "All categories" ? "Full Strap Drawer" : `Inside ${category}`}
                  </p>
                  <div className="mt-3 max-h-[42rem] space-y-2 overflow-y-auto pr-1">
                    {strapsInCategory.map((strap, index) => {
                      const active = hasSelectedLibraryStrap && index === strapIndex;
                      return (
                        <StrapDrawerButton
                          key={strap.id}
                          onClick={() => {
                            setStrapIndex(index);
                            setHasSelectedLibraryStrap(true);
                            setShowFitBench(false);
                            setFitState("auto");
                            if (hasUserUpload) {
                              setHighlightPreviewWindow(true);
                              triggerStrapSettle();
                              window.setTimeout(() => {
                                previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }, 80);
                            }
                          }}
                          strap={strap}
                          active={active}
                          showCategory={category === "All categories"}
                          animateIn={animateDrawerReveal}
                          animationDelayMs={index * 45}
                        />
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-[1.35rem] border border-line bg-canvas/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                  <p className="text-sm uppercase tracking-[0.12em] text-muted">Your Strap Sheet</p>
                  <p className="mt-2 text-sm text-muted">
                    Upload one straight pair image: buckle side on top, tail side below.
                  </p>
                  <input
                    ref={strapUploadInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const nextFile = event.target.files?.[0];
                      if (!nextFile) return;
                      onUploadStrapSheet(nextFile);
                      event.currentTarget.value = "";
                    }}
                  />
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => strapUploadInputRef.current?.click()}
                      className="neo-button rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink"
                    >
                      {hasUploadedStrap ? "Replace Strap Sheet" : "Upload Strap Sheet"}
                    </button>
                    {uploadedStrapSheetUrl ? (
                      <button
                        type="button"
                        onClick={() => setStrapSplitSourceUrl(uploadedStrapSheetUrl)}
                        className="neo-button rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink"
                      >
                        Re-open Split Tool
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[1.35rem] border border-line bg-canvas/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                    Current Upload
                  </p>
                  {hasUploadedStrap ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {[
                        { title: "Part A", src: uploadedStrapPartA?.url },
                        { title: "Part B", src: uploadedStrapPartB?.url }
                      ].map((item) => (
                        <div key={item.title} className="rounded-2xl border border-line bg-white/80 p-3">
                          <p className="text-sm font-semibold text-ink">{item.title}</p>
                          <div className="mt-2 flex h-36 items-center justify-center rounded-xl border border-line bg-slate-50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.src} alt={item.title} className="h-full w-full object-contain p-2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted">
                      No strap loaded yet. Upload a product-style pair image and we’ll split it into the preview.
                    </p>
                  )}
                </div>
              </div>
            )}

          </div>
        </aside>

        <section
          ref={previewSectionRef}
          className={`order-1 min-w-0 space-y-4 xl:order-2 ${hasUserUpload ? "" : "xl:pt-14 xl:max-w-[58rem]"}`}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              {previewStageTitle ? (
                <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[#7c7165]">
                  {previewStageTitle.replace(/^\d+\.\s*/, "")}
                </p>
              ) : null}
              {previewStageHint ? (
                <p className={`${previewStageTitle ? "mt-2" : ""} max-w-[34rem] text-sm leading-6 text-muted`}>
                  {previewStageHint}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {hasUserUpload ? (
                <>
                  <button
                    type="button"
                    onClick={reCropCurrentWatch}
                    className="neo-button rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink"
                  >
                    Re-crop
                  </button>
                  <button
                    type="button"
                    onClick={() => changeWatchInputRef.current?.click()}
                    className="neo-button rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink"
                  >
                    Change Watch
                  </button>
                </>
              ) : null}
              {canRender ? (
                <>
                <button
                  type="button"
                  onClick={toggleLockView}
                  className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                    lockView
                      ? "atelier-accent-soft"
                      : "border-line bg-white/78 text-ink hover:bg-white"
                  }`}
                >
                  {lockView ? "Unlock Fit" : "Lock Fit"}
                </button>
                <button
                  type="button"
                  onClick={() => void onSavePreviewImage()}
                  className="atelier-accent-solid rounded-2xl border px-5 py-2.5 text-sm font-semibold transition hover:opacity-95"
                >
                  Save Image
                </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="glass-card atelier-card-soft rounded-[2rem] p-3 sm:p-4">
            {cropSourceUrl && originalWatchFile ? (
              <CropEditor
                file={originalWatchFile}
                sourceUrl={cropSourceUrl}
                onApply={applyCroppedDial}
                onClose={() => setCropSourceUrl(null)}
              />
            ) : canRender ? (
              <div className={`${highlightPreviewWindow ? "preview-attention-ring rounded-[1.75rem]" : ""} ${animateStrapSettle ? "strap-settle-in" : ""}`}>
                <CanvasPreview
                  ref={canvasRef}
                  watchSrc={watchSrc}
                  strapASrc={activeStrapASrc as string}
                  strapBSrc={activeStrapBSrc as string}
                  partA={partA as PartTransform}
                  partB={partB as PartTransform}
                  style={currentStrap.tint}
                  joinShape={activeJoinShape}
                  watchScale={dialScale}
                  sceneZoom={sceneZoom}
                  locked={lockView}
                  showLugGuides={canShowLiveLugGuides}
                  lugGuideOverrides={lugGuideOverrides}
                  onLugGuidesChange={handleLugGuidesChange}
                  showCycleControls={strapSourceMode === "library" && hasSelectedLibraryStrap}
                  onDragPartsChange={(nextA, nextB) => {
                    setPartA(nextA);
                    setPartB(nextB);
                    setFitState("adjusted");
                  }}
                  onCycleStrap={onCycleStrap}
                />
              </div>
            ) : canShowWatchOnlyPreview ? (
              <WatchOnlyPreview
                watchSrc={watchSrc}
                watchScale={dialScale}
                highlighted={highlightPreviewWindow}
                showLugGuides={showLugGuides}
                onToggleLugGuides={() => setShowLugGuides((prev) => !prev)}
                lugGuideOverrides={lugGuideOverrides}
                onLugGuidesChange={handleLugGuidesChange}
                showGuideOnboarding={showLugGuideOnboarding}
                onDismissGuideOnboarding={dismissLugGuideOnboarding}
              />
            ) : (
              <PreviewUploadStage
                previewUrl={watchPreviewSrc}
                showUploadGuide={showUploadGuide}
                highlightUploadGuide={highlightUploadGuide}
                onToggleUploadGuide={() => setShowUploadGuide((prev) => !prev)}
                onCloseUploadGuide={() => setShowUploadGuide(false)}
                onFileSelect={onUploadDial}
              />
            )}
          </div>

          <div className="glass-card atelier-card-soft rounded-[1.9rem] p-4 sm:p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
                  Materials
                </p>
                <p className="mt-1 text-sm text-muted">
                  Bench references for texture and hardware finish.
                </p>
              </div>
            </div>
            <MaterialsStrip />
          </div>

          <div className="glass-card atelier-card-soft rounded-[1.9rem] p-4 sm:p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
                  4. Bench Tools
                </p>
              </div>
              {activeAiStatus.tool ? (
                <div className="md:max-w-[18rem]">
                  <CompactAiStatus label={activeAiStatus.label} stage={activeAiStatus.stage} />
                </div>
              ) : null}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <ToolButton
                  title="Extract Watch"
                  subtitle="from messy backgrounds"
                  disabled={!hasUserUpload}
                  loading={aiTools.cleanup.loading}
                  sampleImageSrc="/bench-details/extract-watch.jpg"
                  note="Best on clean, front-on retailer or wrist shots with visible lugs."
                  onClick={() => void runCleanupFallback()}
                />
                {aiTools.cleanup.error ? <ErrorText message={aiTools.cleanup.error} /> : null}
              </div>

              <div className="space-y-3">
                <ToolButton
                  title="Create Catalogue Image"
                  disabled={!canRender || !lockView}
                  loading={aiTools.final.loading}
                  sampleImageSrc="/catalogue-mockup-sample.png"
                  highlighted={mockupReadyHighlight}
                  note="Lock the view with your favourite strap, then create a catalogue-style shot."
                  onClick={() => void runFinalRender()}
                />
                {generatedResults.final ? (
                  <ResultActions
                    url={generatedResults.final}
                    label="View mockup"
                    onOpenInPage={() => {
                      clearMockupReadyHighlight();
                      setInlineMockupUrl(generatedResults.final);
                    }}
                    onSave={() => void onSaveMockupImage(generatedResults.final as string)}
                  />
                ) : null}
                {aiTools.final.error ? <ErrorText message={aiTools.final.error} /> : null}
              </div>

            </div>
          </div>
          {strapSourceMode === "library" ? (
            <div
              className={`glass-card atelier-card-soft rounded-[1.9rem] p-4 transition ${
                lockView
                  ? ""
                  : "opacity-80"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                  Similar Straps Available For Buying Elsewhere
                  </p>
                  {lockView ? (
                    <p className="mt-1 text-sm text-muted">
                      We may earn affiliate commission from one of the listed purchase links.
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted">
                      Lock the view to see matching buying options for the strap on the bench.
                    </p>
                  )}
                </div>
                <span className="rounded-full border border-line bg-white/72 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  Coming soon
                </span>
              </div>
              {lockView ? (
                similarProductsLoading ? (
                  <p className="mt-3 text-sm text-muted">Looking around the strap counter…</p>
                ) : similarProducts.length ? (
                  <div className="mt-4 space-y-3">
                    {similarProducts.map((product) => (
                      <a
                        key={product.id}
                        href={product.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-2xl border border-line bg-white/85 p-3 transition hover:-translate-y-0.5 hover:bg-white"
                      >
                        <div className="w-20 shrink-0 overflow-hidden rounded-[1rem] border border-line bg-slate-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={product.imageSrc}
                            alt={product.title}
                            className="h-20 w-full object-contain p-2"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-semibold text-ink">{product.title}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">
                            {product.store}
                          </p>
                        </div>
                        <span className="inline-flex shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink">
                          View Product
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    No close store match yet for this locked strap.
                  </p>
                )
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/55 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MaterialInset
                      src="/strap-selection-kie/cognac-grain-leather-buckle.png"
                      label="Leather strap sample"
                      fit="contain"
                    />
                    <MaterialInset
                      src="/strap-selection-kie/black-rubber-buckle.png"
                      label="Rubber strap sample"
                      fit="contain"
                    />
                  </div>
                  <p className="mt-3 text-sm text-slate-500">
                    Shopping links stay tucked away until the fit is locked in.
                  </p>
                </div>
              )}
            </div>
          ) : null}
          {inlineMockupUrl ? (
            <div className="glass-card atelier-card-soft rounded-[1.9rem] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                  Mockup Deck
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onSaveMockupImage(inlineMockupUrl)}
                    className="neo-button rounded-xl px-3 py-2 text-sm font-medium text-ink"
                  >
                    Save image
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearMockupReadyHighlight();
                      setInlineMockupUrl(null);
                    }}
                    className="neo-button rounded-xl px-3 py-2 text-sm font-medium text-ink"
                  >
                    Close
                  </button>
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="mx-auto w-full max-w-[85%]">
                <img
                  src={inlineMockupUrl}
                  alt="Generated product mockup"
                  className="w-full rounded-xl border border-line bg-white object-contain"
                />
              </div>
            </div>
          ) : null}
          <p className="mt-3 text-sm text-muted">
            Visual inspiration only. Final fit depends on lug width &amp; strap model.
          </p>
          <div className="mt-5 flex justify-center md:justify-end">
            <Link
              href="/contact"
              className="neo-button rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-ink"
            >
              Enquiries / Feedback
            </Link>
          </div>
        </section>

        {hasUserUpload ? (
          <aside className="order-3 xl:order-3 xl:pt-14">
            <FitBenchPanel
              canRender={canRender}
              showFitBench={showFitBench}
              onToggleFitBench={() => setShowFitBench((prev) => !prev)}
              fitConfidence={fitConfidence}
              showLugGuides={showLugGuides}
              onToggleLugGuides={() => setShowLugGuides((prev) => !prev)}
              onResetFit={() => void autoAlignStraps()}
              isAutoAligning={isAutoAligning}
              strapGap={strapGap}
              setGapHalf={setGapHalf}
              lockView={lockView}
              showControlCoachmark={showControlCoachmark}
              strapSizeUi={strapSizeUi}
              setStrapScale={setStrapScale}
              dismissControlCoachmark={dismissControlCoachmark}
              dialScale={dialScale}
              setDialScaleValue={setDialScaleValue}
              sceneZoom={sceneZoom}
              setSceneZoomValue={setSceneZoomValue}
              onToggleLockView={toggleLockView}
              preserveSettings={preserveSettings}
              setPreserveSettings={setPreserveSettings}
              reCropCurrentWatch={reCropCurrentWatch}
              onChangeWatch={() => changeWatchInputRef.current?.click()}
              hasUserUpload={hasUserUpload}
            />
          </aside>
        ) : null}
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

function ResultActions({
  url,
  label,
  onOpenInPage,
  onSave
}: {
  url: string;
  label: string;
  onOpenInPage?: () => void;
  onSave?: () => void;
}) {
  return (
    <div className="ml-1 flex gap-2">
      {onOpenInPage ? (
        <button
          type="button"
          onClick={onOpenInPage}
          className="neo-button rounded-xl px-3 py-2 text-sm font-medium text-ink"
        >
          {label}
        </button>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="neo-button rounded-xl px-3 py-2 text-sm font-medium text-ink"
        >
          {label}
        </a>
      )}
      <button
        type="button"
        onClick={onSave ?? (() => window.open(url, "_blank", "noopener,noreferrer"))}
        className="neo-button rounded-xl px-3 py-2 text-sm font-medium text-ink"
      >
        Save image
      </button>
    </div>
  );
}

function ErrorText({ message }: { message: string }) {
  return <p className="text-xs text-rose-600">{message}</p>;
}

function PreviewUploadStage({
  previewUrl,
  showUploadGuide,
  highlightUploadGuide,
  onToggleUploadGuide,
  onCloseUploadGuide,
  onFileSelect
}: {
  previewUrl: string;
  showUploadGuide: boolean;
  highlightUploadGuide: boolean;
  onToggleUploadGuide: () => void;
  onCloseUploadGuide: () => void;
  onFileSelect: (file: File) => void;
}) {
  return (
    <div className={`relative overflow-hidden rounded-[1.75rem] ${highlightUploadGuide ? "upload-attention-ring" : ""}`}>
      <div className="pointer-events-none absolute inset-0 opacity-60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mock-dial.svg" alt="" aria-hidden="true" className="absolute left-1/2 top-1/2 h-[62%] -translate-x-1/2 -translate-y-1/2 opacity-[0.07]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/strap-selection-kie/cognac-grain-leather-buckle.png"
          alt=""
          aria-hidden="true"
          className="absolute left-8 top-10 hidden h-52 w-24 -rotate-[14deg] object-contain opacity-[0.06] lg:block"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/strap-selection-kie/black-grain-leather-tail.png"
          alt=""
          aria-hidden="true"
          className="absolute bottom-8 right-8 hidden h-56 w-24 rotate-[11deg] object-contain opacity-[0.05] lg:block"
        />
      </div>
      <div className="relative rounded-[1.7rem] border border-line bg-[radial-gradient(circle_at_96%_92%,rgba(245,141,24,0.5)_0%,rgba(247,180,82,0.24)_18%,rgba(251,223,190,0.1)_38%,rgba(255,252,248,0)_64%),linear-gradient(145deg,rgba(255,252,248,0.98)_0%,rgba(255,250,245,0.97)_52%,rgba(249,238,223,0.82)_78%,rgba(245,203,151,0.18)_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_36px_rgba(56,44,32,0.08)] sm:p-7">
        <div className="mx-auto max-w-[34rem]">
          <ImageUploader
            id="watch-stage"
            label=""
            helperText=""
            previewUrl={previewUrl}
            onFileSelect={onFileSelect}
            className="w-full"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Front-on, straight shots work best.</p>
            <button
              type="button"
              onClick={onToggleUploadGuide}
              className="neo-button inline-flex items-center gap-2 rounded-2xl border border-line px-3 py-2 text-sm font-semibold text-ink"
              aria-expanded={showUploadGuide}
              aria-controls="preview-upload-guide-panel"
            >
              Photo Tips
              <span className="text-base leading-none">{showUploadGuide ? "←" : "→"}</span>
            </button>
          </div>
          {showUploadGuide ? (
            <div
              id="preview-upload-guide-panel"
              className="mt-4 overflow-hidden rounded-2xl border border-line bg-white/70 p-3 transition-all duration-300"
            >
              <button
                type="button"
                onClick={onCloseUploadGuide}
                className="mb-2 flex w-full items-center rounded-xl border border-transparent px-1 py-1 text-left hover:bg-white/30"
                aria-expanded={showUploadGuide}
                aria-controls="preview-upload-guide-panel"
              >
                <p className="text-base font-semibold text-ink">Photo Tips</p>
              </button>
              <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-1">
                {UPLOAD_GUIDE_ITEMS.map((item) => (
                  <div key={item.title} className="min-w-[150px] max-w-[160px] flex-1">
                    <UploadGuideCard item={item} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MaterialInset({
  src,
  label,
  fit = "cover"
}: {
  src: string;
  label: string;
  fit?: "cover" | "contain";
}) {
  return (
    <div className="rounded-[1.1rem] border border-line bg-white/82 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
      <div className="overflow-hidden rounded-[0.9rem] border border-line bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className={`h-16 w-full ${fit === "cover" ? "object-cover" : "object-contain p-2"}`}
          loading="lazy"
        />
      </div>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c7165]">{label}</p>
    </div>
  );
}

function MaterialsStrip() {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <MaterialInset src="/bench-details/leather-grain.jpg" label="Leather grain" fit="cover" />
      <MaterialInset src="/bench-details/hardware-tone.jpg" label="Hardware tone" fit="cover" />
    </div>
  );
}

function StrapDrawerButton({
  strap,
  active,
  showCategory,
  onClick,
  animateIn = false,
  animationDelayMs = 0
}: StrapThumbProps & { animateIn?: boolean; animationDelayMs?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`strap-${strap.id}`}
      className={`drawer-card flex w-full items-center gap-2 rounded-[1.25rem] border px-2 py-2 text-left transition ${
        active
          ? "border-[#d7c1a3] bg-[#fbf6ee] text-ink shadow-[0_10px_24px_rgba(155,106,47,0.08)]"
          : "border-line bg-white/70 text-ink hover:bg-white"
      } ${animateIn ? "drawer-reveal-item" : ""}`}
      style={animateIn ? { animationDelay: `${animationDelayMs}ms` } : undefined}
      aria-pressed={active}
    >
      <div
        className={`grid h-[124px] w-[148px] shrink-0 grid-cols-2 items-center gap-0 overflow-hidden rounded-[1rem] border px-0 ${
          active ? "border-[#d7c1a3] bg-white" : "border-line bg-slate-50"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={strap.strapASrc}
          alt={`${strap.label} buckle side`}
          className="h-full w-full translate-x-[8px] scale-[2.5] object-contain"
          loading="lazy"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={strap.strapBSrc}
          alt={`${strap.label} tail side`}
          className="h-full w-full -translate-x-[8px] scale-[2.5] object-contain"
          loading="lazy"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-3 text-[13px] font-semibold leading-tight sm:text-[13px]">{strap.label}</p>
        {showCategory ? (
          <p
            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] ${
              active ? "bg-[#f6ead7] text-[#9b6a2f]" : "bg-slate-200/70 text-slate-700"
            }`}
          >
            {strap.category}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function WatchOnlyPreview({
  watchSrc,
  watchScale,
  highlighted,
  showLugGuides,
  onToggleLugGuides,
  lugGuideOverrides,
  onLugGuidesChange,
  showGuideOnboarding,
  onDismissGuideOnboarding
}: {
  watchSrc: string;
  watchScale: number;
  highlighted: boolean;
  showLugGuides: boolean;
  onToggleLugGuides: () => void;
  lugGuideOverrides: PreviewLugGuideOverrides | null;
  onLugGuidesChange: (overrides: PreviewLugGuideOverrides) => void;
  showGuideOnboarding: boolean;
  onDismissGuideOnboarding: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lugGuides, setLugGuides] = useState<PreviewLugGuides | null>(null);
  const [shouldBlinkGuides, setShouldBlinkGuides] = useState(false);
  const dragRef = useRef<{
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

  useEffect(() => {
    let active = true;
    const draw = async () => {
      if (!canvasRef.current) return;
      try {
        await renderWatchOnlyComposition(canvasRef.current, watchSrc, watchScale);
      } catch {
        if (!active) return;
      }
    };
    void draw();
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

  const getCanvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  const onGuidePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!effectiveLugGuides || !canvasRef.current) return;
    const point = getCanvasPoint(event);
    if (!point) return;
    const hit = getWatchOnlyGuideHitTarget(point, effectiveLugGuides);
    if (!hit) return;
    dragRef.current = {
      pointerId: event.pointerId,
      guide: hit.guide,
      mode: hit.mode,
      startX: point.x,
      startY: point.y,
      initialCenterX: effectiveLugGuides.centerX,
      initialTopY: effectiveLugGuides.topY,
      initialBottomY: effectiveLugGuides.bottomY,
      initialTopWidth: effectiveLugGuides.topWidth,
      initialBottomWidth: effectiveLugGuides.bottomWidth
    };
    canvasRef.current.setPointerCapture(event.pointerId);
  };

  const onGuidePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !effectiveLugGuides) return;
    const point = getCanvasPoint(event);
    if (!point) return;
    const deltaX = point.x - drag.startX;
    const deltaY = point.y - drag.startY;
    const nextCenterXBase = clamp(drag.initialCenterX + deltaX, CANVAS_SIZE * 0.2, CANVAS_SIZE * 0.8);
    if (drag.guide === "top") {
      const nextTopY = clamp(drag.initialTopY + deltaY, CANVAS_SIZE * 0.12, drag.initialBottomY - 60);
      const nextTopWidthState = getWatchOnlyGuideWidthState(
        drag.mode,
        drag.initialCenterX,
        drag.initialTopWidth,
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
      const nextBottomY = clamp(drag.initialBottomY + deltaY, drag.initialTopY + 60, CANVAS_SIZE * 0.88);
      const nextBottomWidthState = getWatchOnlyGuideWidthState(
        drag.mode,
        drag.initialCenterX,
        drag.initialBottomWidth,
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
  };

  const onGuidePointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    canvasRef.current?.releasePointerCapture(event.pointerId);
  };

  useEffect(() => {
    let active = true;
    const loadGuides = async () => {
      try {
        const scaledGuides = await detectPreviewLugGuides(watchSrc, watchScale);
        setLugGuides(scaledGuides);
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

  useEffect(() => {
    setShouldBlinkGuides(true);
    const timeout = window.setTimeout(() => setShouldBlinkGuides(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [watchSrc]);

  return (
    <div className={highlighted ? "preview-attention-ring rounded-[1.75rem]" : ""}>
      <div
        className="rounded-2xl border p-2.5 transition sm:p-3"
        style={{
          background:
            "linear-gradient(150deg, color-mix(in srgb, var(--canvas-bg) 62%, white 38%), color-mix(in srgb, var(--canvas-bg) 84%, white 16%))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.8), 0 12px 30px rgba(15,23,42,.08)",
          backdropFilter: "blur(8px)"
        }}
      >
        <div className="rounded-xl border border-line bg-canvas p-3">
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="aspect-square w-full rounded-xl border border-line bg-white"
              aria-label="Watch preview canvas"
              onPointerDown={onGuidePointerDown}
              onPointerMove={onGuidePointerMove}
              onPointerUp={onGuidePointerEnd}
              onPointerCancel={onGuidePointerEnd}
              style={{ touchAction: "none" }}
            />
            {showLugGuides && effectiveLugGuides ? (
              <WatchOnlyLugGuideOverlay guides={effectiveLugGuides} blink={shouldBlinkGuides} />
            ) : null}
          </div>
          {showLugGuides && showGuideOnboarding && effectiveLugGuides ? (
            <WatchOnlyLugGuideCoachmark onDismiss={onDismissGuideOnboarding} />
          ) : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {showLugGuides
                ? "Watch loaded. Line these guides up with the lug openings, then pick a strap."
                : "Watch loaded. Turn the lug guides back on any time if you want to fine-tune the fit first."}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onToggleLugGuides}
                className="neo-button rounded-xl px-3 py-1.5 text-xs font-semibold text-ink"
              >
                {showLugGuides ? "Hide lug guides" : "Show lug guides"}
              </button>
              <button
                type="button"
                onClick={() => onLugGuidesChange({})}
                className="neo-button rounded-xl px-3 py-1.5 text-xs font-semibold text-ink"
              >
                Reset lug guides
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WatchOnlyLugGuideOverlay({
  guides,
  blink
}: {
  guides: PreviewLugGuides;
  blink: boolean;
}) {
  const topLeft = ((guides.centerX - guides.topWidth / 2) / CANVAS_SIZE) * 100;
  const topWidth = (guides.topWidth / CANVAS_SIZE) * 100;
  const topY = (guides.topY / CANVAS_SIZE) * 100;
  const bottomLeft = ((guides.centerX - guides.bottomWidth / 2) / CANVAS_SIZE) * 100;
  const bottomWidth = (guides.bottomWidth / CANVAS_SIZE) * 100;
  const bottomY = (guides.bottomY / CANVAS_SIZE) * 100;
  const lineStyle = (left: number, top: number, width: number) => ({
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    transform: "translateY(-50%)"
  });
  const handleStyle = (left: number, top: number) => ({
    left: `${left}%`,
    top: `${top}%`,
    width: "14px",
    height: "14px",
    transform: "translate(-50%, -50%)"
  });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
      <div
        className="absolute h-[2px] rounded-full bg-[#d7c1a3]"
        style={lineStyle(topLeft, topY, topWidth)}
      />
      <div
        className="absolute rounded-full border border-[#d7c1a3] bg-white relative"
        style={handleStyle(topLeft, topY)}
      >
        {blink ? <span className="watch-lug-handle-pulse absolute inset-[-5px] rounded-full border border-[#d7c1a3]/70" /> : null}
      </div>
      <div
        className="absolute rounded-full border border-[#d7c1a3] bg-white relative"
        style={handleStyle(topLeft + topWidth, topY)}
      >
        {blink ? <span className="watch-lug-handle-pulse absolute inset-[-5px] rounded-full border border-[#d7c1a3]/70" /> : null}
      </div>
      <div
        className="absolute h-[2px] rounded-full bg-[#d7c1a3]"
        style={lineStyle(bottomLeft, bottomY, bottomWidth)}
      />
      <div
        className="absolute rounded-full border border-[#d7c1a3] bg-white relative"
        style={handleStyle(bottomLeft, bottomY)}
      >
        {blink ? <span className="watch-lug-handle-pulse absolute inset-[-5px] rounded-full border border-[#d7c1a3]/70" /> : null}
      </div>
      <div
        className="absolute rounded-full border border-[#d7c1a3] bg-white relative"
        style={handleStyle(bottomLeft + bottomWidth, bottomY)}
      >
        {blink ? <span className="watch-lug-handle-pulse absolute inset-[-5px] rounded-full border border-[#d7c1a3]/70" /> : null}
      </div>
    </div>
  );
}

function WatchOnlyLugGuideCoachmark({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mt-3 rounded-2xl border border-[#ead8c0] bg-white/94 p-4 shadow-[0_18px_40px_rgba(56,44,32,0.10)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Set the lug openings</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Line these guides up with the top and bottom lug openings. Drag the row or the end
            handles to match the width.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="neo-button rounded-xl px-2.5 py-1 text-xs font-semibold text-ink"
        >
          Got it
        </button>
      </div>
      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span>Top fit</span>
          <span>Then pick a strap</span>
        </div>
        <div className="mt-2 space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-[#d7c1a3] bg-white" />
            <span className="h-[2px] flex-1 rounded-full bg-[#d7c1a3]" />
            <span className="h-3 w-3 rounded-full border border-[#d7c1a3] bg-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg text-[#9b6a2f]">↕</span>
            <span className="text-xs text-slate-600">Move the row to the lug opening</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg text-[#9b6a2f]">↔</span>
            <span className="text-xs text-slate-600">Drag either end to set the width</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getWatchOnlyGuideHitTarget(
  point: { x: number; y: number },
  guides: PreviewLugGuides
): { guide: "top" | "bottom"; mode: GuideDragMode } | null {
  const hitBand = 18;
  const handleBand = 16;
  const topLeft = guides.centerX - guides.topWidth / 2;
  const topRight = guides.centerX + guides.topWidth / 2;
  const bottomLeft = guides.centerX - guides.bottomWidth / 2;
  const bottomRight = guides.centerX + guides.bottomWidth / 2;
  const inRange = (x: number, left: number, width: number) =>
    x >= left - 12 && x <= left + width + 12;

  if (Math.abs(point.x - topLeft) <= handleBand && Math.abs(point.y - guides.topY) <= handleBand) {
    return { guide: "top", mode: "resize-left" };
  }
  if (Math.abs(point.x - topRight) <= handleBand && Math.abs(point.y - guides.topY) <= handleBand) {
    return { guide: "top", mode: "resize-right" };
  }
  if (Math.abs(point.y - guides.topY) <= hitBand && inRange(point.x, topLeft, guides.topWidth)) {
    return { guide: "top", mode: "move" };
  }
  if (
    Math.abs(point.x - bottomLeft) <= handleBand &&
    Math.abs(point.y - guides.bottomY) <= handleBand
  ) {
    return { guide: "bottom", mode: "resize-left" };
  }
  if (
    Math.abs(point.x - bottomRight) <= handleBand &&
    Math.abs(point.y - guides.bottomY) <= handleBand
  ) {
    return { guide: "bottom", mode: "resize-right" };
  }
  if (
    Math.abs(point.y - guides.bottomY) <= hitBand &&
    inRange(point.x, bottomLeft, guides.bottomWidth)
  ) {
    return { guide: "bottom", mode: "move" };
  }
  return null;
}

function getWatchOnlyGuideWidthState(
  mode: GuideDragMode,
  initialCenterX: number,
  initialWidth: number,
  deltaX: number
) {
  if (mode === "move") return null;
  const minWidth = 48;
  const initialLeft = initialCenterX - initialWidth / 2;
  const initialRight = initialCenterX + initialWidth / 2;
  if (mode === "resize-left") {
    const nextLeft = clamp(initialLeft + deltaX, CANVAS_SIZE * 0.08, initialRight - minWidth);
    const width = initialRight - nextLeft;
    return { centerX: (nextLeft + initialRight) / 2, width };
  }
  const nextRight = clamp(initialRight + deltaX, initialLeft + minWidth, CANVAS_SIZE * 0.92);
  const width = nextRight - initialLeft;
  return { centerX: (initialLeft + nextRight) / 2, width };
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
  subtitle,
  disabled,
  loading,
  highlighted,
  sampleImageSrc,
  note,
  onClick
}: {
  title: string;
  subtitle?: string;
  disabled?: boolean;
  loading?: boolean;
  highlighted?: boolean;
  sampleImageSrc?: string;
  note?: string;
  onClick: () => void;
}) {
  return (
    <div
      className={`neo-control rounded-2xl p-4 transition ${
        highlighted
          ? "animate-pulse border-[#d7c1a3]/90 bg-[#fbf3e8] shadow-[0_0_0_1px_rgba(215,193,163,0.35),0_16px_30px_rgba(155,106,47,0.10)]"
          : ""
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {sampleImageSrc ? (
          <div className="w-24 shrink-0 overflow-hidden rounded-2xl border border-line bg-white/90 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sampleImageSrc}
              alt={`${title} sample`}
              className="h-20 w-full object-cover"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-lg font-semibold leading-tight text-ink">{title}</p>
              {subtitle ? (
                <p className="mt-1 text-sm leading-5 text-muted">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClick}
              disabled={disabled || loading}
              className={`neo-button min-w-[84px] shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                loading
                  ? "ai-pulse border-slate-300/80 bg-slate-100"
                  : highlighted
                    ? "atelier-accent-solid"
                    : "text-ink hover:opacity-90"
              }`}
            >
              {loading ? "Working" : highlighted ? "Ready" : "Run"}
            </button>
          </div>
          {note ? <p className="mt-2 max-w-[28rem] text-sm leading-5 text-muted">{note}</p> : null}
        </div>
      </div>
    </div>
  );
}

function FitBenchPanel({
  canRender,
  showFitBench,
  onToggleFitBench,
  fitConfidence,
  showLugGuides,
  onToggleLugGuides,
  onResetFit,
  isAutoAligning,
  strapGap,
  setGapHalf,
  lockView,
  showControlCoachmark,
  strapSizeUi,
  setStrapScale,
  dismissControlCoachmark,
  dialScale,
  setDialScaleValue,
  sceneZoom,
  setSceneZoomValue,
  onToggleLockView,
  preserveSettings,
  setPreserveSettings,
  reCropCurrentWatch,
  onChangeWatch,
  hasUserUpload
}: {
  canRender: boolean;
  showFitBench: boolean;
  onToggleFitBench: () => void;
  fitConfidence: number;
  showLugGuides: boolean;
  onToggleLugGuides: () => void;
  onResetFit: () => void;
  isAutoAligning: boolean;
  strapGap: number;
  setGapHalf: (value: number) => void;
  lockView: boolean;
  showControlCoachmark: boolean;
  strapSizeUi: number;
  setStrapScale: (value: number) => void;
  dismissControlCoachmark: () => void;
  dialScale: number;
  setDialScaleValue: (value: number) => void;
  sceneZoom: number;
  setSceneZoomValue: (value: number) => void;
  onToggleLockView: () => void;
  preserveSettings: boolean;
  setPreserveSettings: (value: boolean | ((prev: boolean) => boolean)) => void;
  reCropCurrentWatch: () => void;
  onChangeWatch: () => void;
  hasUserUpload: boolean;
}) {
  return (
    <div
      className={`rounded-[1.75rem] p-4 ${
        showFitBench && canRender
          ? "atelier-bench-panel"
          : "glass-card atelier-card-soft border border-line"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7c7165]">
            Fit Bench
          </p>
          {showFitBench && canRender ? (
            <p className="mt-1.5 max-w-[18rem] text-xs leading-5 text-[#5f5143]">
              {fitConfidence >= 0.65
                ? "Auto-fit has done most of the placement."
                : "Close fit. Refine size, gap, or framing here."}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggleFitBench}
          disabled={!canRender}
          className="neo-button rounded-2xl px-4 py-2 text-sm font-semibold text-ink disabled:opacity-45"
        >
          {showFitBench ? "Hide" : "Open"}
        </button>
      </div>

      {showFitBench && canRender ? (
        <div className="mt-4 space-y-2.5">
          <div className="grid gap-2.5">
            <div className="relative">
              <SliderControl
                label="Strap Gap"
                min={250}
                max={900}
                step={10}
                value={strapGap}
                onChange={setGapHalf}
                disabled={lockView}
                highlighted={showControlCoachmark}
                hint="Closer ↔ Wider"
              />
              {showControlCoachmark ? (
                <div className="pointer-events-none absolute inset-x-6 -bottom-3 flex items-center justify-center">
                  <div className="flex items-center gap-2 rounded-full border border-[#d7c1a3] bg-white/95 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#c08a44]" />
                    Size first. Then trim the gap.
                  </div>
                </div>
              ) : null}
            </div>
            <SliderControl
              label="Strap Size"
              min={0}
              max={100}
              step={1}
              value={strapSizeUi}
              onChange={(uiVal) => setStrapScale(uiToStrapScale(uiVal))}
              disabled={lockView}
              highlighted={showControlCoachmark}
              hint="Slimmer ↔ Fuller"
            />
            <SliderControl
              label="Dial Size"
              min={DIAL_SCALE_MIN}
              max={DIAL_SCALE_MAX}
              step={0.02}
              value={dialScale}
              onChange={setDialScaleValue}
              disabled={lockView}
              hint="Smaller ↔ Larger"
            />
            <SliderControl
              label="View Zoom"
              min={0.2}
              max={1.4}
              step={0.02}
              value={sceneZoom}
              onChange={setSceneZoomValue}
              hint="Whole watch ↔ Detail"
            />
          </div>

          <div className="space-y-2.5 pt-1">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onToggleLugGuides}
                className="neo-button rounded-xl px-3 py-1.5 text-xs font-semibold text-ink"
              >
                {showLugGuides ? "Hide lug guides" : "Show lug guides"}
              </button>
              <button
                type="button"
                onClick={onResetFit}
                className="neo-button rounded-xl px-3 py-1.5 text-xs font-semibold text-ink"
              >
                {isAutoAligning ? "Resetting..." : "Reset fit"}
              </button>
            </div>
            {showControlCoachmark ? (
              <div className="rounded-2xl border border-[#ead8c0]/80 bg-[#fdf7ef] px-3 py-2 shadow-[0_8px_20px_rgba(155,106,47,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs leading-5 text-slate-700">
                    Bigger straps usually want a little more breathing room. Land the size, then fine-trim the gap.
                  </p>
                  <button
                    type="button"
                    onClick={dismissControlCoachmark}
                    className="neo-button pointer-events-auto shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-ink"
                  >
                    Got it
                  </button>
                </div>
              </div>
            ) : null}
            <ToggleControl
              label="Lock Fit"
              description="Freeze the fit and inspect the pairing"
              enabled={lockView}
              onToggle={onToggleLockView}
            />
            <div className="neo-toggle flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Keep Tweaks</p>
                <p className="text-xs text-muted">Carry the fit tune to the next candidate.</p>
              </div>
              <button
                type="button"
                onClick={() => setPreserveSettings((prev) => !prev)}
                aria-pressed={preserveSettings}
                className={`relative h-8 w-14 shrink-0 overflow-hidden rounded-full border transition ${
                  preserveSettings ? "border-[#d7c1a3] bg-[#f6ead7]" : "border-line bg-canvas"
                }`}
              >
                <span
                  className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    preserveSettings ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reCropCurrentWatch}
                disabled={!hasUserUpload}
                className="neo-button rounded-xl px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
              >
                Re-crop current watch
              </button>
              <button
                type="button"
                onClick={onChangeWatch}
                className="neo-button rounded-xl px-3 py-2 text-xs font-semibold text-ink"
              >
                Change Watch
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
  hint?: string;
  disabled?: boolean;
  highlighted?: boolean;
}

function SliderControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
  displayValue,
  hint,
  disabled,
  highlighted = false
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
    <div className={`neo-control rounded-[1.15rem] p-3 transition ${highlighted ? "ring-2 ring-[#ead8c0]/90 shadow-[0_0_0_1px_rgba(215,193,163,0.32),0_10px_22px_rgba(155,106,47,0.08)]" : ""}`}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[15px] font-semibold text-ink">{label}</span>
        {displayValue ? <span className="text-xs text-muted">{displayValue}</span> : null}
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
      <div className="range-ticks mt-2" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
      {hint ? <p className="mt-2 text-[11px] font-medium tracking-[0.02em] text-muted">{hint}</p> : null}
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
    <div className="neo-control rounded-[1.15rem] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-ink">{label}</p>
          <p className="text-xs text-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={enabled}
          className={`relative h-9 w-16 shrink-0 overflow-hidden rounded-full border transition ${
            enabled
              ? "border-[#d7c1a3] bg-gradient-to-r from-[#f7e7cf] to-[#edd0aa]"
              : "border-line bg-canvas shadow-[inset_2px_2px_8px_rgba(56,44,32,0.08),inset_-4px_-4px_12px_rgba(255,255,255,0.48)]"
          }`}
        >
          <span
            className={`absolute left-1 top-1 h-7 w-7 rounded-full bg-white shadow-[0_8px_14px_rgba(15,23,42,0.18)] transition-transform ${
              enabled ? "translate-x-7" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
