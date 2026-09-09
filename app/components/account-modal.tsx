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
  "MB Bank (Ngân hàng Quân Đội)",
  "Vietcombank (Ngoại thương VN)",
  "Techcombank (Kỹ thương VN)",
  "ACB (Á Châu)",
  "VPBank (Việt Nam Thịnh Vượng)",
  "BIDV (Đầu tư & Phát triển VN)",
  "TPBank (Tiên Phong)",
  "Agribank (Nông nghiệp VN)",
  "VIB (Quốc tế VN)",
  "Sacombank (Sài Gòn Thương Tín)",
  "HDBank (Phát triển TP.HCM)",
  "SHB (Sài Gòn - Hà Nội)",
  "MSB (Hàng Hải)",
  "OCB (Phương Đông)",
  "SeABank (Đông Nam Á)",
  "MoMo (Ví điện tử)",
  "ZaloPay (Ví điện tử)",
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
  const [wallet, setWallet] = useState<WalletData>({
    balance: 0,
    pending_balance: 0,
    total_withdrawn: 0,
    bank_name: "",
    bank_account_no: "",
    bank_account_name: "",
  });
  const [history, setHistory] = useState<WithdrawalItem[]>([]);

  // Form Ngân hàng
  const [bankName, setBankName] = useState(VN_BANKS[0]);
  const [accountNo, setAccountNo] = useState("");
  const [accountName, setAccountName] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [bankSavedSuccess, setBankSavedSuccess] = useState(false);

  // Form Rút tiền
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  const refCode = `u_${user.id.slice(0, 8)}`;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wallet")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.wallet) {
          setWallet(data.wallet);
          setBankName(data.wallet.bank_name || VN_BANKS[0]);
          setAccountNo(data.wallet.bank_account_no || "");
          setAccountName(data.wallet.bank_account_name || "");
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
  }, []);

  // Xử lý lưu ngân hàng
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !accountNo.trim() || !accountName.trim()) {
      return onNotify("Vui lòng điền đầy đủ thông tin ngân hàng!");
    }

    try {
      setSavingBank(true);
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_name: bankName,
          bank_account_no: accountNo.trim(),
          bank_account_name: accountName.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBankSavedSuccess(true);
        setTimeout(() => setBankSavedSuccess(false), 3000);
        onNotify("✅ Đã lưu thông tin tài khoản ngân hàng");
        if (data.wallet) {
          setWallet((prev) => ({
            ...prev,
            bank_name: data.wallet.bank_name,
            bank_account_no: data.wallet.bank_account_no,
            bank_account_name: data.wallet.bank_account_name,
          }));
        }
      } else {
        onNotify(data.error || "Không thể lưu thông tin ngân hàng.");
      }
    } catch {
      onNotify("Lỗi kết nối máy chủ.");
    } finally {
      setSavingBank(false);
    }
  };

  // Xử lý rút tiền
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError("");
    const amountNum = Number(withdrawAmount.replace(/\D/g, ""));

    if (!amountNum || amountNum < 50000) {
      setWithdrawError("Số tiền rút tối thiểu là 50.000đ.");
      return;
    }

    if (amountNum > wallet.balance) {
      setWithdrawError(`Số dư khả dụng (${formatVnd(wallet.balance)}) không đủ để rút.`);
      return;
    }

    if (!wallet.bank_account_no || !wallet.bank_name) {
      setWithdrawError("Vui lòng nhập và bấm Lưu tài khoản ngân hàng trước.");
      return;
    }

    try {
      setWithdrawing(true);
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum }),
      });
      const data = await res.json();

      if (res.ok) {
        onNotify(`🎉 ${data.message || "Tạo yêu cầu rút tiền thành công!"}`);
        setWithdrawAmount("");
        // Cập nhật lại số dư và lịch sử
        setWallet((prev) => ({
          ...prev,
          balance: typeof data.newBalance === "number" ? data.newBalance : Math.max(0, prev.balance - amountNum),
          total_withdrawn: prev.total_withdrawn + amountNum,
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
      onNotify("✓ Đã copy mã giới thiệu: " + refCode);
    }
  };

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Người dùng";

  return (
    <div className="account-overlay" onClick={onClose}>
      <div className="account-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="account-modal-head">
          <div className="account-profile-info">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="account-avatar-img" />
            ) : (
              <div className="account-avatar-fallback">{displayName.charAt(0).toUpperCase()}</div>
            )}
            <div>
              <h3 className="account-user-name">{displayName}</h3>
              <p className="account-user-email">{user.email}</p>
              <div className="account-ref-badge" onClick={copyRefCode} title="Bấm để copy mã giới thiệu">
                <span>Mã giới thiệu: <b>{refCode}</b></span>
                <i>📋</i>
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} title="Đóng">
            ✕
          </button>
        </div>

        {/* 3 Wallet Stats Cards */}
        <div className="account-wallet-grid">
          <div className="wallet-card wallet-card-green">
            <div className="wallet-card-header">
              <span className="wallet-dot green-dot" />
              <span>Số dư khả dụng</span>
            </div>
            <div className="wallet-card-val">{formatVnd(wallet.balance)}</div>
            <div className="wallet-card-sub">Có thể rút về ngân hàng</div>
          </div>

          <div className="wallet-card wallet-card-amber">
            <div className="wallet-card-header">
              <span className="wallet-dot amber-dot" />
              <span>Chờ duyệt</span>
            </div>
            <div className="wallet-card-val">{formatVnd(wallet.pending_balance)}</div>
            <div className="wallet-card-sub">Đang trong hạn đổi trả 14 ngày</div>
          </div>

          <div className="wallet-card wallet-card-neutral">
            <div className="wallet-card-header">
              <span className="wallet-dot neutral-dot" />
              <span>Tổng tiền đã rút</span>
            </div>
            <div className="wallet-card-val">{formatVnd(wallet.total_withdrawn)}</div>
            <div className="wallet-card-sub">Tiền đã về tài khoản ngân hàng</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="account-tabs">
          <button
            className={`account-tab-btn ${activeTab === "withdraw" ? "active" : ""}`}
            onClick={() => setActiveTab("withdraw")}
          >
            💸 Rút tiền & Ngân hàng
          </button>
          <button
            className={`account-tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            📋 Lịch sử rút tiền {history.length > 0 && <span className="tab-count">{history.length}</span>}
          </button>
        </div>

        {/* Tab Content 1: Rút tiền & Cấu hình ngân hàng */}
        {activeTab === "withdraw" && (
          <div className="account-tab-pane">
            {/* Box 1: Cài đặt tài khoản ngân hàng */}
            <div className="account-section-card">
              <div className="section-card-title">
                <span>🏦 Tài khoản ngân hàng nhận tiền</span>
                {wallet.bank_account_no && (
                  <span className="saved-badge">✓ Đã thiết lập</span>
                )}
              </div>
              <form onSubmit={handleSaveBank} className="bank-form">
                <div className="form-group">
                  <label>Ngân hàng / Ví nhận tiền</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="account-input"
                  >
                    {VN_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Số tài khoản / Số MoMo</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="VD: 1903688888..."
                      value={accountNo}
                      onChange={(e) => setAccountNo(e.target.value)}
                      className="account-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Tên chủ tài khoản (IN HOA)</label>
                    <input
                      type="text"
                      placeholder="VD: NGUYEN VAN A"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                      className="account-input"
                    />
                  </div>
                </div>

                <div className="form-submit-row">
                  <button type="submit" disabled={savingBank} className="account-btn-save">
                    {savingBank ? "Đang lưu…" : bankSavedSuccess ? "✓ Đã lưu thành công" : "Lưu thông tin ngân hàng"}
                  </button>
                  <span className="form-help-text">Thông tin được bảo mật và dùng cho lệnh chuyển khoản Napas247.</span>
                </div>
              </form>
            </div>

            {/* Box 2: Tạo lệnh rút tiền */}
            <div className="account-section-card withdraw-card">
              <div className="section-card-title">
                <span>💳 Yêu cầu rút tiền về tài khoản</span>
                <span className="min-withdraw-badge">Tối thiểu 50.000đ</span>
              </div>

              <form onSubmit={handleWithdraw} className="withdraw-form">
                <div className="form-group">
                  <label>Số tiền muốn rút (VNĐ)</label>
                  <div className="withdraw-input-wrap">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Nhập số tiền (từ 50.000đ)"
                      value={withdrawAmount ? Number(withdrawAmount).toLocaleString("vi-VN") : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setWithdrawAmount(raw);
                        setWithdrawError("");
                      }}
                      className="account-input withdraw-amount-input"
                    />
                    <span className="currency-suffix">đ</span>
                  </div>
                </div>

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
                    disabled={wallet.balance <= 0}
                  >
                    Tất cả ({formatVnd(wallet.balance)})
                  </button>
                </div>

                {withdrawError && <div className="withdraw-error-banner">⚠️ {withdrawError}</div>}

                <button
                  type="submit"
                  disabled={withdrawing || wallet.balance < 50000 || !wallet.bank_account_no}
                  className="account-btn-withdraw"
                >
                  {withdrawing ? "Đang gửi yêu cầu…" : "Xác nhận rút tiền →"}
                </button>

                <div className="withdraw-notice">
                  ⚡ Tiền hoàn sẽ được chuyển trực tiếp về tài khoản <b>{wallet.bank_name || "ngân hàng"}</b> trong <b>24–48 giờ làm việc</b> (không tính thứ 7 & chủ nhật).
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tab Content 2: Lịch sử rút tiền */}
        {activeTab === "history" && (
          <div className="account-tab-pane">
            {history.length === 0 ? (
              <div className="history-empty">
                <div className="history-empty-icon">📭</div>
                <h4>Chưa có lệnh rút tiền nào</h4>
                <p>Khi số dư đạt tối thiểu 50.000đ, bạn có thể tạo lệnh rút tiền về tài khoản ngân hàng bất kỳ lúc nào.</p>
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

        {/* Modal Footer */}
        <div className="account-modal-foot">
          <button className="account-signout-btn" onClick={onSignOut}>
            Đăng xuất tài khoản
          </button>
          <button className="account-close-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
