"use client";

import { useEffect, useMemo, useState } from "react";
import {
  HERO_PAIRS,
  getHeroPairImage,
  getWatchArchetypeById,
  type HomepageHeroPair
} from "@/lib/homepageContent";

interface HeroCardStackProps {
  pairs?: HomepageHeroPair[];
  className?: string;
  onSelectPair?: (pair: HomepageHeroPair) => void;
}

const rotationMs = 3200;

export default function HeroCardStack({
  pairs = HERO_PAIRS,
  className = "",
  onSelectPair
}: HeroCardStackProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const normalizedPairs = useMemo(() => pairs.slice(0, 7), [pairs]);

  useEffect(() => {
    if (paused || normalizedPairs.length <= 1) return;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % normalizedPairs.length);
    }, rotationMs);
    return () => window.clearInterval(interval);
  }, [normalizedPairs.length, paused]);

  if (!normalizedPairs.length) {
    return null;
  }

  return (
    <div
      className={`relative isolate overflow-hidden rounded-[2rem] border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,242,234,0.94))] p-2.5 shadow-[0_24px_54px_rgba(56,44,32,0.08)] ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.82),transparent_46%),radial-gradient(circle_at_bottom_right,rgba(185,161,131,0.09),transparent_32%)]" />
      <div className="relative min-h-[20rem] sm:min-h-[23rem] xl:min-h-[25rem]">
        {normalizedPairs.map((pair, index) => {
          const archetype = getWatchArchetypeById(pair.watchArchetypeId);
          const total = normalizedPairs.length;
          const offset = (index - activeIndex + total) % total;
          const visibleOffset = offset > total / 2 ? offset - total : offset;
          const isActive = index === activeIndex;
          const imageSrc = getHeroPairImage(pair, "a");
          const hasImageError = imageErrors[pair.id] === true;
          const depth = Math.abs(visibleOffset);
          const translateY = isActive ? 0 : depth === 1 ? visibleOffset * 18 : visibleOffset * 26;
          const translateX = isActive ? 0 : visibleOffset * 7;
          const scale = isActive ? 1 : depth === 1 ? 0.94 : 0.87;
          const rotate = visibleOffset * 1.1;
          const opacity = isActive ? 1 : depth === 1 ? 0.78 : 0.5;
          const zIndex = isActive ? 30 : 30 - depth;

          return (
            <button
              key={pair.id}
              type="button"
              onClick={() => onSelectPair?.(pair)}
              className="group absolute inset-x-0 top-0 mx-auto w-[min(100%,22.5rem)] rounded-[1.7rem] border border-line bg-canvas/90 p-2.5 text-left shadow-[0_14px_36px_rgba(56,44,32,0.08)] transition duration-500 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#30486c]/30 sm:w-[min(100%,24rem)] xl:w-[min(100%,25.5rem)]"
              style={{
                transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale}) rotate(${rotate}deg)`,
                opacity,
                zIndex,
                pointerEvents: isActive ? "auto" : depth <= 1 ? "auto" : "none"
              }}
              aria-label={pair.title}
            >
              <div className="overflow-hidden rounded-[1.35rem] border border-line bg-[linear-gradient(180deg,#fcfcfb,#f3eee5)] p-2">
                <div className="relative flex min-h-[14rem] items-center justify-center overflow-hidden rounded-[1.1rem] border border-white/85 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(245,239,230,0.92))] sm:min-h-[15.5rem] xl:min-h-[16.5rem]">
                  {!hasImageError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageSrc}
                      alt={pair.label}
                      className="h-full w-full object-contain object-center scale-[1.08] sm:scale-[1.14] xl:scale-[1.18]"
                      loading={isActive ? "eager" : "lazy"}
                      decoding="async"
                      onError={() =>
                        setImageErrors((current) => ({ ...current, [pair.id]: true }))
                      }
                    />
                  ) : null}
                  {hasImageError ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 py-8 text-center">
                      <div className="rounded-full border border-line bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6f6458]">
                        {pair.strapCategory}
                      </div>
                      <p className="font-serif text-[1.6rem] leading-none text-ink">
                        {pair.title}
                      </p>
                      {archetype ? (
                        <p className="max-w-[18rem] text-sm leading-6 text-muted">
                          {archetype.description}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(252,251,248,0.88)_52%,rgba(252,251,248,0.98)_100%)] px-4 pb-4 pt-12">
                    <div className="flex items-end justify-between gap-3">
                      <div className="max-w-[13rem]">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7c7165]">
                          {pair.strapCategory}
                        </p>
                        <p className="mt-1 text-[1rem] font-semibold leading-tight text-ink sm:text-[1.08rem]">
                          {pair.label}
                        </p>
                        <p className="mt-1 text-[11px] leading-4 text-muted">
                          {pair.mood}
                        </p>
                      </div>
                      <span className="rounded-full border border-line bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink shadow-[0_6px_16px_rgba(56,44,32,0.05)]">
                        View
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-line bg-[linear-gradient(180deg,rgba(252,250,245,0.78),rgba(248,242,234,0.96))] px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-[#7c7165] backdrop-blur-sm sm:px-5">
        <span>{normalizedPairs[activeIndex]?.label}</span>
        <span>{paused ? "Paused" : "Auto rotating"}</span>
      </div>
    </div>
  );
}
