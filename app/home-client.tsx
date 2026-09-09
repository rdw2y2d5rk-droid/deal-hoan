"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import type { User } from "@supabase/supabase-js";
import AccountModal from "@/app/components/account-modal";
import { formatPrice, formatSold } from "@/lib/deals/format";
import type { Deal, DealBundle, Coupon, CouponCategory, Platform } from "@/lib/deals/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildShopeeAffiliateUrl,
  isShopeeUrl,
  buildCustomShortUrl,
  extractUrlFromText,
} from "@/lib/deals/affiliate";
import { cashbackFor } from "@/lib/deals/score";
import { resolveProductLocally, matchProductFromCatalog, SAMPLE_CHIP_PRODUCTS, type CalculatedProduct } from "@/lib/deals/resolve";

/**
 * Tabs over "Deal hot hôm nay". Every sort is backed by a field the marketplace
 * actually reports, so no tab implies data we do not have.
 */
/**
 * The card grids must never imply a marketplace they did not come from, so the
 * live source is stated next to them.
 */
const SOURCE_NOTE: Record<DealBundle["source"], string> = {
  shopee: "Dữ liệu thật từ Shopee Affiliate API · cập nhật mỗi 15 phút.",
  "shopee-scrape":
    "Dữ liệu thật cào trực tiếp từ Shopee (phiên đăng nhập cục bộ) · hoàn tiền là ước tính, chưa gắn link affiliate thật.",
  accesstrade:
    "Dữ liệu thật từ AccessTrade (Shopee · Lazada · TikTok Shop) · cập nhật mỗi 15 phút.",
  lazada:
    "Dữ liệu thật từ Lazada · cập nhật mỗi 15 phút. Chưa cắm khoá Shopee Affiliate.",
  seed: "Đang hiển thị dữ liệu mẫu — chưa cắm khoá API của sàn nào.",
};

const HOT_TABS = [
  "Tất cả",
  "Cashback cao",
  "Giảm sâu",
  "Đánh giá cao",
  "Đang được săn",
] as const;

const HOT_SORTERS: ((a: Deal, b: Deal) => number)[] = [
  (a, b) => b.dealScore - a.dealScore,
  (a, b) => b.cashback - a.cashback,
  (a, b) => b.discountPercent - a.discountPercent,
  (a, b) => b.ratingAverage - a.ratingAverage || b.reviewCount - a.reviewCount,
  (a, b) => (b.sold ?? 0) - (a.sold ?? 0),
];

const COUPON_TABS: { key: CouponCategory; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "toan_san", label: "Toàn sàn" },
  { key: "freeship", label: "Freeship 0đ" },
  { key: "vip", label: "Gói Shopee VIP" },
  { key: "mall", label: "Shopee Mall" },
  { key: "live", label: "Shopee Live" },
];

function LazadaLogo({ color = "#0F4C81" }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20.2C6.8 16 4.4 13.2 4.4 10.2A4 4 0 0 1 12 8.4a4 4 0 0 1 7.6 1.8c0 3-2.4 5.8-7.6 10Z"
        fill={color}
      />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="deal-fav-icon"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? "1.5" : "2"}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function Receipt({
  platform = "Shopee Mall",
  product,
  trackedLink,
  copied,
  onCopy,
  onBuy,
  onClear,
}: {
  platform?: string;
  product?: CalculatedProduct | null;
  trackedLink?: string;
  copied?: boolean;
  onCopy?: () => void;
  onBuy?: () => void;
  onClear?: () => void;
}) {
  const price = product?.price ?? 1540000;
  const originalPrice = product?.originalPrice ?? 1990000;
  const cashback = product?.cashback ?? 77000;
  const actualCost = price - cashback;
  const savingsPercent =
    product?.savingsPercent ??
    (price > 0 ? Math.round((cashback / price) * 100) : 5);
  const productName = product?.name || "Tai nghe Bluetooth chống ồn Sony WF-C710N";
  const productImg = product?.imageUrl || null;
  const displayPlatform = product?.platform || platform;

  return (
    <div className="receipt">
      <div className="receipt-head">
        <b>⚡ Hoàn tiền cho link của bạn</b>
        <span>{displayPlatform}</span>
      </div>
      <div className="receipt-product">
        <div className="placeholder small">
          {productImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={productImg}
              alt={productName}
              className="deal-image"
              loading="lazy"
            />
          ) : (
            "ảnh SP"
          )}
        </div>
        <div>
          <b>{productName}</b>
          <p>
            {displayPlatform} {product?.seller ? `· ${product.seller}` : ""} ·{" "}
            <em className="green">
              Hoàn đến {price > 0 ? ((cashback / price) * 100).toFixed(0) : "5"}%
            </em>
          </p>
        </div>
      </div>
      <div className="price-lines">
        {originalPrice > price && (
          <div>
            <span>Giá niêm yết</span>
            <s>{formatPrice(originalPrice)}</s>
          </div>
        )}
        <hr />
        <div className="total">
          <b>Thanh toán hôm nay</b>
          <strong>{formatPrice(price)}</strong>
        </div>
        <div>
          <span>
            {product?.isExactCashback ? "Hoàn tiền đến" : "Hoàn về ví"}{" "}
            <b className="green">sau 14–15 ngày</b>
          </span>
          <b className="green">+{formatPrice(cashback)}</b>
        </div>
        <div className="actual-cost">
          <b>Chi phí thực sau khi nhận hoàn</b>
          <span>
            <strong>{formatPrice(actualCost)}</strong>
            <em>tiết kiệm {savingsPercent}%</em>
          </span>
        </div>
      </div>
      {trackedLink && (
        <div className="tracked-link">
          <span>
            <small>Link mới</small>
            <a
              href={trackedLink}
              target="_blank"
              rel="noopener noreferrer"
              className="tracked-url"
              title="Nhấp để mở link hoặc bấm Copy link"
            >
              <b>{trackedLink}</b>
            </a>
          </span>
          <button className={copied ? "is-copied" : ""} onClick={onCopy}>
            {copied ? "✓ Đã copy" : "Copy link"}
          </button>
        </div>
      )}
      <button className="primary wide" onClick={onBuy}>
        Mua ngay &amp; Nhận hoàn tiền →
      </button>
      {onClear && (
        <div className="receipt-foot">
          <span>
            Mua qua link mới hoặc nút trên — ghi nhận trong 24 giờ, nhận hoàn
            sau 14–15 ngày · <a href="#how">điều kiện</a>
          </span>
          <button className="result-reset" onClick={onClear}>Tính link khác</button>
        </div>
      )}
    </div>
  );
}

