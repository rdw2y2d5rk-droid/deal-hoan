import { readFile } from "node:fs/promises";
import path from "node:path";
import { cashbackFor, dealScore } from "../score";
import type { Deal, DealProvider } from "../types";

/**
 * Reads the output of `scripts/shopee-scrape.mjs` — a Playwright scraper that
 * runs locally, under a manually-authenticated Shopee session (see
 * `scripts/shopee-login.mjs`), and writes real product listings to
 * `lib/deals/cache/shopee-scraped.json`.
 *
 * This is NOT run from the Next.js request path: a browser-driven scrape is
 * far too slow to do per page-load, and Shopee's anti-bot measures make this
 * fragile outside a real, session-authenticated run on your own machine —
 * see the scripts' own comments for the ToS/ban-risk caveats.
 *
 * Because `productUrl` here is a plain Shopee link (not an affiliate one),
 * `cashback` is only an ESTIMATE from `CASHBACK_RATE` in `config.ts`, not a
 * real commission — there is no confirmed payout until this is paired with
 * an affiliate link.
 */
const CACHE_PATH = path.join(process.cwd(), "lib/deals/cache/shopee-scraped.json");

/** Scraped data older than this is treated as stale and skipped. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

type ScrapedProduct = {
  itemId: number;
  shopId: number;
  name: string;
  price: number;
  priceBeforeDiscount: number;
  rawDiscount: number;
  historicalSold: number | null;
  ratingStar: number;
  ratingCount: number;
  image: string | null;
  isMall: boolean;
  productUrl: string;
};

type CacheFile = { scrapedAt: string; products: ScrapedProduct[] };

function normalise(p: ScrapedProduct): Deal | null {
  if (!p.itemId || !p.name || !p.price) return null;

  const originalPrice = p.priceBeforeDiscount > p.price ? p.priceBeforeDiscount : p.price;
  const discountPercent =
    p.rawDiscount ||
    (originalPrice > p.price ? Math.round(((originalPrice - p.price) / originalPrice) * 100) : 0);

  const platform = p.isMall ? "Shopee Mall" : "Shopee";
  const cashback = cashbackFor(p.price, platform);

  return {
    id: `shopee-scrape-${p.shopId}-${p.itemId}`,
    name: p.name,
    platform,
    seller: platform,
    price: p.price,
    originalPrice,
    discountPercent,
    cashback,
    dealScore: dealScore({
      discountPercent,
      price: p.price,
      cashback,
      ratingAverage: p.ratingStar,
      reviewCount: p.ratingCount,
      sold: p.historicalSold,
    }),
    sold: p.historicalSold,
    ratingAverage: p.ratingStar,
    reviewCount: p.ratingCount,
    imageUrl: p.image,
    productUrl: p.productUrl,
  };
}

async function readCache(): Promise<CacheFile | null> {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8");
    return JSON.parse(raw) as CacheFile;
  } catch {
    return null;
  }
}

export const shopeeScrapeProvider: DealProvider = {
  id: "shopee-scrape",

  // Cheap sync-ish check isn't possible for an async file read, so this
  // always reports true and `fetchDeals` throws (skipping the provider) when
  // the cache is missing or stale — the orchestrator treats that the same way.
  isConfigured: () => true,

  async fetchDeals() {
    const cache = await readCache();
    if (!cache) {
      throw new Error(
        "No scraped Shopee data — run: node scripts/shopee-login.mjs && node scripts/shopee-scrape.mjs",
      );
    }

    const age = Date.now() - new Date(cache.scrapedAt).getTime();
    if (age > MAX_AGE_MS) {
      throw new Error(`Scraped Shopee data is ${Math.round(age / 3_600_000)}h old — re-run the scraper`);
    }

    const deals = cache.products.map(normalise).filter((d): d is Deal => d !== null);
    if (deals.length === 0) throw new Error("Scraped Shopee cache has no usable products");

    return deals;
  },
};
