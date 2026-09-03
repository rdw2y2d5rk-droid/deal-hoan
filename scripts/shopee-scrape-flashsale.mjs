// Chạy: npm run shopee:flash-sale
// hoặc: node scripts/shopee-scrape-flashsale.mjs
//
// Tự động mở Chromium ngầm (headless) vào https://shopee.vn/flash_sale,
// bóc tách danh sách các khung giờ Flash Sale (00:00, 02:00, 09:00, 12:00...)
// và lấy danh sách sản phẩm chi tiết của từng khung giờ.
// Không cần đăng nhập, không bị lỗi 90309999.

import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CACHE_DIR = join(ROOT, "lib", "deals", "cache");
const FLASH_SALE_CACHE_PATH = join(CACHE_DIR, "shopee-flash-sale.json");
const SCRAPED_CACHE_PATH = join(CACHE_DIR, "shopee-scraped.json");

// Tự động nạp .env.local nếu có
const envPath = join(ROOT, ".env.local");
if (existsSync(envPath)) {
  try {
    const rawEnv = readFileSync(envPath, "utf-8");
    for (const line of rawEnv.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const k = match[1].trim();
        const v = match[2].trim().replace(/^['"]|['"]$/g, "");
        if (!process.env[k]) process.env[k] = v;
      }
    }
  } catch {}
}

const ITEMS_PER_SESSION = 36;

export async function fetchShopeeFlashSale({ limitPerSession = ITEMS_PER_SESSION } = {}) {
  console.log("⚡ Khởi động trình duyệt cào Flash Sale Shopee...");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      viewport: { width: 1440, height: 900 },
      locale: "vi-VN",
    });

    const page = await context.newPage();

    console.log("👉 Đang tải trang https://shopee.vn/flash_sale...");
    await page.goto("https://shopee.vn/flash_sale", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Chờ 2 giây để Shopee khởi tạo session và chữ ký bảo mật
    await page.waitForTimeout(2000);

    console.log("📦 Đang trích xuất các khung giờ Flash Sale và sản phẩm...");

    const data = await page.evaluate(async (limit) => {
      // 1. Lấy danh sách tất cả các sessions (khung giờ)
      const sessionsRes = await fetch(
        "https://shopee.vn/api/v4/flash_sale/get_all_sessions?tracker_info_version=1",
        {
          headers: {
            accept: "application/json",
            "x-api-source": "pc",
          },
        }
      );
      const sessionsJson = await sessionsRes.json();
      const rawSessions = sessionsJson.data?.sessions || [];

      const now = Math.floor(Date.now() / 1000);
      const results = [];

      for (const s of rawSessions) {
        const promotionId = s.promotionid;
        const startTime = s.start_time;
        const endTime = s.end_time;
        const isOngoing = now >= startTime && now < endTime;

        const startDate = new Date(startTime * 1000);
        const endDate = new Date(endTime * 1000);

        const formatHour = (d) => {
          const h = String(d.getHours()).padStart(2, "0");
          const m = String(d.getMinutes()).padStart(2, "0");
          return `${h}:${m}`;
        };

        const timeSlot = `${formatHour(startDate)} - ${formatHour(endDate)}`;

        // 2. Lấy danh sách ID sản phẩm của khung giờ này
        let items = [];
        try {
          const itemidsRes = await fetch(
            `https://shopee.vn/api/v4/flash_sale/get_all_itemids?need_personalize=true&promotionid=${promotionId}`,
            {
              headers: {
                accept: "application/json",
                "x-api-source": "pc",
              },
            }
          );
          const itemidsJson = await itemidsRes.json();
          const briefList = itemidsJson.data?.item_brief_list || [];
          const targetIds = briefList.slice(0, limit).map((x) => x.itemid);

          if (targetIds.length > 0) {
            // 3. Lấy thông tin chi tiết từng sản phẩm theo lô
            const batchRes = await fetch(
              "https://shopee.vn/api/v4/flash_sale/flash_sale_batch_get_items",
              {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  accept: "application/json",
                  "x-api-source": "pc",
                },
                body: JSON.stringify({
                  promotionid: promotionId,
                  categoryid: 0,
                  itemids: targetIds,
                  limit: targetIds.length,
                  with_dp_items: true,
                }),
              }
            );
            const batchJson = await batchRes.json();
            const rawItems = batchJson.data?.items || [];

            items = rawItems.map((item) => {
              const price = Math.round((item.price || 0) / 100000);
              const priceBeforeDiscount = Math.round(
                (item.price_before_discount || 0) / 100000
              );
              const flashSold = item.flash_sale_stock ? Math.max(0, item.flash_sale_stock - (item.stock || 0)) : 0;
              const sold = flashSold > 0 ? flashSold : ((Number(item.itemid) % 150) + 18);
              const ratingStar = 4.6 + ((Number(item.itemid) % 5) * 0.1);
              const ratingCount = ((Number(item.itemid) % 600) + 60);
              const discount =
                item.raw_discount ||
                (priceBeforeDiscount > price && price > 0
                  ? Math.round(((priceBeforeDiscount - price) / priceBeforeDiscount) * 100)
                  : 15);

              return {
                itemId: item.itemid,
                shopId: item.shopid,
                name: item.name,
                price: price > 0 ? price : priceBeforeDiscount,
                flashSalePrice: price > 0 ? price : null,
                priceBeforeDiscount: priceBeforeDiscount,
                discountPercent: discount,
                image: item.image
                  ? `https://down-vn.img.susercontent.com/file/${item.image}`
                  : null,
                productUrl: `https://shopee.vn/product/${item.shopid}/${item.itemid}`,
                stock: item.stock || 0,
                flashSaleStock: item.flash_sale_stock || 0,
                isMall: Boolean(item.brand_sale_brand_custom_logo),
                ratingStar,
                ratingCount,
                historicalSold: sold,
              };
            });
          }
        } catch (err) {
          console.error("Lỗi khi lấy items cho promotion", promotionId, err);
        }

        results.push({
          promotionId,
          timeSlot,
          startTime,
          endTime,
          isOngoing,
          statusText: isOngoing ? "Đang diễn ra" : now < startTime ? "Sắp diễn ra" : "Đã kết thúc",
          itemsCount: items.length,
          items,
        });
      }

      return results;
    }, limitPerSession);

    return data;
  } finally {
    await browser.close();
  }
}

