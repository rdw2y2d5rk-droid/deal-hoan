import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư | DealHoàn",
  description: "Chính sách quyền riêng tư của DealHoàn.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <Link className="legal-brand" href="/">
          ← DealHoàn
        </Link>
        <p className="legal-kicker">Cập nhật lần cuối: 30/08/2026</p>
        <h1>Chính sách quyền riêng tư</h1>
        <p>
          DealHoàn tôn trọng quyền riêng tư của bạn. Chính sách này giải thích
          cách chúng tôi xử lý thông tin khi bạn sử dụng nền tảng.
        </p>

        <h2>Thông tin chúng tôi nhận</h2>
        <p>
          Khi bạn chọn đăng nhập bằng Google, Supabase có thể lưu thông tin
          định danh cơ bản mà Google cung cấp, như tên, địa chỉ email và ảnh
          đại diện. Chúng tôi không nhận hoặc lưu mật khẩu Google của bạn.
        </p>

        <h2>Mục đích sử dụng</h2>
        <p>
          Thông tin đăng nhập được dùng để xác thực tài khoản, bảo vệ phiên làm
          việc và cung cấp các tính năng cá nhân hoá như lưu deal hoặc theo dõi
          cashback khi các tính năng này được kích hoạt.
        </p>

        <h2>Chia sẻ và bảo mật</h2>
        <p>
          Chúng tôi không bán thông tin cá nhân. Dữ liệu xác thực được xử lý bởi
          Supabase và Google theo cấu hình bảo mật của các dịch vụ này. Chỉ nhân
          sự hoặc hệ thống được uỷ quyền mới được truy cập dữ liệu cần thiết để
          vận hành dịch vụ.
        </p>

        <h2>Quyền của bạn</h2>
        <p>
          Bạn có thể yêu cầu xem, chỉnh sửa hoặc xoá dữ liệu tài khoản của mình.
          Liên hệ chúng tôi qua kênh hỗ trợ được công bố trên DealHoàn để thực
          hiện yêu cầu.
        </p>
      </article>
    </main>
  );
}
