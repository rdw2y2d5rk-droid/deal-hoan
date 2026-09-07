import { readFile } from "node:fs/promises";
import path from "node:path";
import { hasSupabaseConfig, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { createClient } from "@supabase/supabase-js";
import type { Coupon } from "./types";
import { getDailyShopeeCoupons } from "./coupons-static";

const VOUCHER_CACHE_PATH = path.join(process.cwd(), "lib/deals/cache/shopee-vouchers.json");
const FLASH_SALE_CACHE_PATH = path.join(process.cwd(), "lib/deals/cache/shopee-flash-sale.json");

function getLegacyDailyShopeeCoupons(): Coupon[] {
  const vnTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const dateStr = vnTime.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

  return [
    {
      id: "shopee-coupon-toan-san-50k",
      amount: "50k",
      unit: "giảm",
      title: "Shopee — Toàn sàn đơn từ 250k",
      condition: `HSD 23:59 hôm nay (${dateStr}) · Áp cùng cashback`,
      code: "SHOPEE50K",
      color: "orange",
      category: "toan_san",
      platform: "Shopee",
      url: "https://shopee.vn/m/ma-giam-gia",
    },
    {
      id: "shopee-coupon-freeship-0d",
      amount: "Free",
      unit: "ship",
      title: "Shopee — Miễn phí vận chuyển toàn quốc",
      condition: "Giảm tối đa 70k · Đơn từ 0đ · Có hiệu lực ngay",
      code: "FREESHIP0D",
      color: "green",
      category: "freeship",
      platform: "Shopee",
      url: "https://shopee.vn/m/ma-giam-gia",
    },
    {
      id: "shopee-coupon-live-15",
      amount: "15%",
      unit: "giảm",
      title: "Shopee Live & Video — Giảm sâu",
      condition: `Giảm tối đa 50k · Áp dụng sản phẩm gắn tag Live/Video`,
      code: "SHOPEELIVE15",
      color: "black",
      category: "live",
      platform: "Shopee",
      url: "https://shopee.vn/m/ma-giam-gia",
    },
    {
      id: "shopee-coupon-mall-100k",
      amount: "100k",
      unit: "hoàn xu",
      title: "Shopee Mall — Công nghệ & Đời sống chính hãng",
      condition: `Hoàn 10% xu đơn từ 500k · HSD ${dateStr}`,
      code: "MALLHOAN100",
      color: "orange",
      category: "mall",
      platform: "Shopee Mall",
      url: "https://shopee.vn/m/ma-giam-gia",
    },
    {
      id: "shopee-coupon-dealhoan-30k",
      amount: "30k",
      unit: "giảm",
      title: "Shopee — Đơn hàng đầu tiên & Thành viên mới",
      condition: "Đơn từ 99k · Không giới hạn ngành hàng",
      code: "DEALHOAN30",
      color: "blue",
      category: "toan_san",
      platform: "Shopee",
      url: "https://shopee.vn/m/ma-giam-gia",
    },
    {
      id: "shopee-coupon-live-gold-25",
      amount: "25%",
      unit: "giảm",
      title: "Shopee Live — Khung giờ vàng săn sale",
      condition: `Giảm tối đa 70k đơn từ 150k · Áp dụng hôm nay`,
      code: "LIVEGOLD25",
      color: "black",
      category: "live",
      platform: "Shopee",
      url: "https://shopee.vn/m/ma-giam-gia",
    },
  ];
}

async function readFromSupabase(): Promise<Coupon[] | null> {
  if (!hasSupabaseConfig || !supabaseUrl || !supabasePublishableKey) return null;
  try {
    const sb = createClient(supabaseUrl, supabasePublishableKey);
    const { data, error } = await sb.from("flash_sale_cache").select("data").eq("id", "latest").single();
    if (error || !data) return null;
    if (Array.isArray(data.data?.vouchers) && data.data.vouchers.length > 0) {
      return data.data.vouchers as Coupon[];
    }
    return null;
  } catch {
    return null;
  }
}

export async function getVouchers(): Promise<Coupon[]> {
  // 1. Đọc từ Supabase Cloud (được cập nhật bởi GitHub Actions)
  try {
    const cloudVouchers = await readFromSupabase();
    if (cloudVouchers && cloudVouchers.length > 0) {
      return cloudVouchers;
    }
  } catch {}

  // 2. Đọc từ file cache cục bộ nếu có
  try {
    const raw = await readFile(VOUCHER_CACHE_PATH, "utf-8");
    const local = JSON.parse(raw);
    if (Array.isArray(local) && local.length > 0) return local;
  } catch {}

  try {
    const rawFlash = await readFile(FLASH_SALE_CACHE_PATH, "utf-8");
    const flash = JSON.parse(rawFlash);
    if (Array.isArray(flash?.vouchers) && flash.vouchers.length > 0) return flash.vouchers;
  } catch {}

  // 3. Fallback: Danh sách mã giảm giá Shopee thực tế được tính toán tự động theo ngày hiện tại
  return getDailyShopeeCoupons();
}
