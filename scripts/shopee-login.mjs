// Chạy: node scripts/shopee-login.mjs
//
// Mở một cửa sổ Chromium THẬT. Bạn tự đăng nhập bằng tài khoản Shopee của
// mình ngay trên trang Shopee (kể cả OTP nếu có) — script này KHÔNG đọc,
// KHÔNG lưu, KHÔNG chạm vào mật khẩu của bạn ở bất kỳ đâu. Nó chỉ chờ bạn
// đăng nhập xong rồi lưu lại cookie phiên đăng nhập vào file cục bộ
// (.secrets/shopee-session.json, đã có trong .gitignore) để lần cào sau
// dùng lại mà không phải đăng nhập lại mỗi lần.
//
// CẢNH BÁO: việc này có thể vi phạm Điều khoản dịch vụ của Shopee. Rủi ro
// gồm: bị khoá/hạn chế tài khoản, phiên bị Shopee tự đăng xuất nếu phát hiện
// hành vi bất thường. Tự chịu trách nhiệm khi chạy.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_PATH = join(__dirname, "..", ".secrets", "shopee-session.json");
mkdirSync(join(__dirname, "..", ".secrets"), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1366, height: 900 },
  locale: "vi-VN",
});
const page = await context.newPage();

await page.goto("https://shopee.vn/buyer/login");

console.log("\n👉 Cửa sổ Chromium đã mở. Hãy tự đăng nhập bằng tài khoản Shopee của bạn.");
console.log("   Script sẽ tự phát hiện khi bạn đăng nhập xong (tối đa chờ 5 phút).\n");

// Đăng nhập xong Shopee sẽ điều hướng khỏi /buyer/login về trang chủ.
try {
  await page.waitForURL((url) => !url.pathname.startsWith("/buyer/login"), {
    timeout: 5 * 60 * 1000,
  });
} catch {
  console.error("⏱️  Hết thời gian chờ đăng nhập. Chạy lại script khi bạn sẵn sàng.");
  await browser.close();
  process.exit(1);
}

// Chờ thêm chút để cookie phiên đăng nhập được set đầy đủ.
await page.waitForTimeout(2000);

await context.storageState({ path: SESSION_PATH });
console.log(`✅ Đã lưu phiên đăng nhập vào ${SESSION_PATH}`);
console.log("   Giờ chạy: node scripts/shopee-scrape.mjs");

await browser.close();
