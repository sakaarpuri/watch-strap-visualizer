"use client";

import { PointerEvent as ReactPointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
  STRAP_STYLE_TAGS,
  getStrapsForCategory,
  StrapCategory,
  StrapStyleTag,
  StrapVariant
} from "@/lib/strapLibrary";
import type { SimilarProductCard } from "@/lib/shopping";
import {
  DrawerStrapItem,
  libraryStrapToDrawerItem,
  SavedStrap,
  SavedWatch,
  savedStrapToDrawerItem
} from "@/lib/collection";
import { usePersonalCollection } from "@/hooks/usePersonalCollection";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const STRAP_SCALE_MIN = 5;
const STRAP_SCALE_MAX = 260;
const DIAL_SCALE_MIN = 0.7;
const DIAL_SCALE_MAX = 1.8;
const DEFAULT_WATCH_PREVIEW_SCALE = 0.64;
const DEFAULT_SCENE_ZOOM = 0.75;
const DEFAULT_STRAP_AUTO_FIT_WIDTH_FACTOR = 0.28;
const SHOW_SHOPPING_PREVIEW = false;
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

type AiToolKey = "cleanup" | "rescue" | "final" | "strapPrep";
type StrapSourceMode = "library" | "uploaded" | "saved";
type StrapDrawerView = "library" | "saved" | "favorites" | "uploaded";
type FitState = "auto" | "adjusted" | "locked";
type GuideDragMode = "move" | "resize-left" | "resize-right";
type PendingStrapSelection =
  | { sourceType: "library"; strap: StrapVariant; index: number }
  | { sourceType: "saved"; strap: SavedStrap }
  | null;

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
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

interface UploadedSplitPart {
  file: File;
  url: string;
}

interface AuthFormState {
  fullName: string;
  email: string;
  password: string;
}

