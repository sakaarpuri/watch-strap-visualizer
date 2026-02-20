import type { StrapStyle } from "@/lib/compose";

export type StrapCategory = "Leather" | "Rubber" | "Fabric" | "Metal";

export interface StrapVariant {
  id: string;
  label: string;
  category: StrapCategory;
  strapASrc: string;
  strapBSrc: string;
  tint: StrapStyle;
}

const BASE_A = "/sample-strap-a.png";
const BASE_B = "/sample-strap-b.png";

export const STRAP_LIBRARY: Record<StrapCategory, StrapVariant[]> = {
  Leather: [
    { id: "leather-black", label: "Black Leather", category: "Leather", strapASrc: BASE_A, strapBSrc: BASE_B, tint: { name: "Black Leather", color: "#1b1b1b", alpha: 0.3 } },
    { id: "leather-brown", label: "Brown Leather", category: "Leather", strapASrc: BASE_A, strapBSrc: BASE_B, tint: { name: "Brown Leather", color: "#6f4a2f", alpha: 0.3 } },
    { id: "leather-burgundy", label: "Burgundy Leather", category: "Leather", strapASrc: BASE_A, strapBSrc: BASE_B, tint: { name: "Burgundy Leather", color: "#5f2730", alpha: 0.28 } }
  ],
  Rubber: [
    { id: "rubber-black", label: "Black Rubber", category: "Rubber", strapASrc: BASE_A, strapBSrc: BASE_B, tint: { name: "Black Rubber", color: "#1a1a1a", alpha: 0.38 } },
    { id: "rubber-olive", label: "Olive Rubber", category: "Rubber", strapASrc: BASE_A, strapBSrc: BASE_B, tint: { name: "Olive Rubber", color: "#51613f", alpha: 0.34 } },
    { id: "rubber-navy", label: "Navy Rubber", category: "Rubber", strapASrc: BASE_A, strapBSrc: BASE_B, tint: { name: "Navy Rubber", color: "#2a3a56", alpha: 0.35 } }
  ],
  Fabric: [
    { id: "fabric-olive", label: "Olive NATO", category: "Fabric", strapASrc: BASE_A, strapBSrc: BASE_B, tint: { name: "Olive NATO", color: "#647247", alpha: 0.31 } },
    { id: "fabric-sand", label: "Sand Canvas", category: "Fabric", strapASrc: BASE_A, strapBSrc: BASE_B, tint: { name: "Sand Canvas", color: "#8f7f62", alpha: 0.28 } },
    { id: "fabric-gray", label: "Gray Sailcloth", category: "Fabric", strapASrc: BASE_A, strapBSrc: BASE_B, tint: { name: "Gray Sailcloth", color: "#666b73", alpha: 0.3 } }
  ],
  Metal: [
    { id: "metal-polished", label: "Polished Steel", category: "Metal", strapASrc: BASE_A, strapBSrc: BASE_B, tint: { name: "Polished Steel", color: "#9ca3ad", alpha: 0.22 } },
    { id: "metal-brushed", label: "Brushed Steel", category: "Metal", strapASrc: BASE_A, strapBSrc: BASE_B, tint: { name: "Brushed Steel", color: "#818992", alpha: 0.26 } },
    { id: "metal-black", label: "Black PVD", category: "Metal", strapASrc: BASE_A, strapBSrc: BASE_B, tint: { name: "Black PVD", color: "#262626", alpha: 0.34 } }
  ]
};

export const STRAP_CATEGORIES = Object.keys(STRAP_LIBRARY) as StrapCategory[];
