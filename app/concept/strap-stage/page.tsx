"use client";

import Link from "next/link";
import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import CanvasPreview, { CanvasPreviewRef } from "@/components/CanvasPreview";
import CropEditor from "@/components/CropEditor";
import ImageUploader from "@/components/ImageUploader";
import {
  CANVAS_SIZE,
  calculateAutoPlacement,
  detectPreviewLugGuides,
  PartTransform,
  PreviewLugGuideOverrides,
  PreviewLugGuides,
  renderWatchOnlyComposition
} from "@/lib/compose";
import { getStrapsForCategory, StrapCategory, StrapVariant } from "@/lib/strapLibrary";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const DEFAULT_WATCH_PREVIEW_SCALE = 0.88;
const DEFAULT_SCENE_ZOOM = 0.68;
const DEFAULT_STRAP_AUTO_FIT_WIDTH_FACTOR = 0.28;
const LUG_GUIDE_TIP_STORAGE_KEY = "watchstrapper-concept-lug-guide-tip-seen";

type UploadGuideItem = {
  title: string;
  verdict: string;
  tone: "ideal" | "good" | "weak" | "avoid";
  imageSrc: string;
};

type GuideDragMode = "move" | "resize-left" | "resize-right";

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

const COLLAGE_IDS = [
  "leather-sapphire-suede",
  "leather-emerald-suede",
  "leather-oxblood-pebbled",
  "leather-aubergine-suede",
  "leather-mustard-suede",
  "fabric-holi-stripe-nato",
  "fabric-talavera-blue-nato",
  "fabric-navy-canvas",
  "rubber-blue-tropic",
  "metal-gold-silver-bracelet",
  "metal-gold-bracelet"
];

const DRAWER_CATEGORIES: StrapCategory[] = ["All categories", "Leather", "Fabric", "Rubber", "Metal"];

