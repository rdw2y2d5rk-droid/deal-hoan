import { CASHBACK_CAP, CASHBACK_RATE } from "./config";
import type { Platform } from "./types";

/** Cashback in đồng for a real price, using the configured platform rate. */
export function cashbackFor(price: number, platform: Platform, rateOverride?: number) {
  const rate = rateOverride ?? CASHBACK_RATE[platform];
  const raw = Math.min(price * rate, CASHBACK_CAP);
  // Round to 1.000đ so the card shows a payout figure, not a fraction of a đồng.
  return Math.round(raw / 1000) * 1000;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Deal Score, 0-100, from signals the marketplace actually reports.
 *
 * Weighting: discount 40 · cashback 20 · shop trust 25 · demand 15.
 *
 * Note: the product headline claims price history is an input. Public product
 * feeds do not expose historical prices, so history is NOT scored here — wire a
 * price-tracking store in before advertising it.
 */
export function dealScore(input: {
  discountPercent: number;
  price: number;
  cashback: number;
  ratingAverage: number;
  reviewCount: number;
  sold: number | null;
}) {
  // A 50%-off deal saturates the discount component.
  const discount = clamp01(input.discountPercent / 50) * 40;

  const cashbackRate = input.price > 0 ? input.cashback / input.price : 0;
  const cashback = clamp01(cashbackRate / 0.08) * 20;

  // Ratings only count once enough reviews back them up.
  const confidence = clamp01(Math.log10(input.reviewCount + 1) / 2);
  const trust = clamp01(input.ratingAverage / 5) * confidence * 25;

  const demand = clamp01(Math.log10((input.sold ?? 0) + 1) / 4) * 15;

  return Math.round(discount + cashback + trust + demand);
}
