import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng | DealHoàn",
  description: "Điều khoản sử dụng của DealHoàn.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <Link className="legal-brand" href="/">
          ← DealHoàn
        </Link>
        <p className="legal-kicker">Cập nhật lần cuối: 30/08/2026</p>
        <h1>Điều khoản sử dụng</h1>
        <p>
          Khi sử dụng DealHoàn, bạn đồng ý với các điều khoản dưới đây. DealHoàn
          giúp tổng hợp thông tin deal và hỗ trợ chuyển đổi liên kết hoàn tiền.
        </p>

        <h2>Thông tin deal và cashback</h2>
        <p>
          Giá, mã giảm giá, số lượng và mức hoàn tiền có thể thay đổi theo sàn
          thương mại điện tử hoặc đối tác. Thông tin hiển thị không phải là cam
          kết về giá cuối cùng hay khoản hoàn tiền được duyệt.
        </p>

        <h2>Điều kiện ghi nhận hoàn tiền</h2>
        <p>
          Người dùng cần mua qua liên kết đã chuyển đổi, tuân thủ điều kiện của
          sàn và không thực hiện các hành vi làm đơn hàng không hợp lệ. Đơn huỷ,
          hoàn trả hoặc vi phạm điều kiện của sàn có thể không được ghi nhận.
        </p>

        <h2>Tài khoản</h2>
        <p>
          Bạn chịu trách nhiệm bảo vệ tài khoản của mình. Không sử dụng tài
          khoản để gian lận, can thiệp vào hoạt động của hệ thống hoặc gây ảnh
          hưởng đến quyền lợi của người dùng khác.
        </p>

        <h2>Thay đổi dịch vụ</h2>
        <p>
          DealHoàn có thể cập nhật tính năng hoặc điều khoản để phù hợp với hoạt
          động của nền tảng và yêu cầu từ đối tác. Phiên bản mới sẽ được công bố
          tại trang này.
        </p>
      </article>
    </main>
  );
}