export default function StrapStageConceptPage() {
  const [watchSrc, setWatchSrc] = useState("");
  const [watchPreviewSrc, setWatchPreviewSrc] = useState("");
  const [originalWatchFile, setOriginalWatchFile] = useState<File | null>(null);
  const [uploadedWatchFile, setUploadedWatchFile] = useState<File | null>(null);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [category, setCategory] = useState<StrapCategory>("All categories");
  const [strapIndex, setStrapIndex] = useState(0);
  const [hasSelectedLibraryStrap, setHasSelectedLibraryStrap] = useState(false);
  const [partA, setPartA] = useState<PartTransform | null>(null);
  const [partB, setPartB] = useState<PartTransform | null>(null);
  const [dialScale, setDialScale] = useState(DEFAULT_WATCH_PREVIEW_SCALE);
  const [sceneZoom, setSceneZoom] = useState(DEFAULT_SCENE_ZOOM);
  const [fitConfidence, setFitConfidence] = useState(0);
  const [lugGuideOverrides, setLugGuideOverrides] = useState<PreviewLugGuideOverrides | null>(null);
  const [showLugGuides, setShowLugGuides] = useState(true);
  const [showLugGuideOnboarding, setShowLugGuideOnboarding] = useState(false);
  const [showUploadGuide, setShowUploadGuide] = useState(false);
  const [highlightStage, setHighlightStage] = useState(false);
  const [animateDrawerReveal, setAnimateDrawerReveal] = useState(false);
  const [animateStrapSettle, setAnimateStrapSettle] = useState(false);

  const previewSectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<CanvasPreviewRef>(null);
  const strapSettleTimeoutRef = useRef<number | null>(null);
  const previousDrawerReadyRef = useRef(false);

  const strapsInCategory = useMemo(() => getStrapsForCategory(category), [category]);
  const allStraps = useMemo(() => getStrapsForCategory("All categories"), []);
  const currentStrap = strapsInCategory[strapIndex] ?? strapsInCategory[0];
  const collageStraps = useMemo(
    () => COLLAGE_IDS.map((id) => allStraps.find((strap) => strap.id === id)).filter(Boolean) as StrapVariant[],
    [allStraps]
  );

  const hasWatchReady = Boolean(uploadedWatchFile && watchSrc && !cropSourceUrl);
  const activeStrap = hasSelectedLibraryStrap ? currentStrap : null;
  const canRender = Boolean(partA && partB && activeStrap?.strapASrc && activeStrap?.strapBSrc);
  const canShowWatchOnlyPreview = hasWatchReady && !canRender;
  const previewTitle = cropSourceUrl
    ? "Crop your watch"
    : canRender
      ? "Live try-on stage"
      : canShowWatchOnlyPreview
        ? "Watch head stage"
        : "Upload stage";
  const previewHint = cropSourceUrl
    ? "Frame the watch inside this same stage, then apply the crop."
    : canRender
      ? "The strap has landed. This concept keeps the whole journey on one stage."
      : canShowWatchOnlyPreview
        ? "Your watch is ready. Align the lug guides if needed, then pick a strap from the drawer."
        : "Upload starts here. The drawer stays empty until the watch is ready.";

  useEffect(() => {
    if (!highlightStage) return undefined;
    const timeout = window.setTimeout(() => setHighlightStage(false), 2600);
    return () => window.clearTimeout(timeout);
  }, [highlightStage]);

  useEffect(() => {
    if (previousDrawerReadyRef.current || !hasWatchReady) {
      previousDrawerReadyRef.current = hasWatchReady;
      return undefined;
    }
    setAnimateDrawerReveal(true);
    const timeout = window.setTimeout(() => setAnimateDrawerReveal(false), 1100);
    previousDrawerReadyRef.current = hasWatchReady;
    return () => window.clearTimeout(timeout);
  }, [hasWatchReady]);

  useEffect(() => {
    if (!canShowWatchOnlyPreview) return undefined;
    try {
      if (window.localStorage.getItem(LUG_GUIDE_TIP_STORAGE_KEY) === "1") return undefined;
    } catch {
      // ignore storage failures
    }
    const timeout = window.setTimeout(() => setShowLugGuideOnboarding(true), 220);
    return () => window.clearTimeout(timeout);
  }, [canShowWatchOnlyPreview, watchSrc]);

  useEffect(() => {
    if (!canRender) return;
    setShowLugGuides(false);
    if (showLugGuideOnboarding) {
      dismissLugGuideOnboarding();
    }
  }, [canRender, showLugGuideOnboarding]);

  useEffect(() => {
    if (!activeStrap?.strapASrc || !activeStrap?.strapBSrc || !watchSrc) return;
    let cancelled = false;
    const autoAlign = async () => {
      const aligned = await calculateAutoPlacement(
        watchSrc,
        activeStrap.strapASrc,
        activeStrap.strapBSrc,
        activeStrap.autoFitWidthFactor ?? DEFAULT_STRAP_AUTO_FIT_WIDTH_FACTOR,
        activeStrap.autoGapFactor,
        dialScale,
        lugGuideOverrides ?? undefined
      );
      if (cancelled) return;
      setPartA(aligned.partA);
      setPartB(aligned.partB);
      setFitConfidence(aligned.confidence);
    };
    void autoAlign();
    return () => {
      cancelled = true;
    };
  }, [watchSrc, activeStrap?.strapASrc, activeStrap?.strapBSrc, activeStrap?.autoFitWidthFactor, activeStrap?.autoGapFactor, dialScale, lugGuideOverrides]);

  useEffect(() => {
    return () => {
      if (strapSettleTimeoutRef.current) {
        window.clearTimeout(strapSettleTimeoutRef.current);
      }
    };
  }, []);

  const dismissLugGuideOnboarding = () => {
    setShowLugGuideOnboarding(false);
    try {
      window.localStorage.setItem(LUG_GUIDE_TIP_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  const handleLugGuidesChange = (nextOverrides: PreviewLugGuideOverrides) => {
    setLugGuideOverrides((prev) => {
      if (!Object.keys(nextOverrides).length) return null;
      const merged = { ...(prev ?? {}), ...nextOverrides };
      const syncedWidth = nextOverrides.topWidth ?? nextOverrides.bottomWidth ?? merged.topWidth ?? merged.bottomWidth;
      if (typeof syncedWidth === "number") {
        merged.topWidth = syncedWidth;
        merged.bottomWidth = syncedWidth;
      }
      return merged;
    });
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

  const onUploadDial = (file: File) => {
    const uploadedUrl = URL.createObjectURL(file);
    setOriginalWatchFile(file);
    setUploadedWatchFile(file);
    setWatchPreviewSrc(uploadedUrl);
    setWatchSrc(uploadedUrl);
    setCropSourceUrl(uploadedUrl);
    setDialScale(DEFAULT_WATCH_PREVIEW_SCALE);
    setSceneZoom(DEFAULT_SCENE_ZOOM);
    setHasSelectedLibraryStrap(false);
    setPartA(null);
    setPartB(null);
    setLugGuideOverrides(null);
    setShowLugGuides(true);
    setShowLugGuideOnboarding(false);
    setHighlightStage(true);
  };

  const applyCroppedDial = (file: File, previewUrl: string) => {
    setUploadedWatchFile(file);
    setWatchPreviewSrc(previewUrl);
    setWatchSrc(previewUrl);
    setCropSourceUrl(null);
    setDialScale(DEFAULT_WATCH_PREVIEW_SCALE);
    setSceneZoom(DEFAULT_SCENE_ZOOM);
    setHasSelectedLibraryStrap(false);
    setPartA(null);
    setPartB(null);
    setLugGuideOverrides(null);
    setShowLugGuides(true);
    setHighlightStage(true);
    window.setTimeout(() => {
      previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const onCycleStrap = (direction: 1 | -1) => {
    if (!hasSelectedLibraryStrap) return;
    triggerStrapSettle();
    setStrapIndex((prev) => {
      const total = strapsInCategory.length;
      return (prev + direction + total) % total;
    });
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#f7f8fb_0%,#eff3f8_32%,#eef1f5_100%)] text-ink">
      <StrapCollageBackground straps={collageStraps} />
      <div className="relative mx-auto max-w-[92rem] px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pb-14 lg:pt-6">
        <header className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/watchstrapper-logo.png"
            alt="Watchstrapper"
            className="mx-auto h-auto w-[16rem] object-contain sm:w-[18rem]"
          />
          <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            See any strap on your watch before you buy.
          </h1>
          <p className="mt-2 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
            Concept Preview · Single-stage try-on
          </p>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <section ref={previewSectionRef} className="order-2 min-w-0 lg:order-1">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-600">{previewTitle}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{previewHint}</p>
              </div>
              <Link
                href="/"
                className="neo-button hidden rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink md:inline-flex"
              >
                Back to current site
              </Link>
            </div>

            {cropSourceUrl && originalWatchFile ? (
              <CropEditor
                file={originalWatchFile}
                sourceUrl={cropSourceUrl}
                onApply={applyCroppedDial}
                onClose={() => setCropSourceUrl(null)}
              />
            ) : canRender && activeStrap ? (
              <div className={`${highlightStage ? "preview-attention-ring rounded-[1.75rem]" : ""} ${animateStrapSettle ? "strap-settle-in" : ""}`}>
                <div className="glass-card rounded-[1.75rem] p-3 sm:p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white/70 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Try-on live</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {activeStrap.label} landed at {Math.round(fitConfidence * 100)}% fit confidence.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setHasSelectedLibraryStrap(false)}
                        className="neo-button rounded-xl px-3 py-2 text-sm font-semibold text-ink"
                      >
                        Back to watch head
                      </button>
                      <button
                        type="button"
                        onClick={() => setSceneZoom(DEFAULT_SCENE_ZOOM)}
                        className="neo-button rounded-xl px-3 py-2 text-sm font-semibold text-ink"
                      >
                        Reset framing
                      </button>
                    </div>
                  </div>
                  <CanvasPreview
                    ref={canvasRef}
                    watchSrc={watchSrc}
                    strapASrc={activeStrap.strapASrc}
                    strapBSrc={activeStrap.strapBSrc}
                    partA={partA as PartTransform}
                    partB={partB as PartTransform}
                    style={activeStrap.tint}
                    joinShape={activeStrap.joinShape}
                    watchScale={dialScale}
                    sceneZoom={sceneZoom}
                    locked={false}
                    showLugGuides={false}
                    showCycleControls={hasSelectedLibraryStrap}
                    onLugGuidesChange={handleLugGuidesChange}
                    lugGuideOverrides={lugGuideOverrides}
                    onDragPartsChange={(nextPartA, nextPartB) => {
                      setPartA(nextPartA);
                      setPartB(nextPartB);
                    }}
                    onCycleStrap={onCycleStrap}
                  />
                </div>
              </div>
            ) : canShowWatchOnlyPreview ? (
              <ConceptWatchOnlyPreview
                watchSrc={watchSrc}
                watchScale={dialScale}
                highlighted={highlightStage}
                showLugGuides={showLugGuides}
                onToggleLugGuides={() => setShowLugGuides((prev) => !prev)}
                lugGuideOverrides={lugGuideOverrides}
                onLugGuidesChange={handleLugGuidesChange}
                showGuideOnboarding={showLugGuideOnboarding}
                onDismissGuideOnboarding={dismissLugGuideOnboarding}
              />
            ) : (
              <ConceptUploadStage
                previewUrl={watchPreviewSrc}
                showUploadGuide={showUploadGuide}
                onToggleUploadGuide={() => setShowUploadGuide((prev) => !prev)}
                onCloseUploadGuide={() => setShowUploadGuide(false)}
                onFileSelect={onUploadDial}
              />
            )}
          </section>

          <aside className="order-1 lg:order-2">
            <div className="glass-card rounded-[1.75rem] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-ink">2. Strap drawer</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {hasWatchReady
                      ? hasSelectedLibraryStrap
                        ? "The drawer is live. Click around and let the straps settle into the same stage."
                        : "Your watch is ready. Pick a strap and the stage stays right where you are."
                      : "The drawer stays empty until upload and crop are done on the main stage."}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${hasWatchReady ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}
                >
                  {hasWatchReady ? "Ready" : "Locked"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {DRAWER_CATEGORIES.map((option) => {
                  const active = option === category;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={!hasWatchReady}
                      onClick={() => {
                        setCategory(option);
                        setStrapIndex(0);
                        setHasSelectedLibraryStrap(false);
                      }}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? "border-emerald-900 bg-emerald-900 text-white"
                          : "border-line bg-white/70 text-ink"
                      } disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {!hasWatchReady ? (
                <DrawerLockedState straps={collageStraps.slice(0, 4)} />
              ) : (
                <>
                  <div className="mt-4 rounded-2xl border border-line bg-white/70 p-4">
                    <p className="text-sm uppercase tracking-[0.14em] text-slate-500">On deck</p>
                    <p className="mt-2 text-xl font-semibold text-ink">
                      {hasSelectedLibraryStrap ? currentStrap.label : "Pick the first strap to start the reveal"}
                    </p>
                  </div>
                  <div className="mt-4 max-h-[42rem] space-y-3 overflow-y-auto pr-1">
                    {strapsInCategory.slice(0, 12).map((strap, index) => (
                      <ConceptDrawerButton
                        key={strap.id}
                        strap={strap}
                        active={hasSelectedLibraryStrap && strap.id === currentStrap.id}
                        animateIn={animateDrawerReveal}
                        animationDelayMs={index * 55}
                        onClick={() => {
                          setStrapIndex(index);
                          setHasSelectedLibraryStrap(true);
                          setHighlightStage(true);
                          triggerStrapSettle();
                          window.setTimeout(() => {
                            previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }, 70);
                        }}
                      />
                    ))}
                  </div>
                </>
              )}

              <div className="mt-4 rounded-2xl border border-white/70 bg-white/60 p-4 text-sm leading-6 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <p className="font-semibold text-ink">Concept notes</p>
                <p className="mt-1">
                  This route is intentionally focused: one stage, one reveal, and the drawer only fills once the watch is genuinely ready.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function ConceptUploadStage({
  previewUrl,
  showUploadGuide,
  onToggleUploadGuide,
  onCloseUploadGuide,
  onFileSelect
}: {
  previewUrl: string;
  showUploadGuide: boolean;
  onToggleUploadGuide: () => void;
  onCloseUploadGuide: () => void;
  onFileSelect: (file: File) => void;
}) {
  return (
    <div className="upload-attention-ring rounded-[1.75rem]">
      <div className="glass-card rounded-[1.75rem] p-3 sm:p-4">
        <div className="rounded-[1.4rem] border border-line bg-white/70 p-5 sm:p-7">
          <div className="mx-auto max-w-[38rem] text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">1. Upload first</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
              Use the main stage as your whole try-on flow.
            </h2>
            <p className="mx-auto mt-4 max-w-[34rem] text-base leading-7 text-slate-600 sm:text-lg">
              Upload here, crop here, then stay in this same place while the watch head settles and the drawer fills with straps.
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-[34rem]">
            <ImageUploader
              id="concept-watch-stage"
              label=""
              helperText=""
              previewUrl={previewUrl}
              onFileSelect={onFileSelect}
              className="w-full"
            />
          </div>
          <div className="mx-auto mt-5 max-w-[34rem]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600">Straight-on shots make the later strap reveal much cleaner.</p>
              <button
                type="button"
                onClick={onToggleUploadGuide}
                className="neo-button inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-ink"
              >
                Photo Tips <span className="text-base leading-none">{showUploadGuide ? "←" : "→"}</span>
              </button>
            </div>
            {showUploadGuide ? (
              <div className="mt-4 rounded-2xl border border-line bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                <button
                  type="button"
                  onClick={onCloseUploadGuide}
                  className="mb-2 text-left text-base font-semibold text-ink"
                >
                  Photo Tips
                </button>
                <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-1">
                  {UPLOAD_GUIDE_ITEMS.map((item) => (
                    <div key={item.title} className="min-w-[156px] max-w-[164px] flex-1">
                      <UploadGuideCard item={item} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConceptWatchOnlyPreview({
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
      await renderWatchOnlyComposition(canvasRef.current, watchSrc, watchScale, DEFAULT_SCENE_ZOOM);
    };
    void draw();
    return () => {
      active = false;
    };
  }, [watchSrc, watchScale]);

  useEffect(() => {
    let active = true;
    const loadGuides = async () => {
      try {
        const scaledGuides = await detectPreviewLugGuides(watchSrc, watchScale);
        if (!active) return;
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

  const effectiveLugGuides = lugGuides
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
      const nextTopWidthState = getWatchOnlyGuideWidthState(drag.mode, drag.initialCenterX, drag.initialTopWidth, deltaX);
      onLugGuidesChange({
        centerX: nextTopWidthState?.centerX ?? nextCenterXBase,
        topY: nextTopY,
        bottomY: effectiveLugGuides.bottomY,
        topWidth: nextTopWidthState?.width ?? effectiveLugGuides.topWidth,
        bottomWidth: effectiveLugGuides.bottomWidth
      });
    } else {
      const nextBottomY = clamp(drag.initialBottomY + deltaY, drag.initialTopY + 60, CANVAS_SIZE * 0.88);
      const nextBottomWidthState = getWatchOnlyGuideWidthState(drag.mode, drag.initialCenterX, drag.initialBottomWidth, deltaX);
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

  return (
    <div className={highlighted ? "preview-attention-ring rounded-[1.75rem]" : ""}>
      <div className="glass-card rounded-[1.75rem] p-3 sm:p-4">
        <div className="rounded-[1.4rem] border border-line bg-white/70 p-3">
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="aspect-square w-full rounded-[1.2rem] border border-line bg-white"
              aria-label="Watch-only concept preview"
              onPointerDown={onGuidePointerDown}
              onPointerMove={onGuidePointerMove}
              onPointerUp={onGuidePointerEnd}
              onPointerCancel={onGuidePointerEnd}
              style={{ touchAction: "none" }}
            />
            {showLugGuides && effectiveLugGuides ? <WatchOnlyLugGuideOverlay guides={effectiveLugGuides} /> : null}
            {showLugGuides && showGuideOnboarding && effectiveLugGuides ? (
              <WatchOnlyLugGuideCoachmark onDismiss={onDismissGuideOnboarding} />
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[36rem] text-sm leading-6 text-slate-600">
              {showLugGuides
                ? "Line these guides up with the lug openings. Once you pick the first strap, they get out of the way automatically."
                : "The watch head is ready. Choose a strap from the drawer and keep the whole try-on in this same stage."}
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

function DrawerLockedState({ straps }: { straps: StrapVariant[] }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-line bg-white/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Empty for now</p>
      <p className="mt-2 text-lg font-semibold text-ink">The straps arrive once the watch stage is ready.</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Upload, crop, and settle the watch head first. Then the drawer visibly fills in one clean moment.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {straps.map((strap) => (
          <div key={strap.id} className="rounded-2xl border border-line bg-white/80 p-3 opacity-80">
            <div className="flex h-20 items-center justify-center rounded-[1rem] border border-line bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={strap.strapASrc} alt={strap.label} className="h-full w-full scale-[1.45] object-contain" />
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight text-ink">{strap.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConceptDrawerButton({
  strap,
  active,
  animateIn,
  animationDelayMs,
  onClick
}: {
  strap: StrapVariant;
  active: boolean;
  animateIn: boolean;
  animationDelayMs: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[1.45rem] border px-3.5 py-3.5 text-left transition ${
        active
          ? "border-emerald-200 bg-emerald-50/90 text-ink shadow-[0_10px_24px_rgba(16,185,129,0.12)]"
          : "border-line bg-white/72 text-ink hover:bg-white"
      } ${animateIn ? "drawer-reveal-item" : ""}`}
      style={animateIn ? { animationDelay: `${animationDelayMs}ms` } : undefined}
    >
      <div className={`flex h-[108px] w-[108px] shrink-0 items-center justify-center overflow-hidden rounded-[1.1rem] border ${active ? "border-emerald-200 bg-white" : "border-line bg-slate-50"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={strap.strapASrc} alt={strap.label} className="h-full w-full scale-[1.7] object-contain" loading="lazy" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-semibold leading-tight text-ink">{strap.label}</p>
        <p className="mt-2 inline-flex rounded-full bg-slate-200/75 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
          {strap.category}
        </p>
      </div>
    </button>
  );
}

function StrapCollageBackground({ straps }: { straps: StrapVariant[] }) {
  const placements = [
    { left: "-2%", top: "2%", width: "15rem", rotate: "-18deg", opacity: 0.5 },
    { left: "8%", top: "18%", width: "13rem", rotate: "14deg", opacity: 0.42 },
    { left: "78%", top: "4%", width: "14rem", rotate: "16deg", opacity: 0.42 },
    { left: "86%", top: "30%", width: "16rem", rotate: "-20deg", opacity: 0.45 },
    { left: "-3%", top: "58%", width: "16rem", rotate: "12deg", opacity: 0.46 },
    { left: "10%", top: "78%", width: "14rem", rotate: "-12deg", opacity: 0.42 },
    { left: "72%", top: "64%", width: "16rem", rotate: "10deg", opacity: 0.4 },
    { left: "58%", top: "78%", width: "14rem", rotate: "-16deg", opacity: 0.38 },
    { left: "31%", top: "-2%", width: "15rem", rotate: "6deg", opacity: 0.34 },
    { left: "44%", top: "74%", width: "15rem", rotate: "18deg", opacity: 0.35 },
    { left: "55%", top: "18%", width: "14rem", rotate: "-9deg", opacity: 0.33 }
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {straps.map((strap, index) => {
        const placement = placements[index % placements.length];
        const src = index % 2 === 0 ? strap.strapASrc : strap.strapBSrc;
        return (
          <div
            key={`${strap.id}-${index}`}
            className="absolute rounded-[2rem] blur-[0.2px]"
            style={{
              left: placement.left,
              top: placement.top,
              width: placement.width,
              opacity: placement.opacity,
              transform: `rotate(${placement.rotate})`
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-auto w-full object-contain drop-shadow-[0_16px_30px_rgba(15,23,42,0.12)]" />
          </div>
        );
      })}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(244,247,251,0.18)_38%,rgba(244,247,251,0.82)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(248,250,252,0.62),rgba(248,250,252,0.22)_28%,rgba(248,250,252,0.58))]" />
    </div>
  );
}

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
          <img src={item.imageSrc} alt={`${item.title} upload example`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-slate-900">{item.title}</p>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${chipTone}`}>{item.verdict}</span>
      </div>
    </div>
  );
}

function WatchOnlyLugGuideOverlay({ guides }: { guides: PreviewLugGuides }) {
  const topLeft = ((guides.centerX - guides.topWidth / 2) / CANVAS_SIZE) * 100;
  const topWidth = (guides.topWidth / CANVAS_SIZE) * 100;
  const topY = (guides.topY / CANVAS_SIZE) * 100;
  const bottomLeft = ((guides.centerX - guides.bottomWidth / 2) / CANVAS_SIZE) * 100;
  const bottomWidth = (guides.bottomWidth / CANVAS_SIZE) * 100;
  const bottomY = (guides.bottomY / CANVAS_SIZE) * 100;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.2rem]">
      <div className="absolute h-[2px] rounded-full border border-cyan-300 bg-cyan-400/12" style={{ left: `${topLeft}%`, top: `${topY}%`, width: `${topWidth}%` }} />
      <div className="absolute rounded-full border border-cyan-300 bg-white relative" style={{ left: `calc(${topLeft}% - 7px)`, top: `calc(${topY}% - 7px)`, width: "14px", height: "14px" }}>
        <span className="absolute inset-[-5px] rounded-full border border-cyan-300/70 animate-ping" />
      </div>
      <div className="absolute rounded-full border border-cyan-300 bg-white relative" style={{ left: `calc(${topLeft + topWidth}% - 7px)`, top: `calc(${topY}% - 7px)`, width: "14px", height: "14px" }}>
        <span className="absolute inset-[-5px] rounded-full border border-cyan-300/70 animate-ping" />
      </div>
      <div className="absolute h-[2px] rounded-full border border-cyan-300 bg-cyan-400/12" style={{ left: `${bottomLeft}%`, top: `${bottomY}%`, width: `${bottomWidth}%` }} />
      <div className="absolute rounded-full border border-cyan-300 bg-white relative" style={{ left: `calc(${bottomLeft}% - 7px)`, top: `calc(${bottomY}% - 7px)`, width: "14px", height: "14px" }}>
        <span className="absolute inset-[-5px] rounded-full border border-cyan-300/70 animate-ping" />
      </div>
      <div className="absolute rounded-full border border-cyan-300 bg-white relative" style={{ left: `calc(${bottomLeft + bottomWidth}% - 7px)`, top: `calc(${bottomY}% - 7px)`, width: "14px", height: "14px" }}>
        <span className="absolute inset-[-5px] rounded-full border border-cyan-300/70 animate-ping" />
      </div>
      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-slate-200 bg-white/92 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
        Align these to the lug openings, then pick a strap.
      </div>
    </div>
  );
}

function WatchOnlyLugGuideCoachmark({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden rounded-[1.2rem]">
      <div className="absolute left-5 top-5 max-w-[18rem] rounded-2xl border border-cyan-200/80 bg-white/94 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur">
        <div className="pointer-events-auto flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Set the lug openings</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Drag the rows or the blinking end handles to line them up with the real lug openings before your first strap lands.
            </p>
          </div>
          <button type="button" onClick={onDismiss} className="neo-button rounded-xl px-2.5 py-1 text-xs font-semibold text-ink">
            Got it
          </button>
        </div>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span>Line them up</span>
            <span>Then pick a strap</span>
          </div>
          <div className="mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border border-cyan-300 bg-white" />
              <span className="h-[2px] flex-1 rounded-full bg-cyan-300" />
              <span className="h-3 w-3 rounded-full border border-cyan-300 bg-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg text-cyan-500">↕</span>
              <span className="text-xs text-slate-600">Move the row to the opening</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg text-cyan-500">↔</span>
              <span className="text-xs text-slate-600">Adjust the width from either side</span>
            </div>
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
  const inRange = (x: number, left: number, width: number) => x >= left - 12 && x <= left + width + 12;

  if (Math.abs(point.x - topLeft) <= handleBand && Math.abs(point.y - guides.topY) <= handleBand) {
    return { guide: "top", mode: "resize-left" };
  }
  if (Math.abs(point.x - topRight) <= handleBand && Math.abs(point.y - guides.topY) <= handleBand) {
    return { guide: "top", mode: "resize-right" };
  }
  if (Math.abs(point.y - guides.topY) <= hitBand && inRange(point.x, topLeft, guides.topWidth)) {
    return { guide: "top", mode: "move" };
  }
  if (Math.abs(point.x - bottomLeft) <= handleBand && Math.abs(point.y - guides.bottomY) <= handleBand) {
    return { guide: "bottom", mode: "resize-left" };
  }
  if (Math.abs(point.x - bottomRight) <= handleBand && Math.abs(point.y - guides.bottomY) <= handleBand) {
    return { guide: "bottom", mode: "resize-right" };
  }
  if (Math.abs(point.y - guides.bottomY) <= hitBand && inRange(point.x, bottomLeft, guides.bottomWidth)) {
    return { guide: "bottom", mode: "move" };
  }
  return null;
}

function getWatchOnlyGuideWidthState(mode: GuideDragMode, initialCenterX: number, initialWidth: number, deltaX: number) {
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
