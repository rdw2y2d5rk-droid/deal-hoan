import { NextRequest, NextResponse } from "next/server";
import { buildShopeeAffiliateUrl, cleanShopeeUrl, isShopeeUrl } from "@/lib/deals/affiliate";
import { cashbackFor } from "@/lib/deals/score";
import type { Platform } from "@/lib/deals/types";
import { resolveProductLocally, type CalculatedProduct } from "@/lib/deals/resolve";
import { lookupAccessTradeProduct } from "@/lib/deals/providers/accesstrade";

export const dynamic = "force-dynamic";

function extractMeta(html: string, propertyOrName: string): string | null {
  const p = propertyOrName.replace(/:/g, "\\:");
  // Match property="..." content="..."
  const r1 = new RegExp(`<meta[^>]+property=["']${p}["'][^>]+content=["']([^"']+)["']`, "i");
  // Match content="..." property="..."
  const r2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${p}["']`, "i");
  // Match name="..." content="..."
  const r3 = new RegExp(`<meta[^>]+name=["']${p}["'][^>]+content=["']([^"']+)["']`, "i");
  // Match content="..." name="..."
  const r4 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${p}["']`, "i");

  const m = html.match(r1) || html.match(r2) || html.match(r3) || html.match(r4);
  return m ? m[1].trim() : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawUrl = body.url ? String(body.url).trim() : "";
    const subId = body.subId ? String(body.subId).trim() : "dealhoan";

    if (!rawUrl) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    const isShopee = isShopeeUrl(rawUrl);
    let canonicalUrl = rawUrl;
    let ogTitle: string | null = null;
    let ogImage: string | null = null;
    let extractedPrice: number | null = null;

    // 1. Expand shortlinks or fetch OpenGraph metadata
    // Using facebookexternalhit allows Shopee to return real SSR og:image and og:title without anti-bot blocks
    try {
      const fetchHeaders: HeadersInit = {
        "User-Agent":
          "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      };

      const res = await fetch(rawUrl, {
        headers: fetchHeaders,
        redirect: "follow",
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        canonicalUrl = res.url || rawUrl;
        const html = await res.text();

        // Extract image
        const img = extractMeta(html, "og:image") || extractMeta(html, "twitter:image");
        if (img && img.startsWith("http")) {
          ogImage = img;
        }

        // Extract title
        const title =
          extractMeta(html, "og:title") ||
          extractMeta(html, "twitter:title") ||
          html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
        if (title) {
          const cleaned = title
            .replace(/&amp;/g, "&")
            .replace(/\s*[|–-]\s*(Shopee Việt Nam|Lazada\.vn|TikTok Shop|Tiki\.vn|Mua và Bán.*)$/i, "")
            .trim();
          if (cleaned.length > 3 && !cleaned.toLowerCase().startsWith("shopee việt nam")) {
            ogTitle = cleaned;
          }
        }

        // Extract price if exposed in OpenGraph
        const rawPriceStr =
          extractMeta(html, "product:price:amount") ||
          extractMeta(html, "og:price:amount") ||
          extractMeta(html, "twitter:data1");
        if (rawPriceStr) {
          const parsed = Number(rawPriceStr.replace(/[,.]/g, ""));
          if (Number.isFinite(parsed) && parsed > 1000) {
            extractedPrice = parsed;
          }
        }
      }
    } catch {
      // Ignore network / timeout errors and proceed to multi-source catalog resolution
    }

    // 2. Query AccessTrade product datafeed (exact SKU match for real price & CDN image)
    const atProduct = await lookupAccessTradeProduct(canonicalUrl).catch(() => null);

    // 3. Fallback to local catalog resolution if neither metadata nor feed provided name
    const baseProduct = resolveProductLocally(canonicalUrl, [], ogTitle);

    const isCurrentShopee = isShopeeUrl(canonicalUrl) || isShopee;
    const finalPlatform: Platform = atProduct?.platform
      ? atProduct.platform
      : canonicalUrl.toLowerCase().includes("tiktok")
        ? "TikTok Shop"
        : canonicalUrl.toLowerCase().includes("lazada")
          ? "Lazada"
          : isCurrentShopee
            ? baseProduct.platform === "Shopee"
              ? "Shopee"
              : "Shopee Mall"
            : "Shopee";

    const isVerifiedPrice = Boolean(atProduct?.isVerifiedPrice || extractedPrice !== null);
    const priceType = atProduct?.isVerifiedPrice
      ? "exact"
      : extractedPrice !== null
        ? "exact"
        : "estimated";

    const finalName = atProduct?.name || ogTitle || baseProduct.name;
    const finalImage = atProduct?.imageUrl || ogImage || baseProduct.imageUrl;
    const finalPrice = atProduct?.price ?? (extractedPrice || baseProduct.price);
    const finalOriginalPrice =
      atProduct?.originalPrice ??
      (baseProduct.originalPrice > finalPrice
        ? baseProduct.originalPrice
        : Math.round((finalPrice * 1.28) / 1000) * 1000);

    const finalCashback = cashbackFor(finalPrice, finalPlatform);
    const discountPercent =
      finalOriginalPrice > finalPrice
        ? Math.round(((finalOriginalPrice - finalPrice) / finalOriginalPrice) * 100)
        : 0;
    const savingsPercent =
      finalOriginalPrice > finalPrice - finalCashback
        ? Math.round(((finalOriginalPrice - (finalPrice - finalCashback)) / finalOriginalPrice) * 100)
        : Math.round((finalCashback / finalPrice) * 100);

    // NOTE ON COMMISSION ATTRIBUTION:
    // We intentionally route outbound clicks through our DIRECT Shopee Affiliate link:
    // https://s.shopee.vn/an_redir?affiliate_id=17351320644
    // AccessTrade is used SOLELY as a read-only data source for product prices and images.
    // 100% of all affiliate commissions go directly to DealHoàn without any intermediary.
    const trackedLink = isCurrentShopee
      ? buildShopeeAffiliateUrl(canonicalUrl, { subId })
      : canonicalUrl;

    const resolvedProduct: CalculatedProduct = {
      name: finalName,
      imageUrl: finalImage,
      price: finalPrice,
      originalPrice: finalOriginalPrice,
      cashback: finalCashback,
      platform: finalPlatform,
      seller: atProduct?.seller || baseProduct.seller,
      trackedLink,
      discountPercent,
      savingsPercent,
      isVerifiedPrice,
      priceType,
    };

    return NextResponse.json({
      success: true,
      product: resolvedProduct,
      trackedLink,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

