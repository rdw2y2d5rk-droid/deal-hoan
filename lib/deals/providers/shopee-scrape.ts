import { readFile } from "node:fs/promises";
import path from "node:path";
import { cashbackFor, dealScore } from "../score";
import type { Deal, DealProvider } from "../types";
import { hasSupabaseConfig, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { createClient } from "@supabase/supabase-js";

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

const FLASH_SALE_CACHE_PATH = path.join(process.cwd(), "lib/deals/cache/shopee-flash-sale.json");

async function readFromSupabase() {
  if (!hasSupabaseConfig || !supabaseUrl || !supabasePublishableKey) return null;
  try {
    const sb = createClient(supabaseUrl, supabasePublishableKey);
    const { data, error } = await sb.from("flash_sale_cache").select("data").eq("id", "latest").single();
    if (error || !data) return null;
    return data.data;
  } catch {
    return null;
  }
}

async function readCache(): Promise<CacheFile | null> {
  // 1. Ưu tiên đọc từ Supabase Cloud (khi deploy trên Vercel)
  let flashData = await readFromSupabase();

  // 2. Nếu không có Supabase, đọc từ file local
  if (!flashData) {
    try {
      const rawFlash = await readFile(FLASH_SALE_CACHE_PATH, "utf-8");
      flashData = JSON.parse(rawFlash);
    } catch {}
  }

  if (flashData?.sessions?.length) {
    const nowSec = Math.floor(Date.now() / 1000);
    const activeSession =
      flashData.sessions.find(
        (s: { startTime: number; endTime: number }) => nowSec >= s.startTime && nowSec < s.endTime
      ) || flashData.sessions[0];

    const allItems: (ScrapedProduct & { discountPercent?: number; rawDiscount?: number })[] = [];
    const seen = new Set<string>();

    // 1. Đưa sản phẩm phiên hiện tại lên trước để pickFlash ưu tiên
    if (activeSession?.items?.length) {
      for (const it of activeSession.items) {
        const key = `${it.shopId}-${it.itemId}`;
        if (!seen.has(key)) {
          seen.add(key);
          allItems.push(it);
        }
      }
    }

    // 2. Nạp thêm sản phẩm từ TẤT CẢ các khung giờ khác trong ngày để cấp đủ data cho "Deal hot hôm nay"
    for (const session of flashData.sessions) {
      if (!session.items?.length) continue;
      for (const it of session.items) {
        const key = `${it.shopId}-${it.itemId}`;
        if (!seen.has(key)) {
          seen.add(key);
          allItems.push(it);
        }
      }
    }

    if (allItems.length > 0) {
      return {
        scrapedAt: flashData.scrapedAt,
        products: allItems.map((it) => ({
          itemId: it.itemId,
          shopId: it.shopId,
          name: it.name,
          price: it.price,
          priceBeforeDiscount: it.priceBeforeDiscount,
          rawDiscount: it.rawDiscount ?? it.discountPercent ?? 0,
          historicalSold: it.historicalSold ?? null,
          ratingStar: it.ratingStar ?? 5,
          ratingCount: it.ratingCount ?? 100,
          image: it.image,
          isMall: it.isMall,
          productUrl: it.productUrl,
        })),
      };
    }
  }

  // 2. Fallback sang file cache chung
  try {
    const raw = await readFile(CACHE_PATH, "utf-8");
    return JSON.parse(raw) as CacheFile;
  } catch {
    return null;
  }
}

export const shopeeScrapeProvider: DealProvider = {
  id: "shopee-scrape",

  isConfigured: () => true,

  async fetchDeals() {
    const cache = await readCache();
    if (!cache) {
      throw new Error(
        "No scraped Shopee data — run: npm run shopee:flash-sale",
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

export async function getActiveFlashSaleSession(): Promise<{
  timeSlot: string;
  startTime: number;
  endTime: number;
  isOngoing: boolean;
} | null> {
  let flashData = await readFromSupabase();
  if (!flashData) {
    try {
      const rawFlash = await readFile(FLASH_SALE_CACHE_PATH, "utf-8");
      flashData = JSON.parse(rawFlash);
    } catch {}
  }

  if (flashData?.sessions?.length) {
    const nowSec = Math.floor(Date.now() / 1000);
    const activeSession =
      flashData.sessions.find(
        (s: { startTime: number; endTime: number }) => nowSec >= s.startTime && nowSec < s.endTime
      ) || flashData.sessions[0];

    if (activeSession) {
      return {
        timeSlot: activeSession.timeSlot,
        startTime: activeSession.startTime,
        endTime: activeSession.endTime,
        isOngoing: nowSec >= activeSession.startTime && nowSec < activeSession.endTime,
      };
    }
  }
  return null;
}
