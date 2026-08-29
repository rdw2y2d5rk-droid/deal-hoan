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
