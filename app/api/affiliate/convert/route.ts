import { NextRequest, NextResponse } from "next/server";
import { buildShopeeAffiliateUrl, cleanShopeeUrl, isShopeeUrl } from "@/lib/deals/affiliate";

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
    const cleanUrl = isShopee ? cleanShopeeUrl(rawUrl) : rawUrl;
    const affiliateUrl = isShopee ? buildShopeeAffiliateUrl(rawUrl, { subId }) : rawUrl;

    const origin = request.nextUrl.origin;
    const goUrl = `${origin}/go?url=${encodeURIComponent(cleanUrl)}&sub_id=${encodeURIComponent(subId)}`;

    return NextResponse.json({
      success: true,
      isShopee,
      cleanUrl,
      affiliateUrl,
      goUrl,
      // The primary link to open / copy:
      trackedLink: affiliateUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
