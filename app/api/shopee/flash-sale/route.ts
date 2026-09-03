import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { hasSupabaseConfig, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { createClient } from "@supabase/supabase-js";

const CACHE_DIR = path.join(process.cwd(), "lib/deals/cache");
const CACHE_PATH = path.join(CACHE_DIR, "shopee-flash-sale.json");
const SCRAPED_CACHE_PATH = path.join(CACHE_DIR, "shopee-scraped.json");
const MAX_CACHE_AGE_MS = 30 * 60 * 1000; // 30 phút

// Biến khóa để chống cào trùng lặp khi nhiều user vào cùng lúc
let isScraping = false;

interface FlashSaleSession {
  promotionId: number | string;
  timeSlot: string;
  startTime: number;
  endTime: number;
  isOngoing: boolean;
  statusText: string;
  itemsCount: number;
  items: Array<{
    itemId: number;
    shopId: number;
    name: string;
    price: number;
    priceBeforeDiscount: number;
    discountPercent: number;
    historicalSold: number;
    ratingStar: number;
    ratingCount: number;
    image: string | null;
    isMall: boolean;
    productUrl: string;
  }>;
}

interface CachePayload {
  scrapedAt: string;
  totalSessions: number;
  sessions: FlashSaleSession[];
}

async function runBackgroundScrape(): Promise<CachePayload | null> {
  if (isScraping) return null;
  isScraping = true;
  console.log("[Background Worker] Bắt đầu cào Flash Sale ngầm...");

  try {
    const { fetchShopeeFlashSale } = await import("@/scripts/shopee-scrape-flashsale.mjs");
    const sessions: FlashSaleSession[] = await fetchShopeeFlashSale();
    const payload: CachePayload = {
      scrapedAt: new Date().toISOString(),
      totalSessions: sessions.length,
      sessions,
    };

    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(CACHE_PATH, JSON.stringify(payload, null, 2));

    // Cập nhật cho trang chủ mục "Deal chớp nhoáng"
    const ongoingSession = sessions.find((s) => s.isOngoing) || sessions[0];
    if (ongoingSession && ongoingSession.items.length > 0) {
      const homeProducts = ongoingSession.items.map((p) => ({
        itemId: p.itemId,
        shopId: p.shopId,
        name: p.name,
        price: p.price,
        priceBeforeDiscount: p.priceBeforeDiscount,
        rawDiscount: p.discountPercent,
        historicalSold: p.historicalSold,
        ratingStar: p.ratingStar,
        ratingCount: p.ratingCount,
        image: p.image,
        isMall: p.isMall,
        productUrl: p.productUrl,
      }));

      await writeFile(
        SCRAPED_CACHE_PATH,
        JSON.stringify({ scrapedAt: new Date().toISOString(), products: homeProducts }, null, 2)
      );
    }

    console.log("[Background Worker] Hoàn tất cập nhật Flash Sale ngầm!");
    return payload;
  } catch (err) {
    console.error("[Background Worker Lỗi]:", err);
    return null;
  } finally {
    isScraping = false;
  }
}

async function readFromSupabase(): Promise<CachePayload | null> {
  if (!hasSupabaseConfig || !supabaseUrl || !supabasePublishableKey) return null;
  try {
    const sb = createClient(supabaseUrl, supabasePublishableKey);
    const { data, error } = await sb.from("flash_sale_cache").select("data").eq("id", "latest").single();
    if (error || !data) return null;
    return data.data as CachePayload;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const promotionId = searchParams.get("promotionId");
  const sessionIndex = searchParams.get("sessionIndex");
  const status = searchParams.get("status");
  const forceRefresh = searchParams.get("refresh") === "true";

  let data: CachePayload | null = null;

  // 1. Đọc từ Supabase Cloud trước (khi chạy trên Vercel)
  data = await readFromSupabase();

  // 2. Nếu chưa có từ Supabase, fallback đọc từ file cache local
  if (!data) {
    try {
      const raw = await readFile(CACHE_PATH, "utf-8");
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  const cacheAge = data?.scrapedAt ? Date.now() - new Date(data.scrapedAt).getTime() : Infinity;
  const isStale = cacheAge > MAX_CACHE_AGE_MS;

  // 2. Cơ chế SWR (Stale-While-Revalidate):
  // Nếu đã có cache: trả về NGAY LẬP TỨC (tốc độ vài mili-giây)
  // và âm thầm kích hoạt tiến trình cào mới ngầm ở background
  if (data && isStale && !isScraping) {
    runBackgroundScrape().catch(() => {});
  }

  // Nếu người dùng bắt buộc refresh hoặc chưa hề có dữ liệu nào:
  if (forceRefresh || !data) {
    const freshData = await runBackgroundScrape();
    if (freshData) {
      data = freshData;
    } else if (!data) {
      return NextResponse.json(
        {
          error: "DANG_KHOI_DONG",
          message: "Hệ thống đang khởi động cào dữ liệu lần đầu, vui lòng thử lại sau vài giây.",
        },
        { status: 503 }
      );
    }
  }

  // 3. Tính toán trạng thái khung giờ theo thời gian thực (Real-time)
  const nowSec = Math.floor(Date.now() / 1000);
  const dynamicSessions = data.sessions.map((s) => {
    const isOngoing = nowSec >= s.startTime && nowSec < s.endTime;
    const isUpcoming = nowSec < s.startTime;
    return {
      ...s,
      isOngoing,
      statusText: isOngoing ? "Đang diễn ra" : isUpcoming ? "Sắp diễn ra" : "Đã kết thúc",
    };
  });

  // Nếu đã chuyển sang khung giờ mới kể từ lần cào trước, tự kích hoạt cào ngầm để cập nhật giá chính thức
  const activeSession = dynamicSessions.find((s) => s.isOngoing);
  const scrapedSec = Math.floor(new Date(data.scrapedAt).getTime() / 1000);
  const hasEnteredNewSlot = activeSession && activeSession.startTime > scrapedSec;

  if ((isStale || hasEnteredNewSlot) && !isScraping) {
    runBackgroundScrape().catch(() => {});
  }

  // 4. Lọc dữ liệu theo query parameters
  let result = dynamicSessions;

  if (promotionId) {
    result = result.filter((s) => String(s.promotionId) === promotionId);
  } else if (sessionIndex !== null) {
    const idx = parseInt(sessionIndex, 10);
    if (!isNaN(idx) && result[idx]) {
      result = [result[idx]];
    }
  } else if (status === "ongoing") {
    result = result.filter((s) => s.isOngoing);
  } else if (status === "upcoming") {
    result = result.filter((s) => s.startTime > nowSec);
  }

  return NextResponse.json({
    scrapedAt: data.scrapedAt,
    cacheAgeMinutes: Math.round(cacheAge / 60000),
    isBackgroundUpdating: isScraping,
    totalSessions: result.length,
    sessions: result,
  });
}
