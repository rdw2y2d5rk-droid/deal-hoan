import { createHash } from "node:crypto";
import { FETCH_TIMEOUT_MS } from "../config";
import { cashbackFor, dealScore } from "../score";
import type { Deal, DealProvider } from "../types";

/**
 * Shopee Affiliate Open API — the official, sanctioned way to read Shopee offers.
 *
 * Shopee's storefront search API (`shopee.vn/api/v4/...`) answers unauthenticated
 * callers with HTTP 403 / error 90309999 by design; defeating that is both against
 * their terms and fragile, so it is not attempted here.
 *
 * Get an App ID and secret at https://affiliate.shopee.vn (Open API section) and set:
 *   SHOPEE_AFFILIATE_APP_ID=...
 *   SHOPEE_AFFILIATE_SECRET=...
 */
/** Overridable so the API can be pointed at a staging or stub endpoint. */
const ENDPOINT = `${process.env.SHOPEE_API_BASE ?? "https://open-api.affiliate.shopee.vn"}/graphql`;
const PAGE_LIMIT = 50;
const PAGE_COUNT = 3;

const PRODUCT_OFFER_QUERY = `
  query productOfferV2($page: Int, $limit: Int) {
    productOfferV2(page: $page, limit: $limit, sortType: 3) {
      nodes {
        itemId
        productName
        price
        priceMin
        priceDiscountRate
        commissionRate
        sales
        ratingStar
        imageUrl
        offerLink
        shopName
        shopType
      }
    }
  }
`;

type ShopeeNode = {
  itemId: number | string;
  productName: string;
  price?: string | number;
  priceMin?: string | number;
  priceDiscountRate?: string | number;
  commissionRate?: string | number;
  sales?: number;
  ratingStar?: string | number;
  imageUrl?: string | null;
  offerLink?: string | null;
  shopName?: string | null;
  /** Shopee marks Mall shops with shopType containing 2. */
  shopType?: number[] | null;
};

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
};

function credentials() {
  const appId = process.env.SHOPEE_AFFILIATE_APP_ID;
  const secret = process.env.SHOPEE_AFFILIATE_SECRET;
  return appId && secret ? { appId, secret } : null;
}

function normalise(node: ShopeeNode): Deal | null {
  const price = num(node.price) || num(node.priceMin);
  if (!node.itemId || !node.productName || !price) return null;

  // Shopee reports the discount as a rate (0-1) or a percentage depending on field version.
  const rawDiscount = num(node.priceDiscountRate);
  const discountPercent = Math.round(rawDiscount > 1 ? rawDiscount : rawDiscount * 100);
  // Shopee gives a rate, not the list price, so it is derived — rounded to a
  // whole nghìn đồng so the struck-through figure reads like a real price tag.
  const originalPrice =
    discountPercent > 0 && discountPercent < 100
      ? Math.round(price / (1 - discountPercent / 100) / 1000) * 1000
      : price;

  // A real per-offer commission rate always beats our configured default.
  const rawCommission = num(node.commissionRate, NaN);
  const commissionRate = Number.isFinite(rawCommission)
    ? rawCommission > 1
      ? rawCommission / 100
      : rawCommission
    : undefined;

  const platform = node.shopType?.includes(2) ? "Shopee Mall" : "Shopee";
  const cashback = cashbackFor(price, platform, commissionRate);
  const sold = node.sales ?? null;
  const ratingAverage = num(node.ratingStar);

  return {
    id: `shopee-${node.itemId}`,
    name: node.productName,
    platform,
    seller: node.shopName ?? "Shopee",
    price,
    originalPrice,
    discountPercent,
    cashback,
    dealScore: dealScore({
      discountPercent,
      price,
      cashback,
      ratingAverage,
      // The offer feed exposes no review count; sales carry the demand signal instead.
      reviewCount: sold ?? 0,
      sold,
    }),
    sold,
    ratingAverage,
    reviewCount: 0,
    imageUrl: node.imageUrl ?? null,
    productUrl: node.offerLink ?? "https://shopee.vn/",
  };
}

async function fetchPage(creds: { appId: string; secret: string }, page: number): Promise<ShopeeNode[]> {
  const payload = JSON.stringify({
    query: PRODUCT_OFFER_QUERY,
    variables: { page, limit: PAGE_LIMIT },
  });

  // Shopee signs with SHA256 over appId + timestamp + payload + secret.
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha256")
    .update(`${creds.appId}${timestamp}${payload}${creds.secret}`)
    .digest("hex");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `SHA256 Credential=${creds.appId}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body: payload,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Shopee affiliate API page ${page} failed: ${res.status}`);

  const body = (await res.json()) as {
    errors?: { message?: string }[];
    data?: { productOfferV2?: { nodes?: ShopeeNode[] } };
  };

  if (body.errors?.length) {
    throw new Error(`Shopee affiliate API error: ${body.errors[0]?.message}`);
  }

  return body.data?.productOfferV2?.nodes ?? [];
}

export const shopeeProvider: DealProvider = {
  id: "shopee",

  isConfigured: () => credentials() !== null,

  async fetchDeals() {
    const creds = credentials();
    if (!creds) throw new Error("Shopee affiliate credentials are not configured");

    // Multiple pages of the curated offer feed, for enough variety to fill
    // both sections without repeats. A page that fails is simply dropped —
    // the earlier pages still carry the feed's best offers (sortType: 3).
    const pages = await Promise.allSettled(
      Array.from({ length: PAGE_COUNT }, (_, i) => fetchPage(creds, i + 1)),
    );

    const byId = new Map<string, ShopeeNode>();
    for (const result of pages) {
      if (result.status !== "fulfilled") continue;
      for (const node of result.value) byId.set(String(node.itemId), node);
    }

    if (byId.size === 0) throw new Error("Shopee affiliate API returned no offers");

    return [...byId.values()].map(normalise).filter((deal): deal is Deal => deal !== null);
  },
};
