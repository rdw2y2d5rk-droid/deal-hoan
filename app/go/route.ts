import { NextRequest, NextResponse } from "next/server";
import { buildShopeeAffiliateUrl, isShopeeUrl } from "@/lib/deals/affiliate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const s = searchParams.get("s");
  const subId = searchParams.get("sub") || searchParams.get("sub_id") || "dealhoan";
  let targetUrl = searchParams.get("url") || searchParams.get("p");

  // Support short Shopee format: ?s=shopId.itemId or ?s=itemId
  if (s) {
    if (s.includes(".")) {
      const [shopId, itemId] = s.split(".");
      targetUrl = `https://shopee.vn/product/${shopId}/${itemId}`;
    } else {
      targetUrl = `https://shopee.vn/product/0/${s}`;
    }
  }

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
