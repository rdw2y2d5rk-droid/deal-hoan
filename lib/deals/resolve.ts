import { buildShopeeAffiliateUrl, cleanShopeeUrl, isShopeeUrl } from "./affiliate";
import { cashbackFor } from "./score";
import type { Deal, Platform } from "./types";

export type CalculatedProduct = {
  name: string;
  imageUrl: string | null;
  price: number;
  originalPrice: number;
  cashback: number;
  platform: string;
  seller?: string;
  trackedLink?: string;
  discountPercent?: number;
  savingsPercent?: number;
  isVerifiedPrice?: boolean;
  priceType?: "exact" | "estimated" | "user_input";
};

export const SAMPLE_CHIP_PRODUCTS: Record<string, CalculatedProduct> = {
  "https://shopee.vn/tai-nghe-sony": {
    name: "Tai nghe Bluetooth chống ồn Sony WF-C710N",
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
    price: 1540000,
    originalPrice: 1990000,
    cashback: 77000,
    platform: "Shopee Mall",
    seller: "Sony Official Store",
    discountPercent: 23,
    savingsPercent: 26,
  },
  "https://vt.tiktok.com/ZS8abcd/": {
    name: "Áo thun cotton unisex form rộng phong cách Hàn Quốc",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
    price: 189000,
    originalPrice: 290000,
    cashback: 11000,
    platform: "TikTok Shop",
    seller: "Trendy Clothing VN",
    discountPercent: 35,
    savingsPercent: 39,
  },
  "https://lazada.vn/products/sony": {
    name: "Loa Bluetooth Sony SRS-XB13 Extra Bass chống nước IP67",
    imageUrl: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80",
    price: 890000,
    originalPrice: 1290000,
    cashback: 45000,
    platform: "Lazada",
    seller: "Sony Flagship Store",
    discountPercent: 31,
    savingsPercent: 34,
  },
};

export const CATEGORY_FALLBACKS: Array<{
  keywords: string[];
  imageUrl: string;
  nameFallback: string;
  defaultPrice: number;
  defaultOriginalPrice: number;
}> = [
  {
    keywords: ["bàn phím", "ban phim", "keyboard", "aula", "dareu", "akko"],
    imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
    nameFallback: "Bàn phím cơ gaming",
    defaultPrice: 790000,
    defaultOriginalPrice: 1190000,
  },
  {
    keywords: ["chuột", "chuot", "mouse", "logitech", "razer"],
    imageUrl: "https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=800&q=80",
    nameFallback: "Chuột không dây công thái học",
    defaultPrice: 279000,
    defaultOriginalPrice: 430000,
  },
  {
    keywords: ["tai nghe", "headphone", "earphone", "airpod", "sony", "marshall"],
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
    nameFallback: "Tai nghe không dây chống ồn",
    defaultPrice: 1540000,
    defaultOriginalPrice: 1990000,
  },
  {
    keywords: ["loa", "speaker", "soundbar", "jbl"],
    imageUrl: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80",
    nameFallback: "Loa Bluetooth di động",
    defaultPrice: 890000,
    defaultOriginalPrice: 1290000,
  },
  {
    keywords: ["điện thoại", "dien thoai", "phone", "iphone", "samsung", "xiaomi"],
    imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80",
    nameFallback: "Điện thoại thông minh",
    defaultPrice: 8990000,
    defaultOriginalPrice: 11990000,
  },
  {
    keywords: ["laptop", "macbook", "máy tính", "may tinh"],
    imageUrl: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80",
    nameFallback: "Laptop văn phòng / đồ hoạ",
    defaultPrice: 16900000,
    defaultOriginalPrice: 20500000,
  },
  {
    keywords: ["đồng hồ", "dong ho", "watch", "smartwatch", "amazfit"],
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
    nameFallback: "Đồng hồ thông minh theo dõi sức khoẻ",
    defaultPrice: 1490000,
    defaultOriginalPrice: 2190000,
  },
  {
    keywords: ["nồi chiên", "noi chien", "nồi", "noi", "bếp", "bep", "philips"],
    imageUrl: "https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=800&q=80",
    nameFallback: "Nồi chiên không dầu điện tử",
    defaultPrice: 1890000,
    defaultOriginalPrice: 2790000,
  },
  {
    keywords: ["robot", "hút bụi", "hut bui", "vacuum"],
    imageUrl: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=800&q=80",
    nameFallback: "Robot hút bụi lau nhà tự động",
    defaultPrice: 3290000,
    defaultOriginalPrice: 4990000,
  },
  {
    keywords: ["áo", "ao", "quần", "quan", "váy", "vay", "đầm", "dam", "túi", "tui", "uniqlo"],
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
    nameFallback: "Thời trang nam nữ cao cấp",
    defaultPrice: 189000,
    defaultOriginalPrice: 290000,
  },
  {
    keywords: ["giày", "giay", "dép", "dep", "sneaker", "nike"],
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
    nameFallback: "Giày thể thao êm chân",
    defaultPrice: 890000,
    defaultOriginalPrice: 1450000,
  },
  {
    keywords: ["mỹ phẩm", "my pham", "kem", "son", "serum", "sữa rửa mặt", "cerave", "skin1004"],
    imageUrl: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=800&q=80",
    nameFallback: "Sản phẩm chăm sóc da chính hãng",
    defaultPrice: 295000,
    defaultOriginalPrice: 420000,
  },
  {
    keywords: ["bình giữ nhiệt", "binh giu nhiet", "hộp cơm", "hop com", "lock&lock"],
    imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80",
    nameFallback: "Bình giữ nhiệt inox cao cấp",
    defaultPrice: 229000,
    defaultOriginalPrice: 390000,
  },
  {
    keywords: ["sạc", "sac", "cáp", "cap", "pin", "anker"],
    imageUrl: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80",
    nameFallback: "Bộ sạc nhanh công nghệ GaN",
    defaultPrice: 186000,
    defaultOriginalPrice: 300000,
  },
];

