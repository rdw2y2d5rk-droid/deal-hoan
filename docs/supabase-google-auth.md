# Google login với Supabase

Code đã có sẵn callback tại `/auth/callback`. Để kích hoạt đăng nhập thật, cấu hình một lần như sau.

1. Trong Supabase, tạo project và mở **Project Settings → API**. Sao chép Project URL và Publishable key.
2. Copy `.env.example` thành `.env.local`, rồi điền:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   ```

3. Trong Google Cloud Console, tạo OAuth client loại **Web application**. Thêm callback của Supabase vào **Authorized redirect URIs**:

   ```text
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

4. Trong Supabase, mở **Authentication → Providers → Google**, bật Google rồi điền Google Client ID và Client Secret.
5. Trong **Authentication → URL Configuration** của Supabase, thêm các URL redirect của ứng dụng:

   ```text
   http://localhost:3000/auth/callback
   https://<domain-san-xuat>/auth/callback
   ```

6. Khởi động lại `npm run dev` sau khi thay đổi `.env.local`, sau đó bấm **Đăng nhập Google** trên header.

Không commit `.env.local` hoặc bất kỳ secret nào. Publishable/anon key được dùng ở trình duyệt; không dùng service-role key cho luồng đăng nhập này.
