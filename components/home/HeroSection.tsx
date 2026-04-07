"use client";

import Link from "next/link";
import HeroCardStack from "@/components/home/HeroCardStack";
import { HERO_PAIRS } from "@/lib/homepageContent";

interface HeroSectionProps {
  className?: string;
  primaryCtaHref?: string;
  secondaryCtaHref?: string;
  onSelectPair?: (pairId: string) => void;
}

export default function HeroSection({
  className = "",
  primaryCtaHref = "#upload-watch",
  secondaryCtaHref = "#style-starters",
  onSelectPair
}: HeroSectionProps) {
  return (
    <section
      className={`grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] xl:items-start xl:gap-8 ${className}`}
    >
      <div className="space-y-7 xl:pt-3">
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7c7165]">
            Premium strap fitting studio
          </p>
          <h1 className="max-w-[10.9ch] font-serif text-[3.15rem] leading-[0.9] tracking-[-0.05em] text-[#2b241d] sm:text-[4.8rem]">
            See any strap on your watch.
          </h1>
          <p className="max-w-[34rem] text-[1rem] leading-7 text-muted sm:text-[1.03rem]">
            Upload a watch photo, try premium strap pairings, and compare the look before you buy.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={primaryCtaHref}
            className="neo-button--primary rounded-2xl px-5 py-3 text-sm font-semibold text-white"
          >
            Upload Your Watch
          </Link>
          <Link
            href={secondaryCtaHref}
            className="neo-button rounded-2xl px-5 py-3 text-sm font-semibold text-ink"
          >
            Try Sample Watches
          </Link>
        </div>

        <div className="grid max-w-[34rem] gap-3 sm:grid-cols-3">
          {HERO_PAIRS.slice(0, 3).map((pair) => (
            <div
              key={pair.id}
              className="rounded-[1.3rem] border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(249,244,237,0.88))] p-3 shadow-[0_12px_28px_rgba(56,44,32,0.05)]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7c7165]">
                {pair.strapCategory}
              </p>
              <p className="mt-2 text-sm font-semibold leading-tight text-ink">
                {pair.label}
              </p>
              <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted">
                {pair.mood}
              </p>
            </div>
          ))}
        </div>
      </div>

      <HeroCardStack
        pairs={HERO_PAIRS}
        onSelectPair={(pair) => onSelectPair?.(pair.id)}
      />
    </section>
  );
}
