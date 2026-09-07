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
 * Strips existing affiliate / UTM query params from Shopee URLs so
 * they don't conflict with our affiliate tracking.
 */
export function cleanShopeeUrl(rawUrl: string): string {
  try {
    const trimmed = rawUrl.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      return trimmed;
    }
    const parsed = new URL(trimmed);
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
    const lower = rawUrl.toLowerCase();
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
