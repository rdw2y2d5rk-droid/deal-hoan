import type { Platform } from "./types";

/**
 * BUSINESS CONFIG — not marketplace data.
 *
 * These are DealHoàn's own payout rates, applied to the real selling price to
 * produce the "hoàn" figure on a card. They are deliberately conservative
 * placeholders: replace each one with the commission your affiliate contract
 * actually pays for that platform.
 *
 * The Shopee provider ignores this table whenever the Affiliate API returns a
 * real per-offer `commissionRate` — a real rate always wins over a default.
 */
export const CASHBACK_RATE: Record<Platform, number> = {
  Shopee: 0.05,
  "Shopee Mall": 0.05,
  Lazada: 0.045,
  "TikTok Shop": 0.05,
};

/** Cashback is never advertised above this, mirroring typical affiliate caps. */
export const CASHBACK_CAP = 500_000;

/** How many cards each section renders. */
export const FLASH_COUNT = 10;
export const HOT_COUNT = 24;

/** Cache lifetime for a fetched bundle, in seconds. */
export const REVALIDATE_SECONDS = 900;

/** Per-request timeout for any upstream marketplace call, in ms. */
export const FETCH_TIMEOUT_MS = 8_000;
