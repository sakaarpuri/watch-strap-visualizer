import { unstable_cache } from "next/cache";
import { getStrapsForCategory, StrapVariant } from "@/lib/strapLibrary";

export interface SimilarProduct {
  id: string;
  title: string;
  store: string;
  url: string;
  affiliateUrl?: string;
  imageSrc: string;
  material: StrapVariant["shopping"]["material"];
  styleFamilies: StrapVariant["shopping"]["styleFamily"][];
  colorFamilies: StrapVariant["shopping"]["colorFamily"][];
  hardwareFinishes: StrapVariant["shopping"]["hardwareFinish"][];
  keywords?: string[];
}

export interface SimilarProductCard {
  id: string;
  title: string;
  store: string;
  url: string;
  imageSrc: string;
  price?: string;
  matchType?: "exact" | "compatible" | "similar";
  reason?: string;
}

interface ShoppingSeed {
  productType: "watch strap";
  label: string;
  construction: "single-pass" | "two-piece" | "bracelet-two-piece";
  material: StrapVariant["shopping"]["material"];
  styleFamily: StrapVariant["shopping"]["styleFamily"];
  colorFamily: StrapVariant["shopping"]["colorFamily"];
  hardwareFinish: StrapVariant["shopping"]["hardwareFinish"];
  keywords: string[];
  negativeKeywords: string[];
}

interface GeminiQueryPlan {
  exact: string[];
  compatible: string[];
  similar: string[];
  negativeKeywords?: string[];
}

interface NormalizedShoppingResult {
  id: string;
  title: string;
  store: string;
  url: string;
  imageSrc: string;
  price?: string;
  parsedMaterial?: StrapVariant["shopping"]["material"];
  parsedStyle?: StrapVariant["shopping"]["styleFamily"];
  parsedColor?: StrapVariant["shopping"]["colorFamily"];
  parsedHardware?: StrapVariant["shopping"]["hardwareFinish"];
  keywords: string[];
}

interface RankedShoppingResult {
  product: SimilarProductCard;
  score: number;
}

const RAPIDAPI_PRODUCT_SEARCH_HOST = "real-time-product-search.p.rapidapi.com";
const RAPIDAPI_PRODUCT_SEARCH_BASE_URL = `https://${RAPIDAPI_PRODUCT_SEARCH_HOST}`;
const DEFAULT_RAPIDAPI_COUNTRY = process.env.RAPIDAPI_COUNTRY || "uk";
const DEFAULT_RAPIDAPI_LANGUAGE = process.env.RAPIDAPI_LANGUAGE || "en";
const DEFAULT_RAPIDAPI_SORT = process.env.RAPIDAPI_SORT_BY || "BEST_MATCH";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const ENABLE_GEMINI_SHOPPING_QUERY_ENRICHMENT = process.env.ENABLE_GEMINI_SHOPPING_QUERY_ENRICHMENT === "true";
const SHOPPING_CACHE_TTL_SECONDS = Number(process.env.SHOPPING_CACHE_TTL_SECONDS || 60 * 60 * 6);
const RAPIDAPI_SEARCH_PATHS = (process.env.RAPIDAPI_PRODUCT_SEARCH_PATHS || "search-v2,search,search-light-v2")
  .split(",")
  .map((entry) => entry.trim().replace(/^\/+/, ""))
  .filter(Boolean);

