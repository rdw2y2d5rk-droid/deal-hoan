/**
 * Shopee Affiliate Link Utility
 * Converts any Shopee product link into an official tracked affiliate link
 * using Shopee's official an_redir gateway.
 */

export const DEFAULT_SHOPEE_AFFILIATE_ID =
  process.env.NEXT_PUBLIC_SHOPEE_AFFILIATE_ID ||
  process.env.SHOPEE_AFFILIATE_ID ||
  "17351320644";

/**
 * Extracts a clean URL from a string that may contain text around it.
 * e.g.: "Mua Áo thun tại Shopee ngay: https://s.shopee.vn/abcxyz" -> "https://s.shopee.vn/abcxyz"
 */
export function extractUrlFromText(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  const match = trimmed.match(/(https?:\/\/[^\s]+)/i);
  if (match) {
    let url = match[1];
    // Strip trailing punctuation often attached at the end of sentences
    url = url.replace(/[.,;!?)"'\]>]+$/, "");
    return url;
  }
  return trimmed;
}

/**
 * Strips existing affiliate / UTM query params from Shopee URLs so
 * they don't conflict with our affiliate tracking.
 * Unwraps nested origin_link if an affiliate URL is passed.
 */
export function cleanShopeeUrl(rawUrl: string): string {
  try {
    const extracted = extractUrlFromText(rawUrl);
    if (!extracted.startsWith("http://") && !extracted.startsWith("https://")) {
      return extracted;
    }
    const parsed = new URL(extracted);

    // If an an_redir affiliate link is passed, unpack its origin_link
    if (parsed.searchParams.has("origin_link")) {
      const nested = parsed.searchParams.get("origin_link");
      if (nested) {
        try {
          const decoded = decodeURIComponent(nested);
          return cleanShopeeUrl(decoded);
        } catch {
          return cleanShopeeUrl(nested);
        }
      }
    }

    const paramsToKeep = ["sp_atk", "xptdk"];
    const newSearch = new URLSearchParams();
    for (const [key, val] of parsed.searchParams.entries()) {
      if (
        !key.startsWith("utm_") &&
        !key.startsWith("aff_") &&
        key !== "credential_token" &&
        key !== "mmp_pid" &&
        key !== "uls_trackid" &&
        key !== "affiliate_id" &&
        key !== "origin_link"
      ) {
        if (paramsToKeep.includes(key)) {
          newSearch.set(key, val);
        }
      }
    }
    const cleanSearchStr = newSearch.toString();
    return `${parsed.origin}${parsed.pathname}${cleanSearchStr ? `?${cleanSearchStr}` : ""}`;
  } catch {
    return rawUrl;
  }
}

/**
 * Generates an official Shopee Affiliate tracking link
 * Format: https://s.shopee.vn/an_redir?origin_link=<ENCODED_LINK>&affiliate_id=<ID>&sub_id=<SUB_ID>
 */
export function buildShopeeAffiliateUrl(
  rawUrl: string,
  options?: {
    affiliateId?: string;
    subId?: string;
  },
): string {
  const cleanUrl = cleanShopeeUrl(rawUrl);
  const affiliateId = options?.affiliateId || DEFAULT_SHOPEE_AFFILIATE_ID;
  const subId = options?.subId || "dealhoan";

  const target = new URL("https://s.shopee.vn/an_redir");
  target.searchParams.set("origin_link", cleanUrl);
  target.searchParams.set("affiliate_id", affiliateId);
  if (subId) {
    target.searchParams.set("sub_id", subId);
  }

  return target.toString();
}

/**
 * Checks if a URL belongs to Shopee (web, shortlink, universal link)
 */
export function isShopeeUrl(rawUrl: string): boolean {
  try {
    const extracted = extractUrlFromText(rawUrl);
    const lower = extracted.toLowerCase();
    return (
      lower.includes("shopee.vn") ||
      lower.includes("s.shopee.vn") ||
      lower.includes("shope.ee") ||
      lower.includes("vn.shp.ee")
    );
  } catch {
    return false;
  }
}

/**
 * Generates a clean, branded DealHoàn short link
 * e.g.:
 * - For Shopee product: https://dealhoan.vn/go?s=401425654.17054556097
 * - For other links: https://dealhoan.vn/go?url=...
 */
export function buildCustomShortUrl(
  rawUrl: string,
  options?: {
    baseUrl?: string;
    subId?: string;
    shopId?: string;
    itemId?: string;
  },
): string {
  let base = (options?.baseUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://dealhoan.vn").trim();
  if (!base.startsWith("http://") && !base.startsWith("https://")) {
    base = `https://${base}`;
  }
  const subId = options?.subId || "dealhoan";

  // If shopId and itemId are explicitly provided, immediately build standard /go?s=...
  if (options?.shopId && options?.itemId) {
    const shortUrl = new URL("/go", base);
    shortUrl.searchParams.set("s", `${options.shopId}.${options.itemId}`);
    if (subId && subId !== "dealhoan" && subId !== "calc") {
      shortUrl.searchParams.set("sub", subId);
    }
    return shortUrl.toString();
  }

  const cleanUrl = cleanShopeeUrl(rawUrl);

  try {
    const u = new URL(cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`);
    const host = u.hostname.toLowerCase();

    // Check if it is a Shopee product
    if (host.includes("shopee.vn") || host.includes("shp.ee")) {
      const match1 = u.pathname.match(/\/product\/(\d+)\/(\d+)/i);
      const match2 = u.pathname.match(/-i\.(\d+)\.(\d+)/i);
      const match = match1 || match2;
      if (match) {
        const shopId = match[1];
        const itemId = match[2];
        const shortUrl = new URL("/go", base);
        shortUrl.searchParams.set("s", `${shopId}.${itemId}`);
        if (subId && subId !== "dealhoan" && subId !== "calc") {
          shortUrl.searchParams.set("sub", subId);
        }
        return shortUrl.toString();
      }
    }

    // Generic fallback for other URLs
    const shortUrl = new URL("/go", base);
    shortUrl.searchParams.set("url", cleanUrl);
    if (subId && subId !== "dealhoan" && subId !== "calc") {
      shortUrl.searchParams.set("sub", subId);
    }
    return shortUrl.toString();
  } catch {
    const shortUrl = new URL("/go", base);
    shortUrl.searchParams.set("url", rawUrl);
    return shortUrl.toString();
  }
}
