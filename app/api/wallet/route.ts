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

    if (dbError) {
      console.warn("user_wallets query fallback:", dbError.message);
      return NextResponse.json({
        wallet: {
          balance: 0,
          pending_balance: 0,
          total_withdrawn: 0,
          bank_name: "",
          bank_account_no: "",
          bank_account_name: "",
        },
      });
    }

    if (!wallet) {
      const initialWallet = {
        user_id: user.id,
        balance: 0,
        pending_balance: 0,
        total_withdrawn: 0,
        bank_name: "",
        bank_account_no: "",
        bank_account_name: "",
      };
      await supabase.from("user_wallets").insert(initialWallet);
      return NextResponse.json({ wallet: initialWallet });
    }

    return NextResponse.json({ wallet });
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
    const bank_account_no = String(body.bank_account_no || "").trim();
    const bank_account_name = String(body.bank_account_name || "").trim().toUpperCase();

    if (!bank_name || !bank_account_no || !bank_account_name) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ Tên ngân hàng, Số tài khoản và Tên chủ tài khoản." },
        { status: 400 }
      );
    }

    if (!supabase) {
      demoWallet = {
        ...demoWallet,
        bank_name,
        bank_account_no,
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

    const { data: updatedWallet, error: upsertError } = await supabase
      .from("user_wallets")
      .upsert(
        {
          user_id: user.id,
          bank_name,
          bank_account_no,
          bank_account_name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (upsertError) {
      console.warn("user_wallets update fallback:", upsertError.message);
      return NextResponse.json({
        success: true,
        wallet: {
          balance: 0,
          pending_balance: 0,
          total_withdrawn: 0,
          bank_name,
          bank_account_no,
          bank_account_name,
        },
      });
    }

    return NextResponse.json({ success: true, wallet: updatedWallet });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
