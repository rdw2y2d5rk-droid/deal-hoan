import { NextRequest, NextResponse } from "next/server";
import { buildShopeeAffiliateUrl, cleanShopeeUrl, isShopeeUrl } from "@/lib/deals/affiliate";
import { cashbackFor } from "@/lib/deals/score";
import type { Platform } from "@/lib/deals/types";
import { resolveProductLocally, type CalculatedProduct } from "@/lib/deals/resolve";
import { lookupAccessTradeProduct } from "@/lib/deals/providers/accesstrade";
import { lookupFastShopeeProduct } from "@/lib/deals/providers/fast-shopee";

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
    const isDirectShopeeProduct = isShopee && (rawUrl.includes("/product/") || rawUrl.includes("-i."));

    let canonicalUrl = rawUrl;
    let ogTitle: string | null = null;
    let ogImage: string | null = null;
    let extractedPrice: number | null = null;
    let showDiscount: number | null = null;

    // 1. Concurrently trigger fast Shopee resolution if link already has product/item ID
    const fastShopeeDirectPromise = isDirectShopeeProduct
      ? lookupFastShopeeProduct(rawUrl).catch(() => null)
      : Promise.resolve(null);

    // 2. Concurrently expand shortlink or fetch OpenGraph metadata with quick 1800ms timeout
    const metadataPromise = (async () => {
      try {
        const fetchHeaders: HeadersInit = isShopee
          ? {
              "User-Agent":
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
            }
          : {
              "User-Agent":
                "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
            };

        const res = await fetch(rawUrl, {
          headers: fetchHeaders,
          redirect: "follow",
          signal: AbortSignal.timeout(1800),
        });

        if (res.ok) {
          const finalFetchedUrl = res.url || rawUrl;
          const html = await res.text();
          return { finalFetchedUrl, html };
        }
      } catch {}
      return null;
    })();

    // Await both tasks in parallel
    const [fastShopeeDirect, metaResult] = await Promise.all([
      fastShopeeDirectPromise,
      metadataPromise,
    ]);

    if (metaResult) {
      canonicalUrl = metaResult.finalFetchedUrl;
      const html = metaResult.html;

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

      // Extract discount percent from Shopee SSR
      const discountMatch = html.match(/"show_discount":\s*(\d+)/i);
      if (discountMatch) {
        const parsedDisc = Number(discountMatch[1]);
        if (parsedDisc > 0 && parsedDisc < 95) {
          showDiscount = parsedDisc;
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

    const isCurrentShopee = isShopeeUrl(canonicalUrl) || isShopee;

    // If fastShopeeDirect was already resolved, update original price if discount was detected
    let fastShopeeProduct = fastShopeeDirect;
    if (fastShopeeProduct && showDiscount && showDiscount > 0) {
      const realOrig = Math.round((fastShopeeProduct.price / (1 - showDiscount / 100)) / 1000) * 1000;
      if (realOrig > fastShopeeProduct.price) {
        fastShopeeProduct = { ...fastShopeeProduct, originalPrice: realOrig };
      }
    } else if (!fastShopeeProduct && isCurrentShopee) {
      fastShopeeProduct = await lookupFastShopeeProduct(canonicalUrl, showDiscount).catch(() => null);
    }

    // 3. Query AccessTrade product datafeed (exact SKU match for real price & CDN image)
    const atProduct = !fastShopeeProduct
      ? await lookupAccessTradeProduct(canonicalUrl).catch(() => null)
      : null;

    // 4. Fallback to local catalog resolution if external providers yielded no match
    const baseProduct = resolveProductLocally(canonicalUrl, [], ogTitle);

    const finalPlatform: Platform = fastShopeeProduct
      ? "Shopee"
      : atProduct?.platform
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

    const isVerifiedPrice = Boolean(
      fastShopeeProduct?.isVerifiedPrice ||
      atProduct?.isVerifiedPrice ||
      extractedPrice !== null
    );

    const priceType = (fastShopeeProduct?.isVerifiedPrice || atProduct?.isVerifiedPrice || extractedPrice !== null)
      ? "exact"
      : "estimated";

    const finalName = fastShopeeProduct?.name || atProduct?.name || ogTitle || baseProduct.name;
    const finalImage = fastShopeeProduct?.imageUrl || atProduct?.imageUrl || ogImage || baseProduct.imageUrl;
    const finalPrice = fastShopeeProduct?.price ?? atProduct?.price ?? (extractedPrice || baseProduct.price);
    const finalOriginalPrice =
      fastShopeeProduct?.originalPrice ??
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
      finalPrice > 0
        ? Math.round((finalCashback / finalPrice) * 100)
        : 5;

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

