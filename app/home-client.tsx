"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { formatPrice, formatSold } from "@/lib/deals/format";
import type { Deal, DealBundle } from "@/lib/deals/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
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

const coupons = [
  [
    "50k",
    "giảm",
    "Shopee — đơn điện tử từ 500k",
    "HSD 31/08 · áp cùng cashback",
    "DEALHOAN50",
    "orange",
  ],
  [
    "8%",
    "tối đa 100k",
    "TikTok Shop — toàn sàn",
    "HSD 28/08 · đơn từ 250k",
    "TIKDH8",
    "black",
  ],
  [
    "15%",
    "hoàn thêm",
    "Lazada — làm đẹp & mẹ bé",
    "Cuối tuần này · không giới hạn",
    "LZDHOAN15",
    "green",
  ],
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

function Receipt({
  platform = "Shopee Mall",
  trackedLink,
  copied,
  onCopy,
  onBuy,
  onClear,
}: {
  platform?: string;
  trackedLink?: string;
  copied?: boolean;
  onCopy?: () => void;
  onBuy?: () => void;
  onClear?: () => void;
}) {
  return (
    <div className="receipt">
      <div className="receipt-head">
        <b>⚡ Hoàn tiền cho link của bạn</b>
        <span>{platform}</span>
      </div>
      <div className="receipt-product">
        <div className="placeholder small">ảnh SP</div>
        <div>
          <b>Tai nghe Bluetooth chống ồn Sony WF-C710N</b>
          <p>
            {platform} · <em>còn 6 giờ</em>
          </p>
        </div>
      </div>
      <div className="price-lines">
        <div>
          <span>Giá niêm yết</span>
          <s>1.990.000đ</s>
        </div>
        <div>
          <span>
            Giảm giá sàn + mã <code>DEALHOAN50</code>
          </span>
          <b className="red">−450.000đ</b>
        </div>
        <hr />
        <div className="total">
          <b>Thanh toán hôm nay</b>
          <strong>1.540.000đ</strong>
        </div>
        <div>
          <span>
            Hoàn về ví <b className="green">sau 14–15 ngày</b>
          </span>
          <b className="green">+77.000đ</b>
        </div>
        <div className="actual-cost">
          <b>Chi phí thực sau khi nhận hoàn</b>
          <span>
            <strong>1.463.000đ</strong>
            <em>tiết kiệm 26%</em>
          </span>
        </div>
      </div>
      {trackedLink && (
        <div className="tracked-link">
          <span>
            <small>Link mới — đã gắn hoàn tiền</small>
            <b>{trackedLink}</b>
          </span>
          <button onClick={onCopy}>{copied ? "✓ Đã copy" : "Copy link"}</button>
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
          <button onClick={onClear}>Tính link khác</button>
        </div>
      )}
    </div>
  );
}

function DemoReceipt({ onBuy }: { onBuy: () => void }) {
  return (
    <div className="demo-receipt">
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
      <button className="primary" onClick={onBuy}>
        Mua ngay &amp; Nhận hoàn tiền →
      </button>
      <p className="demo-receipt-foot">
        Ghi nhận trong 24 giờ · nhận hoàn sau 14–15 ngày ·{" "}
        <a href="#how">điều kiện</a>
      </p>
    </div>
  );
}
export default function HomeClient({
  flashDeals,
  hotDeals,
  source,
}: {
  flashDeals: Deal[];
  hotDeals: Deal[];
  source: DealBundle["source"];
}) {
  const linkInputRef = useRef<HTMLInputElement>(null);
  const flashScrollRef = useRef<HTMLDivElement>(null);
  const [link, setLink] = useState("");
  const [result, setResult] = useState("");
  const [resultClosing, setResultClosing] = useState(false);
  const [saved, setSaved] = useState<number[]>([]);
  const [tab, setTab] = useState(0);
  const [toast, setToast] = useState("");
  const [seconds, setSeconds] = useState(8049);
  const [busy, setBusy] = useState(false);
  const [inputError, setInputError] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const [trackedLink, setTrackedLink] = useState("");
  const [copiedTracked, setCopiedTracked] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyDontShow, setBuyDontShow] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authPending, setAuthPending] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s ? s - 1 : 7200)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      const el = flashScrollRef.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max > 0)
        el.scrollTo({
          left:
            el.scrollLeft >= max - 10 ? 0 : Math.min(el.scrollLeft + 246, max),
          behavior: "smooth",
        });
    }, 2000);
    return () => clearInterval(timer);
  }, []);
  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2400);
  };
  const signInWithGoogle = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      notify("Chưa cấu hình Supabase — thêm URL và publishable key trước nhé.");
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
    if (!supabase) return;

    setAuthPending(true);
    const { error } = await supabase.auth.signOut();
    setAuthPending(false);
    if (error) return notify("Không thể đăng xuất. Vui lòng thử lại.");
    setUser(null);
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
  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!link.trim()) {
      setInputError(true);
      setTimeout(() => setInputError(false), 600);
      setTimeout(() => {
        (document.activeElement as HTMLElement | null)?.blur();
      }, 1000);
      return notify("Dán link sản phẩm trước đã nhé 🙂");
    }
    (document.activeElement as HTMLElement | null)?.blur();
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setResultClosing(false);
      const platform = link.toLowerCase().includes("tiktok")
        ? "TikTok Shop"
        : link.toLowerCase().includes("lazada")
          ? "Lazada"
          : "Shopee Mall";
      setResult(platform);
      setTrackedLink(
        `https://dealhoan.vn/go/DH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      );
      setCopiedTracked(false);
      notify("Đã tính xong — mua qua link mới để nhận hoàn 77.000đ");
    }, 500);
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
          <a className="brand" title="DealHoàn — dán link, nhận hoàn tiền">
            <i>
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
                <path
                  d="M20.5 9.2A8.7 8.7 0 1 1 15.1 4.4"
                  stroke="white"
                  strokeWidth="2.35"
                  strokeLinecap="round"
                />
                <path
                  d="m12.3 5.9 2.8-1.5-1.4-2.8"
                  stroke="white"
                  strokeWidth="2.35"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect x="7.1" y="9.15" width="11.7" height="8.15" rx="2.35" fill="white" />
                <path d="M10.2 12.2h5.65M13.35 10.65v5.1" stroke="#ED4D2D" strokeWidth="1.75" strokeLinecap="round" />
                <circle cx="18.5" cy="17.9" r="2.15" fill="#86EFAC" stroke="#ED4D2D" strokeWidth="1.25" />
              </svg>
            </i>
            <span className="brand-copy">
              <b>
                Deal<span>Hoàn</span>
              </b>
              <small>Mua rẻ · Hoàn tiền</small>
            </span>
          </a>
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
                <span className="account-user" title={user.email ?? undefined}>
                  {String(user.user_metadata.full_name ?? user.email ?? "Tài khoản").split(" ")[0]}
                </span>
                <button disabled={authPending} onClick={signOut}>
                  {authPending ? "Đang xử lý…" : "Đăng xuất"}
                </button>
              </>
            ) : (
              <button disabled={authPending} onClick={signInWithGoogle}>
                {authPending ? "Đang mở Google…" : "Đăng nhập Google"}
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
            DealHoàn tự áp mã giảm giá, so giá 30 ngày và tính sẵn{" "}
            <b>chi phí thực sau hoàn tiền</b> — trước khi bạn bấm mua.
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
                    setResultClosing(false);
                  }, 420);
                }
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
                      setResultClosing(false);
                    }, 420);
                  }
                  linkInputRef.current?.focus();
                }}
              >
                ×
              </button>
            )}
            <button className="primary">
              {busy ? "⏳ Đang tính…" : "⚡ Tính hoàn tiền"}
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
                    trackedLink={trackedLink}
                    copied={copiedTracked}
                    onCopy={() => {
                      navigator.clipboard?.writeText(trackedLink);
                      setCopiedTracked(true);
                      notify("Đã copy link hoàn tiền");
                    }}
                    onBuy={() => {
                      if (buyDontShow) {
                        window.open(
                          trackedLink || "https://dealhoan.vn/go/DEMO",
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
            <button onClick={() => setLink("https://shopee.vn/tai-nghe-sony")}>
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
            <button onClick={() => setLink("https://vt.tiktok.com/ZS8abcd/")}>
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
            <button onClick={() => setLink("https://lazada.vn/products/sony")}>
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
              <b>2,1 tỷ đ</b>đã hoàn cho người dùng
            </div>
            <hr />
            <div>
              <b>380k+</b>người săn deal
            </div>
            <hr />
            <div>
              <b>3 sàn</b>Shopee · TikTok · Lazada
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
            <h2>⚡ Deal chớp nhoáng</h2>
            <div className="timer">
              {tm.map((t, i) => (
                <span key={i}>{t}</span>
              ))}
            </div>
            <a>Xem tất cả →</a>
          </div>
          <div className="flash-scroll" ref={flashScrollRef}>
            <div className="flash-grid">
              {flashDeals.map((deal) => (
                <article key={deal.id}>
                  <div className="placeholder">
                    {deal.imageUrl ? (
                      // Scraped deal images come from unpredictable CDN hosts, so
                      // next/image's static host allowlist doesn't fit here.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={deal.imageUrl} alt={deal.name} className="deal-image" loading="lazy" />
                    ) : (
                      "ảnh sản phẩm"
                    )}
                    <b>−{deal.discountPercent}%</b>
                  </div>
                  <strong>
                    <a
                      href={deal.productUrl}
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
            <p>
              Deal Score chấm theo mức giảm, cashback, đánh giá shop và lượng
              đã bán.
            </p>
            <p className="deal-source">{SOURCE_NOTE[source]}</p>
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
          {visibleHotDeals.map((deal, i) => (
            <article className="deal" key={deal.id}>
              <div className="placeholder">
                {deal.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- see flash-grid note above
                  <img src={deal.imageUrl} alt={deal.name} className="deal-image" loading="lazy" />
                ) : (
                  "ảnh sản phẩm"
                )}
                <b>−{deal.discountPercent}%</b>
                <span>🔥 {deal.dealScore}</span>
                <button
                  aria-label={
                    saved.includes(i) ? "Bỏ lưu deal" : "Lưu deal"
                  }
                  onClick={() => {
                    const exists = saved.includes(i);
                    setSaved(
                      exists ? saved.filter((x) => x !== i) : [...saved, i],
                    );
                    notify(
                      exists
                        ? "Đã bỏ lưu deal"
                        : "Đã lưu deal — sẽ báo khi giảm thêm",
                    );
                  }}
                >
                  {saved.includes(i) ? "♥" : "♡"}
                </button>
              </div>
              <div className="deal-body">
                <small>
                  <b>{deal.platform}</b>
                  {formatSold(deal.sold)
                    ? ` · đã bán ${formatSold(deal.sold)}`
                    : ""}
                </small>
                <strong>{deal.name}</strong>
                <div>
                  <em>{formatPrice(deal.price)}</em>
                  {deal.originalPrice > deal.price && (
                    <s>{formatPrice(deal.originalPrice)}</s>
                  )}
                </div>
                <footer>
                  <b>₫ Hoàn {formatPrice(deal.cashback)}</b>
                  <a
                    href={deal.productUrl}
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
        <div className="heading">
          <h2>Mã giảm giá nổi bật</h2>
          <a>Tất cả mã →</a>
        </div>
        <div className="coupon-grid">
          {coupons.map((c) => (
            <article className={"coupon " + c[5]} key={c[4]}>
              <div>
                <b>{c[0]}</b>
                <small>{c[1]}</small>
              </div>
              <section>
                <strong>{c[2]}</strong>
                <p>{c[3]}</p>
                <footer>
                  <code>{c[4]}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(c[4]);
                      notify("Đã copy mã " + c[4] + " — dán khi thanh toán");
                    }}
                  >
                    Copy mã
                  </button>
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
                "Cashback được duyệt vào ví, rút về ngân hàng hoặc Momo từ 50.000đ.",
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
            <DemoReceipt onBuy={() => setBuyOpen(true)} />
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
                      trackedLink || "https://dealhoan.vn/go/DEMO",
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
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
