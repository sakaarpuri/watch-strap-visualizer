"use client";

import { useState, type CSSProperties } from "react";
import {
  STRAP_WORLDS,
  type HomepageStrapWorld
} from "@/lib/homepageContent";

interface StrapWorldsSectionProps {
  worlds?: HomepageStrapWorld[];
  title?: string;
  subtitle?: string;
  className?: string;
  onSelectWorld?: (world: HomepageStrapWorld) => void;
  onSelectCategory?: (category: HomepageStrapWorld["category"]) => void;
}

const panelBackground = (featured: boolean): CSSProperties => ({
  backgroundImage: featured
    ? "linear-gradient(155deg, rgba(255,255,255,0.98), rgba(246,239,230,0.92))"
    : "linear-gradient(155deg, rgba(255,255,255,0.95), rgba(248,242,233,0.78))"
});

export default function StrapWorldsSection({
  worlds = STRAP_WORLDS,
  title = "Strap Worlds",
  subtitle = "Browse by material mood instead of hunting through a flat drawer.",
  className = "",
  onSelectWorld,
  onSelectCategory
}: StrapWorldsSectionProps) {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  return (
    <section className={className}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7c7165]">
            Materials
          </p>
          <h2 className="mt-2 font-serif text-[1.85rem] leading-none tracking-[-0.02em] text-[#2b241d] sm:text-[2.2rem]">
            {title}
          </h2>
        </div>
        <p className="max-w-[34rem] text-sm leading-6 text-muted sm:text-[0.97rem]">
          {subtitle}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
        {worlds.map((world, index) => {
          const featured = index === 0;
          const handleClick = () => {
            onSelectWorld?.(world);
            onSelectCategory?.(world.category);
          };

          return (
            <button
              key={world.id}
              type="button"
              onClick={handleClick}
              className={`group overflow-hidden rounded-[1.7rem] border border-line/90 bg-canvas text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(56,44,32,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#30486c]/30 ${
                featured ? "sm:col-span-2" : ""
              }`}
            >
              <div
                className={`p-3 ${featured ? "sm:p-4" : "sm:p-3"}`}
                style={panelBackground(featured)}
              >
                <div
                  className={`relative overflow-hidden rounded-[1.15rem] border border-white/80 bg-[linear-gradient(160deg,#fcfcfd,#f3f6fb)] ${
                    featured ? "min-h-[340px] sm:min-h-[360px]" : "min-h-[240px] sm:min-h-[300px]"
                  }`}
                >
                  {!imageErrors[world.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={world.image}
                      alt={world.title}
                      className={`h-full w-full object-cover object-center transition duration-500 group-hover:scale-[1.03] ${
                        featured ? "scale-[1.01]" : ""
                      }`}
                      loading="eager"
                      decoding="async"
                      onError={() =>
                        setImageErrors((current) => ({ ...current, [world.id]: true }))
                      }
                    />
                  ) : null}
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4">
                    <div className="rounded-full border border-line/80 bg-white/84 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6f6458] shadow-[0_8px_16px_rgba(56,44,32,0.04)]">
                      {world.category}
                    </div>
                    <span className="rounded-full border border-white/60 bg-white/58 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b59d7f] backdrop-blur">
                      Preview
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(252,251,248,0.82)_56%,rgba(252,251,248,0.98)_100%)] px-4 pb-4 pt-12">
                    <div className={`max-w-[18rem] ${featured ? "sm:max-w-[24rem]" : ""}`}>
                      <p className="font-serif text-[1.55rem] leading-none tracking-[-0.02em] text-ink sm:text-[1.65rem]">
                        {world.title}
                      </p>
                      <p className="mt-3 max-w-[15rem] text-sm leading-6 text-muted">
                        {world.description}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#8a7d70]">
                        Explore {world.category}
                      </span>
                      <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink transition group-hover:border-[#d7c1a3] group-hover:bg-white">
                        Open
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
