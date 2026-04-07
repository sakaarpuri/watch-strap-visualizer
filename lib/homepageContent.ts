import homepageContent from "@/public/homepage/content/homepage-content.json";

export type HomepageStrapCategory = "Leather" | "Fabric" | "Rubber" | "Metal";
export type HomepageWatchArchetypeId =
  | "field-watch"
  | "diver-watch"
  | "modern-sport-watch";

export interface HomepageWatchArchetype {
  id: HomepageWatchArchetypeId;
  title: string;
  reference: string;
  description: string;
}

export interface HomepageHeroPair {
  id: string;
  title: string;
  label: string;
  watchArchetypeId: HomepageWatchArchetypeId;
  libraryStrapId: string;
  strapCategory: HomepageStrapCategory;
  mood: string;
  assetBase: string;
  variants: Array<"a" | "b">;
  background: "warm-ivory";
  crop: "4:5";
  note?: string;
}

export interface HomepageStyleStarter {
  id: string;
  title: string;
  subtitle: string;
  watchArchetypeId: HomepageWatchArchetypeId;
  libraryStrapId: string;
  strapCategory: HomepageStrapCategory;
  image: string;
  note?: string;
}

export interface HomepageStrapWorld {
  id: string;
  title: string;
  description: string;
  category: HomepageStrapCategory;
  image: string;
}

interface HomepageContentPayload {
  watchArchetypes: HomepageWatchArchetype[];
  heroPairs: HomepageHeroPair[];
  styleStarters: HomepageStyleStarter[];
  strapWorlds: HomepageStrapWorld[];
}

const content = homepageContent as HomepageContentPayload;

export const WATCH_ARCHETYPES = content.watchArchetypes;
export const HERO_PAIRS = content.heroPairs;
export const STYLE_STARTERS = content.styleStarters;
export const STRAP_WORLDS = content.strapWorlds;

export const getHeroPairImage = (
  pair: HomepageHeroPair,
  variant: "a" | "b" = "a"
) => `${pair.assetBase}-${variant}.png`;

export const getHeroPairPoster = (pair: HomepageHeroPair) =>
  getHeroPairImage(pair, "a");

export const getWatchArchetypeById = (id: HomepageWatchArchetypeId) =>
  WATCH_ARCHETYPES.find((item) => item.id === id) ?? null;
