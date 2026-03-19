import type { StrapCategory, StrapVariant } from "@/lib/strapLibrary";

export type StrapSourceType = "library" | "saved";

export interface ProfileRecord {
  id: string;
  full_name: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SavedWatch {
  id: string;
  user_id: string;
  label: string;
  image_url: string;
  watch_brand?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SavedStrap {
  id: string;
  user_id: string;
  label: string;
  category: StrapCategory;
  strap_a_url: string;
  strap_b_url: string;
  material?: string | null;
  hardware_finish?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface FavoriteStrap {
  id: string;
  user_id: string;
  source_type: StrapSourceType;
  library_strap_id?: string | null;
  saved_strap_id?: string | null;
  created_at?: string;
}

export interface SavedLook {
  id: string;
  user_id: string;
  label: string;
  image_url: string;
  watch_label?: string | null;
  watch_source_type?: "uploaded" | "saved" | null;
  saved_watch_id?: string | null;
  strap_label?: string | null;
  strap_source_type?: "library" | "saved" | "uploaded" | null;
  library_strap_id?: string | null;
  saved_strap_id?: string | null;
  fit_settings?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface DrawerStrapItem {
  key: string;
  id: string;
  label: string;
  category: StrapCategory;
  strapASrc: string;
  strapBSrc: string;
  sourceType: StrapSourceType;
  libraryStrap?: StrapVariant;
  savedStrap?: SavedStrap;
}

export const savedStrapToDrawerItem = (strap: SavedStrap): DrawerStrapItem => ({
  key: `saved:${strap.id}`,
  id: strap.id,
  label: strap.label,
  category: strap.category,
  strapASrc: strap.strap_a_url,
  strapBSrc: strap.strap_b_url,
  sourceType: "saved",
  savedStrap: strap
});

export const libraryStrapToDrawerItem = (strap: StrapVariant): DrawerStrapItem => ({
  key: `library:${strap.id}`,
  id: strap.id,
  label: strap.label,
  category: strap.category,
  strapASrc: strap.strapASrc,
  strapBSrc: strap.strapBSrc,
  sourceType: "library",
  libraryStrap: strap
});