export function parseSlugFromUrl(rawUrl: string): string | null {
  try {
    const trimmed = rawUrl.trim();
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const pathname = decodeURIComponent(u.pathname);
    const parts = pathname.split("/").filter(Boolean);
    if (!parts.length) return null;
    let s = parts[0];
    if (s === "product" && parts.length > 2) {
      return `Sản phẩm Shopee #${parts[2]}`;
    } else if (s === "product" && parts.length > 1) {
      return `Sản phẩm #${parts[1]}`;
    } else if ((s === "products" || s === "p") && parts.length > 1) {
      s = parts[1];
    }
    s = s.replace(/-i\.\d+\.\d+.*$/, "");
    s = s.replace(/-i\d+.*$/, "");
    s = s.replace(/\.html.*$/, "");
    const clean = s.replace(/[-_+]/g, " ").replace(/\s+/g, " ").trim();
    return clean || null;
  } catch {
    return null;
  }
}

export function matchProductFromCatalog(rawUrl: string, deals: Deal[] = []): CalculatedProduct | null {
  const trimmed = rawUrl.trim();
  if (SAMPLE_CHIP_PRODUCTS[trimmed]) {
    return { ...SAMPLE_CHIP_PRODUCTS[trimmed] };
  }

  const cleanUrl = cleanShopeeUrl(trimmed);
  for (const d of deals) {
    if (d.productUrl && d.productUrl !== "#" && (d.productUrl === trimmed || cleanShopeeUrl(d.productUrl) === cleanUrl)) {
      return {
        name: d.name,
        imageUrl: d.imageUrl,
        price: d.price,
        originalPrice: d.originalPrice,
        cashback: d.cashback,
        platform: d.platform,
        seller: d.seller,
        discountPercent: d.discountPercent,
      };
    }
  }

  const slug = parseSlugFromUrl(trimmed);
  if (slug) {
    const slugLower = slug.toLowerCase();
    const slugWords = slugLower.split(" ").filter((w) => w.length > 2);
    for (const d of deals) {
      const dealNameLower = d.name.toLowerCase();
      const matchCount = slugWords.filter((w) => dealNameLower.includes(w)).length;
      if (matchCount >= 2 || (slugWords.length === 1 && matchCount === 1)) {
        return {
          name: slug.length > d.name.length ? slug : d.name,
          imageUrl: d.imageUrl,
          price: d.price,
          originalPrice: d.originalPrice,
          cashback: d.cashback,
          platform: d.platform,
          seller: d.seller,
          discountPercent: d.discountPercent,
        };
      }
    }
  }

  return null;
}

export function resolveProductLocally(rawUrl: string, deals: Deal[] = []): CalculatedProduct {
  const matched = matchProductFromCatalog(rawUrl, deals);
  if (matched) return matched;

  const trimmed = rawUrl.trim();
  const isShopee = isShopeeUrl(trimmed);
  const platform: Platform = trimmed.toLowerCase().includes("tiktok")
    ? "TikTok Shop"
    : trimmed.toLowerCase().includes("lazada")
      ? "Lazada"
      : isShopee
        ? "Shopee Mall"
        : "Shopee";

  const slug = parseSlugFromUrl(trimmed);
  const name = slug
    ? slug.charAt(0).toUpperCase() + slug.slice(1)
    : "Sản phẩm được hoàn tiền";

  const nameLower = name.toLowerCase();
  const categoryMatch = CATEGORY_FALLBACKS.find((cat) =>
    cat.keywords.some((k) => nameLower.includes(k) || trimmed.toLowerCase().includes(k)),
  );

  const imageUrl =
    categoryMatch?.imageUrl ||
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80";

  const price = categoryMatch?.defaultPrice || 450000;
  const originalPrice = categoryMatch?.defaultOriginalPrice || Math.round((price * 1.35) / 1000) * 1000;
  const cashback = cashbackFor(price, platform);

  return {
    name: slug ? name : categoryMatch?.nameFallback || "Sản phẩm săn deal hoàn tiền",
    imageUrl,
    price,
    originalPrice,
    cashback,
    platform,
    discountPercent: Math.round(((originalPrice - price) / originalPrice) * 100),
  };
}