function DemoReceipt() {
  return (
    <div className="demo-receipt" aria-label="Minh hoạ cách tính hoàn tiền">
      <div className="demo-receipt-head">
        <b>Bạn thực trả bao nhiêu?</b>
        <span>🔥 Deal Score 94</span>
      </div>
      <div className="demo-receipt-product">
        <div className="placeholder demo-image">ảnh SP</div>
        <div>
          <b>Tai nghe Bluetooth chống ồn Sony WF-C710N</b>
          <p>
            Shopee Mall · <em>còn 6 giờ</em>
          </p>
        </div>
      </div>
      <div className="demo-price-lines">
        <div>
          <span>Giá niêm yết</span>
          <s>1.990.000đ</s>
        </div>
        <div>
          <span>Giảm giá sàn</span>
          <b>−400.000đ</b>
        </div>
        <div>
          <span>
            Mã <code>DEALHOAN50</code>
          </span>
          <b>−50.000đ</b>
        </div>
        <hr />
        <div className="demo-total">
          <b>Thanh toán hôm nay</b>
          <strong>1.540.000đ</strong>
        </div>
        <div>
          <span>
            Hoàn về ví <b>sau 14–15 ngày</b>
          </span>
          <b className="green">+77.000đ</b>
        </div>
      </div>
      <div className="demo-actual-cost">
        <b>Chi phí thực sau khi nhận hoàn</b>
        <span>
          <strong>1.463.000đ</strong>
          <em>tiết kiệm 26%</em>
        </span>
      </div>
      <div className="primary demo-btn" aria-hidden="true">
        Mua ngay &amp; Nhận hoàn tiền →
      </div>
      <p className="demo-receipt-foot">
        Ghi nhận trong 24 giờ · nhận hoàn sau 14–15 ngày · điều kiện
      </p>
    </div>
  );
}
function getNextShopeeSlotEndMs(): number {
  const now = new Date();
  const vnTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const vnHour = vnTime.getHours();

  // Các mốc chuyển khung giờ Flash Sale của Shopee: 2, 9, 12, 15, 17, 21, 24 (0h)
  const slotHours = [2, 9, 12, 15, 17, 21, 24];
  const nextHour = slotHours.find((h) => h > vnHour) ?? 24;

  const target = new Date(vnTime);
  target.setHours(nextHour, 0, 0, 0);

  const diffMs = target.getTime() - vnTime.getTime();
  return Date.now() + diffMs;
}

