import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export interface WalletData {
  balance: number;
  pending_balance: number;
  total_withdrawn: number;
  bank_name: string;
  bank_account_no: string;
  bank_account_name: string;
}

let demoWallet: WalletData = {
  balance: 154000,
  pending_balance: 77000,
  total_withdrawn: 200000,
  bank_name: "MB Bank (MBB)",
  bank_account_no: "0988889999",
  bank_account_name: "NGUYEN VAN DEMO",
};

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ wallet: demoWallet });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    const { data: wallet, error: dbError } = await supabase
      .from("user_wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const metaBankName = String(user.user_metadata?.bank_name || "");
    const metaAccountNo = String(user.user_metadata?.bank_account_no || "");
    const metaAccountName = String(user.user_metadata?.bank_account_name || "");

    if (dbError) {
      console.warn("user_wallets query fallback:", dbError.message);
      return NextResponse.json({
        wallet: {
          balance: 0,
          pending_balance: 0,
          total_withdrawn: 0,
          bank_name: metaBankName,
          bank_account_no: metaAccountNo,
          bank_account_name: metaAccountName,
        },
      });
    }

    if (!wallet) {
      const initialWallet = {
        user_id: user.id,
        balance: 0,
        pending_balance: 0,
        total_withdrawn: 0,
        bank_name: metaBankName,
        bank_account_no: metaAccountNo,
        bank_account_name: metaAccountName,
      };
      await supabase.from("user_wallets").insert(initialWallet);
      return NextResponse.json({ wallet: initialWallet });
    }

    // Merge with user_metadata if user_wallets has empty bank fields
    const mergedWallet: WalletData = {
      balance: Number(wallet.balance ?? 0),
      pending_balance: Number(wallet.pending_balance ?? 0),
      total_withdrawn: Number(wallet.total_withdrawn ?? 0),
      bank_name: wallet.bank_name || metaBankName,
      bank_account_no: wallet.bank_account_no || metaAccountNo,
      bank_account_name: wallet.bank_account_name || metaAccountName,
    };

    return NextResponse.json({ wallet: mergedWallet });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    const bank_name = String(body.bank_name || "").trim();
    const rawAccountNo = String(body.bank_account_no || "").trim();
    const bank_account_name = String(body.bank_account_name || "").trim().toUpperCase();

    // 1. Kiểm tra không để trống
    if (!bank_name || !rawAccountNo || !bank_account_name) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ Ngân hàng, Số tài khoản và Tên chủ tài khoản." },
        { status: 400 }
      );
    }

    // 2. Validate số tài khoản: chỉ số, độ dài 6-20 ký tự
    const cleanAccountNo = rawAccountNo.replace(/\D/g, "");
    if (cleanAccountNo.length < 6 || cleanAccountNo.length > 20) {
      return NextResponse.json(
        { error: "Số tài khoản ngân hàng không hợp lệ (phải từ 6 đến 20 chữ số)." },
        { status: 400 }
      );
    }

    // 3. Validate tên chủ tài khoản: tối thiểu 3 chữ cái, không chứa số/ký tự đặc biệt
    if (bank_account_name.length < 3 || /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(bank_account_name)) {
      return NextResponse.json(
        { error: "Tên chủ tài khoản không hợp lệ (tối thiểu 3 chữ cái, không chứa số hoặc ký tự đặc biệt)." },
        { status: 400 }
      );
    }

    if (!supabase) {
      demoWallet = {
        ...demoWallet,
        bank_name,
        bank_account_no: cleanAccountNo,
        bank_account_name,
      };
      return NextResponse.json({ success: true, wallet: demoWallet });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    // A. Lưu vào Supabase Auth user_metadata để đảm bảo luôn luôn tồn tại
    try {
      await supabase.auth.updateUser({
        data: {
          bank_name,
          bank_account_no: cleanAccountNo,
          bank_account_name,
        },
      });
    } catch (metaErr) {
      console.warn("Update user_metadata error:", metaErr);
    }

    // B. Đồng thời lưu vào bảng user_wallets
    const { data: updatedWallet, error: upsertError } = await supabase
      .from("user_wallets")
      .upsert(
        {
          user_id: user.id,
          bank_name,
          bank_account_no: cleanAccountNo,
          bank_account_name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .maybeSingle();

    if (upsertError) {
      console.warn("user_wallets update fallback:", upsertError.message);
    }

    return NextResponse.json({
      success: true,
      wallet: {
        balance: Number(updatedWallet?.balance ?? 0),
        pending_balance: Number(updatedWallet?.pending_balance ?? 0),
        total_withdrawn: Number(updatedWallet?.total_withdrawn ?? 0),
        bank_name,
        bank_account_no: cleanAccountNo,
        bank_account_name,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
