import { FETCH_TIMEOUT_MS } from "../config";
import { cashbackFor, dealScore } from "../score";
import type { Deal, DealProvider, Platform } from "../types";

/**
 * AccessTrade Vietnam — the affiliate network that carries Shopee, Lazada and
 * TikTok Shop under one publisher account, which is how this site can show all
 * three marketplaces from a single integration.
 *
 * Register at https://accesstrade.vn, then set:
 *   ACCESSTRADE_TOKEN=...
 *   ACCESSTRADE_MERCHANTS=shopee,lazada,tiktokshop   # optional, this is the default
 */
/** Overridable so the feed can be pointed at a staging or stub endpoint. */
const DATAFEED_URL = `${process.env.ACCESSTRADE_API_BASE ?? "https://api.accesstrade.vn"}/v1/datafeeds`;
const PER_MERCHANT_LIMIT = 50;

const DEFAULT_MERCHANTS = ["shopee", "lazada", "tiktokshop"];

const MERCHANT_PLATFORM: Record<string, Platform> = {
  shopee: "Shopee",
  lazada: "Lazada",
  tiktokshop: "TikTok Shop",
};

type FeedItem = {
  product_id?: string | number;
  name?: string;
  price?: string | number;
  /** List price before discount on most campaigns. */
  discount?: string | number;
  discount_rate?: string | number;
  image?: string | null;
  aff_link?: string | null;
  url?: string | null;
  merchant?: string | null;
  shop_name?: string | null;
  sku?: string | number;
  /** Publisher commission, percent, when the campaign exposes it. */
  commission_rate?: string | number;
};

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
};

function token() {
  return process.env.ACCESSTRADE_TOKEN || null;
}

function merchants() {
  const raw = process.env.ACCESSTRADE_MERCHANTS;
  if (!raw) return DEFAULT_MERCHANTS;
  return raw
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
}

async function fetchMerchant(merchant: string, authToken: string): Promise<FeedItem[]> {
  const url = `${DATAFEED_URL}?${new URLSearchParams({
    merchant,
    limit: String(PER_MERCHANT_LIMIT),
  })}`;

  const res = await fetch(url, {
    headers: { Authorization: `Token ${authToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`AccessTrade ${merchant} feed failed: ${res.status}`);
  const body = (await res.json()) as { data?: FeedItem[] };
  return body.data ?? [];
}

function normalise(item: FeedItem): Deal | null {
  const price = num(item.price);
  const productUrl = item.aff_link || item.url;
  if (!item.name || !price || !productUrl) return null;

  const merchant = (item.merchant ?? "").toLowerCase();
  const platform = MERCHANT_PLATFORM[merchant] ?? "Shopee";

  // `discount` carries the pre-discount list price on AccessTrade feeds.
  const listed = num(item.discount);
  const originalPrice = listed > price ? listed : price;
  const discountPercent = num(item.discount_rate)
    ? Math.round(num(item.discount_rate))
    : originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  // A real campaign commission always beats our configured default rate.
  const rawCommission = num(item.commission_rate, NaN);
  const commissionRate = Number.isFinite(rawCommission)
    ? rawCommission > 1
      ? rawCommission / 100
      : rawCommission
    : undefined;

  const cashback = cashbackFor(price, platform, commissionRate);

  return {
    id: `at-${merchant || "x"}-${item.product_id ?? productUrl}`,
    name: item.name,
    platform,
    seller: platform,
    price,
    originalPrice,
    discountPercent,
    cashback,
    dealScore: dealScore({
      discountPercent,
      price,
      cashback,
      // Datafeeds carry no rating or sales signal; the score rests on discount
      // and cashback alone for this provider.
      ratingAverage: 0,
      reviewCount: 0,
      sold: null,
    }),
    sold: null,
    ratingAverage: 0,
    reviewCount: 0,
    imageUrl: item.image ?? null,
    productUrl,
  };
}

export const accessTradeProvider: DealProvider = {
  id: "accesstrade",

  isConfigured: () => token() !== null,

  async fetchDeals() {
    const authToken = token();
    if (!authToken) throw new Error("AccessTrade token is not configured");

    const batches = await Promise.allSettled(
      merchants().map((m) => fetchMerchant(m, authToken)),
    );

    const items: FeedItem[] = [];
    for (const batch of batches) {
      if (batch.status === "fulfilled") items.push(...batch.value);
      else console.warn("[deals] accesstrade merchant failed:", batch.reason);
    }

    if (items.length === 0) throw new Error("AccessTrade returned no products");

    const byId = new Map<string, Deal>();
    for (const item of items) {
      const deal = normalise(item);
      if (deal) byId.set(deal.id, deal);
    }

    return [...byId.values()];
  },
};

export type AccessTradeProductResult = {
  name: string;
  price: number;
  originalPrice: number;
  imageUrl: string | null;
  platform: Platform;
  seller?: string;
  isVerifiedPrice: boolean;
};

/**
 * Queries AccessTrade product datafeed by SKU or product ID.
 * Returns verified platform price, product name, and CDN image if present in the datafeed.
 */
export async function lookupAccessTradeProduct(
  rawUrl: string,
): Promise<AccessTradeProductResult | null> {
  const authToken = token();
  if (!authToken) return null;

  try {
    const parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    const host = parsed.hostname.toLowerCase();

    let domain = "";
    let sku = "";

    if (host.includes("shopee.vn") || host.includes("shp.ee")) {
      domain = "shopee.vn";
      const match1 = parsed.pathname.match(/\/product\/\d+\/(\d+)/i);
      const match2 = parsed.pathname.match(/-i\.\d+\.(\d+)/i);
      const match3 = parsed.pathname.match(/\/product\/(\d+)/i);
      sku = match1?.[1] || match2?.[1] || match3?.[1] || "";
    } else if (host.includes("lazada.vn")) {
      domain = "lazada.vn";
      const matchS = parsed.pathname.match(/-s(\d+)/i);
      const matchI = parsed.pathname.match(/-i(\d+)/i);
      sku = matchS?.[1] || matchI?.[1] || "";
    } else if (host.includes("tiki.vn")) {
      domain = "tiki.vn";
      const matchP = parsed.pathname.match(/-p(\d+)/i);
      sku = matchP?.[1] || "";
    }

    if (!sku || !domain) return null;

    const queryUrl = `${DATAFEED_URL}?domain=${encodeURIComponent(domain)}&sku=${encodeURIComponent(sku)}&limit=1`;
    const res = await fetch(queryUrl, {
      headers: {
        Authorization: `Token ${authToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const body = (await res.json()) as { data?: FeedItem[]; total?: number };
    const item = body.data?.[0];
    if (!item || !item.name) return null;

    const rawPrice = num(item.price);
    const rawDiscount = num(item.discount);
    // In AccessTrade feeds:
    // When a product has a discount, discount is the discounted price, price is the original price.
    // If discount is 0 or equal to price, the selling price is rawPrice.
    const salePrice = rawDiscount > 0 && rawDiscount < rawPrice ? rawDiscount : rawPrice;
    const originalPrice = rawPrice > salePrice ? rawPrice : Math.round((salePrice * 1.25) / 1000) * 1000;

    const platform: Platform = domain.includes("lazada")
      ? "Lazada"
      : "Shopee";

    return {
      name: item.name.trim(),
      price: salePrice,
      originalPrice,
      imageUrl: item.image || null,
      platform,
      seller: item.shop_name || undefined,
      isVerifiedPrice: true,
    };
  } catch {
    return null;
  }
}
