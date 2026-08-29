/** Normalised deal shape shared by every marketplace provider. */
export type Platform = "Shopee" | "Shopee Mall" | "Lazada" | "TikTok Shop";

export type Deal = {
  /** Stable id, prefixed by provider so ids never collide across sources. */
  id: string;
  name: string;
  platform: Platform;
  /** Merchant/shop name as reported by the marketplace. */
  seller: string;
  /** Current selling price, in đồng. */
  price: number;
  /** List price before discount, in đồng. Equals `price` when there is no discount. */
  originalPrice: number;
  /** Marketplace discount, whole percent. */
  discountPercent: number;
  /** Cash returned to the buyer, in đồng. See `cashback.ts` for how this is derived. */
  cashback: number;
  /** 0-100. Computed from real signals — see `score.ts`. */
  dealScore: number;
  /** Units sold as reported by the marketplace, or null when unknown. */
  sold: number | null;
  ratingAverage: number;
  reviewCount: number;
  imageUrl: string | null;
  productUrl: string;
};

export type DealBundle = {
  flash: Deal[];
  hot: Deal[];
  /** Which provider actually served the data — surfaced in the UI so the source is never implied. */
  source: "shopee" | "shopee-scrape" | "accesstrade" | "lazada" | "seed";
  /** ISO timestamp of the fetch. */
  fetchedAt: string;
};

export interface DealProvider {
  readonly id: "shopee" | "shopee-scrape" | "accesstrade" | "lazada";
  /** False when required credentials are missing, so the orchestrator can skip it silently. */
  isConfigured(): boolean;
  fetchDeals(): Promise<Deal[]>;
}
