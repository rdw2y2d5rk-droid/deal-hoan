import { NextRequest, NextResponse } from "next/server";
import { buildShopeeAffiliateUrl, cleanShopeeUrl, isShopeeUrl } from "@/lib/deals/affiliate";
import { cashbackFor } from "@/lib/deals/score";
import type { Platform } from "@/lib/deals/types";
import { resolveProductLocally, type CalculatedProduct } from "@/lib/deals/resolve";

export const dynamic = "force-dynamic";

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

    // Expand shortlinks or fetch metadata with a safe 3.5s timeout
    try {
      const fetchHeaders: HeadersInit = {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      };

      const res = await fetch(rawUrl, {
        headers: fetchHeaders,
        redirect: "follow",
        signal: AbortSignal.timeout(3500),
      });

      if (res.ok) {
        canonicalUrl = res.url || rawUrl;
        const html = await res.text();

        // 1. Extract image
        const imgMatch =
          html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
          html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
        if (imgMatch && imgMatch[1]?.startsWith("http")) {
          ogImage = imgMatch[1].trim();
        }

        // 2. Extract title
        const titleMatch =
          html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
          html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          const rawTitle = titleMatch[1].trim();
          // Clean generic suffixes
          const cleaned = rawTitle
            .replace(/\s*[|–-]\s*(Shopee Việt Nam|Lazada\.vn|TikTok Shop|Tiki\.vn|Mua và Bán.*)$/i, "")
            .trim();
          if (cleaned.length > 3 && !cleaned.toLowerCase().startsWith("shopee việt nam")) {
            ogTitle = cleaned;
          }
        }

        // 3. Extract price
        const priceMatch =
          html.match(/<meta[^>]+property=["'](?:product|og):price:amount["'][^>]+content=["']([\d.,]+)["']/i) ||
          html.match(/<meta[^>]+name=["']twitter:data1["'][^>]+content=["']([\d.,]+)["']/i);
        if (priceMatch && priceMatch[1]) {
          const parsed = Number(priceMatch[1].replace(/[,.]/g, ""));
          if (Number.isFinite(parsed) && parsed > 1000) {
            extractedPrice = parsed;
          }
        }
      }
    } catch {
      // Ignore network / timeout errors and fallback to local catalog resolution
    }

    // Resolve base product locally (sample chips, known keywords, category fallbacks)
    const baseProduct = resolveProductLocally(canonicalUrl);

    const isCurrentShopee = isShopeeUrl(canonicalUrl) || isShopee;
    const finalPlatform: Platform = canonicalUrl.toLowerCase().includes("tiktok")
      ? "TikTok Shop"
      : canonicalUrl.toLowerCase().includes("lazada")
        ? "Lazada"
        : isCurrentShopee
          ? baseProduct.platform === "Shopee"
            ? "Shopee"
            : "Shopee Mall"
          : "Shopee";

    const finalName = ogTitle || baseProduct.name;
    const finalImage = ogImage || baseProduct.imageUrl;
    const finalPrice = extractedPrice || baseProduct.price;
    const finalOriginalPrice =
      baseProduct.originalPrice > finalPrice
        ? baseProduct.originalPrice
        : Math.round((finalPrice * 1.28) / 1000) * 1000;
    const finalCashback = cashbackFor(finalPrice, finalPlatform);
    const discountPercent =
      finalOriginalPrice > finalPrice
        ? Math.round(((finalOriginalPrice - finalPrice) / finalOriginalPrice) * 100)
        : 0;
    const savingsPercent =
      finalOriginalPrice > finalPrice - finalCashback
        ? Math.round(((finalOriginalPrice - (finalPrice - finalCashback)) / finalOriginalPrice) * 100)
        : Math.round((finalCashback / finalPrice) * 100);

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
      seller: baseProduct.seller,
      trackedLink,
      discountPercent,
      savingsPercent,
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
