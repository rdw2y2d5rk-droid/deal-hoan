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
    const amount = Number(body.amount);

    if (!amount || isNaN(amount) || amount < 50000) {
      return NextResponse.json(
        { error: "Số tiền rút tối thiểu là 50.000đ." },
        { status: 400 }
      );
    }

    if (!supabase) {
      const demoReq: WithdrawalRecord = {
        id: crypto.randomUUID(),
        user_id: "demo-user",
        amount,
        bank_name: "MB Bank (Ngân hàng Quân Đội)",
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

    // Lấy thông tin ví & ngân hàng của user
    const { data: wallet } = await supabase
      .from("user_wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const bank_name = String(body.bank_name || wallet?.bank_name || "").trim();
    const bank_account_no = String(body.bank_account_no || wallet?.bank_account_no || "").trim();
    const bank_account_name = String(body.bank_account_name || wallet?.bank_account_name || "").trim().toUpperCase();

    if (!bank_name || !bank_account_no || !bank_account_name) {
      return NextResponse.json(
        { error: "Vui lòng cập nhật tài khoản ngân hàng trước khi rút tiền." },
        { status: 400 }
      );
    }

    const currentBalance = Number(wallet?.balance ?? 0);
    if (currentBalance < amount) {
      return NextResponse.json(
        { error: `Số dư khả dụng (${currentBalance.toLocaleString("vi-VN")}đ) không đủ để rút ${amount.toLocaleString("vi-VN")}đ.` },
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
      .single();

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