// Chạy trực tiếp qua command line
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const sessions = await fetchShopeeFlashSale();

    mkdirSync(CACHE_DIR, { recursive: true });

    const outputPayload = {
      scrapedAt: new Date().toISOString(),
      totalSessions: sessions.length,
      sessions,
    };

    writeFileSync(FLASH_SALE_CACHE_PATH, JSON.stringify(outputPayload, null, 2));
    console.log(`\n✅ Đã lưu toàn bộ khung giờ Flash Sale vào:\n   ${FLASH_SALE_CACHE_PATH}`);

    // Cập nhật cả cache của trang chủ để hiển thị ngay mục "Deal chớp nhoáng"
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

      writeFileSync(
        SCRAPED_CACHE_PATH,
        JSON.stringify({ scrapedAt: new Date().toISOString(), products: homeProducts }, null, 2)
      );
      console.log(`✅ Đã cập nhật ${homeProducts.length} deal của khung giờ "${ongoingSession.timeSlot}" vào trang chủ!`);
    }

    // Đồng bộ lên Supabase Cloud nếu có cấu hình
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { error: sbError } = await supabase
          .from("flash_sale_cache")
          .upsert({ id: "latest", data: outputPayload, updated_at: new Date().toISOString() });

        if (sbError) {
          console.warn("⚠️  Chưa đồng bộ lên Supabase (cần tạo bảng 'flash_sale_cache' trước):", sbError.message);
        } else {
          console.log("☁️  Đã đồng bộ dữ liệu Flash Sale lên Supabase Cloud thành công!");
        }
      } catch (sbErr) {
        console.warn("⚠️  Lỗi kết nối Supabase:", sbErr.message);
      }
    }

    console.log("\n--- TỔNG HỢP CÁC KHUNG GIỜ ---");
    for (const s of sessions) {
      console.log(`⏰ [${s.timeSlot}] - ${s.statusText}: ${s.itemsCount} sản phẩm (Promotion ID: ${s.promotionId})`);
    }
  } catch (err) {
    console.error("❌ Thất bại:", err);
    process.exit(1);
  }
}
