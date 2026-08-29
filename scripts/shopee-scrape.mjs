// Chạy: node scripts/shopee-scrape.mjs
// (cần chạy scripts/shopee-login.mjs trước ít nhất một lần)
//
// Dùng phiên đăng nhập đã lưu để duyệt các trang tìm kiếm Shopee. Thay vì
// đọc HTML đã render (dễ vỡ vì Shopee đặt tên class ngẫu nhiên/đổi liên
// tục), script "nghe" đúng request JSON mà chính trang Shopee tự gọi khi
// tải kết quả tìm kiếm — đáng tin hơn nhiều.
//
// Lưu ý quan trọng: mình (Claude) KHÔNG có tài khoản Shopee thật để tự chạy
// và xác nhận cấu trúc JSON này — nó dựa trên schema đã biết của API tìm
// kiếm Shopee, có thể đã đổi khác. Nếu chạy xong mà "products.json" ra rỗng
// nhưng "debug-raw" có dữ liệu, gửi lại nội dung debug-raw để chỉnh field
// cho đúng.

import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SESSION_PATH = join(ROOT, ".secrets", "shopee-session.json");
const CACHE_DIR = join(ROOT, "lib", "deals", "cache");
const OUT_PATH = join(CACHE_DIR, "shopee-scraped.json");
const DEBUG_PATH = join(CACHE_DIR, "shopee-scraped.debug.json");

if (!existsSync(SESSION_PATH)) {
  console.error("❌ Chưa có phiên đăng nhập. Chạy trước: node scripts/shopee-login.mjs");
  process.exit(1);
}

const QUERIES = [
  "nồi chiên không dầu",
  "robot hút bụi",
  "serum dưỡng da",
  "giày chạy bộ",
  "máy xay sinh tố",
  "bàn phím cơ",
  "kem chống nắng",
  "bình giữ nhiệt",
  "tai nghe bluetooth",
  "nồi cơm điện",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (base) => base + Math.random() * base * 0.5;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: SESSION_PATH,
  viewport: { width: 1366, height: 900 },
  locale: "vi-VN",
});
const page = await context.newPage();

const rawBatches = [];
const byId = new Map();

for (const [i, query] of QUERIES.entries()) {
  console.log(`[${i + 1}/${QUERIES.length}] "${query}"`);

  const captured = new Promise((resolve) => {
    const onResponse = async (res) => {
      if (!res.url().includes("/api/v4/search/search_items")) return;
      try {
        const json = await res.json();
        page.off("response", onResponse);
        resolve(json);
      } catch {
        // response body not JSON / already consumed — keep waiting for another match
      }
    };
    page.on("response", onResponse);
    setTimeout(() => resolve(null), 15000);
  });

  await page.goto(`https://shopee.vn/search?keyword=${encodeURIComponent(query)}`, {
    waitUntil: "domcontentloaded",
  });

  const json = await captured;

  if (!json) {
    console.warn(`  ⚠️  Không bắt được response cho "${query}" (có thể bị chặn/đăng xuất).`);
    continue;
  }

  rawBatches.push({ query, json });

  const items = json?.items ?? [];
  console.log(`  → ${items.length} sản phẩm`);

  for (const entry of items) {
    const b = entry.item_basic ?? entry;
    if (!b?.itemid || !b?.shopid || !b?.name) continue;
    byId.set(`${b.shopid}-${b.itemid}`, b);
  }

  await sleep(jitter(2500));
}

await browser.close();

mkdirSync(CACHE_DIR, { recursive: true });
writeFileSync(DEBUG_PATH, JSON.stringify(rawBatches, null, 1));

const products = [...byId.values()].map((b) => ({
  itemId: b.itemid,
  shopId: b.shopid,
  name: b.name,
  // Shopee prices are stored in a fixed-point *100000 unit.
  price: Math.round((b.price ?? 0) / 100000),
  priceBeforeDiscount: Math.round((b.price_before_discount ?? 0) / 100000),
  rawDiscount: b.raw_discount ?? 0,
  historicalSold: b.historical_sold ?? null,
  ratingStar: b.item_rating?.rating_star ?? 0,
  ratingCount: (b.item_rating?.rating_count ?? [0])[0] ?? 0,
  image: b.image ? `https://down-vn.img.susercontent.com/file/${b.image}` : null,
  isMall: Boolean(b.is_official_shop || b.shopee_verified),
  productUrl: `https://shopee.vn/product/${b.shopid}/${b.itemid}`,
}));

writeFileSync(
  OUT_PATH,
  JSON.stringify({ scrapedAt: new Date().toISOString(), products }, null, 1),
);

console.log(`\n✅ Đã lưu ${products.length} sản phẩm vào ${OUT_PATH}`);
console.log(`   Dữ liệu thô (để đối chiếu nếu field sai) tại ${DEBUG_PATH}`);
if (products.length === 0) {
  console.log("   ⚠️  0 sản phẩm — mở file debug để xem response thật trông ra sao.");
}