const CURATED_PRODUCTS: SimilarProduct[] = [
  {
    id: "wg-leather-classics",
    title: "Leather Watch Straps",
    store: "WatchGecko",
    url: "https://www.watchgecko.com/collections/leather-watch-straps",
    imageSrc: "/strap-selection-kie/black-smooth-leather-buckle.png",
    material: "leather",
    styleFamilies: ["classic", "smooth", "grain", "pebbled", "pull-up"],
    colorFamilies: ["black", "brown", "tan", "beige", "burgundy"],
    hardwareFinishes: ["silver"]
  },
  {
    id: "cns-leather-bands",
    title: "Leather Watch Bands",
    store: "CNS Watch Bands",
    url: "https://cnswatchbands.com/leather-watch-bands/",
    imageSrc: "/strap-selection-kie/cognac-grain-leather-buckle.png",
    material: "leather",
    styleFamilies: ["classic", "smooth", "grain", "saffiano"],
    colorFamilies: ["brown", "tan", "black", "gray"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "wg-suede-straps",
    title: "Suede Watch Straps",
    store: "WatchGecko",
    url: "https://www.watchgecko.com/collections/suede-watch-straps",
    imageSrc: "/strap-selection-kie/sapphire-suede-buckle.png",
    material: "leather",
    styleFamilies: ["suede"],
    colorFamilies: ["blue", "green", "beige", "burgundy", "tan"],
    hardwareFinishes: ["silver"]
  },
  {
    id: "wg-nubuck-straps",
    title: "Nubuck & Soft Leather Straps",
    store: "WatchGecko",
    url: "https://www.watchgecko.com/collections/leather-watch-straps",
    imageSrc: "/strap-selection-kie/clean/taupe-nubuck-leather-buckle.png",
    material: "leather",
    styleFamilies: ["suede", "pull-up"],
    colorFamilies: ["brown", "gray", "green"],
    hardwareFinishes: ["silver"]
  },
  {
    id: "wg-canvas-straps",
    title: "Canvas Watch Straps",
    store: "WatchGecko",
    url: "https://www.watchgecko.com/collections/canvas-watch-straps",
    imageSrc: "/strap-selection-kie/fabric-khaki-canvas-buckle.png",
    material: "fabric",
    styleFamilies: ["canvas"],
    colorFamilies: ["green", "gray", "beige", "blue"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "wg-nylon-straps",
    title: "Nylon Watch Straps",
    store: "WatchGecko",
    url: "https://www.watchgecko.com/collections/nylon-watch-straps",
    imageSrc: "/strap-selection-kie/olive-nato-buckle.png",
    material: "fabric",
    styleFamilies: ["nato"],
    colorFamilies: ["green", "blue", "gray", "multicolor", "beige"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "cns-nylon-bands",
    title: "Nylon Watch Bands",
    store: "CNS Watch Bands",
    url: "https://cnswatchbands.com/nylon-watch-bands/",
    imageSrc: "/strap-selection-kie/holi-stripe-nato-buckle.png",
    material: "fabric",
    styleFamilies: ["nato", "canvas", "sailcloth"],
    colorFamilies: ["green", "blue", "gray", "multicolor", "beige"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "wg-sailcloth-straps",
    title: "Sailcloth Watch Straps",
    store: "WatchGecko",
    url: "https://www.watchgecko.com/collections/canvas-watch-straps",
    imageSrc: "/strap-selection-kie/fabric-black-sailcloth-buckle.png",
    material: "fabric",
    styleFamilies: ["sailcloth"],
    colorFamilies: ["black", "gray", "blue"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "barton-tropical-rubber",
    title: "Tropical-Style Rubber Watch Bands",
    store: "BARTON",
    url: "https://www.bartonwatchbands.com/collections/rubber-watch-bands",
    imageSrc: "/strap-selection-kie/rubber-orange-tropic-buckle.png",
    material: "rubber",
    styleFamilies: ["tropic", "rubber"],
    colorFamilies: ["orange", "blue", "black"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "barton-elite-silicone",
    title: "Elite Silicone Watch Bands",
    store: "BARTON",
    url: "https://www.bartonwatchbands.com/collections/elite-silicone-watch-bands",
    imageSrc: "/strap-selection-kie/olive-performance-rubber-buckle.png",
    material: "rubber",
    styleFamilies: ["performance", "rubber"],
    colorFamilies: ["green", "blue", "black", "orange"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "barton-rubber-collection",
    title: "Rubber Watch Bands",
    store: "BARTON",
    url: "https://www.bartonwatchbands.com/collections/rubber-watch-bands",
    imageSrc: "/strap-selection-kie/rubber-sand-fkm-buckle.png",
    material: "rubber",
    styleFamilies: ["fkm", "performance", "rubber"],
    colorFamilies: ["beige", "blue", "black", "green"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "wg-metal-straps",
    title: "Metal Watch Straps",
    store: "WatchGecko",
    url: "https://www.watchgecko.com/collections/metal-watch-straps",
    imageSrc: "/strap-selection-kie/steel-bracelet-buckle.png",
    material: "metal",
    styleFamilies: ["bracelet", "link-bracelet", "mesh"],
    colorFamilies: ["silver", "black"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "strapcode-metal-bracelets",
    title: "Metal Watch Bands",
    store: "Strapcode",
    url: "https://www.strapcode.com/collections/watch-bands",
    imageSrc: "/strap-selection-kie/steel-link-bracelet-buckle.png",
    material: "metal",
    styleFamilies: ["bracelet", "link-bracelet"],
    colorFamilies: ["silver", "black"],
    hardwareFinishes: ["silver", "black"]
  },
  {
    id: "strapcode-mesh-bands",
    title: "Mesh Watch Bands",
    store: "Strapcode",
    url: "https://www.strapcode.com/collections/mesh-watch-bands",
    imageSrc: "/strap-selection-kie/black-pvd-bracelet-buckle.png",
    material: "metal",
    styleFamilies: ["mesh"],
    colorFamilies: ["silver", "black"],
    hardwareFinishes: ["silver", "black"]
  }
];

const warmLeather = new Set(["brown", "tan", "beige"]);
const blueFamily = new Set(["blue"]);
const metalMarkers = ["bracelet", "mesh", "milanese", "link", "jubilee", "oyster", "flat link", "watch band"];
const fabricMarkers = ["nato", "nylon", "canvas", "sailcloth", "fabric", "seatbelt"];
const rubberMarkers = ["rubber", "fkm", "silicone", "tropic", "performance"];
const suedeMarkers = ["suede", "nubuck"];
const pebbledMarkers = ["pebbled"];
const grainMarkers = ["grain", "lizard"];
const pullupMarkers = ["pull-up", "pull up"];
const saffianoMarkers = ["saffiano"];
const meshMarkers = ["mesh", "milanese"];
const linkMarkers = ["link", "jubilee", "oyster", "flat link", "beads of rice"];

const includesAny = (haystack: string, needles: string[]) => needles.some((needle) => haystack.includes(needle));

const areColorFamiliesCompatible = (
  strapColor: StrapVariant["shopping"]["colorFamily"],
  productColor: StrapVariant["shopping"]["colorFamily"]
) => {
  if (strapColor === productColor) return true;
  if (warmLeather.has(strapColor) && warmLeather.has(productColor)) return true;
  if (blueFamily.has(strapColor) && blueFamily.has(productColor)) return true;
  return false;
};

const getStrapById = (strapId: string) => getStrapsForCategory("All categories").find((entry) => entry.id === strapId);

const inferConstruction = (strap: StrapVariant): ShoppingSeed["construction"] => {
  if (strap.shopping.material === "metal") return "bracelet-two-piece";
  if (strap.shopping.styleFamily === "nato") return "single-pass";
  return "two-piece";
};

const buildSeedFromStrap = (strap: StrapVariant): ShoppingSeed => ({
  productType: "watch strap",
  label: strap.label,
  construction: inferConstruction(strap),
  material: strap.shopping.material,
  styleFamily: strap.shopping.styleFamily,
  colorFamily: strap.shopping.colorFamily,
  hardwareFinish: strap.shopping.hardwareFinish,
  keywords: strap.shopping.keywords,
  negativeKeywords: ["apple watch", "smartwatch", "fitness tracker", "garmin", "fitbit", "case"]
});

const humanizeStyle = (style: ShoppingSeed["styleFamily"]) => {
  if (style === "link-bracelet") return "link bracelet";
  return style.replace(/-/g, " ");
};

const GENERIC_QUERY_KEYWORDS = new Set(["classic", "smooth", "grain", "pebbled", "pull", "saffiano"]);
const DEFAULT_ALLOWLIST_MERCHANTS = [
  "watchgecko",
  "cns watch bands",
  "barton",
  "strapcode",
  "watch obsession",
  "forstner",
  "staib",
  "crown & buckle",
  "bulang"
];
const DEFAULT_BLOCKLIST_MERCHANTS = ["amazon", "ebay", "etsy", "aliexpress", "temu", "wish"];
const MERCHANT_ALLOWLIST = new Set(
  (process.env.SHOPPING_MERCHANT_ALLOWLIST || DEFAULT_ALLOWLIST_MERCHANTS.join(","))
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
);
const MERCHANT_BLOCKLIST = new Set(
  (process.env.SHOPPING_MERCHANT_BLOCKLIST || DEFAULT_BLOCKLIST_MERCHANTS.join(","))
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
);

const MATERIAL_QUERY_TERMS: Record<ShoppingSeed["material"], string[]> = {
  leather: ["leather", "watch strap"],
  fabric: ["nylon", "fabric", "watch strap"],
  rubber: ["rubber", "watch strap"],
  metal: ["watch bracelet"]
};

const STYLE_QUERY_TERMS: Record<ShoppingSeed["styleFamily"], string[]> = {
  classic: ["classic"],
  smooth: ["smooth"],
  grain: ["grain", "grained", "lizard grain"],
  pebbled: ["pebbled"],
  "pull-up": ["pull up", "pull-up"],
  saffiano: ["saffiano"],
  suede: ["suede", "nubuck"],
  nato: ["nato", "nylon"],
  canvas: ["canvas"],
  sailcloth: ["sailcloth"],
  rubber: ["rubber"],
  tropic: ["tropic"],
  fkm: ["fkm", "fluoro rubber"],
  performance: ["performance", "rubber"],
  bracelet: ["bracelet"],
  "link-bracelet": ["link bracelet", "oyster", "jubilee", "flat link"],
  mesh: ["mesh", "milanese"]
};

const MULTICOLOR_HINTS = new Set(["striped", "patterned", "woven", "serape", "talavera", "holi", "oaxaca", "block", "indigo"]);

const buildDescriptorFromKeywords = (keywords: string[]) =>
  keywords
    .filter((keyword) => !GENERIC_QUERY_KEYWORDS.has(keyword))
    .slice(0, 3)
    .join(" ")
    .trim();

const buildPatternHints = (keywords: string[]) => {
  const set = new Set(keywords);
  const hints: string[] = [];
  if (set.has("stripe") || set.has("striped") || set.has("holi")) hints.push("striped");
  if (set.has("block") || set.has("talavera")) hints.push("patterned");
  if (set.has("oaxaca") || set.has("serape")) hints.push("woven");
  if (set.has("indigo")) hints.push("indigo");
  return [...new Set(hints)];
};

const buildAliasTerms = (seed: ShoppingSeed) => {
  const aliases: string[] = [];
  const keywordSet = new Set(seed.keywords);
  const normalizedLabel = seed.label.toLowerCase();

  if (keywordSet.has("bond") || normalizedLabel.includes("bond nato")) {
    aliases.push("james bond nato", "bond nato");
  }
  if (keywordSet.has("seatbelt")) aliases.push("seatbelt nato");
  if (keywordSet.has("canvas")) aliases.push("canvas watch strap");
  if (keywordSet.has("sailcloth")) aliases.push("sailcloth watch strap");
  if (keywordSet.has("tropic")) aliases.push("tropic rubber watch strap");
  if (keywordSet.has("fkm")) aliases.push("fkm rubber watch strap");
  if (keywordSet.has("mesh") || seed.styleFamily === "mesh") aliases.push("milanese watch bracelet");
  if (keywordSet.has("jubilee")) aliases.push("jubilee watch bracelet");

  return [...new Set(aliases)];
};

const buildColorTerms = (color: ShoppingSeed["colorFamily"], keywords: string[]) => {
  if (color === "multicolor") {
    const keywordHints = keywords.filter((keyword) => MULTICOLOR_HINTS.has(keyword)).slice(0, 2);
    return ["multicolor", ...keywordHints];
  }
  if (color === "brown") return ["brown", "cognac"];
  if (color === "blue") return ["blue", "navy"];
  if (color === "green") return ["green", "olive"];
  if (color === "silver") return ["silver", "steel"];
  return [color];
};

const buildHardwareTerms = (hardware: ShoppingSeed["hardwareFinish"], material: ShoppingSeed["material"]) => {
  if (material === "metal") return hardware === "black" ? ["black"] : ["steel"];
  if (hardware === "silver") return ["steel buckle", "silver buckle"];
  if (hardware === "gold") return ["gold buckle"];
  if (hardware === "black") return ["black buckle", "pvd buckle"];
  return [];
};

const dedupeTerms = (parts: string[]) =>
  [...new Set(parts.map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean))];

const buildDeterministicQueries = (seed: ShoppingSeed): GeminiQueryPlan => {
  const style = humanizeStyle(seed.styleFamily);
  const descriptor = buildDescriptorFromKeywords(seed.keywords);
  const patternHints = buildPatternHints(seed.keywords);
  const materialTerms = MATERIAL_QUERY_TERMS[seed.material];
  const styleTerms = STYLE_QUERY_TERMS[seed.styleFamily];
  const colorTerms = buildColorTerms(seed.colorFamily, seed.keywords);
  const hardwareTerms = buildHardwareTerms(seed.hardwareFinish, seed.material);
  const labelTerms = seed.label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const aliasTerms = buildAliasTerms(seed);
  const exactQueries = dedupeTerms([
    `${labelTerms} watch strap`,
    ...aliasTerms.map((alias) => `${alias} watch strap`),
    `${descriptor} ${patternHints.join(" ")} ${styleTerms[0] || style} ${materialTerms[0]}`,
    `${colorTerms[0] || seed.colorFamily} ${descriptor} ${styleTerms[0] || style} ${materialTerms.join(" ")}`,
    `${colorTerms.join(" ")} ${styleTerms.join(" ")} ${materialTerms.join(" ")} ${hardwareTerms[0] || ""}`,
    `${descriptor} ${colorTerms[0] || ""} ${style} watch strap`
  ]);
  const compatibleQueries = dedupeTerms([
    ...aliasTerms,
    `${colorTerms[0] || seed.colorFamily} ${styleTerms[0] || style} watch strap ${hardwareTerms[0] || ""}`,
    `${colorTerms[0] || seed.colorFamily} ${materialTerms.join(" ")} ${hardwareTerms[0] || ""}`,
    `${descriptor} ${materialTerms.join(" ")}`
  ]);
  const similarQueries = dedupeTerms([
    `${styleTerms.join(" ")} ${materialTerms.join(" ")}`,
    `${descriptor} ${patternHints.join(" ")} ${materialTerms.join(" ")}`,
    `${seed.material} watch strap ${style}`
  ]);

  return {
    exact: exactQueries.slice(0, 4),
    compatible: compatibleQueries.slice(0, 4),
    similar: similarQueries.slice(0, 4),
    negativeKeywords: seed.negativeKeywords
  };
};

const safeJsonParse = <T>(input: string): T | null => {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
};

const extractGeminiJson = <T>(rawText: string): T | null => {
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const direct = safeJsonParse<T>(cleaned);
  if (direct) return direct;
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return safeJsonParse<T>(cleaned.slice(start, end + 1));
  }
  return null;
};

const buildGeminiPrompt = (strap: StrapVariant, seed: ShoppingSeed) => `You are helping a watch strap visualizer find shoppable alternatives.
Return strict JSON only with this shape:
{
  "exact": string[],
  "compatible": string[],
  "similar": string[],
  "negativeKeywords": string[]
}
Rules:
- These are Google Shopping queries for watch straps only.
- Keep each query concise and retailer-friendly.
- Prefer compatibility and product terms over poetic language.
- Avoid widths because this app does not know the user's lug width yet.
- Exclude smartwatch and fitness band language.
- exact queries should preserve color, material, style, and hardware when possible.
- compatible queries can relax hardware or style slightly.
- similar queries can broaden to visually similar alternatives.
Strap label: ${strap.label}
Known attributes: ${JSON.stringify(seed)}`;

const getGeminiPlan = async (strap: StrapVariant, seed: ShoppingSeed): Promise<GeminiQueryPlan | null> => {
  if (!ENABLE_GEMINI_SHOPPING_QUERY_ENRICHMENT) return null;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(DEFAULT_GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        },
        contents: [
          {
            role: "user",
            parts: [{ text: buildGeminiPrompt(strap, seed) }]
          }
        ]
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini query planning failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText =
    payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "";
  const parsed = extractGeminiJson<GeminiQueryPlan>(rawText);
  if (!parsed) return null;

  return {
    exact: Array.isArray(parsed.exact) ? parsed.exact.filter(Boolean) : [],
    compatible: Array.isArray(parsed.compatible) ? parsed.compatible.filter(Boolean) : [],
    similar: Array.isArray(parsed.similar) ? parsed.similar.filter(Boolean) : [],
    negativeKeywords: Array.isArray(parsed.negativeKeywords) ? parsed.negativeKeywords.filter(Boolean) : []
  };
};

const mergeQueryPlans = (fallbackPlan: GeminiQueryPlan, geminiPlan: GeminiQueryPlan | null): GeminiQueryPlan => {
  if (!geminiPlan) return fallbackPlan;
  return {
    exact: [...new Set([...geminiPlan.exact, ...fallbackPlan.exact])].slice(0, 4),
    compatible: [...new Set([...geminiPlan.compatible, ...fallbackPlan.compatible])].slice(0, 4),
    similar: [...new Set([...geminiPlan.similar, ...fallbackPlan.similar])].slice(0, 4),
    negativeKeywords: [...new Set([...(fallbackPlan.negativeKeywords || []), ...(geminiPlan.negativeKeywords || [])])]
  };
};

const buildSearchQuery = (query: string, negativeKeywords: string[]) => {
  const cleanedBase = query.replace(/\s+/g, " ").trim();
  if (!negativeKeywords.length) return cleanedBase;
  return `${cleanedBase} ${negativeKeywords.map((keyword) => `-${keyword.replace(/\s+/g, "-")}`).join(" ")}`;
};

const parseMaterial = (text: string): StrapVariant["shopping"]["material"] | undefined => {
  if (includesAny(text, metalMarkers)) return "metal";
  if (includesAny(text, rubberMarkers)) return "rubber";
  if (includesAny(text, fabricMarkers)) return "fabric";
  if (
    text.includes("leather") ||
    includesAny(text, suedeMarkers) ||
    includesAny(text, pebbledMarkers) ||
    includesAny(text, grainMarkers)
  ) {
    return "leather";
  }
  return undefined;
};

const parseStyle = (
  text: string,
  material?: StrapVariant["shopping"]["material"]
): StrapVariant["shopping"]["styleFamily"] | undefined => {
  if (material === "metal") {
    if (includesAny(text, meshMarkers)) return "mesh";
    if (includesAny(text, linkMarkers)) return "link-bracelet";
    return includesAny(text, metalMarkers) ? "bracelet" : undefined;
  }
  if (material === "rubber") {
    if (text.includes("tropic")) return "tropic";
    if (text.includes("fkm")) return "fkm";
    if (text.includes("performance")) return "performance";
    return includesAny(text, rubberMarkers) ? "rubber" : undefined;
  }
  if (material === "fabric") {
    if (text.includes("sailcloth")) return "sailcloth";
    if (text.includes("canvas")) return "canvas";
    return includesAny(text, fabricMarkers) ? "nato" : undefined;
  }
  if (includesAny(text, suedeMarkers)) return "suede";
  if (includesAny(text, pebbledMarkers)) return "pebbled";
  if (includesAny(text, pullupMarkers)) return "pull-up";
  if (includesAny(text, saffianoMarkers)) return "saffiano";
  if (includesAny(text, grainMarkers)) return "grain";
  if (text.includes("smooth")) return "smooth";
  return material === "leather" ? "classic" : undefined;
};

const parseColor = (
  text: string,
  material?: StrapVariant["shopping"]["material"]
): StrapVariant["shopping"]["colorFamily"] | undefined => {
  if (text.includes("black") || text.includes("pvd")) return "black";
  if (["espresso", "dark brown", "chocolate", "bourbon", "cognac", "brown"].some((token) => text.includes(token))) return "brown";
  if (["tan", "saffron"].some((token) => text.includes(token))) return "tan";
  if (["beige", "sand", "taupe"].some((token) => text.includes(token))) return "beige";
  if (["burgundy", "oxblood", "aubergine", "maroon"].some((token) => text.includes(token))) return "burgundy";
  if (["navy", "bond", "indigo", "talavera", "sapphire", "blue"].some((token) => text.includes(token))) return "blue";
  if (["olive", "forest", "khaki", "emerald", "mustard", "green"].some((token) => text.includes(token))) return "green";
  if (["gray", "grey", "slate", "charcoal", "gunmetal"].some((token) => text.includes(token))) {
    return material === "metal" ? "silver" : "gray";
  }
  if (text.includes("gold")) return "gold";
  if (text.includes("orange")) return "orange";
  if (["stripe", "striped", "rainbow", "multicolor", "multi color"].some((token) => text.includes(token))) return "multicolor";
  if (material === "metal") return "silver";
  return undefined;
};

const parseHardware = (text: string): StrapVariant["shopping"]["hardwareFinish"] | undefined => {
  if (text.includes("black pvd") || text.includes("pvd") || text.includes("black buckle")) return "black";
  if (text.includes("gold") || text.includes("gilt") || text.includes("gold buckle")) return "gold";
  if (text.includes("silver") || text.includes("steel") || text.includes("stainless")) return "silver";
  return undefined;
};

const tokenize = (text: string) =>
  [
    ...new Set(
      text
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2 && !["watch", "strap", "band", "bands", "bracelet"].includes(token))
    )
  ];

const isLikelyCategoryPage = (title: string, url: string) => {
  const normalizedTitle = title.toLowerCase().trim();
  const normalizedUrl = url.toLowerCase();
  const genericTitle =
    /^(nylon|leather|canvas|rubber|metal|mesh|silicone|suede|fabric)\s+watch\s+(bands|straps)$/.test(normalizedTitle) ||
    normalizedTitle.endsWith(" watch bands") ||
    normalizedTitle.endsWith(" watch straps");
  const genericPathMarkers = ["/collections/", "/shop-by-style/", "/shop-by-material/", "/category/", "/watch-bands", "/watch-straps"];
  return genericTitle && genericPathMarkers.some((marker) => normalizedUrl.includes(marker));
};

const getMerchantWeight = (store: string, url: string) => {
  const haystack = `${store} ${url}`.toLowerCase();
  for (const blocked of MERCHANT_BLOCKLIST) {
    if (haystack.includes(blocked)) return -12;
  }
  for (const preferred of MERCHANT_ALLOWLIST) {
    if (haystack.includes(preferred)) return 6;
  }
  return 0;
};

const readNestedString = (value: unknown, path: string[]): string | undefined => {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" && current.trim() ? current.trim() : undefined;
};

const readNestedNumber = (value: unknown, path: string[]): number | undefined => {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "number" && Number.isFinite(current) ? current : undefined;
};

const readFirstStringFromList = (value: unknown, path: string[]): string | undefined => {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  if (Array.isArray(current)) {
    const first = current.find((entry) => typeof entry === "string" && entry.trim());
    return typeof first === "string" ? first.trim() : undefined;
  }
  return undefined;
};

const normalizeRapidApiResult = (raw: Record<string, unknown>, strap: StrapVariant): NormalizedShoppingResult | null => {
  const title =
    (typeof raw.product_title === "string" && raw.product_title.trim()) ||
    (typeof raw.title === "string" && raw.title.trim()) ||
    "";
  const store =
    readNestedString(raw, ["offer", "store", "name"]) ||
    readNestedString(raw, ["offer", "merchant", "name"]) ||
    (typeof raw.source === "string" && raw.source.trim()) ||
    (typeof raw.store === "string" && raw.store.trim()) ||
    (typeof raw.seller_name === "string" && raw.seller_name.trim()) ||
    "Unknown store";
  const url =
    (typeof raw.product_url === "string" && raw.product_url.trim()) ||
    (typeof raw.offer_page_url === "string" && raw.offer_page_url.trim()) ||
    readNestedString(raw, ["offer", "offer_page_url"]) ||
    readNestedString(raw, ["offer", "product_url"]) ||
    (typeof raw.link === "string" && raw.link.trim()) ||
    "";
  const imageSrc =
    (typeof raw.product_photo === "string" && raw.product_photo.trim()) ||
    readFirstStringFromList(raw, ["product_photos"]) ||
    readFirstStringFromList(raw, ["photos"]) ||
    (typeof raw.thumbnail === "string" && raw.thumbnail.trim()) ||
    (typeof raw.image === "string" && raw.image.trim()) ||
    "";
  const price =
    readNestedString(raw, ["offer", "price"]) ||
    (typeof raw.price === "string" && raw.price.trim()) ||
    (typeof raw.extracted_price === "number" ? String(raw.extracted_price) : undefined) ||
    (readNestedNumber(raw, ["offer", "extracted_price"]) !== undefined
      ? String(readNestedNumber(raw, ["offer", "extracted_price"]))
      : undefined);

  if (!title || !url || !imageSrc) return null;
  if (isLikelyCategoryPage(title, url)) return null;

  const haystack = `${title} ${store} ${typeof raw.snippet === "string" ? raw.snippet : ""} ${
    typeof raw.product_description === "string" ? raw.product_description : ""
  }`.toLowerCase();
  const parsedMaterial = parseMaterial(haystack);
  const parsedStyle = parseStyle(haystack, parsedMaterial);
  const parsedColor = parseColor(haystack, parsedMaterial);
  const parsedHardware = parseHardware(haystack);

  return {
    id: `${store}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    title,
    store,
    url,
    imageSrc,
    price,
    parsedMaterial,
    parsedStyle,
    parsedColor,
    parsedHardware,
    keywords: tokenize(haystack)
  };
};

const scoreCuratedProduct = (strap: StrapVariant, product: SimilarProduct) => {
  const meta = strap.shopping;
  if (product.material !== meta.material) return -1;

  const sameStyle = product.styleFamilies.includes(meta.styleFamily);
  const sameColor = product.colorFamilies.some((family) => areColorFamiliesCompatible(meta.colorFamily, family));
  const sameHardware = product.hardwareFinishes.includes(meta.hardwareFinish);
  const sharedKeywords = (product.keywords || []).filter((keyword) => meta.keywords.includes(keyword));

  let score = 10;
  if (sameStyle) score += 8;
  if (sameColor) score += 7;
  if (sameHardware) score += 2;
  score += sharedKeywords.length;

  if (!sameStyle && !sameColor) return -1;
  if (meta.material !== "metal" && !sameColor) return -1;

  return score;
};

const ALLOW_CURATED_SHOPPING_FALLBACK = process.env.ALLOW_CURATED_SHOPPING_FALLBACK === "true";

const getCuratedProductsForStrap = (strapId: string, limit = 4): SimilarProductCard[] => {
  const strap = getStrapById(strapId);
  if (!strap) return [];

  return CURATED_PRODUCTS
    .map((product) => ({
      product,
      score: scoreCuratedProduct(strap, product)
    }))
    .filter(({ score }) => score >= 17)
    .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title))
    .slice(0, limit)
    .map(({ product }) => ({
      id: product.id,
      title: product.title,
      store: product.store,
      url: product.affiliateUrl || product.url,
      imageSrc: strap.strapASrc
    }));
};

const rankLiveProduct = (strap: StrapVariant, result: NormalizedShoppingResult): RankedShoppingResult | null => {
  const meta = strap.shopping;
  const sameMaterial = result.parsedMaterial === meta.material;
  const sameStyle = result.parsedStyle === meta.styleFamily;
  const sameColor = result.parsedColor ? areColorFamiliesCompatible(meta.colorFamily, result.parsedColor) : false;
  const sameHardware = result.parsedHardware === meta.hardwareFinish;
  const sharedKeywords = result.keywords.filter((keyword) => meta.keywords.includes(keyword)).length;
  const merchantWeight = getMerchantWeight(result.store, result.url);
  const hasPatternKeywords = meta.keywords.some((keyword) =>
    ["stripe", "holi", "block", "indigo", "oaxaca", "serape", "talavera"].includes(keyword)
  );
  const matchedPatternKeywords = result.keywords.filter((keyword) =>
    ["stripe", "striped", "holi", "block", "indigo", "oaxaca", "serape", "talavera", "patterned", "woven"].includes(keyword)
  ).length;

  let score = 0;
  if (sameMaterial) score += 10;
  if (sameStyle) score += 8;
  if (sameColor) score += 6;
  if (sameHardware) score += 3;
  score += Math.min(sharedKeywords, 4);
  score += merchantWeight;
  if (hasPatternKeywords) score += matchedPatternKeywords * 4;

  if (merchantWeight < 0) return null;
  if (!sameMaterial && meta.material !== "metal") return null;
  if (!sameStyle && !sameColor && sharedKeywords === 0) return null;
  if (hasPatternKeywords && matchedPatternKeywords === 0) return null;
  if (meta.material === "metal" && !sameStyle && !result.keywords.some((keyword) => ["bracelet", "mesh", "milanese", "jubilee", "oyster", "link"].includes(keyword))) {
    return null;
  }
  if (meta.material === "rubber" && !result.keywords.some((keyword) => ["rubber", "fkm", "silicone", "tropic", "performance"].includes(keyword))) {
    return null;
  }
  if (meta.material === "fabric" && !result.keywords.some((keyword) => ["nato", "nylon", "canvas", "sailcloth", "fabric"].includes(keyword))) {
    return null;
  }
  if (meta.material === "leather" && !result.keywords.some((keyword) => ["leather", "suede", "nubuck", "grain", "pebbled", "saffiano"].includes(keyword))) {
    return null;
  }

  const matchType: SimilarProductCard["matchType"] =
    sameMaterial && sameStyle && sameColor && (!hasPatternKeywords || matchedPatternKeywords > 0)
      ? "exact"
      : sameMaterial && (sameStyle || sameColor)
        ? "compatible"
        : "similar";

  const reason =
    matchType === "exact"
      ? "Close match on material, color, style, and finish"
      : matchType === "compatible"
        ? "Compatible alternative with strong attribute overlap"
        : "Similar look, check specs before buying";

  return {
    product: {
      id: result.id,
      title: result.title,
      store: result.store,
      url: result.url,
      imageSrc: result.imageSrc,
      price: result.price,
      matchType,
      reason
    },
    score
  };
};

const unwrapRapidApiResults = (payload: unknown): Record<string, unknown>[] => {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  if (Array.isArray(root.data)) return root.data.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
  if (!root.data || typeof root.data !== "object") return [];
  const data = root.data as Record<string, unknown>;
  for (const key of ["products", "shopping_results", "results", "items"]) {
    const value = data[key];
    if (Array.isArray(value)) {
      return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
    }
  }
  return [];
};

const fetchRapidApiShoppingResults = async (query: string): Promise<Record<string, unknown>[]> => {
  const apiKey = process.env.RAPIDAPI_PRODUCT_SEARCH_KEY || process.env.RAPIDAPI_KEY;
  if (!apiKey) return [];

  const searchParams = new URLSearchParams({
    query,
    country: DEFAULT_RAPIDAPI_COUNTRY,
    language: DEFAULT_RAPIDAPI_LANGUAGE,
    limit: "10",
    sort_by: DEFAULT_RAPIDAPI_SORT
  });

  let lastError: Error | null = null;

  for (const path of RAPIDAPI_SEARCH_PATHS) {
    const response = await fetch(`${RAPIDAPI_PRODUCT_SEARCH_BASE_URL}/${path}?${searchParams.toString()}`, {
      headers: {
        Accept: "application/json",
        "X-RapidAPI-Host": RAPIDAPI_PRODUCT_SEARCH_HOST,
        "X-RapidAPI-Key": apiKey
      },
      next: { revalidate: 60 * 60 * 6 }
    });

    if (response.status === 404) {
      lastError = new Error(`RapidAPI product search path not found: ${path}`);
      continue;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`RapidAPI shopping lookup failed (${response.status})${body ? `: ${body.slice(0, 200)}` : ""}`);
    }

    const payload = (await response.json()) as unknown;
    const results = unwrapRapidApiResults(payload);
    if (results.length) return results;
  }

  if (lastError) throw lastError;
  return [];
};

const dedupeProducts = (products: SimilarProductCard[]) => {
  const seen = new Set<string>();
  return products.filter((product) => {
    const key = `${product.url}|${product.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const fetchAndRankQueryBatch = async (
  strap: StrapVariant,
  queries: string[],
  negativeKeywords: string[]
): Promise<RankedShoppingResult[]> => {
  const settled = await Promise.allSettled(
    queries.map(async (query) => {
      const searchQuery = buildSearchQuery(query, negativeKeywords);
      const rawResults = await fetchRapidApiShoppingResults(searchQuery);
      return rawResults
        .map((raw) => normalizeRapidApiResult(raw, strap))
        .filter((result): result is NormalizedShoppingResult => Boolean(result))
        .map((result) => rankLiveProduct(strap, result))
        .filter((result): result is RankedShoppingResult => Boolean(result));
    })
  );

  return settled.flatMap((entry) => (entry.status === "fulfilled" ? entry.value : []));
};

const finalizeRankedProducts = (ranked: RankedShoppingResult[], limit: number) =>
  dedupeProducts(
    ranked
      .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title))
      .map(({ product }) => product)
  ).slice(0, limit);

const getHybridProductsForStrapUncached = async (strapId: string, limit = 6): Promise<SimilarProductCard[]> => {
  const strap = getStrapById(strapId);
  if (!strap) return [];

  const apiKey = process.env.RAPIDAPI_PRODUCT_SEARCH_KEY || process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return ALLOW_CURATED_SHOPPING_FALLBACK ? getCuratedProductsForStrap(strapId, limit) : [];
  }

  const seed = buildSeedFromStrap(strap);
  const deterministicPlan = buildDeterministicQueries(seed);
  let plan = deterministicPlan;

  try {
    const geminiPlan = await getGeminiPlan(strap, seed);
    plan = mergeQueryPlans(deterministicPlan, geminiPlan);
  } catch {
    plan = deterministicPlan;
  }

  const negativeKeywords = plan.negativeKeywords || [];

  const exactRanked = await fetchAndRankQueryBatch(strap, plan.exact.slice(0, 3), negativeKeywords);
  const exactProducts = finalizeRankedProducts(exactRanked, limit);
  if (exactProducts.length >= Math.min(3, limit)) return exactProducts;

  const compatibleRanked = await fetchAndRankQueryBatch(strap, plan.compatible.slice(0, 2), negativeKeywords);
  const exactAndCompatible = finalizeRankedProducts([...exactRanked, ...compatibleRanked], limit);
  if (exactAndCompatible.length >= Math.min(4, limit)) return exactAndCompatible;

  const similarRanked = await fetchAndRankQueryBatch(strap, plan.similar.slice(0, 2), negativeKeywords);
  const liveProducts = finalizeRankedProducts([...exactRanked, ...compatibleRanked, ...similarRanked], limit);
  if (liveProducts.length) return liveProducts;
  return ALLOW_CURATED_SHOPPING_FALLBACK ? getCuratedProductsForStrap(strapId, limit) : [];
};

const getCachedHybridProductsForStrap = unstable_cache(
  async (strapId: string, limit: number) => getHybridProductsForStrapUncached(strapId, limit),
  ["shopping-similar-products"],
  { revalidate: SHOPPING_CACHE_TTL_SECONDS }
);

export const getSimilarProductsForStrap = async (strapId: string, limit = 6): Promise<SimilarProductCard[]> =>
  getCachedHybridProductsForStrap(strapId, limit);