const defaultToolState = (): Record<AiToolKey, AiToolState> => ({
  cleanup: { loading: false, error: null },
  rescue: { loading: false, error: null },
  final: { loading: false, error: null },
  strapPrep: { loading: false, error: null }
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

const SAMPLE_WATCH_HEADS = [
  { id: "dress", label: "Dress", src: "/mock-watches/dress-watch.webp" },
  { id: "diver", label: "Diver", src: "/mock-watches/diver-watch.webp" },
  { id: "field", label: "Field", src: "/mock-watches/field-watch.webp" },
  { id: "chronograph", label: "Chronograph", src: "/mock-watches/chronograph-watch.webp" },
  { id: "pilot", label: "Pilot", src: "/mock-watches/pilot-watch.webp" },
  { id: "integrated-sports", label: "Integrated", src: "/mock-watches/integrated-sports-watch.webp" }
] as const;

type SampleWatchHead = (typeof SAMPLE_WATCH_HEADS)[number];

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

export default function HomePageClient({
  buildVersion
}: {
  buildVersion: string;
}) {
  const {
    configured: accountConfigured,
    loading: accountLoading,
    authBusy,
    authMessage,
    user,
    profile,
    savedWatches,
    savedStraps,
    savedLooks,
    favoriteLookup,
    signIn,
    signUp,
    signOut,
    updateDisplayName,
    updatePassword,
    saveWatch,
    saveStrap,
    saveLook,
    renameWatch,
    deleteWatch,
    renameStrap,
    deleteStrap,
    renameLook,
    deleteLook,
    toggleFavorite
  } = usePersonalCollection();
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
  const [strapDrawerView, setStrapDrawerView] = useState<StrapDrawerView>("library");
  const [category, setCategory] = useState<StrapCategory>("All categories");
  const [styleFilter, setStyleFilter] = useState<StrapStyleTag | "All styles">("All styles");
  const [strapIndex, setStrapIndex] = useState(0);
  const [selectedLibraryStrap, setSelectedLibraryStrap] = useState<StrapVariant | null>(null);
  const [selectedSavedStrap, setSelectedSavedStrap] = useState<SavedStrap | null>(null);
  const [pendingStrapSelection, setPendingStrapSelection] = useState<PendingStrapSelection>(null);
  const [partA, setPartA] = useState<PartTransform | null>(null);
  const [partB, setPartB] = useState<PartTransform | null>(null);
  const [dialScale, setDialScale] = useState(DEFAULT_WATCH_PREVIEW_SCALE);
  const [sceneZoom, setSceneZoom] = useState(DEFAULT_SCENE_ZOOM);
  const [preserveSettings, setPreserveSettings] = useState(true);
  const [lockView, setLockView] = useState(false);
  const [fitState, setFitState] = useState<FitState>("auto");
  const [fitConfidence, setFitConfidence] = useState(0);
  const [showFitBench, setShowFitBench] = useState(false);
  const [mobileBenchToolsOpen, setMobileBenchToolsOpen] = useState(false);
  const [isAutoAligning, setIsAutoAligning] = useState(false);
  const [aiTools, setAiTools] = useState<Record<AiToolKey, AiToolState>>(defaultToolState);
  const [generatedResults, setGeneratedResults] = useState<GeneratedResultState>({
    final: null
  });
  const [inlineMockupUrl, setInlineMockupUrl] = useState<string | null>(null);
  const [showUploadGuide, setShowUploadGuide] = useState(false);
  const [highlightPreviewWindow, setHighlightPreviewWindow] = useState(false);
  const [hasAutoOpenedUploadGuide, setHasAutoOpenedUploadGuide] = useState(false);
  const [lugGuideOverrides, setLugGuideOverrides] = useState<PreviewLugGuideOverrides | null>(null);
  const [detectedPreviewLugGuides, setDetectedPreviewLugGuides] = useState<PreviewLugGuides | null>(null);
  const [showLugGuides, setShowLugGuides] = useState(true);
  const [showLugGuideOnboarding, setShowLugGuideOnboarding] = useState(false);
  const [similarProducts, setSimilarProducts] = useState<SimilarProductCard[]>([]);
  const [similarProductsLoading, setSimilarProductsLoading] = useState(false);
  const [mockupReadyHighlight, setMockupReadyHighlight] = useState(false);
  const [animateStrapSettle, setAnimateStrapSettle] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showMyWatchesDialog, setShowMyWatchesDialog] = useState(false);
  const [showSavedLooksDialog, setShowSavedLooksDialog] = useState(false);
  const [showSampleWatchesDialog, setShowSampleWatchesDialog] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authError, setAuthError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState<AuthFormState>({
    fullName: "",
    email: "",
    password: ""
  });
  const [activeAiStatus, setActiveAiStatus] = useState<ActiveAiStatus>({
    tool: null,
    label: "",
    stage: ""
  });
  const [activeSavedWatchId, setActiveSavedWatchId] = useState<string | null>(null);

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

  const sortStrapsForCategory = (nextCategory: StrapCategory) => {
    const straps = [...getStrapsForCategory(nextCategory)];
    return straps.sort((a, b) => {
      if (nextCategory === "All categories") {
        const categoryDiff =
          ALL_CATEGORY_PRIORITY.indexOf(a.category) - ALL_CATEGORY_PRIORITY.indexOf(b.category);
        if (categoryDiff !== 0) return categoryDiff;
      }
      const scoreDiff = getStrapSortScore(a) - getStrapSortScore(b);
      if (scoreDiff !== 0) return scoreDiff;
      return a.label.localeCompare(b.label);
    });
  };

  const strapsInCategory = useMemo(() => sortStrapsForCategory(category), [category]);
  const filteredLibraryStraps = useMemo(() => {
    if (styleFilter === "All styles") return strapsInCategory;
    return strapsInCategory.filter((strap) => strap.styleTags.includes(styleFilter));
  }, [strapsInCategory, styleFilter]);
  const allLibraryStraps = useMemo(() => getStrapsForCategory("All categories"), []);
  const favoriteLibraryStraps = useMemo(
    () =>
      allLibraryStraps.filter((strap) =>
        favoriteLookup.has(`library:${strap.id}`)
      ),
    [allLibraryStraps, favoriteLookup]
  );
  const favoriteSavedStraps = useMemo(
    () =>
      savedStraps.filter((strap) =>
        favoriteLookup.has(`saved:${strap.id}`)
      ),
    [favoriteLookup, savedStraps]
  );
  const favoriteDrawerItems = useMemo<DrawerStrapItem[]>(
    () => [
      ...favoriteLibraryStraps.map(libraryStrapToDrawerItem),
      ...favoriteSavedStraps.map(savedStrapToDrawerItem)
    ],
    [favoriteLibraryStraps, favoriteSavedStraps]
  );
  const savedDrawerItems = useMemo<DrawerStrapItem[]>(
    () => savedStraps.map(savedStrapToDrawerItem),
    [savedStraps]
  );
  const libraryDrawerItems = useMemo<DrawerStrapItem[]>(
    () => filteredLibraryStraps.map(libraryStrapToDrawerItem),
    [filteredLibraryStraps]
  );
  const resolvedLibraryIndex =
    selectedLibraryStrap && strapSourceMode === "library"
      ? filteredLibraryStraps.findIndex((strap) => strap.id === selectedLibraryStrap.id)
      : -1;
  const activeLibraryIndex = resolvedLibraryIndex >= 0 ? resolvedLibraryIndex : strapIndex;
  const currentStrap: StrapVariant =
    (strapSourceMode === "library" ? selectedLibraryStrap : null) ??
    filteredLibraryStraps[activeLibraryIndex] ??
    filteredLibraryStraps[0];
  const hasUserUpload = Boolean(uploadedWatchFile && originalWatchSrc);
  const hasUploadedStrap = Boolean(uploadedStrapPartA && uploadedStrapPartB);
  const activeLibraryStrap = strapSourceMode === "library" ? selectedLibraryStrap : null;
  const activeSavedStrap = strapSourceMode === "saved" ? selectedSavedStrap : null;
  const currentSampleWatch =
    originalWatchSrc ? SAMPLE_WATCH_HEADS.find((sample) => sample.src === originalWatchSrc) ?? null : null;
  const activeStrapASrc =
    strapSourceMode === "uploaded" && uploadedStrapPartA
      ? uploadedStrapPartA.url
      : activeSavedStrap?.strap_a_url ?? activeLibraryStrap?.strapASrc;
  const activeStrapBSrc =
    strapSourceMode === "uploaded" && uploadedStrapPartB
      ? uploadedStrapPartB.url
      : activeSavedStrap?.strap_b_url ?? activeLibraryStrap?.strapBSrc;
  const activeStrapLabel =
    strapSourceMode === "uploaded"
      ? "Your Strap"
      : activeSavedStrap?.label ?? activeLibraryStrap?.label ?? "Selected strap";
  const activeJoinShape =
    strapSourceMode === "uploaded" || strapSourceMode === "saved"
      ? "flat"
      : activeLibraryStrap?.joinShape;
  const activeAutoFitWidthFactor =
    strapSourceMode === "uploaded" || strapSourceMode === "saved"
      ? DEFAULT_STRAP_AUTO_FIT_WIDTH_FACTOR
      : activeLibraryStrap?.autoFitWidthFactor ?? DEFAULT_STRAP_AUTO_FIT_WIDTH_FACTOR;
  const activeAutoGapFactor =
    strapSourceMode === "uploaded" || strapSourceMode === "saved"
      ? undefined
      : activeLibraryStrap?.autoGapFactor;
  const activeDrawerItems =
    strapDrawerView === "favorites"
      ? favoriteDrawerItems
      : strapDrawerView === "saved"
        ? savedDrawerItems
        : libraryDrawerItems;
  const canRender = useMemo(
    () => Boolean(partA && partB && activeStrapASrc && activeStrapBSrc),
    [partA, partB, activeStrapASrc, activeStrapBSrc]
  );
  const hasPendingPreUploadStrap = Boolean(pendingStrapSelection && hasUserUpload && !canRender);
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
    ? "Your strap is on the bench. Open the bench if you want to refine it."
    : cropSourceUrl
      ? "Frame the watch in this same stage, then apply the crop."
      : canShowWatchOnlyPreview
        ? hasPendingPreUploadStrap
          ? `Your watch is ready. Line up the lug guides, then apply ${pendingStrapSelection?.strap.label ?? "your selected strap"}.`
          : "Your watch is ready. Line up the lug guides if needed, then pick a strap."
        : "";
  const canOpenTools = hasUserUpload && !cropSourceUrl;

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
    setActiveSavedWatchId(null);
    setPartA(null);
    setPartB(null);
    setLockView(false);
    setFitState("auto");
    setShowFitBench(false);
    setLugGuideOverrides(null);
    setShowLugGuides(true);
    setShowLugGuideOnboarding(false);
    setShowUploadGuide(false);
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
    setStrapDrawerView("uploaded");
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
    setStrapDrawerView("uploaded");
    setShowFitBench(false);
    setFitState("auto");
    triggerStrapSettle();
  };

  useEffect(() => {
    if (!highlightPreviewWindow) return undefined;
    const timeout = window.setTimeout(() => setHighlightPreviewWindow(false), 3500);
    return () => window.clearTimeout(timeout);
  }, [highlightPreviewWindow]);

  useEffect(() => {
    setStrapIndex(0);
    if (selectedLibraryStrap && !filteredLibraryStraps.some((strap) => strap.id === selectedLibraryStrap.id)) {
      setSelectedLibraryStrap(null);
    }
  }, [filteredLibraryStraps, selectedLibraryStrap]);

  useEffect(() => {
    if (resolvedLibraryIndex >= 0 && resolvedLibraryIndex !== strapIndex) {
      setStrapIndex(resolvedLibraryIndex);
    }
  }, [resolvedLibraryIndex, strapIndex]);

  useEffect(() => {
    return () => {
      if (mockupReadyTimeoutRef.current) {
        window.clearTimeout(mockupReadyTimeoutRef.current);
      }
      if (strapSettleTimeoutRef.current) {
        window.clearTimeout(strapSettleTimeoutRef.current);
      }
    };
  }, []);

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
    let active = true;
    const loadDefaultPreviewGuides = async () => {
      try {
        const guides = await detectPreviewLugGuides(watchSrc, dialScale);
        if (!active) return;
        setDetectedPreviewLugGuides(guides);
      } catch {
        if (!active) return;
        setDetectedPreviewLugGuides(null);
      }
    };
    void loadDefaultPreviewGuides();
    return () => {
      active = false;
    };
  }, [watchSrc, dialScale]);

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

  useEffect(() => {
    if (!saveFeedback) return undefined;
    const timeout = window.setTimeout(() => setSaveFeedback(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [saveFeedback]);

  useEffect(() => {
    if (user) return;
    if (strapDrawerView === "saved" || strapDrawerView === "favorites") {
      setStrapDrawerView("library");
    }
  }, [strapDrawerView, user]);

  const handleGuideToggle = () => {
    setShowLugGuides((prev) => {
      const next = !prev;
      if (prev && !next && hasPendingPreUploadStrap) {
        window.setTimeout(() => applyPendingSelection(), 0);
      }
      return next;
    });
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

  const requireSignedIn = (message = "Sign in to save items to your collection.") => {
    if (user) return true;
    setAuthError(message);
    setShowAuthDialog(true);
    return false;
  };

  const handleAuthSubmit = async () => {
    try {
      setAuthError(null);
      if (authMode === "sign-up") {
        await signUp(authForm.fullName.trim(), authForm.email.trim(), authForm.password);
      } else {
        await signIn(authForm.email.trim(), authForm.password);
        setShowAuthDialog(false);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "We couldn't sign you in.");
    }
  };

  const handleSaveStrapToCollection = async () => {
    if (!uploadedStrapPartA || !uploadedStrapPartB || !requireSignedIn("Sign in to save this strap to your collection.")) return;
    const label = window.prompt("Name this strap for your collection.", "My strap")?.trim();
    if (!label) return;
    try {
      await saveStrap({
        label,
        category,
        partAFile: uploadedStrapPartA.file,
        partBFile: uploadedStrapPartB.file
      });
      setSaveFeedback(`Saved ${label} to My Straps.`);
      setStrapDrawerView("saved");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "We couldn't save that strap.");
    }
  };

  const handleSelectSavedWatch = async (watch: SavedWatch) => {
    try {
      const fetched = await fileFromSrc(watch.image_url, `${watch.label}.png`);
      const nextUrl = watch.image_url;
      setOriginalWatchFile(fetched);
      setOriginalWatchSrc(nextUrl);
      setActiveSavedWatchId(watch.id);
      applyWatchAsset(fetched, nextUrl);
      setShowMyWatchesDialog(false);
    } catch {
      setAuthError("We couldn't load that saved watch.");
    }
  };

  const handleSelectSampleWatch = async (sample: SampleWatchHead) => {
    try {
      const fetched = await fileFromSrc(sample.src, `${sample.id}.png`);
      setOriginalWatchFile(fetched);
      setOriginalWatchSrc(sample.src);
      setActiveSavedWatchId(null);
      applyWatchAsset(fetched, sample.src);
    } catch {
      setAuthError("We couldn't load that sample watch.");
    }
  };

  const handleFavoriteToggle = async (item: DrawerStrapItem) => {
    if (!requireSignedIn("Sign in to save favorites across devices.")) return;
    try {
      if (item.sourceType === "library" && item.libraryStrap) {
        await toggleFavorite({ sourceType: "library", libraryStrapId: item.libraryStrap.id });
      } else if (item.sourceType === "saved" && item.savedStrap) {
        await toggleFavorite({ sourceType: "saved", savedStrapId: item.savedStrap.id });
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "We couldn't update that favorite.");
    }
  };

  const applyPendingSelection = () => {
    if (!pendingStrapSelection) return;
    if (pendingStrapSelection.sourceType === "library") {
      setStrapIndex(pendingStrapSelection.index);
      setSelectedLibraryStrap(pendingStrapSelection.strap);
      setSelectedSavedStrap(null);
      setStrapSourceMode("library");
    } else {
      setSelectedSavedStrap(pendingStrapSelection.strap);
      setSelectedLibraryStrap(null);
      setStrapSourceMode("saved");
    }
    setPendingStrapSelection(null);
    setShowFitBench(false);
    setFitState("auto");
    triggerStrapSettle();
  };

  const handleSaveLook = async () => {
    if (!canRender || !requireSignedIn("Sign in to save this finished pairing to Saved Looks.")) return;
    const blob = await canvasRef.current?.getPngBlob();
    if (!blob) return;
    const defaultName = `${activeStrapLabel} look`;
    const label = window.prompt("Name this finished look.", defaultName)?.trim();
    if (!label) return;

    try {
      const lookFile = new File([blob], `${label.replace(/\s+/g, "-").toLowerCase() || "saved-look"}.png`, {
        type: "image/png"
      });
      await saveLook({
        label,
        file: lookFile,
        watchLabel: activeSavedWatchId
          ? savedWatches.find((watch) => watch.id === activeSavedWatchId)?.label || "Saved watch"
          : uploadedWatchFile?.name.replace(/\.[^.]+$/, "") || "Uploaded watch",
        watchSourceType: activeSavedWatchId ? "saved" : "uploaded",
        savedWatchId: activeSavedWatchId,
        strapLabel: activeStrapLabel,
        strapSourceType: strapSourceMode,
        libraryStrapId: activeLibraryStrap?.id ?? null,
        savedStrapId: activeSavedStrap?.id ?? null,
        fitSettings: {
          lockView,
          dialScale,
          sceneZoom,
          preserveSettings,
          lugGuideOverrides,
          partA,
          partB
        }
      });
      setSaveFeedback(`Saved ${label} to Saved Looks.`);
      setShowSavedLooksDialog(true);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "We couldn't save that look.");
    }
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
      const effectiveGuidePlacement = lugGuideOverrides ?? detectedPreviewLugGuides ?? undefined;
      const shouldPreserve = Boolean(
        latestPartA &&
          latestPartB &&
          fitState !== "auto" &&
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
        effectiveGuidePlacement
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
    if (strapSourceMode !== "library" || !activeLibraryStrap) return;
    const total = filteredLibraryStraps.length;
    if (!total) return;
    const neighborIndices = [
      activeLibraryIndex,
      (activeLibraryIndex + 1) % total,
      (activeLibraryIndex - 1 + total) % total
    ];
    const uniqueIndices = [...new Set(neighborIndices)];
    void Promise.all(
      uniqueIndices.flatMap((index) => {
        const strap = filteredLibraryStraps[index];
        if (!strap) return [];
        return [loadStrapImage(strap.strapASrc), loadStrapImage(strap.strapBSrc)];
      })
    ).catch(() => undefined);
  }, [activeLibraryIndex, activeLibraryStrap, category, strapSourceMode, filteredLibraryStraps]);

  const onCycleStrap = (direction: 1 | -1) => {
    if (strapSourceMode !== "library") return;
    const total = filteredLibraryStraps.length;
    if (!total) return;
    triggerStrapSettle();
    const nextIndex = (activeLibraryIndex + direction + total) % total;
    const nextStrap = filteredLibraryStraps[nextIndex];
    if (!nextStrap) return;
    setStrapIndex(nextIndex);
    setSelectedLibraryStrap(nextStrap);
  };

  const activateLibraryStrap = (strap: StrapVariant, index: number) => {
    if (!hasUserUpload) {
      setPendingStrapSelection({ sourceType: "library", strap, index });
      setSelectedLibraryStrap(null);
      setSelectedSavedStrap(null);
      setStrapSourceMode("library");
      setShowFitBench(false);
      setFitState("auto");
      setHighlightPreviewWindow(true);
      return;
    }
    setPendingStrapSelection(null);
    setStrapIndex(index);
    setSelectedLibraryStrap(strap);
    setSelectedSavedStrap(null);
    setStrapSourceMode("library");
    setShowFitBench(false);
    setFitState("auto");
    setHighlightPreviewWindow(true);
    triggerStrapSettle();
    window.setTimeout(() => {
      previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
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
      setAiStage("cleanup", "Extract Watch with AI", "Uploading");
      const preparedFile = await prepareAiInput(uploadedWatchFile, {
        maxSide: 1200,
        quality: 0.86
      });
      const formData = new FormData();
      formData.append("image", preparedFile);
      setAiStage("cleanup", "Extract Watch with AI", "Removing background");
      const imageUrl = await postToolForm("/api/kie/cleanup", formData);
      setAiStage("cleanup", "Extract Watch with AI", "Applying result");
      applyProcessedWatch(imageUrl);
      setToolLoading("cleanup", false);
    } catch (error) {
      setToolLoading("cleanup", false, formatAiError(error));
    }
  };

  const runStrapSheetPrep = async () => {
    if (!uploadedStrapSheetFile) return;
    setToolLoading("strapPrep", true);
    try {
      setAiStage("strapPrep", "Prepare Strap Sheet", "Uploading");
      const preparedFile = await prepareAiInput(uploadedStrapSheetFile, {
        maxSide: 1400,
        quality: 0.88
      });
      const formData = new FormData();
      formData.append("image", preparedFile);
      setAiStage("strapPrep", "Prepare Strap Sheet", "Cleaning background");
      const imageUrl = await postToolForm("/api/kie/cleanup", formData);
      setAiStage("strapPrep", "Prepare Strap Sheet", "Opening split tool");
      const nextFile = await fileFromSrc(imageUrl, `${uploadedStrapSheetFile.name.replace(/\.[^.]+$/, "") || "strap-sheet"}-prepped.png`);
      const nextUrl = URL.createObjectURL(nextFile);
      setUploadedStrapSheetFile(nextFile);
      setUploadedStrapSheetUrl(nextUrl);
      setStrapSplitSourceUrl(nextUrl);
      setUploadedStrapPartA(null);
      setUploadedStrapPartB(null);
      setStrapSourceMode("uploaded");
      setStrapDrawerView("uploaded");
      setToolLoading("strapPrep", false);
    } catch (error) {
      setToolLoading("strapPrep", false, formatAiError(error));
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
      <header className="relative mb-10 text-center sm:mb-12">
        <div className="absolute right-0 top-0 flex items-center gap-2">
          {saveFeedback ? (
            <span className="rounded-full border border-[#d7c1a3] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#7c5b2e]">
              {saveFeedback}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (!requireSignedIn("Sign in to review your saved looks.")) return;
              setShowSavedLooksDialog(true);
            }}
            className="neo-button rounded-2xl px-4 py-2 text-sm font-semibold text-ink"
          >
            Saved Looks
          </button>
          {user ? (
            <button
              type="button"
              onClick={() => setShowSettingsDialog(true)}
              className="neo-button rounded-2xl px-4 py-2 text-sm font-semibold text-ink"
            >
              {profile?.full_name?.trim() || user.email || "Account"}
            </button>
          ) : accountConfigured ? (
            <button
              type="button"
              onClick={() => {
                setAuthMode("sign-in");
                setAuthError(null);
                setShowAuthDialog(true);
              }}
              className="neo-button rounded-2xl px-4 py-2 text-sm font-semibold text-ink"
            >
              Sign in
            </button>
          ) : null}
        </div>
        <p className="font-serif text-[2.3rem] leading-none tracking-tight text-[#2b241d] sm:text-[2.9rem]">
          Watchstrapper
        </p>
        <h1 className="mt-4 font-['Instrument_Sans',ui-sans-serif,system-ui,sans-serif] text-[1.4rem] font-medium leading-[1.02] tracking-[-0.04em] text-ink sm:text-[2.2rem]">
          See any strap on your watch.
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
            </div>
            <div className="mt-4 inline-flex flex-wrap rounded-full border border-line bg-canvas p-1">
              {[
                { view: "library" as const, label: "Library" },
                { view: "saved" as const, label: "My Straps", disabled: !user },
                { view: "favorites" as const, label: "Favorites", disabled: !user },
                { view: "uploaded" as const, label: "Your Strap" }
              ].map((option) => {
                const active = strapDrawerView === option.view;
                return (
                  <button
                    key={option.view}
                    type="button"
                    onClick={() => {
                      if (option.disabled) {
                        setAuthMode("sign-in");
                        setAuthError("Sign in to view your saved straps and favorites.");
                        setShowAuthDialog(true);
                        return;
                      }
                      setStrapDrawerView(option.view);
                      if (option.view === "uploaded") {
                        setStrapSourceMode("uploaded");
                      }
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "atelier-pill-active"
                        : "text-ink hover:bg-white"
                    } ${option.disabled ? "opacity-60" : ""}`}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {strapDrawerView === "library" ? (
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
                          const nextCategoryStraps = sortStrapsForCategory(option);
                          const nextVisibleStraps =
                            styleFilter === "All styles"
                              ? nextCategoryStraps
                              : nextCategoryStraps.filter((strap) => strap.styleTags.includes(styleFilter));
                          if (!nextVisibleStraps.length) {
                            setStrapIndex(0);
                            setSelectedLibraryStrap(null);
                            setSelectedSavedStrap(null);
                            setStrapSourceMode("library");
                            setShowFitBench(false);
                            setFitState("auto");
                            return;
                          }
                          activateLibraryStrap(nextVisibleStraps[0], 0);
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
                <div className="mt-3 xl:hidden">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c7165]">
                      Style Mood
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStyleFilter("All styles")}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        styleFilter === "All styles"
                          ? "atelier-pill-active"
                          : "border-line bg-canvas text-ink hover:border-[#d7c1a3] hover:bg-white"
                      }`}
                      aria-pressed={styleFilter === "All styles"}
                    >
                      All styles
                    </button>
                    {STRAP_STYLE_TAGS.map((tag) => {
                      const count = strapsInCategory.filter((strap) => strap.styleTags.includes(tag)).length;
                      if (!count) return null;
                      const active = styleFilter === tag;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setStyleFilter(tag)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
                            active
                              ? "atelier-pill-active"
                              : "border-line bg-canvas text-ink hover:border-[#d7c1a3] hover:bg-white"
                          }`}
                          aria-pressed={active}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="strap-browser-shell mt-3 rounded-[1.35rem] border border-line bg-canvas/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
                    {styleFilter === "All styles"
                      ? category === "All categories"
                        ? "Full Strap Drawer"
                        : `Inside ${category}`
                      : `${styleFilter} straps`}
                  </p>
                  <div className="strap-browser-stack mt-3 max-h-[42rem] overflow-y-auto pr-1">
                    {libraryDrawerItems.map((item, index) => {
                      const strap = item.libraryStrap as StrapVariant;
                      const active = strapSourceMode === "library" && selectedLibraryStrap?.id === strap.id;
                      return (
                        <StrapDrawerButton
                          key={strap.id}
                          onClick={() => {
                            activateLibraryStrap(strap, index);
                          }}
                          strap={strap}
                          active={
                            !hasUserUpload && pendingStrapSelection?.sourceType === "library"
                              ? pendingStrapSelection.strap.id === strap.id
                              : active
                          }
                          showCategory={false}
                          isFavorite={favoriteLookup.has(`library:${strap.id}`)}
                          onToggleFavorite={() => void handleFavoriteToggle(item)}
                          stackIndex={index}
                          totalItems={libraryDrawerItems.length}
                        />
                      );
                    })}
                    {!libraryDrawerItems.length ? (
                      <p className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-6 text-sm text-muted">
                        No straps in this category match the current style filter yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : strapDrawerView === "saved" || strapDrawerView === "favorites" ? (
              <div className="mt-4 rounded-[1.35rem] border border-line bg-canvas/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
                    {strapDrawerView === "saved" ? "My Straps" : "Favorite Straps"}
                  </p>
                  {!user ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("sign-in");
                        setShowAuthDialog(true);
                      }}
                      className="neo-button rounded-xl px-3 py-1.5 text-xs font-semibold text-ink"
                    >
                      Sign in
                    </button>
                  ) : null}
                </div>
                {activeDrawerItems.length ? (
                  <div className="mt-3 space-y-3">
                    {activeDrawerItems.map((item, index) => {
                      const saved = item.savedStrap;
                      const library = item.libraryStrap;
                      return (
                        <div key={item.key} className="space-y-2">
                          <StrapDrawerButton
                            strap={{
                              id: item.id,
                              label: item.label,
                              category: item.category,
                              styleTags: library?.styleTags ?? [],
                              strapASrc: item.strapASrc,
                              strapBSrc: item.strapBSrc,
                              tint: library?.tint ?? { name: "Original", color: "#000000", alpha: 0 },
                              shopping: library?.shopping ?? {
                                material: "leather",
                                styleFamily: "classic",
                                colorFamily: "brown",
                                hardwareFinish: "silver",
                                keywords: []
                              },
                              joinShape: library?.joinShape
                            }}
                            active={
                              !hasUserUpload && pendingStrapSelection
                                ? pendingStrapSelection.sourceType === item.sourceType &&
                                  (item.sourceType === "saved"
                                    ? pendingStrapSelection.strap.id === saved?.id
                                    : pendingStrapSelection.strap.id === library?.id)
                                : item.sourceType === "saved"
                                  ? strapSourceMode === "saved" && selectedSavedStrap?.id === saved?.id
                                  : strapSourceMode === "library" && selectedLibraryStrap?.id === library?.id
                            }
                            showCategory={false}
                            onClick={() => {
                              if (!hasUserUpload) {
                                if (item.sourceType === "saved" && saved) {
                                  setPendingStrapSelection({ sourceType: "saved", strap: saved });
                                  setStrapSourceMode("saved");
                                }
                                if (item.sourceType === "library" && library) {
                                  setPendingStrapSelection({ sourceType: "library", strap: library, index });
                                  setStrapSourceMode("library");
                                }
                                setSelectedLibraryStrap(null);
                                setSelectedSavedStrap(null);
                                setShowFitBench(false);
                                setFitState("auto");
                                setHighlightPreviewWindow(true);
                                return;
                              }
                              setPendingStrapSelection(null);
                              if (item.sourceType === "saved" && saved) {
                                setSelectedSavedStrap(saved);
                                setSelectedLibraryStrap(null);
                                setStrapSourceMode("saved");
                              }
                              if (item.sourceType === "library" && library) {
                                setSelectedLibraryStrap(library);
                                setSelectedSavedStrap(null);
                                setStrapSourceMode("library");
                              }
                              setShowFitBench(false);
                              setFitState("auto");
                              if (hasUserUpload) {
                                triggerStrapSettle();
                              }
                            }}
                            isFavorite={favoriteLookup.has(`${item.sourceType}:${item.id}`)}
                            onToggleFavorite={() => void handleFavoriteToggle(item)}
                            stackIndex={index}
                            totalItems={activeDrawerItems.length}
                          />
                          {item.sourceType === "saved" && saved ? (
                            <div className="flex flex-wrap gap-2 pl-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  const nextLabel = window.prompt("Rename this saved strap.", saved.label)?.trim();
                                  if (!nextLabel || nextLabel === saved.label) return;
                                  try {
                                    await renameStrap(saved.id, nextLabel);
                                  } catch (error) {
                                    setAuthError(error instanceof Error ? error.message : "We couldn't rename that strap.");
                                  }
                                }}
                                className="neo-button rounded-xl px-3 py-1.5 text-xs font-semibold text-ink"
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!window.confirm(`Delete ${saved.label} from My Straps?`)) return;
                                  try {
                                    await deleteStrap(saved);
                                  } catch (error) {
                                    setAuthError(error instanceof Error ? error.message : "We couldn't delete that strap.");
                                  }
                                }}
                                className="neo-button rounded-xl px-3 py-1.5 text-xs font-semibold text-ink"
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    {user
                      ? strapDrawerView === "saved"
                        ? "Save a split strap to build your own drawer."
                        : "Favorite straps you love and they will collect here."
                      : "Sign in to use your saved strap collection."}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-[1.35rem] border border-line bg-canvas/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                  <p className="text-sm uppercase tracking-[0.12em] text-muted">Your Strap Sheet</p>
                  <p className="mt-2 text-sm text-muted">
                    Upload one straight pair image: buckle side on top, tail side below.
                  </p>
                  <div className="mt-4 rounded-[1.1rem] border border-[#e1d6c8] bg-white/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7a6a57]">
                      Best photo style
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm leading-5 text-muted">
                      <li>Retailer-style product photo on a clean white or pale background.</li>
                      <li>Shot straight-on from above, not angled or in perspective.</li>
                      <li>Buckle half on top, tail half below, both fully visible end to end.</li>
                      <li>No watch head attached, no hand holding it, and very light shadow only.</li>
                    </ul>
                    <p className="mt-3 text-sm text-muted">
                      That is the most common internet product-photo style and the easiest format for this site to split and preview accurately.
                    </p>
                  </div>
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
                    <button
                      type="button"
                      onClick={() => void runStrapSheetPrep()}
                      disabled={!uploadedStrapSheetFile || aiTools.strapPrep.loading}
                      className="neo-button rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
                    >
                      {aiTools.strapPrep.loading ? "Preparing..." : "Prepare Strap Sheet with AI"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveStrapToCollection()}
                      disabled={!hasUploadedStrap}
                      className="neo-button rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
                    >
                      Save Strap to Collection
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    AI prep helps when the source photo has a noisy background or weak edge separation before you open the split tool.
                  </p>
                  {aiTools.strapPrep.error ? (
                    <div className="mt-3">
                      <ErrorText message={aiTools.strapPrep.error} />
                    </div>
                  ) : null}
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
          className={`relative order-1 min-w-0 space-y-3 sm:space-y-4 xl:order-2 ${hasUserUpload ? "" : "xl:pt-14 xl:max-w-[58rem]"}`}
        >
          <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-x-8">
            <div className="max-w-[38rem]">
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
            <div className="space-y-2 sm:hidden">
              <button
                type="button"
                onClick={() => changeWatchInputRef.current?.click()}
                className="neo-button min-h-[3.2rem] w-full rounded-[1.2rem] px-4 py-2.5 text-sm font-semibold text-ink"
              >
                {hasUserUpload ? "Upload New Watch" : "Upload Watch"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                {currentSampleWatch ? (
                  <button
                    type="button"
                    onClick={() => setShowSampleWatchesDialog(true)}
                    className="neo-button min-h-[3.05rem] rounded-[1.15rem] px-4 py-2.5 text-sm font-semibold text-ink"
                  >
                    Try Another Sample
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (!requireSignedIn("Sign in to reuse your prepared watch collection.")) return;
                    setShowMyWatchesDialog(true);
                  }}
                  className={`neo-button min-h-[3.05rem] rounded-[1.15rem] px-4 py-2.5 text-sm font-semibold text-ink ${
                    currentSampleWatch ? "" : "col-span-1"
                  }`}
                >
                  My Watches
                </button>
              </div>
            </div>
            <div className="hidden grid-cols-1 gap-2 sm:grid sm:grid-cols-2 xl:w-[33rem] xl:justify-self-end">
              <button
                type="button"
                onClick={() => changeWatchInputRef.current?.click()}
                className="neo-button min-h-[3.6rem] rounded-[1.45rem] px-5 py-3 text-base font-semibold text-ink"
              >
                {hasUserUpload ? "Upload New Watch" : "Upload Watch"}
              </button>
              {currentSampleWatch ? (
                <button
                  type="button"
                  onClick={() => setShowSampleWatchesDialog(true)}
                  className="neo-button min-h-[3.6rem] rounded-[1.45rem] px-5 py-3 text-base font-semibold text-ink"
                >
                  Try Another Sample
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (!requireSignedIn("Sign in to reuse your prepared watch collection.")) return;
                  setShowMyWatchesDialog(true);
                }}
                className="neo-button min-h-[3.6rem] rounded-[1.45rem] px-5 py-3 text-base font-semibold text-ink"
              >
                My Watches
              </button>
            </div>
          </div>

          {(hasUserUpload && !cropSourceUrl) || canRender ? (
            <div className="grid grid-cols-2 gap-2 rounded-[1.3rem] border border-line bg-white/62 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] sm:flex sm:flex-wrap sm:items-center sm:rounded-[1.45rem] sm:px-4 sm:py-4">
              {canRender ? (
                <>
                  <button
                    type="button"
                    onClick={() => void onSavePreviewImage()}
                    className="neo-button min-h-[2.8rem] rounded-[1.05rem] px-3.5 py-2 text-[13px] font-semibold text-ink sm:min-h-[3.45rem] sm:rounded-[1.35rem] sm:px-5 sm:py-3 sm:text-base"
                  >
                    Save Image
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveLook()}
                    className="neo-button min-h-[2.8rem] rounded-[1.05rem] px-3.5 py-2 text-[13px] font-semibold text-ink sm:min-h-[3.45rem] sm:rounded-[1.35rem] sm:px-5 sm:py-3 sm:text-base"
                  >
                    Save Look
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          <div
            className={
              cropSourceUrl || canRender || canShowWatchOnlyPreview
                ? "relative -mx-1 glass-card atelier-card-soft rounded-[1.7rem] p-2.5 sm:mx-0 sm:rounded-[2rem] sm:p-4"
                : "relative -mx-1 sm:mx-0"
            }
          >
            {cropSourceUrl && originalWatchFile ? (
              <div className="space-y-4">
                <div className="glass-card atelier-card-soft rounded-[1.4rem] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
                        Extract Watch with AI
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        Use AI cleanup before cropping if the watch needs separating from the background.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void runCleanupFallback()}
                      disabled={!hasUserUpload || aiTools.cleanup.loading}
                      className="neo-button rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
                    >
                      {aiTools.cleanup.loading ? "Extracting..." : "Extract Watch with AI"}
                    </button>
                  </div>
                  {aiTools.cleanup.error ? (
                    <div className="mt-3">
                      <ErrorText message={aiTools.cleanup.error} />
                    </div>
                  ) : null}
                </div>
                <CropEditor
                  file={originalWatchFile}
                  sourceUrl={cropSourceUrl}
                  onApply={applyCroppedDial}
                  onClose={() => setCropSourceUrl(null)}
                />
              </div>
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
                  showCycleControls={strapDrawerView === "library" && strapSourceMode === "library" && filteredLibraryStraps.length > 1}
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
                onToggleLugGuides={handleGuideToggle}
                lugGuideOverrides={lugGuideOverrides}
                onLugGuidesChange={handleLugGuidesChange}
                showGuideOnboarding={showLugGuideOnboarding}
                onDismissGuideOnboarding={dismissLugGuideOnboarding}
                pendingStrapLabel={hasPendingPreUploadStrap ? pendingStrapSelection?.strap.label ?? null : null}
              />
            ) : (
              <PreviewUploadStage
                previewUrl={watchPreviewSrc}
                showUploadGuide={showUploadGuide}
                onToggleUploadGuide={() => setShowUploadGuide((prev) => !prev)}
                onCloseUploadGuide={() => setShowUploadGuide(false)}
                onFileSelect={onUploadDial}
                sampleWatches={SAMPLE_WATCH_HEADS}
                onSelectSampleWatch={handleSelectSampleWatch}
              />
            )}
            {canOpenTools ? (
              <>
                  <button
                    type="button"
                    onClick={() => setShowFitBench(true)}
                    className={`pointer-events-auto absolute top-5 right-[-1px] z-20 hidden h-11 items-center rounded-l-none rounded-r-[1.1rem] border border-l-0 px-4 text-[11px] font-semibold uppercase tracking-[0.22em] shadow-[0_12px_24px_rgba(56,44,32,0.08)] backdrop-blur-sm transition xl:inline-flex ${
                      showFitBench
                        ? "opacity-0 pointer-events-none"
                        : "translate-x-[calc(100%-1px)] border-[#e3d3bd] bg-[#fffdf9] text-[#6f6559] hover:border-[#d9c2a3] hover:bg-[#fff8ef]"
                    }`}
                    aria-expanded={showFitBench}
                    title="Open tools to zoom in or out on the preview window"
                  >
                  Tools
                </button>
                {showFitBench ? (
                  <aside className="pointer-events-none absolute right-[-1px] top-5 z-10 hidden translate-x-[calc(100%-1px)] xl:block">
                    <div className="pointer-events-auto w-[18rem]">
                      <FitBenchPanel
                        canRender={canRender}
                        fitConfidence={fitConfidence}
                        showLugGuides={showLugGuides}
                        onToggleLugGuides={handleGuideToggle}
                        onResetFit={() => void autoAlignStraps()}
                        isAutoAligning={isAutoAligning}
                        strapGap={strapGap}
                        setGapHalf={setGapHalf}
                        preserveSettings={preserveSettings}
                        setPreserveSettings={setPreserveSettings}
                        strapSizeUi={strapSizeUi}
                        setStrapScale={setStrapScale}
                        dialScale={dialScale}
                        setDialScaleValue={setDialScaleValue}
                        sceneZoom={sceneZoom}
                        setSceneZoomValue={setSceneZoomValue}
                        reCropCurrentWatch={reCropCurrentWatch}
                        onToggleVisibility={() => setShowFitBench((prev) => !prev)}
                      />
                    </div>
                  </aside>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="xl:hidden">
            {(hasUserUpload || canRender) && !cropSourceUrl ? (
              <div className="glass-card atelier-card-soft rounded-[1.6rem] p-4">
                <div className="flex flex-wrap gap-2">
                  {canOpenTools ? (
                    <div className="rounded-2xl border border-line bg-white/78 px-4 py-2.5 text-sm text-[#5f5143]">
                      <button
                        type="button"
                        onClick={() => setShowFitBench((prev) => !prev)}
                        className="font-semibold text-ink"
                        aria-expanded={showFitBench}
                      >
                        {showFitBench ? "Hide Tools" : "Tools"}
                      </button>
                      <p className="mt-1 text-xs leading-4 text-muted">Zoom in or out on the preview window.</p>
                    </div>
                  ) : null}
                </div>
                {aiTools.cleanup.error ? (
                  <div className="mt-3">
                    <ErrorText message={aiTools.cleanup.error} />
                  </div>
                ) : null}
                {canOpenTools && showFitBench ? (
                  <div className="mt-4">
                    <FitBenchPanel
                      canRender={canRender}
                      fitConfidence={fitConfidence}
                      showLugGuides={showLugGuides}
                      onToggleLugGuides={handleGuideToggle}
                      onResetFit={() => void autoAlignStraps()}
                      isAutoAligning={isAutoAligning}
                      strapGap={strapGap}
                      setGapHalf={setGapHalf}
                      preserveSettings={preserveSettings}
                      setPreserveSettings={setPreserveSettings}
                      strapSizeUi={strapSizeUi}
                      setStrapScale={setStrapScale}
                      dialScale={dialScale}
                      setDialScaleValue={setDialScaleValue}
                      sceneZoom={sceneZoom}
                      setSceneZoomValue={setSceneZoomValue}
                      reCropCurrentWatch={reCropCurrentWatch}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="hidden xl:block xl:space-y-4">
            {strapDrawerView === "library" ? (
              <div className="glass-card atelier-card-soft rounded-[1.6rem] p-4 sm:p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
                      Style Mood
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Narrow the drawer by fashion style, not just material.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStyleFilter("All styles")}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      styleFilter === "All styles"
                        ? "atelier-pill-active"
                        : "border-line bg-canvas text-ink hover:border-[#d7c1a3] hover:bg-white"
                    }`}
                    aria-pressed={styleFilter === "All styles"}
                  >
                    All styles
                  </button>
                  {STRAP_STYLE_TAGS.map((tag) => {
                    const count = strapsInCategory.filter((strap) => strap.styleTags.includes(tag)).length;
                    if (!count) return null;
                    const active = styleFilter === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setStyleFilter(tag)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition ${
                          active
                            ? "atelier-pill-active"
                            : "border-line bg-canvas text-ink hover:border-[#d7c1a3] hover:bg-white"
                        }`}
                        aria-pressed={active}
                      >
                        {tag}
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20 text-white" : "bg-slate-200/70 text-slate-700"}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="glass-card atelier-card-soft rounded-[1.9rem] p-4 sm:p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
                    3. Bench Tools
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
                    title="Create Catalogue Image"
                    disabled={!canRender}
                    loading={aiTools.final.loading}
                    sampleImageSrc="/catalogue-mockup-sample.png"
                    highlighted={mockupReadyHighlight}
                    note="Create a catalogue-style shot from the current pairing."
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
            {SHOW_SHOPPING_PREVIEW && strapSourceMode === "library" ? (
              <div
                className={`glass-card rounded-[1.9rem] border border-[#d7d1c8] bg-[linear-gradient(180deg,rgba(241,239,235,0.96),rgba(232,228,221,0.92))] p-4 transition ${
                  lockView
                    ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_12px_24px_rgba(56,44,32,0.08)]"
                    : "opacity-78 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)] grayscale-[0.14]"
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
                        Matching buying options will show up here for the strap on the bench.
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
                          className="flex items-center gap-4 rounded-2xl border border-[#d4cec4] bg-white/80 p-3 transition hover:bg-white/88"
                        >
                          <div className="w-36 shrink-0 overflow-hidden rounded-[1rem] border border-[#d4cec4] bg-slate-50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={product.imageSrc}
                              alt={product.title}
                              className="h-36 w-full object-contain p-2.5"
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
                      No close store match yet for this strap.
                    </p>
                  )
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/42 p-4 grayscale-[0.18]">
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
                      Shopping links will appear here when matching options are available.
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
              href="mailto:hello@watchstrapper.com"
              className="neo-button rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-ink"
            >
              hello@watchstrapper.com
            </Link>
          </div>
          <p className="mt-3 text-center text-[11px] uppercase tracking-[0.16em] text-[#8b7c6d] md:text-right">
            Version {buildVersion}
          </p>
        </div>
      </section>

        <section className="order-3 min-w-0 space-y-4 xl:hidden">
          <div className="glass-card atelier-card-soft rounded-[1.7rem] p-4">
            <button
              type="button"
              onClick={() => setMobileBenchToolsOpen((prev) => !prev)}
              className="flex w-full items-start justify-between gap-3 text-left"
              aria-expanded={mobileBenchToolsOpen}
            >
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
                  3. Bench Tools
                </p>
                <p className="mt-1 text-sm text-muted">
                  AI cleanup and catalogue tools when you need them, tucked away by default on phone.
                </p>
              </div>
              <span className="neo-button shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-ink">
                {mobileBenchToolsOpen ? "Hide" : "Open"}
              </span>
            </button>
            {activeAiStatus.tool ? (
              <div className="mt-3">
                <CompactAiStatus label={activeAiStatus.label} stage={activeAiStatus.stage} />
              </div>
            ) : null}
            {mobileBenchToolsOpen ? (
              <div className="mt-4 grid gap-4">
                <div className="space-y-2">
                  <ToolButton
                    title="Create Catalogue Image"
                    disabled={!canRender}
                    loading={aiTools.final.loading}
                    sampleImageSrc="/catalogue-mockup-sample.png"
                    highlighted={mockupReadyHighlight}
                    note="Create a catalogue-style shot from the current pairing."
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
            ) : null}
          </div>
          {SHOW_SHOPPING_PREVIEW && strapSourceMode === "library" ? (
            <div
              className={`glass-card rounded-[1.9rem] border border-[#d7d1c8] bg-[linear-gradient(180deg,rgba(241,239,235,0.96),rgba(232,228,221,0.92))] p-4 transition ${
                lockView
                  ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_12px_24px_rgba(56,44,32,0.08)]"
                  : "opacity-78 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)] grayscale-[0.14]"
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
                      Matching buying options will show up here for the strap on the bench.
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
                        className="flex items-center gap-4 rounded-2xl border border-[#d4cec4] bg-white/80 p-3 transition hover:bg-white/88"
                      >
                        <div className="w-36 shrink-0 overflow-hidden rounded-[1rem] border border-[#d4cec4] bg-slate-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={product.imageSrc}
                            alt={product.title}
                            className="h-36 w-full object-contain p-2.5"
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
                    No close store match yet for this strap.
                  </p>
                )
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/42 p-4 grayscale-[0.18]">
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
                    Shopping links will appear here when matching options are available.
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
              href="mailto:hello@watchstrapper.com"
              className="neo-button rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-ink"
            >
              hello@watchstrapper.com
            </Link>
          </div>
          <p className="mt-3 text-center text-[11px] uppercase tracking-[0.16em] text-[#8b7c6d]">
            Version {buildVersion}
          </p>
        </section>

        {canOpenTools ? <aside className="order-4 hidden min-w-0 xl:block xl:order-3 xl:self-start" /> : null}

      </section>
      <ModalShell open={showAuthDialog} onClose={() => setShowAuthDialog(false)} title={authMode === "sign-up" ? "Create your account" : "Sign in"}>
        {accountConfigured ? (
          <div className="space-y-4">
            {authMode === "sign-up" ? (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">Display name</span>
                <input
                  value={authForm.fullName}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, fullName: event.target.value }))}
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none"
                  placeholder="Your name"
                />
              </label>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Email</span>
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none"
                placeholder="you@example.com"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Password</span>
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none"
                placeholder="At least 6 characters"
              />
            </label>
            {authError ? <p className="text-sm text-rose-600">{authError}</p> : null}
            {authMessage ? <p className="text-sm text-[#7c5b2e]">{authMessage}</p> : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleAuthSubmit()}
                disabled={authBusy}
                className="atelier-accent-solid rounded-2xl border px-5 py-3 text-sm font-semibold disabled:opacity-60"
              >
                {authBusy ? "Working..." : authMode === "sign-up" ? "Create account" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode((prev) => (prev === "sign-up" ? "sign-in" : "sign-up"));
                  setAuthError(null);
                }}
                className="neo-button rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink"
              >
                {authMode === "sign-up" ? "Have an account?" : "Need an account?"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted">
            Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to enable account-backed collections.
          </p>
        )}
      </ModalShell>

      <ModalShell open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} title="Account settings">
        {user ? (
          <AccountSettingsPanel
            profileName={profile?.full_name || ""}
            email={user.email || ""}
            busy={authBusy || accountLoading}
            onSaveName={async (fullName) => {
              try {
                await updateDisplayName(fullName);
                setSaveFeedback("Updated your display name.");
              } catch (error) {
                setAuthError(error instanceof Error ? error.message : "We couldn't update your name.");
              }
            }}
            onChangePassword={async (password) => {
              try {
                await updatePassword(password);
                setSaveFeedback("Password updated.");
              } catch (error) {
                setAuthError(error instanceof Error ? error.message : "We couldn't update your password.");
              }
            }}
            onSignOut={async () => {
              await signOut();
              setShowSettingsDialog(false);
            }}
          />
        ) : null}
      </ModalShell>

      <ModalShell open={showMyWatchesDialog} onClose={() => setShowMyWatchesDialog(false)} title="My Watches">
        {savedWatches.length ? (
          <div className="space-y-3">
            {savedWatches.map((watch) => (
              <div key={watch.id} className="rounded-[1.35rem] border border-line bg-white/78 p-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={watch.image_url} alt={watch.label} className="h-20 w-20 rounded-2xl border border-line object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-ink">{watch.label}</p>
                    <p className="text-sm text-muted">{watch.watch_brand || "Prepared watch head"}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSelectSavedWatch(watch)}
                    className="atelier-accent-solid rounded-2xl border px-4 py-2 text-sm font-semibold"
                  >
                    Use this watch
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const nextLabel = window.prompt("Rename this saved watch.", watch.label)?.trim();
                      if (!nextLabel || nextLabel === watch.label) return;
                      try {
                        await renameWatch(watch.id, nextLabel);
                      } catch (error) {
                        setAuthError(error instanceof Error ? error.message : "We couldn't rename that watch.");
                      }
                    }}
                    className="neo-button rounded-2xl px-4 py-2 text-sm font-semibold text-ink"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(`Delete ${watch.label} from My Watches?`)) return;
                      try {
                        await deleteWatch(watch);
                      } catch (error) {
                        setAuthError(error instanceof Error ? error.message : "We couldn't delete that watch.");
                      }
                    }}
                    className="neo-button rounded-2xl px-4 py-2 text-sm font-semibold text-ink"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted">
            Save a cropped watch head and it will show up here ready to reuse without re-cropping.
          </p>
        )}
      </ModalShell>

      <ModalShell open={showSavedLooksDialog} onClose={() => setShowSavedLooksDialog(false)} title="Saved Looks">
        {savedLooks.length ? (
          <div className="space-y-3">
            {savedLooks.map((look) => (
              <div key={look.id} className="rounded-[1.35rem] border border-line bg-white/78 p-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={look.image_url} alt={look.label} className="h-20 w-20 rounded-2xl border border-line object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-ink">{look.label}</p>
                    <p className="text-sm text-muted">
                      {look.watch_label || "Watch"} · {look.strap_label || "Strap"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={look.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="atelier-accent-solid rounded-2xl border px-4 py-2 text-sm font-semibold"
                  >
                    View image
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      const nextLabel = window.prompt("Rename this saved look.", look.label)?.trim();
                      if (!nextLabel || nextLabel === look.label) return;
                      try {
                        await renameLook(look.id, nextLabel);
                      } catch (error) {
                        setAuthError(error instanceof Error ? error.message : "We couldn't rename that look.");
                      }
                    }}
                    className="neo-button rounded-2xl px-4 py-2 text-sm font-semibold text-ink"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(`Delete ${look.label} from Saved Looks?`)) return;
                      try {
                        await deleteLook(look);
                      } catch (error) {
                        setAuthError(error instanceof Error ? error.message : "We couldn't delete that look.");
                      }
                    }}
                    className="neo-button rounded-2xl px-4 py-2 text-sm font-semibold text-ink"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted">
            Save a finished preview to build a gallery of favorite watch-and-strap pairings.
          </p>
        )}
      </ModalShell>

      <ModalShell
        open={showSampleWatchesDialog}
        onClose={() => setShowSampleWatchesDialog(false)}
        title="Try Another Sample"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {SAMPLE_WATCH_HEADS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={async () => {
                setShowSampleWatchesDialog(false);
                await handleSelectSampleWatch(sample);
              }}
              className="neo-button flex items-center gap-3 rounded-[1.2rem] p-3 text-left"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-[1rem] border border-line bg-white/85 p-2">
                <img src={sample.src} alt={sample.label} className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{sample.label}</p>
                <p className="mt-1 text-xs text-muted">Load this sample watch into the preview.</p>
              </div>
            </button>
          ))}
        </div>
      </ModalShell>
    </main>
  );
}

function ModalShell({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,24,20,0.44)] px-4 py-6">
      <div className="w-full max-w-[34rem] rounded-[2rem] border border-line bg-[#fffaf3] p-5 shadow-[0_30px_70px_rgba(28,24,20,0.22)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-lg font-semibold text-ink">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="neo-button rounded-2xl px-3 py-2 text-sm font-semibold text-ink"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AccountSettingsPanel({
  profileName,
  email,
  busy,
  onSaveName,
  onChangePassword,
  onSignOut
}: {
  profileName: string;
  email: string;
  busy: boolean;
  onSaveName: (fullName: string) => Promise<void>;
  onChangePassword: (password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(profileName);
  const [password, setPassword] = useState("");

  useEffect(() => {
    setFullName(profileName);
  }, [profileName]);

  return (
    <div className="space-y-4">
      <div className="rounded-[1.35rem] border border-line bg-white/82 p-4">
        <p className="text-sm font-semibold text-ink">Signed in as</p>
        <p className="mt-1 text-sm text-muted">{email}</p>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">Display name</span>
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSaveName(fullName.trim())}
          className="atelier-accent-solid rounded-2xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          Save name
        </button>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink">New password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none"
          placeholder="At least 6 characters with a number or symbol"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || !password.trim()}
          onClick={() => void onChangePassword(password)}
          className="neo-button rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
        >
          Update password
        </button>
        <button
          type="button"
          onClick={() => void onSignOut()}
          className="neo-button rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink"
        >
          Sign out
        </button>
      </div>
    </div>
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
  onToggleUploadGuide,
  onCloseUploadGuide,
  onFileSelect,
  sampleWatches,
  onSelectSampleWatch
}: {
  previewUrl: string;
  showUploadGuide: boolean;
  onToggleUploadGuide: () => void;
  onCloseUploadGuide: () => void;
  onFileSelect: (file: File) => void;
  sampleWatches: readonly SampleWatchHead[];
  onSelectSampleWatch: (sample: SampleWatchHead) => void;
}) {
  const [uploadSectionActivated, setUploadSectionActivated] = useState(false);
  const [sampleWatchesLoaded, setSampleWatchesLoaded] = useState(false);

  const sampleWatchAnimationDelays = useMemo(() => {
    const order = sampleWatches.map((_, index) => index);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
    }
    const shuffled = order.map((position) => 160 + position * 320);
    return sampleWatches.reduce<Record<string, number>>((acc, sample, index) => {
      acc[sample.id] = shuffled[index];
      return acc;
    }, {});
  }, [sampleWatches]);

  useEffect(() => {
    let cancelled = false;
    const loaders = sampleWatches.map(
      (sample) =>
        new Promise<void>((resolve) => {
          const preloader = new Image();
          preloader.onload = () => resolve();
          preloader.onerror = () => resolve();
          preloader.src = sample.src;
        })
    );

    void Promise.all(loaders).then(() => {
      if (!cancelled) {
        setSampleWatchesLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sampleWatches]);

  const activateUploadStage = () => {
    if (uploadSectionActivated) return;
    setUploadSectionActivated(true);
  };

  const renderSampleWatchLabel = (sample: { id: string; label: string }) => {
    if (sample.id === "chronograph") {
      return (
        <>
          <span className="block">Chrono</span>
          <span className="block">graph</span>
        </>
      );
    }

    return sample.label;
  };

  const canAnimateSampleWatches = uploadSectionActivated && sampleWatchesLoaded;

  return (
    <div
      className={`relative overflow-hidden rounded-[1.75rem] border border-[#e4d7c5] bg-[radial-gradient(circle_at_94%_90%,rgba(245,141,24,0.92)_0%,rgba(248,160,42,0.7)_18%,rgba(250,188,88,0.44)_34%,rgba(252,215,150,0.2)_54%,rgba(255,252,248,0)_82%),radial-gradient(145%_74%_at_62%_104%,rgba(247,157,44,0.56)_0%,rgba(249,181,76,0.38)_24%,rgba(251,209,136,0.22)_46%,rgba(255,252,248,0.08)_67%,rgba(255,252,248,0)_88%),radial-gradient(112%_54%_at_24%_100%,rgba(248,181,74,0.26)_0%,rgba(251,222,177,0.16)_38%,rgba(255,252,248,0)_72%),linear-gradient(180deg,rgba(255,252,248,0.98)_0%,rgba(255,250,245,0.97)_56%,rgba(250,240,226,0.9)_82%,rgba(246,214,170,0.36)_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),inset_0_0_0_1px_rgba(255,250,242,0.55),0_18px_36px_rgba(56,44,32,0.08)] sm:p-7 ${uploadSectionActivated ? "upload-attention-ring" : ""}`}
    >
      <div className="relative mx-auto max-w-[34rem]">
        <ImageUploader
          id="watch-stage"
          label=""
          helperText=""
          previewUrl={previewUrl}
          onFileSelect={onFileSelect}
          className="w-full"
          bare
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Front-on, straight shots work best.</p>
          <div className="relative">
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
            {showUploadGuide ? (
              <div
                id="preview-upload-guide-panel"
                className="absolute right-0 top-[calc(100%+0.75rem)] z-20 w-[min(26rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-line bg-[rgba(255,252,247,0.985)] p-3 shadow-[0_20px_40px_rgba(56,44,32,0.14)] backdrop-blur-[2px]"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-ink">Photo Tips</p>
                  <button
                    type="button"
                    onClick={onCloseUploadGuide}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-sm font-semibold text-ink hover:bg-[#fbf6ee]"
                    aria-label="Close photo tips"
                  >
                    ×
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {UPLOAD_GUIDE_ITEMS.map((item) => (
                    <div key={item.title} className="min-w-0">
                      <UploadGuideCard item={item} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-line bg-white/58 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="sample-watch-heading text-xs font-semibold uppercase tracking-[0.16em] text-[#7c7165]">
                Try a Sample Watch
              </p>
              <p className="mt-1 text-sm text-muted">
                Jump straight in with a mock watch head if you want to test straps first.
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {sampleWatches.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => onSelectSampleWatch(sample)}
                onMouseEnter={activateUploadStage}
                onFocus={activateUploadStage}
                onTouchStart={activateUploadStage}
                className={`sample-watch-card rounded-[1.1rem] border border-line bg-white/88 px-2 py-2 text-center transition hover:border-[#d7c1a3] hover:bg-white ${
                  canAnimateSampleWatches ? "sample-watch-card-ready" : ""
                }`}
                style={canAnimateSampleWatches ? {
                  animationDelay: `${sampleWatchAnimationDelays[sample.id]}ms`,
                  ["--sample-watch-delay" as string]: `${sampleWatchAnimationDelays[sample.id]}ms`
                } : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sample.src}
                  alt={`${sample.label} watch head`}
                  className="sample-watch-card-image mx-auto h-24 w-auto object-contain sm:h-[6.75rem]"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
                <p className="mt-1 min-h-[2rem] text-[11px] font-semibold leading-tight text-ink sm:min-h-[2.25rem] sm:text-xs">
                  {renderSampleWatchLabel(sample)}
                </p>
              </button>
            ))}
          </div>
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

function StrapDrawerButton({
  strap,
  active,
  showCategory,
  onClick,
  isFavorite = false,
  onToggleFavorite,
  stackIndex = 0,
  totalItems = 1
}: StrapThumbProps & { stackIndex?: number; totalItems?: number }) {
  const isMetal = strap.category === "Metal" || strap.category === "Women" && strap.id.includes("metal");
  const buckleTransform = isMetal
    ? "translate-x-[4px] translate-y-[8px] scale-[1.84]"
    : "translate-x-[6px] translate-y-[24px] scale-[2.26]";
  const tailTransform = isMetal
    ? "-translate-x-[4px] translate-y-[8px] scale-[1.84]"
    : "-translate-x-[6px] translate-y-[24px] scale-[2.26]";
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`strap-${strap.id}`}
      className={`drawer-card relative flex w-full flex-col items-start gap-2 rounded-[1.25rem] border px-2 py-2 text-left transition ${
        active
          ? "border-[#d7c1a3] bg-[#fbf6ee] text-ink shadow-[0_10px_24px_rgba(155,106,47,0.08)]"
          : "border-line bg-white/70 text-ink"
      }`}
      style={{
        zIndex: stackIndex + 1
      }}
      aria-pressed={active}
    >
      {onToggleFavorite ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          className={`absolute right-3 top-3 z-10 rounded-full border px-2 py-1 text-xs font-semibold ${
            isFavorite ? "border-[#d7c1a3] bg-[#fff2df] text-[#a8661c]" : "border-line bg-white/88 text-slate-500"
          }`}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          {isFavorite ? "★" : "☆"}
        </button>
      ) : null}
      <div
        className={`drawer-card-media grid h-[148px] w-full grid-cols-2 items-center gap-0 overflow-hidden rounded-[1rem] border px-0 ${
          active ? "border-[#d7c1a3] bg-white" : "border-[#ddd3c5] bg-white"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={strap.strapASrc}
          alt={`${strap.label} buckle side`}
          className={`h-full w-full object-contain ${buckleTransform}`}
          loading={stackIndex < 6 ? "eager" : "lazy"}
          fetchPriority={stackIndex < 3 ? "high" : "auto"}
          />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={strap.strapBSrc}
          alt={`${strap.label} tail side`}
          className={`h-full w-full object-contain ${tailTransform}`}
          loading={stackIndex < 6 ? "eager" : "lazy"}
          fetchPriority={stackIndex < 3 ? "high" : "auto"}
        />
      </div>
      <div className="drawer-card-copy min-w-0 w-full py-1 pr-8">
        <p className="min-h-[2.6rem] text-[13px] text-center font-semibold leading-tight sm:text-[13px]">
          {strap.label}
        </p>
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
  onDismissGuideOnboarding,
  pendingStrapLabel
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
  pendingStrapLabel: string | null;
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
    if (!showLugGuides) return;
    setShouldBlinkGuides(true);
    const timeout = window.setTimeout(() => setShouldBlinkGuides(false), 2400);
    return () => window.clearTimeout(timeout);
  }, [watchSrc, showLugGuides, lugGuideOverrides]);

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
                ? pendingStrapLabel
                  ? `Watch loaded. Line these guides up with the lug openings, then hide guides to apply ${pendingStrapLabel}.`
                  : "Watch loaded. Line these guides up with the lug openings, then pick a strap."
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
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1={guides.centerX - guides.topWidth / 2}
          y1={guides.topY}
          x2={guides.centerX + guides.topWidth / 2}
          y2={guides.topY}
          stroke="#2ea8ff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <line
          x1={guides.centerX - guides.bottomWidth / 2}
          y1={guides.bottomY}
          x2={guides.centerX + guides.bottomWidth / 2}
          y2={guides.bottomY}
          stroke="#d7c1a3"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {[
          { x: guides.centerX - guides.topWidth / 2, y: guides.topY },
          { x: guides.centerX + guides.topWidth / 2, y: guides.topY },
          { x: guides.centerX - guides.bottomWidth / 2, y: guides.bottomY },
          { x: guides.centerX + guides.bottomWidth / 2, y: guides.bottomY }
        ].map((point, index) => (
          <g key={`${point.x}-${point.y}-${index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="8.5"
              fill="white"
              stroke="#2ea8ff"
              strokeWidth="2.6"
              className={blink ? "watch-lug-handle-blink-stroke" : undefined}
            />
          </g>
        ))}
      </svg>
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
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Align the guides, then pick a strap
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
  fitConfidence,
  showLugGuides,
  onToggleLugGuides,
  onResetFit,
  isAutoAligning,
  strapGap,
  setGapHalf,
  strapSizeUi,
  setStrapScale,
  dialScale,
  setDialScaleValue,
  sceneZoom,
  setSceneZoomValue,
  preserveSettings,
  setPreserveSettings,
  reCropCurrentWatch,
  onToggleVisibility
}: {
  canRender: boolean;
  fitConfidence: number;
  showLugGuides: boolean;
  onToggleLugGuides: () => void;
  onResetFit: () => void;
  isAutoAligning: boolean;
  strapGap: number;
  setGapHalf: (value: number) => void;
  strapSizeUi: number;
  setStrapScale: (value: number) => void;
  dialScale: number;
  setDialScaleValue: (value: number) => void;
  sceneZoom: number;
  setSceneZoomValue: (value: number) => void;
  preserveSettings: boolean;
  setPreserveSettings: (value: boolean | ((prev: boolean) => boolean)) => void;
  reCropCurrentWatch: () => void;
  onToggleVisibility?: () => void;
}) {
  return (
    <div className={`atelier-bench-panel border border-[#e3d3bd] bg-[#fffdf9] shadow-[0_18px_34px_rgba(56,44,32,0.08)] ${onToggleVisibility ? "overflow-hidden rounded-l-none rounded-r-[1.5rem] border-l-0" : "rounded-[1.75rem] p-4"}`}>
      {onToggleVisibility ? (
        <button
          type="button"
          onClick={onToggleVisibility}
          className="flex w-full items-center justify-between border-b border-[#e7d8c4] bg-[#fff7ec] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6c5b49]"
        >
          <span>Tools</span>
          <span className="text-sm leading-none text-[#8a7458]">×</span>
        </button>
      ) : null}
      <div className={onToggleVisibility ? "p-4" : ""}>
        {!onToggleVisibility ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7c7165]">
            Tools
          </p>
        ) : null}
        <p className={`${onToggleVisibility ? "" : "mt-1.5"} max-w-[28rem] text-xs leading-5 text-[#5f5143]`}>
          {fitConfidence >= 0.65
            ? "Auto-fit is already close. Use these controls only if you want to refine the look."
            : "Adjust zoom, spacing, scale, and framing before you save the pairing."}
        </p>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <SliderControl
          label="View Zoom"
          min={0.2}
          max={1.4}
          step={0.02}
          value={sceneZoom}
          onChange={setSceneZoomValue}
          disabled={!canRender}
          hint="Whole watch ↔ Detail"
        />
        <SliderControl
          label="Strap Gap"
          min={250}
          max={900}
          step={10}
          value={strapGap}
          onChange={setGapHalf}
          disabled={!canRender}
          hint="Closer ↔ Wider"
        />
        <SliderControl
          label="Strap Size"
          min={0}
          max={100}
          step={1}
          value={strapSizeUi}
          onChange={(uiVal) => setStrapScale(uiToStrapScale(uiVal))}
          disabled={!canRender}
          hint="Slimmer ↔ Fuller"
        />
        <SliderControl
          label="Dial Size"
          min={DIAL_SCALE_MIN}
          max={DIAL_SCALE_MAX}
          step={0.02}
          value={dialScale}
          onChange={setDialScaleValue}
          disabled={!canRender}
          hint="Smaller ↔ Larger"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggleLugGuides}
          className="neo-button rounded-xl px-3 py-1.5 text-[11px] font-semibold text-ink"
        >
          {showLugGuides ? "Hide lug guides" : "Show lug guides"}
        </button>
        <button
          type="button"
          onClick={onResetFit}
          className="neo-button rounded-xl px-3 py-1.5 text-[11px] font-semibold text-ink"
        >
          {isAutoAligning ? "Resetting..." : "Reset fit"}
        </button>
        <button
          type="button"
          onClick={reCropCurrentWatch}
          className="neo-button rounded-xl px-3 py-1.5 text-[11px] font-semibold text-ink"
        >
          Re-crop
        </button>
      </div>

      <div className="mt-3 neo-toggle flex items-center justify-between rounded-[1.1rem] px-3 py-2">
        <div>
          <p className="text-[13px] font-semibold text-ink">Keep Tweaks</p>
          <p className="text-[11px] leading-4 text-muted">Carry this fit tune to the next candidate.</p>
        </div>
        <button
          type="button"
          onClick={() => setPreserveSettings((prev) => !prev)}
          aria-pressed={preserveSettings}
          className={`relative h-7 w-12 shrink-0 overflow-hidden rounded-full border transition ${
            preserveSettings ? "border-[#d7c1a3] bg-[#f6ead7]" : "border-line bg-canvas"
          }`}
        >
          <span
            className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              preserveSettings ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
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
    <div className={`neo-control rounded-[1.05rem] px-3 py-2.5 transition ${highlighted ? "ring-2 ring-[#ead8c0]/90 shadow-[0_0_0_1px_rgba(215,193,163,0.32),0_10px_22px_rgba(155,106,47,0.08)]" : ""}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
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
      <div className="range-ticks mt-1.5" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
      {hint ? <p className="mt-1.5 text-[10px] font-medium tracking-[0.02em] text-muted">{hint}</p> : null}
    </div>
  );
}
