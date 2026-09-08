import { NextRequest, NextResponse } from "next/server";
import { buildShopeeAffiliateUrl, isShopeeUrl, cleanShopeeUrl } from "@/lib/deals/affiliate";
import { lookupFastShopeeProduct } from "@/lib/deals/providers/fast-shopee";

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
    let cleanTarget = cleanShopeeUrl(targetUrl);
    // If it's a shortlink (s.shopee.vn, vn.shp.ee) without explicit /product/ or -i.
    const isDirectProduct = cleanTarget.includes("/product/") || cleanTarget.includes("-i.");
    if (!isDirectProduct) {
      try {
        const resolved = await lookupFastShopeeProduct(cleanTarget);
        if (resolved?.productLink) {
          cleanTarget = resolved.productLink;
        }
      } catch {}
    }

    const affiliateUrl = buildShopeeAffiliateUrl(cleanTarget, { subId });
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
