import { NextResponse } from "next/server";
import { getDeals } from "@/lib/deals";

/**
 * Diagnostics for the deal pipeline: shows which provider actually served the
 * homepage and what it returned. Useful right after adding API credentials.
 *
 * Reports only whether each credential is present — never its value.
 */
export async function GET() {
  const bundle = await getDeals();

  return NextResponse.json({
    source: bundle.source,
    fetchedAt: bundle.fetchedAt,
    counts: { flash: bundle.flash.length, hot: bundle.hot.length },
    credentials: {
      shopeeAffiliate: Boolean(
        process.env.SHOPEE_AFFILIATE_APP_ID && process.env.SHOPEE_AFFILIATE_SECRET,
      ),
      accessTrade: Boolean(process.env.ACCESSTRADE_TOKEN),
    },
    sample: {
      flash: bundle.flash[0] ?? null,
      hot: bundle.hot[0] ?? null,
    },
  });
}
