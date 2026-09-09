"use client";

import React, { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";

export interface WalletData {
  balance: number;
  pending_balance: number;
  total_withdrawn: number;
  bank_name: string;
  bank_account_no: string;
  bank_account_name: string;
}

export interface WithdrawalItem {
  id: string;
  amount: number;
  bank_name: string;
  bank_account_no: string;
  bank_account_name: string;
  status: "pending" | "completed" | "rejected";
  note?: string | null;
  created_at: string;
}

const VN_BANKS = [
  "Vietcombank (VCB)",
  "MB Bank (MBB)",
  "Techcombank (TCB)",
  "VietinBank (CTG)",
  "BIDV",
  "ACB",
  "VPBank",
  "TPBank",
  "Agribank",
  "Sacombank",
  "VIB",
  "HDBank",
  "SHB",
  "MSB",
  "OCB",
  "SeABank",
  "LPBank",
  "Nam A Bank",
  "Eximbank",
  "Bac A Bank",
  "PVcomBank",
  "BaoViet Bank",
  "Kienlongbank",
  "VietABank",
  "Saigonbank",
  "Shinhan Bank",
  "Woori Bank",
];

function formatVnd(amount: number) {
  return amount.toLocaleString("vi-VN") + "đ";
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function AccountModal({
  user,
  onClose,
  onSignOut,
  onNotify,
}: {
  user: User;
  onClose: () => void;
  onSignOut: () => void;
  onNotify: (msg: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"withdraw" | "history">("withdraw");
  const [wallet, setWallet] = useState<WalletData>(() => {
    // Hydrate initial bank info from localStorage if available
    let savedBank = { bank_name: "", bank_account_no: "", bank_account_name: "" };
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dealhoan_bank_info_" + user.id);
        if (stored) {
          const parsed = JSON.parse(stored);
          savedBank = {
            bank_name: parsed.bank_name || "",
            bank_account_no: parsed.bank_account_no || "",
            bank_account_name: parsed.bank_account_name || "",
          };
        }
      } catch {}
    }
    return {
      balance: 0,
      pending_balance: 0,
      total_withdrawn: 0,
      ...savedBank,
    };
  });
  const [history, setHistory] = useState<WithdrawalItem[]>([]);

  // Form Ngân hàng
  const [bankName, setBankName] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dealhoan_bank_info_" + user.id);
        if (stored) return JSON.parse(stored).bank_name || VN_BANKS[0];
      } catch {}
    }
    return VN_BANKS[0];
  });
  const [accountNo, setAccountNo] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dealhoan_bank_info_" + user.id);
        if (stored) return JSON.parse(stored).bank_account_no || "";
      } catch {}
    }
    return "";
  });
  const [accountName, setAccountName] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("dealhoan_bank_info_" + user.id);
        if (stored) return JSON.parse(stored).bank_account_name || "";
      } catch {}
    }
    return "";
  });
  const [savingBank, setSavingBank] = useState(false);
  const [bankSavedSuccess, setBankSavedSuccess] = useState(false);

  // Form Rút tiền
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  const refCode = `u_${user.id.slice(0, 8)}`;

  // Tải dữ liệu ví và lịch sử từ server
  useEffect(() => {
    let cancelled = false;

    fetch("/api/wallet")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.wallet) {
          const serverW = data.wallet;

          // Nếu server có thông tin ngân hàng thì cập nhật state & localStorage
          if (serverW.bank_account_no) {
            setWallet(serverW);
            setBankName(serverW.bank_name || VN_BANKS[0]);
            setAccountNo(serverW.bank_account_no);
            setAccountName(serverW.bank_account_name || "");
            try {
              localStorage.setItem(
                "dealhoan_bank_info_" + user.id,
                JSON.stringify({
                  bank_name: serverW.bank_name || VN_BANKS[0],
                  bank_account_no: serverW.bank_account_no,
                  bank_account_name: serverW.bank_account_name || "",
                })
              );
            } catch {}
          } else {
            // Nếu server chưa có nhưng localStorage có thì giữ nguyên và sync lên server
            try {
              const stored = localStorage.getItem("dealhoan_bank_info_" + user.id);
              if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.bank_account_no) {
                  setWallet((prev) => ({
                    ...prev,
                    ...serverW,
                    bank_name: parsed.bank_name || VN_BANKS[0],
                    bank_account_no: parsed.bank_account_no,
                    bank_account_name: parsed.bank_account_name || "",
                  }));
                  setBankName(parsed.bank_name || VN_BANKS[0]);
                  setAccountNo(parsed.bank_account_no);
                  setAccountName(parsed.bank_account_name || "");

                  // Sync ngầm lên server
                  fetch("/api/wallet", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(parsed),
                  }).catch(() => {});
                  return;
                }
              }
            } catch {}
            setWallet(serverW);
          }
        }
      })
      .catch((err) => console.warn("Fetch wallet error:", err));

    fetch("/api/wallet/withdraw")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.history)) {
          setHistory(data.history);
        }
      })
      .catch((err) => console.warn("Fetch history error:", err));

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  // Kiểm tra lệnh rút đang chờ xử lý
  const pendingWithdrawal = history.find((h) => h.status === "pending");

  // Kiểm tra tài khoản ngân hàng đã sẵn sàng chưa
  const isBankReady = Boolean(wallet.bank_account_no && wallet.bank_name);

  // Số tiền parsed
  const parsedAmount = Number(withdrawAmount.replace(/\D/g, ""));

  // Hệ thống Validate nhiều Rule chặt chẽ cho số tiền rút
  const validateWithdrawal = (): { isValid: boolean; error?: string; hint?: string } => {
    if (!isBankReady) {
      return { isValid: false, error: "Vui lòng lưu thông tin ngân hàng trước khi rút tiền." };
    }
    if (pendingWithdrawal) {
      return {
        isValid: false,
        error: `Bạn đang có 1 lệnh rút ${formatVnd(pendingWithdrawal.amount)} đang chờ xử lý. Vui lòng đợi hoàn tất.`,
      };
    }
    if (wallet.balance < 50000) {
      return {
        isValid: false,
        error: `Số dư khả dụng (${formatVnd(wallet.balance)}) chưa đạt mức tối thiểu 50.000đ để rút.`,
      };
    }
    if (!withdrawAmount) {
      return {
        isValid: false,
        hint: `Số dư khả dụng: ${formatVnd(wallet.balance)} · Rút tối thiểu 50.000đ`,
      };
    }
    if (!parsedAmount || parsedAmount <= 0) {
      return { isValid: false, error: "Số tiền muốn rút không hợp lệ." };
    }
    if (parsedAmount < 50000) {
      return {
        isValid: false,
        error: `Số tiền rút tối thiểu là 50.000đ (còn thiếu ${formatVnd(50000 - parsedAmount)}).`,
      };
    }
    if (parsedAmount > wallet.balance) {
      return {
        isValid: false,
        error: `Số tiền rút (${formatVnd(parsedAmount)}) vượt quá số dư khả dụng (${formatVnd(wallet.balance)}).`,
      };
    }
    if (parsedAmount > 50000000) {
      return {
        isValid: false,
        error: "Số tiền rút tối đa mỗi lệnh là 50.000.000đ.",
      };
    }
    if (parsedAmount % 1000 !== 0) {
      return {
        isValid: false,
        error: "Số tiền rút phải là bội số của 1.000đ (Ví dụ: 50.000đ, 60.000đ, 100.000đ...).",
      };
    }
    return {
      isValid: true,
      hint: `✓ Hợp lệ · Số dư còn lại sau khi rút: ${formatVnd(wallet.balance - parsedAmount)}`,
    };
  };

  const amountValidation = validateWithdrawal();

  // Xử lý lưu ngân hàng chặt chẽ + lưu cả client và server
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNo = accountNo.replace(/\D/g, "");
    const cleanName = accountName.trim().toUpperCase();

    if (!bankName) {
      return onNotify("⚠️ Vui lòng chọn ngân hàng nhận tiền!");
    }
    if (!cleanNo || cleanNo.length < 6 || cleanNo.length > 20) {
      return onNotify("⚠️ Số tài khoản ngân hàng không hợp lệ (phải từ 6 đến 20 chữ số)!");
    }
    if (!cleanName || cleanName.length < 3) {
      return onNotify("⚠️ Tên chủ tài khoản phải có ít nhất 3 ký tự!");
    }
    if (/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(cleanName)) {
      return onNotify("⚠️ Tên chủ tài khoản chỉ gồm chữ cái, không chứa số hoặc ký tự đặc biệt!");
    }

    // 1. Lưu ngay vào localStorage
    try {
      localStorage.setItem(
        "dealhoan_bank_info_" + user.id,
        JSON.stringify({
          bank_name: bankName,
          bank_account_no: cleanNo,
          bank_account_name: cleanName,
        })
      );
    } catch {}

    setAccountNo(cleanNo);
    setAccountName(cleanName);

    try {
      setSavingBank(true);
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_name: bankName,
          bank_account_no: cleanNo,
          bank_account_name: cleanName,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBankSavedSuccess(true);
        setTimeout(() => setBankSavedSuccess(false), 3000);
        onNotify("✅ Đã lưu thông tin tài khoản ngân hàng");
        setWallet((prev) => ({
          ...prev,
          bank_name: bankName,
          bank_account_no: cleanNo,
          bank_account_name: cleanName,
        }));
      } else {
        onNotify(data.error || "Không thể lưu thông tin ngân hàng.");
      }
    } catch {
      onNotify("✅ Đã ghi nhớ tài khoản trên thiết bị của bạn");
      setWallet((prev) => ({
        ...prev,
        bank_name: bankName,
        bank_account_no: cleanNo,
        bank_account_name: cleanName,
      }));
    } finally {
      setSavingBank(false);
    }
  };

  // Xử lý rút tiền với multi-rule validation
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError("");

    if (!amountValidation.isValid) {
      setWithdrawError(amountValidation.error || "Số tiền rút không hợp lệ.");
      return;
    }

    try {
      setWithdrawing(true);
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          bank_name: wallet.bank_name || bankName,
          bank_account_no: wallet.bank_account_no || accountNo,
          bank_account_name: wallet.bank_account_name || accountName,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        onNotify(`🎉 ${data.message || "Tạo yêu cầu rút tiền thành công!"}`);
        setWithdrawAmount("");
        setWallet((prev) => ({
          ...prev,
          balance: typeof data.newBalance === "number" ? data.newBalance : Math.max(0, prev.balance - parsedAmount),
          total_withdrawn: prev.total_withdrawn + parsedAmount,
        }));
        if (data.request) {
          setHistory((prev) => [data.request, ...prev]);
        }
        setActiveTab("history");
      } else {
        setWithdrawError(data.error || "Không thể tạo yêu cầu rút tiền.");
      }
    } catch {
      setWithdrawError("Lỗi kết nối máy chủ. Vui lòng thử lại sau.");
    } finally {
      setWithdrawing(false);
    }
  };

  const setPresetAmount = (val: number) => {
    setWithdrawError("");
    setWithdrawAmount(val.toString());
  };

  const copyRefCode = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(refCode);
      onNotify("✓ Đã copy mã: " + refCode);
    }
  };

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Huy Quang Vũ";

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="account-overlay" onClick={onClose}>
      <div className="account-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="account-modal-head">
          <div className="account-head-left">
            {/* Brand Logo & Divider (Matches Image 1) */}
            <div className="account-brand-wrap">
              <span className="account-brand-mark" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/deal-hoan-mark.png" alt="" />
              </span>
              <span className="account-brand-wordmark">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/deal-hoan-logo.png" alt="Deal Hoàn" />
              </span>
            </div>

            <div className="account-head-divider" />

            {/* Profile Info */}
            <div className="account-profile-info">
              <div className="account-avatar-wrap">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={displayName} className="account-avatar-img" />
                ) : (
                  <div className="account-avatar-fallback">{getInitials(displayName)}</div>
                )}
                <span className="account-online-dot" />
              </div>

              <div className="account-profile-texts">
                <div className="account-name-row">
                  <h3 className="account-user-name">{displayName}</h3>
                  <button
                    type="button"
                    className="account-ref-badge"
                    onClick={copyRefCode}
                    title="Bấm để copy mã"
                  >
                    <span>Mã: <b>{refCode}</b></span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                  </button>
                </div>
                <p className="account-user-email">{user.email || "quangvh.technical@gmail.com"}</p>
              </div>
            </div>
          </div>

          <button className="account-head-close" onClick={onClose} title="Đóng">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 3 Wallet Stats Cards (Matches Image 1 & 2) */}
        <div className="account-wallet-grid">
          {/* Card 1: Số dư khả dụng */}
          <div className="wallet-card wallet-card-green">
            <div className="wallet-card-icon green-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
            </div>
            <div className="wallet-card-body">
              <div className="wallet-card-label">SỐ DƯ KHẢ DỤNG</div>
              <div className="wallet-card-val green-val">{formatVnd(wallet.balance)}</div>
              <div className="wallet-card-sub">Có thể rút ngay</div>
            </div>
          </div>

          {/* Card 2: Chờ duyệt */}
          <div className="wallet-card wallet-card-amber">
            <div className="wallet-card-icon amber-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="wallet-card-body">
              <div className="wallet-card-label">CHỜ DUYỆT</div>
              <div className="wallet-card-val amber-val">{formatVnd(wallet.pending_balance)}</div>
              <div className="wallet-card-sub">Sau 14 – 15 ngày</div>
            </div>
          </div>

          {/* Card 3: Đã nhận */}
          <div className="wallet-card wallet-card-blue">
            <div className="wallet-card-icon blue-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2 2 7h20L12 2z" />
              </svg>
            </div>
            <div className="wallet-card-body">
              <div className="wallet-card-label">ĐÃ NHẬN</div>
              <div className="wallet-card-val blue-val">{formatVnd(wallet.total_withdrawn)}</div>
              <div className="wallet-card-sub">Về ngân hàng</div>
            </div>
          </div>
        </div>

        {/* Tabs (Matches Image 1 & 2) */}
        <div className="account-tabs">
          <button
            className={`account-tab-btn ${activeTab === "withdraw" ? "active" : ""}`}
            onClick={() => setActiveTab("withdraw")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" x2="22" y1="10" y2="10" />
            </svg>
            <span>Rút tiền</span>
          </button>
          <button
            className={`account-tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" x2="8" y1="13" y2="13" />
              <line x1="16" x2="8" y1="17" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>Lịch sử rút</span>
            {history.length > 0 && <span className="tab-count-badge">{history.length}</span>}
          </button>
        </div>

        {/* Tab Content 1: Rút tiền (Matches Image 1) */}
        {activeTab === "withdraw" && (
          <div className="account-tab-pane">
            {/* Box 1: Tài khoản ngân hàng nhận tiền */}
            <div className="account-section-card">
              <div className="section-head-with-icon">
                <div className="section-icon-box orange-box">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2 2 7h20L12 2z" />
                  </svg>
                </div>
                <div className="section-head-texts">
                  <h4 className="section-title">Tài khoản ngân hàng nhận tiền</h4>
                  <p className="section-sub">Chọn ngân hàng và nhập thông tin tài khoản để nhận tiền hoàn</p>
                </div>
              </div>

              <form onSubmit={handleSaveBank} className="bank-form">
                <div className="form-group">
                  <label>Ngân hàng</label>
                  <div className="select-input-wrap">
                    <span className="select-bank-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 2 7 12 12 22 7 12 2" />
                        <polyline points="2 17 12 22 22 17" />
                        <polyline points="2 12 12 17 22 12" />
                      </svg>
                    </span>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="account-input select-bank-field"
                    >
                      {VN_BANKS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    <span className="select-chevron">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Số tài khoản</label>
                    <div className="input-with-icon-wrap">
                      <span className="input-leading-icon">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="20" height="14" x="2" y="5" rx="2" />
                          <line x1="2" x2="22" y1="10" y2="10" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Nhập số tài khoản..."
                        value={accountNo}
                        onChange={(e) => setAccountNo(e.target.value.replace(/\D/g, ""))}
                        className="account-input input-has-leading"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Tên chủ tài khoản</label>
                    <div className="input-with-icon-wrap">
                      <span className="input-leading-icon">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        placeholder="VD: NGUYEN VAN A"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                        className="account-input input-has-leading"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-submit-row">
                  <button type="submit" disabled={savingBank} className="account-btn-save">
                    {savingBank ? "Đang lưu…" : bankSavedSuccess ? "✓ Đã lưu tài khoản" : "Lưu tài khoản"}
                  </button>
                  {wallet.bank_account_no && (
                    <span className="saved-indicator">
                      ✓ Đã lưu: <b>{wallet.bank_name}</b> · {wallet.bank_account_no}
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Box 2: Số tiền muốn rút */}
            <div className="account-section-card withdraw-card">
              <div className="section-head-with-icon">
                <div className="section-icon-box orange-box">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
                    <path d="M7 6h1v4" />
                    <path d="m16.71 13.88.7.71-2.82 2.82" />
                  </svg>
                </div>
                <div className="section-head-texts">
                  <h4 className="section-title">Số tiền muốn rút</h4>
                  <p className="section-sub">Nhập số tiền bạn muốn rút về ngân hàng</p>
                </div>
                <span className="min-withdraw-badge">Tối thiểu 50.000đ</span>
              </div>

              <form onSubmit={handleWithdraw} className="withdraw-form">
                <div className="input-with-icon-wrap">
                  <span className="input-leading-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="12" x="2" y="6" rx="2" />
                      <circle cx="12" cy="12" r="2" />
                      <path d="M6 12h.01M18 12h.01" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Nhập số tiền (tối thiểu 50.000đ)"
                    value={withdrawAmount ? Number(withdrawAmount).toLocaleString("vi-VN") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      setWithdrawAmount(raw);
                      setWithdrawError("");
                    }}
                    className="account-input input-has-leading input-has-trailing"
                  />
                  <span className="input-trailing-suffix">đ</span>
                </div>

                {/* Live validation feedback message */}
                {amountValidation.error && (
                  <div className="withdraw-feedback-msg error">
                    <span>⚠️</span>
                    <span>{amountValidation.error}</span>
                  </div>
                )}
                {!amountValidation.error && amountValidation.isValid && amountValidation.hint && (
                  <div className="withdraw-feedback-msg success">
                    <span>✓</span>
                    <span>{amountValidation.hint}</span>
                  </div>
                )}
                {!amountValidation.error && !amountValidation.isValid && amountValidation.hint && (
                  <div className="withdraw-feedback-msg neutral">
                    <span>💡</span>
                    <span>{amountValidation.hint}</span>
                  </div>
                )}

                {/* Preset Chips */}
                <div className="withdraw-presets">
                  <button type="button" onClick={() => setPresetAmount(50000)} className="preset-btn">
                    50.000đ
                  </button>
                  <button type="button" onClick={() => setPresetAmount(100000)} className="preset-btn">
                    100.000đ
                  </button>
                  <button type="button" onClick={() => setPresetAmount(200000)} className="preset-btn">
                    200.000đ
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetAmount(wallet.balance)}
                    className="preset-btn preset-max"
                  >
                    Tất cả ({formatVnd(wallet.balance)})
                  </button>
                </div>

                {withdrawError && <div className="withdraw-error-banner">⚠️ {withdrawError}</div>}

                {/* Primary Button */}
                <button
                  type="submit"
                  disabled={withdrawing || !amountValidation.isValid}
                  className={`account-btn-withdraw ${
                    !isBankReady
                      ? "btn-needs-bank"
                      : pendingWithdrawal
                      ? "btn-pending"
                      : ""
                  }`}
                >
                  <span className="btn-lightning">
                    {pendingWithdrawal ? "⏳" : "⚡"}
                  </span>
                  <span>
                    {withdrawing
                      ? "Đang gửi yêu cầu rút tiền…"
                      : !isBankReady
                      ? "Vui lòng lưu thông tin ngân hàng trước"
                      : pendingWithdrawal
                      ? `Đang có lệnh rút ${formatVnd(pendingWithdrawal.amount)} chờ xử lý`
                      : wallet.balance < 50000
                      ? "Số dư khả dụng chưa đủ 50.000đ"
                      : !withdrawAmount
                      ? "Nhập số tiền muốn rút"
                      : !amountValidation.isValid
                      ? "Số tiền rút chưa hợp lệ"
                      : `Xác nhận rút ${formatVnd(parsedAmount)} →`}
                  </span>
                </button>

                {/* Notice Box */}
                <div className="withdraw-notice-box">
                  <span className="notice-lightning">⚡</span>
                  <span>
                    Chuyển khoản Napas 24/7 về ngân hàng trong <b>24 – 48h làm việc</b> (trừ T7 & CN).
                  </span>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab Content 2: Lịch sử rút tiền (Matches Image 2) */}
        {activeTab === "history" && (
          <div className="account-tab-pane">
            {history.length === 0 ? (
              <div className="history-empty-wrapper">
                {/* Custom SVG Illustration matching Image 2 */}
                <div className="empty-receipt-illustration">
                  <svg width="180" height="140" viewBox="0 0 180 140" fill="none">
                    {/* Soft Peach Cloud */}
                    <path
                      d="M40 90C30 90 22 82 22 72C22 64 27 57 35 55C37 42 48 32 61 32C71 32 79 38 83 46C87 44 91 43 96 43C108 43 118 51 121 62C126 62 131 66 132 71C137 73 140 78 140 83C140 90 134 96 127 96H40"
                      fill="#FFF5EE"
                    />
                    {/* Stars/crosses */}
                    <path d="M28 62V54M24 58H32" stroke="#FDBA74" strokeWidth="2" strokeLinecap="round" />
                    <path d="M142 42V36M139 39H145" stroke="#FDBA74" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="138" cy="62" r="1.5" fill="#FED7AA" />
                    <circle cx="36" cy="80" r="1.5" fill="#FED7AA" />

                    {/* Receipt Document */}
                    <g filter="drop-shadow(0px 6px 12px rgba(234, 88, 12, 0.08))">
                      {/* Ribbon bookmark tag on top right */}
                      <path d="M104 18H116V30L110 26L104 30V18Z" fill="#EA580C" />
                      <rect x="58" y="24" width="64" height="88" rx="6" fill="#FFFFFF" stroke="#FED7AA" strokeWidth="1" />
                      {/* Zigzag bottom of receipt */}
                      <path
                        d="M58 108L63 112L68 108L73 112L78 108L83 112L88 108L93 112L98 108L103 112L108 108L113 112L118 108L122 112V108H58Z"
                        fill="#FFFFFF"
                      />
                      {/* Lines on receipt */}
                      <rect x="68" y="38" width="44" height="4" rx="2" fill="#FCA5A5" />
                      <rect x="68" y="48" width="34" height="3" rx="1.5" fill="#FED7AA" />
                      <rect x="68" y="56" width="40" height="3" rx="1.5" fill="#FED7AA" />
                      <rect x="68" y="64" width="28" height="3" rx="1.5" fill="#FED7AA" />
                      <line x1="68" y1="74" x2="112" y2="74" stroke="#FEE2E2" strokeWidth="1" strokeDasharray="2 2" />
                      <rect x="68" y="80" width="30" height="3" rx="1.5" fill="#FCA5A5" />
                    </g>

                    {/* Orange Clock Badge */}
                    <circle cx="116" cy="94" r="17" fill="#EA580C" filter="drop-shadow(0px 3px 6px rgba(234, 88, 12, 0.3))" />
                    <circle cx="116" cy="94" r="14" fill="#F97316" />
                    <path d="M116 88V94L120 96" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <h4 className="history-empty-title">Chưa có lệnh rút tiền nào</h4>
                <p className="history-empty-sub">
                  Khi số dư đạt tối thiểu 50.000đ, bạn có thể tạo lệnh rút tiền về tài khoản ngân hàng bất kỳ lúc nào.
                </p>
              </div>
            ) : (
              <div className="history-list">
                {history.map((item) => (
                  <div key={item.id} className="history-item">
                    <div className="history-left">
                      <div className="history-amount">−{formatVnd(item.amount)}</div>
                      <div className="history-bank">
                        {item.bank_name} · <b>{item.bank_account_no}</b> ({item.bank_account_name})
                      </div>
                      <div className="history-time">{formatDate(item.created_at)}</div>
                    </div>
                    <div className="history-right">
                      {item.status === "completed" && (
                        <span className="status-badge status-completed">✅ Đã chuyển</span>
                      )}
                      {item.status === "pending" && (
                        <span className="status-badge status-pending">⏳ Chờ xử lý</span>
                      )}
                      {item.status === "rejected" && (
                        <span className="status-badge status-rejected">❌ Bị từ chối</span>
                      )}
                      {item.note && <div className="history-note">{item.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer (Matches Image 1 & 2) */}
        <div className="account-modal-foot">
          <button type="button" className="account-signout-btn" onClick={onSignOut}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            <span>Đăng xuất tài khoản</span>
          </button>
          <button type="button" className="account-close-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
