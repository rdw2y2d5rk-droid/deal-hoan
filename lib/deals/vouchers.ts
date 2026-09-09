import { readFile } from "node:fs/promises";
import path from "node:path";
import { hasSupabaseConfig, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { createClient } from "@supabase/supabase-js";
import type { Coupon } from "./types";
import { getDailyShopeeCoupons } from "./coupons-static";

const VOUCHER_CACHE_PATH = path.join(process.cwd(), "lib/deals/cache/shopee-vouchers.json");
const FLASH_SALE_CACHE_PATH = path.join(process.cwd(), "lib/deals/cache/shopee-flash-sale.json");

function getLegacyDailyShopeeCoupons(): Coupon[] {
  return getDailyShopeeCoupons();
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
