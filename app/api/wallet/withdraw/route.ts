import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export interface WithdrawalRecord {
  id: string;
  user_id: string;
  amount: number;
  bank_name: string;
  bank_account_no: string;
  bank_account_name: string;
  status: "pending" | "completed" | "rejected";
  note?: string | null;
  created_at: string;
}

let demoHistory: WithdrawalRecord[] = [
  {
    id: "w-demo-1",
    user_id: "demo-user",
    amount: 200000,
    bank_name: "MB Bank (MBB)",
    bank_account_no: "0988889999",
    bank_account_name: "NGUYEN VAN DEMO",
    status: "completed",
    note: "Đã chuyển khoản thành công qua Napas247",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ history: demoHistory });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { data: history, error: dbError } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (dbError) {
      console.warn("withdrawal_requests query fallback:", dbError.message);
      return NextResponse.json({ history: [] });
    }

    return NextResponse.json({ history: history || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    const rawAmount = body.amount;
    const amount = Number(rawAmount);

    // Rule 1: Số tiền phải là số nguyên dương hợp lệ
    if (typeof rawAmount === "undefined" || rawAmount === null || rawAmount === "" || isNaN(amount) || !Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Số tiền muốn rút không hợp lệ. Vui lòng nhập một số nguyên dương." },
        { status: 400 }
      );
    }

    // Rule 2: Số tiền rút tối thiểu 50.000đ
    if (amount < 50000) {
      return NextResponse.json(
        { error: "Số tiền rút tối thiểu là 50.000đ." },
        { status: 400 }
      );
    }

    // Rule 3: Số tiền rút tối đa 50.000.000đ mỗi lần
    if (amount > 50000000) {
      return NextResponse.json(
        { error: "Số tiền rút tối đa mỗi lệnh là 50.000.000đ." },
        { status: 400 }
      );
    }

    // Rule 4: Bội số của 1.000đ
    if (amount % 1000 !== 0) {
      return NextResponse.json(
        { error: "Số tiền rút phải là bội số của 1.000đ (Ví dụ: 50.000đ, 60.000đ, 100.000đ...)." },
        { status: 400 }
      );
    }

    if (!supabase) {
      const demoReq: WithdrawalRecord = {
        id: crypto.randomUUID(),
        user_id: "demo-user",
        amount,
        bank_name: "MB Bank (MBB)",
        bank_account_no: "0988889999",
        bank_account_name: "NGUYEN VAN DEMO",
        status: "pending",
        note: "Đang chờ đối soát & chuyển khoản qua Napas247",
        created_at: new Date().toISOString(),
      };
      demoHistory = [demoReq, ...demoHistory];
      return NextResponse.json({
        success: true,
        message: `Đã gửi yêu cầu rút ${amount.toLocaleString("vi-VN")}đ về MB Bank. Tiền sẽ được chuyển trong 24–48h làm việc.`,
        request: demoReq,
        newBalance: Math.max(0, 154000 - amount),
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    // Rule 5: Kiểm tra lệnh rút đang chờ duyệt (Pending Withdrawal Check)
    const { data: pendingRequests } = await supabase
      .from("withdrawal_requests")
      .select("id, amount, created_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .limit(1);

    if (pendingRequests && pendingRequests.length > 0) {
      const pending = pendingRequests[0];
      return NextResponse.json(
        {
          error: `Bạn đang có 1 lệnh rút ${Number(pending.amount).toLocaleString("vi-VN")}đ đang chờ xử lý. Vui lòng đợi hoàn tất trước khi tạo lệnh mới.`,
        },
        { status: 400 }
      );
    }

    // Lấy thông tin ví & ngân hàng của user (ưu tiên user_wallets, fallback user_metadata)
    const { data: wallet } = await supabase
      .from("user_wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const metaBankName = String(user.user_metadata?.bank_name || "");
    const metaAccountNo = String(user.user_metadata?.bank_account_no || "");
    const metaAccountName = String(user.user_metadata?.bank_account_name || "");

    const bank_name = String(body.bank_name || wallet?.bank_name || metaBankName).trim();
    const rawAccountNo = String(body.bank_account_no || wallet?.bank_account_no || metaAccountNo).trim();
    const bank_account_name = String(body.bank_account_name || wallet?.bank_account_name || metaAccountName).trim().toUpperCase();
    const bank_account_no = rawAccountNo.replace(/\D/g, "");

    // Rule 6: Phải có thông tin ngân hàng hợp lệ
    if (!bank_name || !bank_account_no || !bank_account_name) {
      return NextResponse.json(
        { error: "Vui lòng lưu thông tin tài khoản ngân hàng nhận tiền trước khi rút." },
        { status: 400 }
      );
    }

    if (bank_account_no.length < 6 || bank_account_no.length > 20) {
      return NextResponse.json(
        { error: "Số tài khoản ngân hàng không hợp lệ (phải từ 6 đến 20 chữ số)." },
        { status: 400 }
      );
    }

    // Rule 7: Kiểm tra số dư ví
    const currentBalance = Number(wallet?.balance ?? 0);
    if (currentBalance < 50000) {
      return NextResponse.json(
        { error: `Số dư khả dụng hiện tại (${currentBalance.toLocaleString("vi-VN")}đ) chưa đạt mức tối thiểu 50.000đ để rút.` },
        { status: 400 }
      );
    }

    // Rule 8: Số tiền rút không được vượt quá số dư khả dụng
    if (amount > currentBalance) {
      return NextResponse.json(
        { error: `Số tiền muốn rút (${amount.toLocaleString("vi-VN")}đ) vượt quá số dư khả dụng (${currentBalance.toLocaleString("vi-VN")}đ).` },
        { status: 400 }
      );
    }

    // 1. Cập nhật số dư trong user_wallets
    const newBalance = Math.max(0, currentBalance - amount);
    const newWithdrawn = Number(wallet?.total_withdrawn ?? 0) + amount;

    await supabase
      .from("user_wallets")
      .update({
        balance: newBalance,
        total_withdrawn: newWithdrawn,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    // 2. Tạo lệnh rút trong withdrawal_requests
    const newRequest: WithdrawalRecord = {
      id: crypto.randomUUID(),
      user_id: user.id,
      amount,
      bank_name,
      bank_account_no,
      bank_account_name,
      status: "pending",
      note: "Đang chờ đối soát & chuyển khoản qua Napas247",
      created_at: new Date().toISOString(),
    };

    const { data: inserted } = await supabase
      .from("withdrawal_requests")
      .insert(newRequest)
      .select()
      .maybeSingle();

    return NextResponse.json({
      success: true,
      message: `Đã gửi yêu cầu rút ${amount.toLocaleString("vi-VN")}đ về ${bank_name}. Tiền sẽ được chuyển trong 24–48h làm việc.`,
      request: inserted || newRequest,
      newBalance,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
