-- DealHoàn Wallet & Withdrawal Schema for Supabase
-- Run this in Supabase SQL Editor: Dashboard -> SQL Editor -> New query

-- 1. Bảng lưu trữ ví của từng người dùng
create table if not exists public.user_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0,          -- Số dư khả dụng có thể rút (VNĐ)
  pending_balance bigint not null default 0,  -- Tiền chờ duyệt đơn hàng (VNĐ)
  total_withdrawn bigint not null default 0,  -- Tổng tiền đã rút thành công (VNĐ)
  bank_name text,                             -- Tên ngân hàng (VD: MB Bank, Vietcombank)
  bank_account_no text,                       -- Số tài khoản ngân hàng
  bank_account_name text,                     -- Tên chủ tài khoản (IN HOA)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Bảng lưu trữ các lệnh rút tiền
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null check (amount >= 50000), -- Số tiền rút tối thiểu 50.000đ
  bank_name text not null,
  bank_account_no text not null,
  bank_account_name text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  note text,                                     -- Ghi chú của admin hoặc lý do từ chối
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Chỉ mục tối ưu truy vấn
create index if not exists idx_withdrawal_requests_user_id on public.withdrawal_requests(user_id, created_at desc);

-- 4. Bật Row Level Security (RLS) để đảm bảo bảo mật dữ liệu
alter table public.user_wallets enable row level security;
alter table public.withdrawal_requests enable row level security;

-- Policies cho user_wallets: Người dùng chỉ có thể xem và sửa ví của chính mình
create policy "Users can view own wallet"
  on public.user_wallets for select
  using (auth.uid() = user_id);

create policy "Users can update own bank details"
  on public.user_wallets for update
  using (auth.uid() = user_id);

create policy "Users can insert own wallet"
  on public.user_wallets for insert
  with check (auth.uid() = user_id);

-- Policies cho withdrawal_requests: Người dùng chỉ có thể xem và tạo lệnh rút của chính mình
create policy "Users can view own withdrawals"
  on public.withdrawal_requests for select
  using (auth.uid() = user_id);

create policy "Users can create own withdrawal"
  on public.withdrawal_requests for insert
  with check (auth.uid() = user_id);
