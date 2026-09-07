import { NextRequest, NextResponse } from "next/server";
import { buildShopeeAffiliateUrl, isShopeeUrl } from "@/lib/deals/affiliate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");
  const subId = searchParams.get("sub_id") || "dealhoan";

  if (!targetUrl) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If it's Shopee, convert to official Shopee Affiliate tracking link
  if (isShopeeUrl(targetUrl)) {
    const affiliateUrl = buildShopeeAffiliateUrl(targetUrl, { subId });
    return NextResponse.redirect(affiliateUrl, {
      status: 307,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  // Direct redirect for other URLs
  return NextResponse.redirect(targetUrl, {
    status: 307,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