export default function HomeClient({
  flashDeals,
  hotDeals,
  vouchers: initialVouchers,
  source,
  flashEndTime,
  flashSlot,
}: {
  flashDeals: Deal[];
  hotDeals: Deal[];
  vouchers?: Coupon[];
  source: DealBundle["source"];
  flashEndTime?: number;
  flashSlot?: string;
}) {
  const linkInputRef = useRef<HTMLInputElement>(null);
  const flashScrollRef = useRef<HTMLDivElement>(null);
  const isFlashHoveredRef = useRef(false);
  const flashPauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const pauseFlash = (ms = 6000) => {
    isFlashHoveredRef.current = true;
    if (flashPauseTimeoutRef.current) clearTimeout(flashPauseTimeoutRef.current);
    flashPauseTimeoutRef.current = setTimeout(() => {
      isFlashHoveredRef.current = false;
    }, ms);
  };
  const [link, setLink] = useState("");
  const [result, setResult] = useState("");
  const [resultClosing, setResultClosing] = useState(false);
  const [savedDealIds, setSavedDealIds] = useState<string[]>([]);
  const [tab, setTab] = useState(0);
  const [couponTab, setCouponTab] = useState<CouponCategory>("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const allCoupons = initialVouchers && initialVouchers.length > 0 ? initialVouchers : [];
  const displayedCoupons =
    couponTab === "all"
      ? allCoupons
      : allCoupons.filter((c) => c.category === couponTab);


  const [seconds, setSeconds] = useState(() => {
    const endMs = flashEndTime && flashEndTime > Date.now() ? flashEndTime : getNextShopeeSlotEndMs();

    return Math.max(0, Math.floor((endMs - Date.now()) / 1000));
  });
  const [busy, setBusy] = useState(false);
  const [calcTimer, setCalcTimer] = useState(0);
  const [inputError, setInputError] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const [trackedLink, setTrackedLink] = useState("");
  const [copiedTracked, setCopiedTracked] = useState(false);
  const [calculatedProduct, setCalculatedProduct] = useState<CalculatedProduct | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyDontShow, setBuyDontShow] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authPending, setAuthPending] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);

  const fetchUserBalance = () => {
    fetch("/api/wallet")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.wallet && typeof data.wallet.balance === "number") {
          setUserBalance(data.wallet.balance);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    fetch("/api/wallet")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data?.wallet && typeof data.wallet.balance === "number") {
          setUserBalance(data.wallet.balance);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const interval = setInterval(() => {
      setCalcTimer((Date.now() - start) / 1000);
    }, 100);
    return () => {
      clearInterval(interval);
      setCalcTimer(0);
    };
  }, [busy]);

  useEffect(() => {
    const tick = () => {
      const endMs = flashEndTime && flashEndTime > Date.now() ? flashEndTime : getNextShopeeSlotEndMs();
      setSeconds(Math.max(0, Math.floor((endMs - Date.now()) / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [flashEndTime]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (isFlashHoveredRef.current) return;
      const el = flashScrollRef.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max > 0)
        el.scrollTo({
          left:
            el.scrollLeft >= max - 10 ? 0 : Math.min(el.scrollLeft + 246, max),
          behavior: "smooth",
        });
    }, 4500);
    return () => {
      clearInterval(timer);
      if (flashPauseTimeoutRef.current) clearTimeout(flashPauseTimeoutRef.current);
    };
  }, []);
  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2400);
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dealhoan_favorite_deal_ids");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedDealIds(parsed.map(String));
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const toggleFavoriteDeal = (deal: Deal, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const dealId = String(deal.id);
    const exists = savedDealIds.includes(dealId);
    const nextIds = exists
      ? savedDealIds.filter((id) => id !== dealId)
      : [...savedDealIds, dealId];

    setSavedDealIds(nextIds);

    try {
      localStorage.setItem("dealhoan_favorite_deal_ids", JSON.stringify(nextIds));

      const rawDeals = localStorage.getItem("dealhoan_favorite_deals");
      let storedDeals: Deal[] = [];
      if (rawDeals) {
        try {
          const parsed = JSON.parse(rawDeals);
          if (Array.isArray(parsed)) storedDeals = parsed;
        } catch {
          storedDeals = [];
        }
      }

      if (exists) {
        storedDeals = storedDeals.filter((d) => String(d?.id) !== dealId);
      } else {
        storedDeals = [deal, ...storedDeals.filter((d) => String(d?.id) !== dealId)].slice(0, 100);
      }
      localStorage.setItem("dealhoan_favorite_deals", JSON.stringify(storedDeals));
    } catch {
      // ignore localStorage errors
    }

    notify(
      exists
        ? "Đã bỏ lưu deal"
        : "❤️ Đã lưu deal vào danh sách yêu thích",
    );
  };
  const signInWithGoogle = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Đang mở tài khoản Demo để trải nghiệm chức năng ví & rút tiền...");
      const demoUser = {
        id: "demo-user-123",
        email: "demo@dealhoan.vn",
        app_metadata: {},
        user_metadata: {
          full_name: "Nguyễn Văn Demo",
          name: "Nguyễn Văn Demo",
          avatar_url: "",
        },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as User;
      setUser(demoUser);
      setAccountOpen(true);
      return;
    }

    setAuthPending(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setAuthPending(false);
      notify("Không thể mở đăng nhập Google. Vui lòng thử lại.");
    }
  };
  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setUser(null);
      setUserBalance(null);
      notify("Đã đăng xuất tài khoản Demo");
      return;
    }

    setAuthPending(true);
    const { error } = await supabase.auth.signOut();
    setAuthPending(false);
    if (error) return notify("Không thể đăng xuất. Vui lòng thử lại.");
    setUser(null);
    setUserBalance(null);
    notify("Đã đăng xuất");
  };
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUser(data.user);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  const getAffiliateUrl = (url?: string | null) => {
    if (!url) return "https://shopee.vn";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://dealhoan.vn";
    const subId = user ? `u_${user.id.slice(0, 8)}` : "dealhoan";
    return buildCustomShortUrl(url, { baseUrl, subId });
  };

  const executeCalculation = async (targetUrl: string) => {
    const rawClean = extractUrlFromText(targetUrl);
    const trimmed = (rawClean || targetUrl).trim();
    if (!trimmed) {
      setInputError(true);
      setTimeout(() => setInputError(false), 600);
      setTimeout(() => {
        (document.activeElement as HTMLElement | null)?.blur();
      }, 1000);
      return notify("Dán link sản phẩm trước đã nhé 🙂");
    }

    if (rawClean && rawClean !== targetUrl) {
      setLink(rawClean);
    }

    (document.activeElement as HTMLElement | null)?.blur();
    setBusy(true);

    const subId = user ? `u_${user.id.slice(0, 8)}` : "calc";

    // 1. If it is a sample chip demo (e.g. clicked chip buttons), display immediately
    if (SAMPLE_CHIP_PRODUCTS[trimmed]) {
      const chipProduct = SAMPLE_CHIP_PRODUCTS[trimmed];
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://dealhoan.vn";
      const localTracked = buildCustomShortUrl(trimmed, { baseUrl, subId });
      setCalculatedProduct(chipProduct);
      setTrackedLink(localTracked);
      setCopiedTracked(false);
      setResultClosing(false);
      setResult(chipProduct.platform);
      setBusy(false);
      notify("Đã tính xong — đã gắn mã hoàn tiền 100% DealHoàn");
      return;
    }

    // 2. For pasted/entered links: reset previous receipt so no stale/old price is shown
    if (result) {
      setResult("");
      setCalculatedProduct(null);
    }

    // 3. Wait until server returns ALL real data before dropping down receipt
    const allAvailableDeals = [...hotDeals, ...flashDeals];
    try {
      const res = await fetch("/api/deals/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, subId }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.product) {
          // Set full data first
          setCalculatedProduct(data.product);
          if (data.trackedLink) {
            setTrackedLink(data.trackedLink);
          }
          setCopiedTracked(false);
          setResultClosing(false);
          // ONLY drop down the receipt after all data is completely ready
          setResult(data.product.platform);
        }
      } else {
        throw new Error("Server resolve failed");
      }
    } catch {
      // Fallback only if server request completely fails
      const localProduct = resolveProductLocally(trimmed, allAvailableDeals);
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://dealhoan.vn";
      const localTracked = buildCustomShortUrl(trimmed, { baseUrl, subId });
      setCalculatedProduct(localProduct);
      setTrackedLink(localTracked);
      setCopiedTracked(false);
      setResultClosing(false);
      setResult(localProduct.platform);
    } finally {
      setBusy(false);
      notify("Đã tính xong — đã gắn mã hoàn tiền 100% DealHoàn");
    }
  };

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    executeCalculation(link);
  };
  const visibleHotDeals = [...hotDeals].sort(HOT_SORTERS[tab]);
  const tm = [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ].map((x) => String(x).padStart(2, "0"));
  return (
    <main>
      <div className="utility">
        <div className="container">
          <div className="utility-left">
            <span>Hoàn tiền từ Shopee · TikTok Shop · Lazada</span>
            <a href="#how">Cách hoạt động</a>
            <a href="#faq">Câu hỏi thường gặp</a>
          </div>
          <div className="utility-right">
            <a>Tải app</a>
            <a className="mint" href="#referral">
              Mời bạn — nhận hoa hồng
            </a>
          </div>
        </div>
      </div>
      <header>
        <div className="container nav">
          <Link className="brand" href="/" title="DealHoàn — dán link, nhận hoàn tiền">
            <span className="brand-mark" aria-hidden="true">
              <img src="/brand/deal-hoan-mark.png" alt="" />
            </span>
            <span className="brand-wordmark">
              <img src="/brand/deal-hoan-logo.png" alt="DealHoàn — Săn deal · Hoàn tiền" />
            </span>
          </Link>
          <form className="search" onSubmit={calc}>
            <span>⌕</span>
            <input placeholder="Tìm sản phẩm, deal, mã giảm giá…" />
            <button>Tìm deal</button>
          </form>
          <nav>
            <a className="active" href="#deals">
              Deal hot
            </a>
            <a href="#coupons">Mã giảm giá</a>
            <a href="#how">Cashback</a>
          </nav>
          <div className="account">
            {user ? (
              <>
                <button
                  type="button"
                  className="account-wallet-btn"
                  onClick={() => setAccountOpen(true)}
                  title="Mở ví hoàn tiền & rút tiền"
                >
                  <span className="account-avatar">
                    {user.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="" />
                    ) : (
                      (user.user_metadata?.full_name || user.email || "U").charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="account-name">
                    {String(user.user_metadata?.full_name ?? user.email ?? "Tài khoản").split(" ")[0]}
                  </span>
                  <span className="account-balance-tag">
                    {userBalance !== null ? `${userBalance.toLocaleString("vi-VN")}đ` : "Ví tiền"}
                  </span>
                </button>
                <button disabled={authPending} onClick={signOut} className="account-logout-btn">
                  {authPending ? "…" : "Đăng xuất"}
                </button>
              </>
            ) : (
              <button disabled={authPending} onClick={signInWithGoogle} className="account-login-btn">
                {authPending ? (
                  "Đang mở…"
                ) : (
                  <>
                    <span className="auth-btn-desktop">Đăng nhập Google</span>
                    <span className="auth-btn-mobile">Đăng nhập</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </header>
      <section className="hero">
        <i className="orb peach" />
        <i className="orb mint-orb" />
        <div className="container hero-inner">
          <div className="badge">
            <i />
            1.248 deal mới hôm nay
          </div>
          <h1>
            Dán link sản phẩm,
            <br />
            biết ngay <span>tiền được hoàn</span>
          </h1>
          <p>
            Tự áp mã, so giá và tính sẵn{" "}
            <b>chi phí thực sau hoàn tiền</b> trước khi mua.
          </p>
          <form
            className={`calculator ${inputError ? "input-error" : ""} ${link ? "has-link" : ""}`}
            onSubmit={calc}
          >
            <i>🔗</i>
            <input
              ref={linkInputRef}
              value={link}
              onChange={(e) => {
                const nextLink = e.target.value;
                setLink(nextLink);
                if (!nextLink.trim() && result && !resultClosing) {
                  setResultClosing(true);
                  setTimeout(() => {
                    setResult("");
                    setCalculatedProduct(null);
                    setResultClosing(false);
                  }, 420);
                }
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData?.getData("text") || "";
                const extracted = extractUrlFromText(pasted);
                if (extracted && extracted !== pasted) {
                  e.preventDefault();
                  setLink(extracted);
                }
                requestAnimationFrame(() => {
                  if (linkInputRef.current) linkInputRef.current.scrollLeft = 0;
                });
              }}
              placeholder="Dán link sản phẩm Shopee, TikTok Shop hoặc Lazada…"
            />
            {link && (
              <button
                type="button"
                className="calculator-clear"
                aria-label="Xoá link"
                onClick={() => {
                  setLink("");
                  if (result && !resultClosing) {
                    setResultClosing(true);
                    setTimeout(() => {
                      setResult("");
                      setCalculatedProduct(null);
                      setResultClosing(false);
                    }, 420);
                  }
                  linkInputRef.current?.focus();
                }}
              >
                ×
              </button>
            )}
            <button
              type="submit"
              className={`primary ${busy ? "is-calculating" : ""}`}
              disabled={busy}
            >
              {busy ? (
                <span className="calculating-content">
                  <span className="calc-spinner" aria-hidden="true" />
                  <span>Đang tính…</span>
                  <span className="calc-timer-tag">{calcTimer.toFixed(1)}s</span>
                </span>
              ) : (
                "⚡ Tính hoàn tiền"
              )}
            </button>
          </form>
          {result && (
            <div
              className={`result-collapse ${resultClosing ? "is-closing" : ""}`}
            >
              <div className="result-clip">
                <div
                  className={`result ${resultClosing ? "result-closing" : ""}`}
                >
                  <Receipt
                    platform={result}
                    product={calculatedProduct}
                    trackedLink={trackedLink}
                    copied={copiedTracked}
                    onCopy={() => {
                      navigator.clipboard?.writeText(trackedLink);
                      setCopiedTracked(true);
                      try {
                        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
                      } catch {}
                      setTimeout(() => setCopiedTracked(false), 1500);
                      notify("Đã copy link hoàn tiền");
                    }}
                    onBuy={() => {
                      if (buyDontShow) {
                        window.open(
                          trackedLink || (link ? getAffiliateUrl(link) : "https://shopee.vn"),
                          "_blank",
                          "noopener",
                        );
                        notify(
                          `Đã mở ${result} — ghi nhận trong 24 giờ, nhận hoàn sau 14–15 ngày`,
                        );
                      } else setBuyOpen(true);
                    }}
                    onClear={() => {
                      if (resultClosing) return;
                      setResultClosing(true);
                      setTimeout(() => {
                        setLink("");
                        setResult("");
                        setCalculatedProduct(null);
                        setResultClosing(false);
                        linkInputRef.current?.focus();
                      }, 420);
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          <div className="chips">
            <span className="chips-label">Hỗ trợ:</span>
            <button
              type="button"
              onClick={() => {
                const sample = "https://shopee.vn/tai-nghe-sony";
                setLink(sample);
                executeCalculation(sample);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M6.6 8.4h10.8L18.5 19a1.8 1.8 0 0 1-1.8 2H7.3A1.8 1.8 0 0 1 5.5 19zM9 8.2V6.8a3 3 0 0 1 6 0v1.4"
                  stroke="#EE4D2D"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Shopee
            </button>
            <button
              type="button"
              onClick={() => {
                const sample = "https://vt.tiktok.com/ZS8abcd/";
                setLink(sample);
                executeCalculation(sample);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M13.2 15.5V4.8c.7 1.9 2.4 3.5 4.6 3.8"
                  stroke="#171717"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle
                  cx="9.7"
                  cy="15.9"
                  r="3.5"
                  stroke="#171717"
                  strokeWidth="2.4"
                />
              </svg>
              TikTok Shop
            </button>
            <button
              type="button"
              onClick={() => {
                const sample = "https://lazada.vn/products/sony";
                setLink(sample);
                executeCalculation(sample);
              }}
            >
              <LazadaLogo />
              Lazada
            </button>
          </div>
          <div className="live" aria-label="Hoạt động hoàn tiền trực tiếp">
            <b>
              <i />
              LIVE
            </b>
            <div className="live-ticker">
              <div className="live-ticker-items">
                <span>
                  Minh T. vừa nhận hoàn <strong>86.000đ</strong> từ Shopee
                </span>
                <span>
                  Hằng N. vừa nhận hoàn <strong>42.500đ</strong> từ TikTok Shop
                </span>
                <span>
                  Quốc B. vừa nhận hoàn <strong>129.000đ</strong> từ Lazada
                </span>
                <span>
                  Thảo V. vừa nhận hoàn <strong>58.000đ</strong> từ Shopee
                </span>
                <span>
                  Minh T. vừa nhận hoàn <strong>86.000đ</strong> từ Shopee
                </span>
              </div>
            </div>
          </div>
          <div className="stats">
            <div>
              <b>2,1 tỷ đ</b>
              <span className="stats-desc">
                đã hoàn cho<br className="stats-br" /> người dùng
              </span>
            </div>
            <hr />
            <div>
              <b>380k+</b>
              <span className="stats-desc">
                thành viên<br className="stats-br" /> săn deal
              </span>
            </div>
            <hr />
            <div>
              <b>3 sàn</b>
              <span className="stats-desc">
                Shopee · TikTok ·<br className="stats-br" /> Lazada
              </span>
            </div>
          </div>
        </div>
        <div className="container platforms">
          {[
            ["Shopee", "8.240", "12%", "orange"],
            ["TikTok Shop", "5.130", "10%", "dark"],
            ["Lazada", "3.960", "9%", "blue"],
          ].map((p, i) => (
            <a className="platform" key={p[1]}>
              <i className={`${p[3]} platform-${i}`}>
                {i === 0 && <span className="sr-only">Shopee</span>}
                {i === 1 && (
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M13.2 15.5V4.8c.7 1.9 2.4 3.5 4.6 3.8"
                      stroke="#fff"
                      strokeWidth="2.3"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="9.7"
                      cy="15.9"
                      r="3.5"
                      stroke="#fff"
                      strokeWidth="2.3"
                    />
                  </svg>
                )}
                {i === 2 && <LazadaLogo />}
              </i>
              <span>
                <b>{p[0]}</b>
                <small>{p[1]} deal đang mở</small>
              </span>
              <em>Hoàn đến {p[2]}</em>
            </a>
          ))}
        </div>
      </section>
      <section className="container flash-section">
        <div className="flash">
          <div className="flash-top">
            <div className="flash-top-left">
              <h2>⚡ Deal chớp nhoáng</h2>
              <div className="flash-countdown-group">
                {flashSlot && (
                  <span className="flash-slot">
                    {flashSlot}
                  </span>
                )}
                <div className="timer">
                  <span>{tm[0]}</span>
                  <span className="timer-colon">:</span>
                  <span>{tm[1]}</span>
                  <span className="timer-colon">:</span>
                  <span className="timer-sec">{tm[2]}</span>
                </div>
              </div>
            </div>
            <div className="flash-top-right">
              <div className="flash-nav-btns">
                <button
                  type="button"
                  className="flash-nav-btn"
                  title="Cuộn trái"
                  onClick={() => {
                    pauseFlash(8000);
                    if (flashScrollRef.current) {
                      flashScrollRef.current.scrollBy({ left: -260, behavior: "smooth" });
                    }
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="flash-nav-btn"
                  title="Cuộn phải"
                  onClick={() => {
                    pauseFlash(8000);
                    if (flashScrollRef.current) {
                      flashScrollRef.current.scrollBy({ left: 260, behavior: "smooth" });
                    }
                  }}
                >
                  ›
                </button>
              </div>
            </div>
          </div>
          <div
            className="flash-scroll"
            ref={flashScrollRef}
            onMouseEnter={() => {
              isFlashHoveredRef.current = true;
            }}
            onMouseLeave={() => {
              isFlashHoveredRef.current = false;
            }}
            onTouchStart={() => {
              isFlashHoveredRef.current = true;
            }}
            onTouchEnd={() => {
              pauseFlash(6000);
            }}
            onWheel={() => {
              pauseFlash(6000);
            }}
          >
            <div className="flash-grid">
              {flashDeals.map((deal) => (
                <article key={deal.id}>
                  <div className="placeholder">
                    <a
                      href={getAffiliateUrl(deal.productUrl)}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="deal-image-link"
                      aria-label={deal.name}
                    >
                      {deal.imageUrl ? (
                        // Scraped deal images come from unpredictable CDN hosts, so
                        // next/image's static host allowlist doesn't fit here.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={deal.imageUrl} alt={deal.name} className="deal-image" loading="lazy" />
                      ) : (
                        "ảnh sản phẩm"
                      )}
                    </a>
                    <b>−{deal.discountPercent}%</b>
                    <button
                      type="button"
                      className={`deal-fav-btn ${savedDealIds.includes(String(deal.id)) ? "is-active" : ""}`}
                      aria-label={
                        savedDealIds.includes(String(deal.id)) ? "Bỏ lưu deal" : "Lưu deal yêu thích"
                      }
                      title={
                        savedDealIds.includes(String(deal.id)) ? "Bỏ lưu deal" : "Lưu deal yêu thích"
                      }
                      onClick={(e) => toggleFavoriteDeal(deal, e)}
                    >
                      <HeartIcon filled={savedDealIds.includes(String(deal.id))} />
                    </button>
                  </div>
                  <strong>
                    <a
                      href={getAffiliateUrl(deal.productUrl)}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                    >
                      {deal.name}
                    </a>
                  </strong>
                  <div>
                    <em>{formatPrice(deal.price)}</em>
                    {deal.originalPrice > deal.price && (
                      <s>{formatPrice(deal.originalPrice)}</s>
                    )}
                  </div>
                  <small>
                    {formatSold(deal.sold) && <>Đã bán {formatSold(deal.sold)} · </>}
                    hoàn <b>{formatPrice(deal.cashback)}</b>
                  </small>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="container block" id="deals">
        <div className="heading">
          <div>
            <h2>Deal hot hôm nay</h2>
          </div>
          <a>Xem tất cả →</a>
        </div>
        <div className="tabs">
          {HOT_TABS.map((x, i) => (
            <button
              className={tab === i ? "selected" : ""}
              onClick={() => setTab(i)}
              key={x}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="deal-grid">
          {visibleHotDeals.map((deal) => (
            <article className="deal" key={deal.id}>
              <div className="placeholder">
                <a
                  href={getAffiliateUrl(deal.productUrl)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="deal-image-link"
                  aria-label={deal.name}
                >
                  {deal.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- see flash-grid note above
                    <img src={deal.imageUrl} alt={deal.name} className="deal-image" loading="lazy" />
                  ) : (
                    "ảnh sản phẩm"
                  )}
                </a>
                <b>−{deal.discountPercent}%</b>
                <span>🔥 {deal.dealScore}</span>
                <button
                  type="button"
                  className={`deal-fav-btn ${savedDealIds.includes(String(deal.id)) ? "is-active" : ""}`}
                  aria-label={
                    savedDealIds.includes(String(deal.id)) ? "Bỏ lưu deal" : "Lưu deal yêu thích"
                  }
                  title={
                    savedDealIds.includes(String(deal.id)) ? "Bỏ lưu deal" : "Lưu deal yêu thích"
                  }
                  onClick={(e) => toggleFavoriteDeal(deal, e)}
                >
                  <HeartIcon filled={savedDealIds.includes(String(deal.id))} />
                </button>
              </div>
              <div className="deal-body">
                <small>
                  <b>{deal.platform}</b>
                  {formatSold(deal.sold)
                    ? ` · đã bán ${formatSold(deal.sold)}`
                    : ""}
                </small>
                <strong>
                  <a
                    href={getAffiliateUrl(deal.productUrl)}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    {deal.name}
                  </a>
                </strong>
                <div>
                  <em>{formatPrice(deal.price)}</em>
                  {deal.originalPrice > deal.price && (
                    <s>{formatPrice(deal.originalPrice)}</s>
                  )}
                </div>
                <footer>
                  <b>₫ Hoàn {formatPrice(deal.cashback)}</b>
                  <a
                    href={getAffiliateUrl(deal.productUrl)}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    Mua ngay →
                  </a>
                </footer>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="container block" id="coupons">
        <div className="heading heading-with-sub">
          <div className="heading-main">
            <h2>Mã giảm giá nổi bật</h2>
            <a
              href={getAffiliateUrl("https://shopee.vn/m/ma-giam-gia")}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              Tất cả mã Shopee →
            </a>
          </div>
          <p className="deal-source">
            Mã giảm giá Shopee hôm nay — tự động cập nhật và áp cùng cashback hoàn tiền.
          </p>
        </div>

        <div className="coupon-hubs">
          <a
            href={getAffiliateUrl("https://shopee.vn/m/ma-giam-gia")}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="coupon-hub-pill"
          >
            <span className="hub-icon">🎟️</span>
            <div>
              <b>Kho Voucher Toàn Sàn</b>
              <small>shopee.vn/m/ma-giam-gia ↗</small>
            </div>
          </a>
          <a
            href={getAffiliateUrl("https://shopee.vn/m/mien-phi-van-chuyen")}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="coupon-hub-pill"
          >
            <span className="hub-icon">🚚</span>
            <div>
              <b>Mã Freeship 0đ</b>
              <small>shopee.vn/m/mien-phi-van-chuyen ↗</small>
            </div>
          </a>
          <a
            href={getAffiliateUrl("https://shopee.vn/m/goi-ShopeeVIP")}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="coupon-hub-pill vip"
          >
            <span className="hub-icon">⭐</span>
            <div>
              <b>Gói Shopee VIP</b>
              <small>shopee.vn/m/goi-ShopeeVIP ↗</small>
            </div>
          </a>
        </div>

        <div className="tabs">
          {COUPON_TABS.map((t) => (
            <button
              key={t.key}
              className={couponTab === t.key ? "selected" : ""}
              onClick={() => setCouponTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="coupon-grid">
          {displayedCoupons.map((c) => (
            <article className={"coupon " + c.color} key={c.id}>
              <div>
                <b>{c.amount}</b>
                <small>{c.unit}</small>
              </div>
              <section>
                <strong>{c.title}</strong>
                <p>{c.condition}</p>
                <footer>
                  <code>{c.code}</code>
                  <a
                    href={getAffiliateUrl(c.url || "https://shopee.vn/m/ma-giam-gia")}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="coupon-action-btn"
                    onClick={() => {
                      if (c.code) {
                        navigator.clipboard?.writeText(c.code);
                        setCopiedCode(c.code);
                        notify(`✓ Đã copy mã ${c.code} — Đang mở Shopee để bạn lưu mã...`);
                        setTimeout(() => setCopiedCode(null), 3000);
                      }
                    }}
                  >
                    {copiedCode === c.code ? "✓ Đang mở Shopee" : "Lấy mã & Mở App ↗"}
                  </a>
                </footer>
              </section>
            </article>
          ))}
        </div>
      </section>
      <section className="container block" id="how">
        <div className="how">
          <div>
            <h2>Cashback hoạt động thế nào?</h2>
            <p>
              Minh bạch từng bước — tiền hoàn có trạng thái rõ ràng, không cam
              kết mơ hồ.
            </p>
            {[
              [
                "Dán link hoặc chọn deal",
                "Dán link sản phẩm để DealHoàn tính tiền hoàn, hoặc chọn deal đã tính sẵn giá thực trả.",
              ],
              [
                "Mua qua liên kết",
                "Bấm mua và nhận hoàn tiền — bạn mua trực tiếp trên sàn như bình thường.",
              ],
              [
                "Cashback chờ duyệt",
                "Đơn ghi nhận trong 24 giờ, trạng thái chờ duyệt đến khi hết hạn đổi trả.",
              ],
              [
                "Rút tiền về tài khoản",
                "Cashback được duyệt vào ví, rút về tài khoản ngân hàng từ 50.000đ.",
              ],
            ].map((s, i) => (
              <div className="step" key={s[0]}>
                <i>{i + 1}</i>
                <span>
                  <b>{s[0]}</b>
                  <small>{s[1]}</small>
                </span>
              </div>
            ))}
          </div>
          <div className="demo">
            <span className="float top">▼ Giá thấp nhất 30 ngày</span>
            <span className="float bottom">✓ +77.000đ hoàn sau 14 ngày</span>
            <DemoReceipt />
          </div>
        </div>
      </section>
      <section className="container block" id="referral">
        <div className="referral">
          <div>
            <h2>Mời bạn bè, nhận hoa hồng</h2>
            <p>
              Nhận 20.000đ khi bạn bè hoàn thành đơn đầu tiên, cộng 5% hoa hồng
              từ cashback của họ trong 6 tháng.
            </p>
          </div>
          <div>
            <button
              className="primary"
              onClick={() => {
                navigator.clipboard?.writeText(
                  "https://dealhoan.vn/ref/BAN2026",
                );
                setRefCopied(true);
                try {
                  confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
                } catch {}
                setTimeout(() => setRefCopied(false), 2500);
                notify("Đã copy link giới thiệu của bạn");
              }}
            >
              {refCopied ? "✓ Đã copy link" : "Copy link giới thiệu"}
            </button>
            <button className="outline">Chia sẻ Zalo</button>
          </div>
        </div>
      </section>
      <footer className="site-footer">
        <div className="container">
          <div>
            <h3>
              Deal<span>Hoàn</span>
            </h3>
            <p>
              Nền tảng săn deal & hoàn tiền cho người mua sắm thông minh tại
              Việt Nam.
            </p>
          </div>
          <div className="footer-links">
            <div>
              <b>Khám phá</b>
              <a>Deal hot</a>
              <a>Mã giảm giá</a>
              <a>Danh mục</a>
              <a>Thương hiệu</a>
            </div>
            <div id="faq">
              <b>Cashback</b>
              <a>Cách hoạt động</a>
              <a>Chính sách hoàn tiền</a>
              <a>Rút tiền</a>
              <a>FAQ</a>
            </div>
            <div>
              <b>DealHoàn</b>
              <a>Giới thiệu bạn bè</a>
              <a>Blog</a>
              <a>Liên hệ</a>
            </div>
          </div>
        </div>
        <small>
          © 2026 DealHoàn. Cashback ghi nhận qua liên kết tiếp thị của các sàn
          TMĐT.
        </small>
      </footer>
      {buyOpen && (
        <div className="buy-overlay" onClick={() => setBuyOpen(false)}>
          <div className="buy-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setBuyOpen(false)}>
              ✕
            </button>
            <span className="modal-badge">🛡 Lưu ý trước khi mua</span>
            <h3>Để không mất hoàn tiền</h3>
            <p>
              Đây là các lỗi thường gặp khiến đơn không được ghi nhận hoặc bị
              sàn từ chối.{" "}
              <a href="#how" onClick={() => setBuyOpen(false)}>
                Xem hướng dẫn ▸
              </a>
            </p>
            <div className="buy-rules">
              {[
                [
                  "Xoá sản phẩm khỏi giỏ hàng",
                  "trước khi vào link đã chuyển đổi, sau đó thêm lại từ phiên mua mới.",
                ],
                [
                  "Không bấm link, banner hay video khác",
                  "sau khi đã mở link hoàn tiền.",
                ],
                [
                  "Chờ khoảng 10 giây",
                  "sau khi mở app sàn rồi mới đặt hàng — không thao tác quá nhanh.",
                ],
                [
                  "Không dùng trình duyệt ẩn danh",
                  "hoặc chặn cookie/quảng cáo — hệ thống ghi nhận đơn qua cookie.",
                ],
                [
                  "Không tự mua qua tài khoản affiliate",
                  "hoặc tài khoản liên quan nếu sàn không cho phép.",
                ],
                [
                  "Đơn huỷ, hoàn trả hoặc không hợp lệ",
                  "sẽ không được hoàn tiền.",
                ],
              ].map(([head, body]) => (
                <div key={head}>
                  <b>✓</b>
                  <span>
                    <strong>{head}</strong> {body}
                  </span>
                </div>
              ))}
            </div>
            <div className="buy-warning">
              ⚠️{" "}
              <span>
                Kết quả ghi nhận đơn phụ thuộc vào sàn và đối tác. Hệ thống
                không thể sửa đơn đã bị sàn đánh dấu không hợp lệ.
              </span>
            </div>
            <div className="buy-bottom">
              <label className="buy-dont-show">
                <input
                  type="checkbox"
                  checked={buyDontShow}
                  onChange={(e) => setBuyDontShow(e.target.checked)}
                />{" "}
                Đã hiểu, không hiện lại lần sau
              </label>
              <div className="buy-actions">
                <button onClick={() => setBuyOpen(false)}>Đóng</button>
                <button
                  className="primary"
                  disabled={!buyDontShow}
                  onClick={() => {
                    setBuyOpen(false);
                    window.open(
                      trackedLink || (link ? getAffiliateUrl(link) : "https://shopee.vn"),
                      "_blank",
                      "noopener",
                    );
                    notify(
                      `Đã mở ${result} — ghi nhận trong 24 giờ, nhận hoàn sau 14–15 ngày`,
                    );
                  }}
                >
                  Tôi đã đọc, tiếp tục mua hàng →
                </button>
              </div>
            </div>
            <footer>
              Mở <strong>{result || "Shopee Mall"}</strong> trong tab mới · ghi nhận trong 24 giờ · nhận
              hoàn sau 14–15 ngày
            </footer>
          </div>
        </div>
      )}
      {accountOpen && user && (
        <AccountModal
          user={user}
          onClose={() => {
            setAccountOpen(false);
            fetchUserBalance();
          }}
          onSignOut={() => {
            setAccountOpen(false);
            signOut();
          }}
          onNotify={notify}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
