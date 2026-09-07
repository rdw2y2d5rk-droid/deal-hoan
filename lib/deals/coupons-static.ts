import type { Coupon } from "./types";

/** Client-safe coupon fallback; no Node.js or server-only imports. */
export function getDailyShopeeCoupons(): Coupon[] {
  const vnTime = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }),
  );
  const dateStr = vnTime.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });

  return [
    { id: "shopee-coupon-toan-san-50k", amount: "50k", unit: "giảm", title: "Shopee — Toàn sàn đơn từ 250k", condition: `HSD 23:59 hôm nay (${dateStr}) · Áp cùng cashback`, code: "SHOPEE50K", color: "orange", category: "toan_san", platform: "Shopee", url: "https://shopee.vn/m/ma-giam-gia" },
    { id: "shopee-coupon-freeship-0d", amount: "Free", unit: "ship", title: "Shopee — Miễn phí vận chuyển toàn quốc", condition: "Giảm tối đa 70k · Đơn từ 0đ · Có hiệu lực ngay", code: "FREESHIP0D", color: "green", category: "freeship", platform: "Shopee", url: "https://shopee.vn/m/ma-giam-gia" },
    { id: "shopee-coupon-live-15", amount: "15%", unit: "giảm", title: "Shopee Live & Video — Giảm sâu", condition: "Giảm tối đa 50k · Áp dụng sản phẩm gắn tag Live/Video", code: "SHOPEELIVE15", color: "black", category: "live", platform: "Shopee", url: "https://shopee.vn/m/ma-giam-gia" },
    { id: "shopee-coupon-mall-100k", amount: "100k", unit: "hoàn xu", title: "Shopee Mall — Công nghệ & Đời sống chính hãng", condition: `Hoàn 10% xu đơn từ 500k · HSD ${dateStr}`, code: "MALLHOAN100", color: "orange", category: "mall", platform: "Shopee Mall", url: "https://shopee.vn/m/ma-giam-gia" },
    { id: "shopee-coupon-dealhoan-30k", amount: "30k", unit: "giảm", title: "Shopee — Đơn hàng đầu tiên & Thành viên mới", condition: "Đơn từ 99k · Không giới hạn ngành hàng", code: "DEALHOAN30", color: "blue", category: "toan_san", platform: "Shopee", url: "https://shopee.vn/m/ma-giam-gia" },
    { id: "shopee-coupon-live-gold-25", amount: "25%", unit: "giảm", title: "Shopee Live — Khung giờ vàng săn sale", condition: `Giảm tối đa 70k đơn từ 150k · Áp dụng hôm nay`, code: "LIVEGOLD25", color: "black", category: "live", platform: "Shopee", url: "https://shopee.vn/m/ma-giam-gia" },
  ];
}
