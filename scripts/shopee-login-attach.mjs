// Chạy: npm run shopee:login:attach
//
// Cách này dùng khi npm run shopee:login không đăng nhập được (ví dụ Google
// chặn đăng nhập từ trình duyệt do Playwright tự mở). Thay vì để Playwright
// mở và điều khiển Chrome ngay từ đầu, bạn tự mở một cửa sổ Chrome THẬT
// (script chỉ in ra câu lệnh, không tự chạy), tự đăng nhập Shopee bình
// thường (kể cả qua Google) — vì lúc này chưa có gì "điều khiển" cửa sổ đó,
// Google sẽ không thấy dấu hiệu tự động hoá. Sau khi bạn đăng nhập xong,
// script này mới "gắn" vào cửa sổ Chrome đó qua cổng debug để đọc phiên
// đăng nhập ra và lưu lại — không đụng vào mật khẩu của bạn ở bước nào.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_PATH = join(__dirname, "..", ".secrets", "shopee-session.json");
mkdirSync(join(__dirname, "..", ".secrets"), { recursive: true });

const DEBUG_PORT = 9222;
const PROFILE_DIR = "/tmp/shopee-chrome-profile";

console.log(`
👉 Bước 1: Đóng HẾT các cửa sổ Chrome đang mở (kể cả Chrome bạn đang dùng
   hàng ngày) — Chrome không cho mở 2 phiên debug khác nhau cùng lúc.

👉 Bước 2: Mở Terminal MỚI (để cửa sổ này rảnh chạy tiếp bước 3), dán lệnh
   sau rồi Enter:

   open -na "Google Chrome" --args --remote-debugging-port=${DEBUG_PORT} --user-data-dir="${PROFILE_DIR}"

👉 Bước 3: Một cửa sổ Chrome trống mở ra. Vào shopee.vn, đăng nhập bình
   thường (được phép dùng nút "Đăng nhập với Google" ở đây, vì cửa sổ này
   chưa bị script nào điều khiển).

👉 Bước 4: Đăng nhập xong, quay lại đây, nhấn Enter để tiếp tục...
`);

await new Promise((resolve) => process.stdin.once("data", resolve));

console.log("Đang gắn vào Chrome...");

let browser;
try {
  browser = await chromium.connectOverCDP(`http://localhost:${DEBUG_PORT}`);
} catch (err) {
  console.error(`❌ Không gắn được vào Chrome ở cổng ${DEBUG_PORT}.`);
  console.error("   Kiểm tra lại bạn đã chạy đúng lệnh ở Bước 2 chưa, và cửa sổ đó còn mở không.");
  console.error(String(err.message ?? err));
  process.exit(1);
}

const context = browser.contexts()[0];
if (!context) {
  console.error("❌ Không tìm thấy tab nào trong Chrome đó.");
  process.exit(1);
}

const pages = context.pages();
const shopeePage = pages.find((p) => p.url().includes("shopee.vn"));
if (!shopeePage) {
  console.error("❌ Không thấy tab nào đang mở shopee.vn. Mở shopee.vn trong cửa sổ đó rồi thử lại.");
  process.exit(1);
}

if (shopeePage.url().includes("/buyer/login")) {
  console.error("⚠️  Tab shopee.vn vẫn đang ở trang đăng nhập — có vẻ bạn chưa đăng nhập xong.");
  process.exit(1);
}

await context.storageState({ path: SESSION_PATH });
console.log(`✅ Đã lưu phiên đăng nhập vào ${SESSION_PATH}`);
console.log("   Giờ chạy: npm run shopee:scrape");
console.log("\n(Cửa sổ Chrome debug vẫn mở, bạn có thể đóng nó đi giờ.)");

await browser.close();
process.exit(0);
