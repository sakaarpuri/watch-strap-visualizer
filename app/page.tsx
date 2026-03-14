"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import CanvasPreview, { CanvasPreviewRef } from "@/components/CanvasPreview";
import CropEditor from "@/components/CropEditor";
import ImageUploader from "@/components/ImageUploader";
import StrapSplitEditor from "@/components/StrapSplitEditor";
import { calculateAutoPlacement, loadStrapImage, PartTransform } from "@/lib/compose";
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
    imageSrc: "/upload-guide/ideal-straight.png"
  },
  {
    title: "Good",
    verdict: "Usually workable",
    tone: "good",
    imageSrc: "/upload-guide/straight-noisy.png"
  },
  {
    title: "Difficult",
    verdict: "Needs fixing",
    tone: "weak",
    imageSrc: "/upload-guide/too-rotated.png"
  },
  {
    title: "Skip It",
    verdict: "Do not upload",
    tone: "avoid",
    imageSrc: "/upload-guide/dont-even-try.png"
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
    <div className={`rounded-2xl border bg-gradient-to-br ${shellTone} p-2.5`}>
      <div className="rounded-[1rem] border border-white/70 bg-white/85 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <div className="relative h-24 overflow-hidden rounded-[0.85rem] bg-[linear-gradient(160deg,#f9fafb,#eef2f7)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageSrc}
            alt={`${item.title} upload example`}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
      <div className="mt-2.5">
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
  const defaultAllCategoryIndex = Math.max(
    0,
    getStrapsForCategory("All categories").findIndex((strap) => strap.id === "rubber-olive-performance")
  );
  const [watchSrc, setWatchSrc] = useState("/mock-dial.svg");
  const [watchPreviewSrc, setWatchPreviewSrc] = useState("/mock-dial.svg");
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
  const [strapIndex, setStrapIndex] = useState(defaultAllCategoryIndex);
  const [partA, setPartA] = useState<PartTransform | null>(null);
  const [partB, setPartB] = useState<PartTransform | null>(null);
  const [dialScale, setDialScale] = useState(1);
  const [sceneZoom, setSceneZoom] = useState(1);
  const [preserveSettings, setPreserveSettings] = useState(true);
  const [lockView, setLockView] = useState(false);
  const [isAutoAligning, setIsAutoAligning] = useState(false);
  const [aiTools, setAiTools] = useState<Record<AiToolKey, AiToolState>>(defaultToolState);
  const [generatedResults, setGeneratedResults] = useState<GeneratedResultState>({
    final: null
  });
  const [inlineMockupUrl, setInlineMockupUrl] = useState<string | null>(null);
  const [showUploadGuide, setShowUploadGuide] = useState(false);
  const [highlightUploadGuide, setHighlightUploadGuide] = useState(true);
  const [hasAutoOpenedUploadGuide, setHasAutoOpenedUploadGuide] = useState(false);
  const [showControlCoachmark, setShowControlCoachmark] = useState(false);
  const [similarProducts, setSimilarProducts] = useState<SimilarProductCard[]>([]);
  const [similarProductsLoading, setSimilarProductsLoading] = useState(false);
  const [activeAiStatus, setActiveAiStatus] = useState<ActiveAiStatus>({
    tool: null,
    label: "",
    stage: ""
  });

  const canvasRef = useRef<CanvasPreviewRef>(null);
  const strapUploadInputRef = useRef<HTMLInputElement>(null);
  const latestPartARef = useRef<PartTransform | null>(null);
  const latestPartBRef = useRef<PartTransform | null>(null);
  const preserveSettingsRef = useRef(true);
  const lockViewRef = useRef(false);

  const strapsInCategory = useMemo(() => {
    const straps = [...getStrapsForCategory(category)];
    return straps.sort((a, b) => {
      const scoreDiff = getStrapSortScore(a) - getStrapSortScore(b);
      if (scoreDiff !== 0) return scoreDiff;
      return a.label.localeCompare(b.label);
    });
  }, [category]);
  const currentStrap: StrapVariant = strapsInCategory[strapIndex] ?? strapsInCategory[0];
  const hasUserUpload = Boolean(uploadedWatchFile && originalWatchSrc);
  const hasUploadedStrap = Boolean(uploadedStrapPartA && uploadedStrapPartB);
  const activeStrapASrc =
    strapSourceMode === "uploaded" && uploadedStrapPartA ? uploadedStrapPartA.url : currentStrap?.strapASrc;
  const activeStrapBSrc =
    strapSourceMode === "uploaded" && uploadedStrapPartB ? uploadedStrapPartB.url : currentStrap?.strapBSrc;
  const activeStrapLabel =
    strapSourceMode === "uploaded" ? "Your Strap" : currentStrap?.label || "Selected strap";
  const activeJoinShape = strapSourceMode === "uploaded" ? undefined : currentStrap?.joinShape;
  const activeAutoFitWidthFactor =
    strapSourceMode === "uploaded" ? 0.1 : currentStrap?.autoFitWidthFactor;
  const activeAutoGapFactor =
    strapSourceMode === "uploaded" ? undefined : currentStrap?.autoGapFactor;
  const canRender = useMemo(
    () => Boolean(partA && partB && activeStrapASrc && activeStrapBSrc),
    [partA, partB, activeStrapASrc, activeStrapBSrc]
  );

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

  const onUploadDial = (file: File) => {
    const uploadedUrl = URL.createObjectURL(file);
    setOriginalWatchFile(file);
    setUploadedWatchFile(file);
    setOriginalWatchSrc(uploadedUrl);
    setWatchPreviewSrc(uploadedUrl);
    setWatchSrc(uploadedUrl);
    setCropSourceUrl(uploadedUrl);
    setHighlightUploadGuide(true);
    if (!hasAutoOpenedUploadGuide) {
      setShowUploadGuide(true);
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
  };

  useEffect(() => {
    if (!highlightUploadGuide) return undefined;
    const timeout = window.setTimeout(() => setHighlightUploadGuide(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightUploadGuide]);

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
    await saveUrlAsPng(url, "watch-strap-catalogue.png");
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
    if (!activeStrapASrc || !activeStrapBSrc) return;
    setIsAutoAligning(true);
    try {
      const latestPartA = latestPartARef.current;
      const latestPartB = latestPartBRef.current;
      const shouldPreserve = Boolean(
        latestPartA &&
          latestPartB &&
          (preserveSettingsRef.current || lockViewRef.current)
      );
      let aligned = await calculateAutoPlacement(
        watchSrc,
        activeStrapASrc,
        activeStrapBSrc,
        activeAutoFitWidthFactor,
        activeAutoGapFactor
      );

      if (shouldPreserve && latestPartA && latestPartB) {
        const preservedHalfGap = (latestPartB.y - latestPartA.y) / 2;
        const preservedAverageScale = getAverageScale(latestPartA, latestPartB);
        const preservedCenterX = (latestPartA.x + latestPartB.x) / 2;
        const preservedCenterY = (latestPartA.y + latestPartB.y) / 2;
        aligned = applyScaleToPair(aligned.partA, aligned.partB, preservedAverageScale);
        aligned = applyGapToPair(aligned.partA, aligned.partB, preservedHalfGap);
        aligned = applyCenterToPair(
          aligned.partA,
          aligned.partB,
          preservedCenterX,
          preservedCenterY
        );
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
  }, [watchSrc, activeStrapASrc, activeStrapBSrc, activeAutoFitWidthFactor, activeAutoGapFactor]);

  useEffect(() => {
    if (strapSourceMode !== "library") return;
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
  }, [category, strapIndex, strapSourceMode]);

  const onCycleStrap = (direction: 1 | -1) => {
    if (strapSourceMode !== "library") return;
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

  useEffect(() => {
    if (strapSourceMode !== "library" || !currentStrap?.id) {
      setSimilarProducts([]);
      setSimilarProductsLoading(false);
      return;
    }

    let active = true;
    setSimilarProductsLoading(true);
    fetch(`/api/products/similar?strapId=${encodeURIComponent(currentStrap.id)}`)
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
  }, [currentStrap?.id, strapSourceMode]);

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
      setToolLoading("final", false);
    } catch (error) {
      setToolLoading("final", false, formatAiError(error));
    }
  };

  const strapGap = partA && partB ? (partB.y - partA.y) / 2 : 320;
  const strapScale = partA && partB ? (partA.scale + partB.scale) / 2 : 90;
  const strapSizeUi = strapScaleToUi(strapScale);

  return (
    <main className="mx-auto max-w-[108rem] px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-12 xl:px-10">
      <header>
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Watch Strap Visualizer
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-base text-muted">
            Your current favourite watch is looking for a strap partner.
          </p>
        </div>
      </header>

      <section className="mt-4">
        <div className="relative w-full max-w-[1120px]">
          <div className="w-full max-w-[280px]">
            <ImageUploader
              id="watch"
              label="1. Upload Watch Photo"
              helperText="Front-on, straight shots work best. Retailer screenshots are the easy mode."
              previewUrl={watchPreviewSrc}
              onFileSelect={onUploadDial}
              compact
              accentActive={highlightUploadGuide}
              className="w-full max-w-[280px] shrink-0"
            />
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowUploadGuide((prev) => !prev)}
                className={`neo-button inline-flex items-center gap-2 rounded-2xl border border-line px-3 py-2 text-sm font-semibold text-ink ${highlightUploadGuide ? "upload-attention-ring" : ""}`}
                aria-expanded={showUploadGuide}
                aria-controls="upload-guide-panel"
              >
                Photo Tips
                <span className="text-base leading-none">{showUploadGuide ? "←" : "→"}</span>
              </button>
            </div>
          </div>

          {showUploadGuide ? (
            <div
              id="upload-guide-panel"
              className={`glass-card z-20 mt-3 w-full max-w-[760px] overflow-hidden rounded-2xl border border-line p-3 transition-all duration-300 lg:absolute lg:left-[304px] lg:top-0 lg:mt-0 ${
                highlightUploadGuide ? "upload-attention-ring" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setShowUploadGuide(false)}
                className="mb-2 flex w-full items-center justify-between gap-3 rounded-xl border border-transparent px-1 py-1 text-left hover:bg-white/30"
                aria-expanded={showUploadGuide}
                aria-controls="upload-guide-panel"
              >
                <p className="text-base font-semibold text-ink">Photo Tips</p>
                <span className="neo-button shrink-0 rounded-xl px-3 py-2 text-lg font-semibold text-ink">
                  ←
                </span>
              </button>
              <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-1">
                {UPLOAD_GUIDE_ITEMS.map((item) => (
                  <div key={item.title} className="min-w-[170px] max-w-[180px] flex-1">
                    <UploadGuideCard item={item} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {cropSourceUrl && originalWatchFile ? (
        <section className="mt-4 w-full max-w-[880px]">
          <CropEditor
            file={originalWatchFile}
            sourceUrl={cropSourceUrl}
            onApply={applyCroppedDial}
          />
        </section>
      ) : null}

      {strapSplitSourceUrl && uploadedStrapSheetFile ? (
        <section className="mt-4 w-full max-w-[1100px]">
          <StrapSplitEditor
            file={uploadedStrapSheetFile}
            sourceUrl={strapSplitSourceUrl}
            onApply={applySplitStrap}
            onClose={() => setStrapSplitSourceUrl(null)}
          />
        </section>
      ) : null}

      <section className="mt-6 grid gap-4 lg:mt-8 lg:grid-cols-[480px,1fr]">
        <aside className="space-y-5">
          <div className="glass-card rounded-2xl p-4 sm:p-6">
            <p className="text-lg font-medium text-ink">
              2. Browse The Strap Box
            </p>
            <div className="mt-3 inline-flex rounded-full border border-line bg-canvas p-1">
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
                        ? "bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]"
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
                  <p className="text-sm uppercase tracking-[0.12em] text-muted">On Deck</p>
                  <p className="mt-2 text-xl font-semibold text-ink">{currentStrap.label}</p>
                  <p className="mt-2 text-sm text-muted">
                    Flick through contenders with the preview arrows.
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-line bg-canvas/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                    {category === "All categories" ? "Full Strap Drawer" : `Inside ${category}`}
                  </p>
                  <div className="mt-3 max-h-[36rem] space-y-3 overflow-y-auto pr-1">
                    {strapsInCategory.map((strap, index) => {
                      const active = index === strapIndex;
                      return (
                        <StrapDrawerButton
                          key={strap.id}
                          onClick={() => setStrapIndex(index)}
                          strap={strap}
                          active={active}
                          showCategory={category === "All categories"}
                        />
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-line bg-canvas/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
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

                <div className="rounded-xl border border-line bg-canvas/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
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

            <div className="neo-toggle mt-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Keep Tweaks</p>
                <p className="text-xs text-muted">Carry the fit tune to the next candidate.</p>
              </div>
              <button
                type="button"
                onClick={() => setPreserveSettings((prev) => !prev)}
                aria-pressed={preserveSettings}
                className={`relative h-8 w-14 shrink-0 overflow-hidden rounded-full border transition ${
                  preserveSettings
                    ? "border-emerald-500/40 bg-emerald-400/30"
                    : "border-line bg-canvas"
                }`}
              >
                <span
                  className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    preserveSettings ? "translate-x-6" : "translate-x-0"
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
                {isAutoAligning ? "Resetting fit..." : "Reset Strap Fit"}
              </button>
              <button
                type="button"
                onClick={() => void onSavePreviewImage()}
                className="rounded-lg border border-ink bg-ink px-4 py-2.5 text-base text-white hover:opacity-90"
              >
                Save Image
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
                  Back To Original Photo
                </button>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <h2 className="mb-3 text-base font-medium uppercase tracking-[0.15em] text-muted">
            4. Strap Check
          </h2>
          {canRender ? (
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
              showCycleControls={strapSourceMode === "library"}
              onDragPartsChange={(nextA, nextB) => {
                setPartA(nextA);
                setPartB(nextB);
              }}
              onCycleStrap={onCycleStrap}
              controls={
                <div className="glass-card rounded-xl p-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                    Fit Bench
                  </p>
                  <div className="mt-2 grid gap-2">
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
                      />
                      {showControlCoachmark ? (
                        <div className="pointer-events-none absolute inset-x-6 -bottom-3 flex items-center justify-center">
                          <div className="flex items-center gap-2 rounded-full border border-sky-200 bg-white/95 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
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
                      displayValue={Math.round(strapScale).toString()}
                      disabled={lockView}
                      highlighted={showControlCoachmark}
                    />
                    {showControlCoachmark ? (
                      <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 px-3 py-2 shadow-[0_8px_20px_rgba(56,189,248,0.08)]">
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
                      label="Lock Fit"
                      description="Freeze the fit and just inspect the view"
                      enabled={lockView}
                      onToggle={() => setLockView((prev) => !prev)}
                    />
                  </div>
                </div>
              }
            />
          ) : (
            <div className="rounded-2xl border border-line bg-canvas p-4 text-sm text-muted">
              Upload a watch photo, then give it a strap worth arguing about.
            </div>
          )}
          {strapSourceMode === "library" ? (
            <div className="glass-card mt-4 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                    Buy Similar Online
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Matches for {currentStrap.label}, not the whole drawer.
                  </p>
                </div>
              </div>
              {similarProductsLoading ? (
                <p className="mt-3 text-sm text-muted">Looking around the strap counter…</p>
              ) : similarProducts.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {similarProducts.map((product) => (
                    <a
                      key={product.id}
                      href={product.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-line bg-canvas/80 p-3 transition hover:-translate-y-0.5 hover:bg-white"
                    >
                      <div className="overflow-hidden rounded-[1rem] border border-line bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.imageSrc}
                          alt={product.title}
                          className="h-36 w-full object-contain p-2"
                        />
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm font-semibold text-ink">{product.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">
                        {product.store}
                      </p>
                      <span className="mt-3 inline-flex rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink">
                        View Product
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  No decent shopping match yet for this strap. Try another one from the bench.
                </p>
              )}
            </div>
          ) : null}
          <div className="glass-card mt-4 rounded-2xl p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                  Bench Tools
                </p>
              </div>
              {activeAiStatus.tool ? (
                <div className="md:max-w-[18rem]">
                  <CompactAiStatus label={activeAiStatus.label} stage={activeAiStatus.stage} />
                </div>
              ) : null}
            </div>
            <div className="hide-scrollbar mt-4 -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 md:mx-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-4 md:overflow-visible md:px-0">
              <div className="min-w-[15rem] snap-start space-y-2 md:min-w-0">
                <ToolButton
                  title="Extract Watch"
                  disabled={!hasUserUpload}
                  loading={aiTools.cleanup.loading}
                  onClick={() => void runCleanupFallback()}
                />
                {aiTools.cleanup.error ? <ErrorText message={aiTools.cleanup.error} /> : null}
              </div>

              <div className="min-w-[18rem] snap-start space-y-2 md:col-span-2 md:min-w-0">
                <ToolButton
                  title="Create Catalogue Image"
                  disabled={!canRender || !lockView}
                  loading={aiTools.final.loading}
                  sampleImageSrc="/catalogue-mockup-sample.png"
                  note="Lock the fit with your favourite strap, then make a catalogue-style shot."
                  onClick={() => void runFinalRender()}
                />
                {generatedResults.final ? (
                  <ResultActions
                    url={generatedResults.final}
                    label="View mockup"
                    onOpenInPage={() => setInlineMockupUrl(generatedResults.final)}
                    onSave={() => void onSaveMockupImage(generatedResults.final as string)}
                  />
                ) : null}
                {aiTools.final.error ? <ErrorText message={aiTools.final.error} /> : null}
              </div>

            </div>
          </div>
          {inlineMockupUrl ? (
            <div className="glass-card mt-4 rounded-2xl p-4">
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
                    onClick={() => setInlineMockupUrl(null)}
                    className="neo-button rounded-xl px-3 py-2 text-sm font-medium text-ink"
                  >
                    Close
                  </button>
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={inlineMockupUrl}
                alt="Generated product mockup"
                className="w-full rounded-xl border border-line bg-white object-contain"
              />
            </div>
          ) : null}
          <p className="mt-3 text-sm text-muted">
            Visual inspiration only. Final fit depends on lug width &amp; strap model.
          </p>
          <div className="mt-6 flex justify-center md:justify-end">
            <Link
              href="/contact"
              className="neo-button rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-ink"
            >
              Enquiries / Feedback
            </Link>
          </div>
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

function StrapDrawerButton({ strap, active, showCategory, onClick }: StrapThumbProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`strap-${strap.id}`}
      className={`flex w-full items-center gap-4 rounded-[1.6rem] border px-4 py-4 text-left transition ${
        active
          ? "border-sky-200 bg-sky-50/90 text-ink shadow-[0_10px_24px_rgba(56,189,248,0.12)]"
          : "border-line bg-white/70 text-ink hover:bg-white"
      }`}
      aria-pressed={active}
    >
      <div
        className={`flex h-[152px] w-[152px] shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem] border ${
          active ? "border-sky-200 bg-white" : "border-line bg-slate-50"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={strap.strapASrc}
          alt={`${strap.label} thumbnail`}
          className="h-full w-full object-contain p-1"
          loading="lazy"
        />
      </div>
      <div className="min-w-0 max-w-[9.5rem] flex-1">
        <p className="line-clamp-2 text-[15px] font-semibold leading-tight sm:text-[16px]">{strap.label}</p>
        {showCategory ? (
          <p
            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] ${
              active ? "bg-sky-100 text-sky-700" : "bg-slate-200/70 text-slate-700"
            }`}
          >
            {strap.category}
          </p>
        ) : null}
      </div>
    </button>
  );
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
  disabled,
  loading,
  sampleImageSrc,
  note,
  onClick
}: {
  title: string;
  disabled?: boolean;
  loading?: boolean;
  sampleImageSrc?: string;
  note?: string;
  onClick: () => void;
}) {
  return (
    <div className="neo-control rounded-2xl p-4">
      <div className="flex items-center gap-4">
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
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-semibold leading-tight text-ink">{title}</p>
            <button
              type="button"
              onClick={onClick}
              disabled={disabled || loading}
              className={`neo-button min-w-[84px] shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-ink transition disabled:cursor-not-allowed disabled:opacity-50 ${
                loading
                  ? "ai-pulse border-slate-300/80 bg-slate-100"
                  : "hover:opacity-90"
              }`}
            >
              {loading ? "Working" : "Run"}
            </button>
          </div>
          {note ? <p className="mt-2 max-w-[28rem] text-sm leading-5 text-muted">{note}</p> : null}
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
    <div className={`neo-control rounded-2xl p-4 transition ${highlighted ? "ring-2 ring-sky-200/80 shadow-[0_0_0_1px_rgba(125,211,252,0.35),0_14px_28px_rgba(56,189,248,0.1)]" : ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-lg font-semibold text-ink">{label}</span>
        <span className="text-sm text-muted">
          {displayValue ??
            (label === "Watch Head Size" ? `${Math.round(value * 100)}%` : Math.round(value))}
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
          className={`relative h-12 w-20 shrink-0 overflow-hidden rounded-full border transition ${
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
