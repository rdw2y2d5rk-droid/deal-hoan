import { unstable_cache } from "next/cache";
import { FLASH_COUNT, HOT_COUNT, REVALIDATE_SECONDS } from "./config";
import { shopeeProvider } from "./providers/shopee";
import { accessTradeProvider } from "./providers/accesstrade";
import { lazadaProvider } from "./providers/lazada";
import { shopeeScrapeProvider } from "./providers/shopee-scrape";
import { SEED_FLASH, SEED_HOT } from "./seed";
import type { Deal, DealBundle, DealProvider } from "./types";

/**
 * Priority order.
 *  1. Shopee's own affiliate API — real product + real commission, when configured.
 *  2. Locally-scraped Shopee data (`scripts/shopee-scrape.mjs`) — real product
 *     data from an authenticated session, but `productUrl` is a plain Shopee
 *     link and `cashback` is only estimated (see `providers/shopee-scrape.ts`).
 *  3. AccessTrade — real product + real commission for Shopee/Lazada/TikTok Shop, when configured.
 *  4. Lazada's public catalog search — real product data, no credentials needed,
 *     estimated cashback like the scraper above.
 * TikTok Shop has no browsable web catalog to read at all.
 */
const PROVIDERS: DealProvider[] = [
  shopeeProvider,
  shopeeScrapeProvider,
  accessTradeProvider,
  lazadaProvider,
];

/** "Deal chớp nhoáng" — the steepest markdowns, deepest first. */
function pickFlash(deals: Deal[]) {
  return [...deals]
    .filter((d) => d.discountPercent > 0)
    .sort((a, b) => b.discountPercent - a.discountPercent || b.dealScore - a.dealScore)
    .slice(0, FLASH_COUNT);
}

/** "Deal hot hôm nay" — highest Deal Score, preferring deals flash is not already showing. */
function pickHot(deals: Deal[], exclude: Deal[]) {
  const taken = new Set(exclude.map((d) => d.id));
  const unused = deals.filter((d) => !taken.has(d.id));

  // A feed thin enough that flash consumed nearly all of it would otherwise
  // leave this section empty — repeating a deal beats showing none.
  const pool = unused.length >= HOT_COUNT ? unused : deals;

  return [...pool]
    .sort((a, b) => b.dealScore - a.dealScore || b.discountPercent - a.discountPercent)
    .slice(0, HOT_COUNT);
}

async function fetchBundle(): Promise<DealBundle> {
  for (const provider of PROVIDERS) {
    if (!provider.isConfigured()) continue;

    try {
      const deals = await provider.fetchDeals();
      const flash = pickFlash(deals);
      const hot = pickHot(deals, flash);

      if (flash.length && hot.length) {
        return {
          flash,
          hot,
          source: provider.id,
          fetchedAt: new Date().toISOString(),
        };
      }
      console.warn(`[deals] ${provider.id} returned too few usable deals; trying next provider`);
    } catch (error) {
      console.warn(`[deals] ${provider.id} failed:`, error);
    }
  }

  console.warn("[deals] every provider failed — serving seed data");
  return {
    flash: SEED_FLASH,
    hot: SEED_HOT,
    source: "seed",
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Cached entry point for the homepage. Revalidates every
 * `REVALIDATE_SECONDS`, so a page view never blocks on the marketplaces.
 */
export const getDeals = unstable_cache(fetchBundle, ["deals-bundle"], {
  revalidate: REVALIDATE_SECONDS,
  tags: ["deals"],
});
