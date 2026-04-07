"use client";

import { useState, type CSSProperties } from "react";
import {
  STYLE_STARTERS,
  type HomepageStyleStarter
} from "@/lib/homepageContent";

interface StyleStartersSectionProps {
  starters?: HomepageStyleStarter[];
  title?: string;
  subtitle?: string;
  className?: string;
  onSelectStarter?: (starter: HomepageStyleStarter) => void;
  onSelectCategory?: (category: HomepageStyleStarter["strapCategory"]) => void;
}

const cardBackground = (featured: boolean): CSSProperties => ({
  backgroundImage: featured
    ? "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(247,239,229,0.9))"
    : "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(251,246,239,0.78))"
});

export default function StyleStartersSection({
  starters = STYLE_STARTERS,
  title = "Style Starters",
  subtitle = "Jump into a look that already feels resolved.",
  className = "",
  onSelectStarter,
  onSelectCategory
}: StyleStartersSectionProps) {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  return (
    <section className={className}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7c7165]">
            Quick Starts
          </p>
          <h2 className="mt-2 font-serif text-[1.85rem] leading-none tracking-[-0.02em] text-[#2b241d] sm:text-[2.2rem]">
            {title}
          </h2>
        </div>
        <p className="max-w-[34rem] text-sm leading-6 text-muted sm:text-[0.97rem]">
          {subtitle}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
        {starters.map((starter, index) => {
          const featured = index === 0;
          const handleClick = () => {
            onSelectStarter?.(starter);
            onSelectCategory?.(starter.strapCategory);
          };

          return (
            <button
              key={starter.id}
              type="button"
              onClick={handleClick}
              className="group overflow-hidden rounded-[1.7rem] border border-line/90 bg-canvas text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(56,44,32,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#30486c]/30"
            >
              <div
                className={`p-3 ${
                  featured ? "sm:p-4" : "sm:p-3"
                }`}
                style={cardBackground(featured)}
              >
                <div
                  className={`relative overflow-hidden rounded-[1.15rem] border border-white/80 bg-[linear-gradient(160deg,#fcfcfd,#f3f6fb)] ${
                    featured ? "min-h-[300px] sm:min-h-[330px]" : "min-h-[240px] sm:min-h-[270px]"
                  }`}
                >
                  {!imageErrors[starter.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={starter.image}
                      alt={starter.title}
                      className={`h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.03] ${
                        featured ? "scale-[1.01]" : ""
                      }`}
                      loading={featured ? "eager" : "lazy"}
                      decoding="async"
                      onError={() =>
                        setImageErrors((current) => ({ ...current, [starter.id]: true }))
                      }
                    />
                  ) : null}
                  <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
                    <div className="rounded-full border border-line/80 bg-white/82 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6f6458] shadow-[0_8px_16px_rgba(56,44,32,0.04)]">
                      {starter.strapCategory}
                    </div>
                    <span className="rounded-full border border-white/60 bg-white/58 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a7d70] backdrop-blur">
                      Starter
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(252,251,248,0.76)_48%,rgba(252,251,248,0.96)_100%)] p-4 pt-14">
                    <div className={`max-w-[14rem] ${featured ? "sm:max-w-[16rem]" : ""}`}>
                      <p className="text-[1.34rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
                        {starter.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        {starter.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-line/50 px-4 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a7d70]">
                  {starter.watchArchetypeId.replace(/-/g, " ")}
                </p>
                <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink transition group-hover:border-[#d7c1a3] group-hover:bg-white">
                  Try Look
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
