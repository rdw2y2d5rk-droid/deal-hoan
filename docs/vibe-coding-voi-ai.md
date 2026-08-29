# Vibe coding với AI: cách giữ chất lượng code

Vibe coding hiệu quả không phải là giao hết cho AI rồi chờ kết quả. Hãy xem AI như một kỹ sư triển khai nhanh; bạn cung cấp tiêu chuẩn, kiểm tra đầu ra và chia nhỏ công việc để giữ quyền kiểm soát.

## Quy trình đề xuất

1. **Đưa chuẩn tham chiếu rõ ràng.** Gửi HTML/screenshot/Figma, danh sách màn hình, breakpoint, hành vi và ràng buộc kỹ thuật. Nêu phần nào phải giống tuyệt đối, phần nào được sáng tạo.
2. **Yêu cầu khảo sát trước khi sửa.** Ví dụ: “Đọc cấu trúc repo, package, quy ước và các file liên quan. Báo cáo kế hoạch ngắn trước khi chỉnh sửa.” Điều này tránh AI thay framework hoặc phá code sẵn có.
3. **Chia theo lát cắt có thể kiểm tra.** UI khung → responsive → tương tác → API → test. Mỗi lát cắt cần tiêu chí hoàn thành cụ thể.
4. **Yêu cầu bằng chứng.** Mỗi thay đổi phải nêu file sửa, lệnh lint/build/test đã chạy, kết quả, và phần nào chỉ là mock.
5. **Review bằng giao diện thật.** Chạy local, so sánh desktop/mobile, thử trạng thái lỗi/loading/empty. Screenshot phát hiện sai lệch UI rất nhanh.

## Prompt mẫu

```text
Bạn là senior frontend. Hãy triển khai trang theo file tham chiếu [đường dẫn].

Ràng buộc:
- Giữ Next.js/App Router và TypeScript hiện có; đọc tài liệu đúng phiên bản trước khi code.
- UI desktop bám sát bố cục, màu, typography, khoảng cách của mẫu; responsive tốt từ 375px.
- Chuyển tương tác trong mẫu thành React state, không nhúng prototype/iframe.
- Không sửa file không liên quan. Asset chưa có thì dùng placeholder có chủ đích và ghi rõ.

Quy trình:
1) Khảo sát repo và tóm tắt kế hoạch 5 dòng.
2) Triển khai component nhỏ, dữ liệu tách rõ khỏi UI.
3) Chạy lint và production build; sửa toàn bộ lỗi.
4) Báo cáo: file sửa, hành vi đã làm, lệnh kiểm tra/kết quả, giới hạn còn lại.
```

## Checklist đánh giá đầu ra AI

- [ ] Không có lỗi lint, TypeScript hoặc production build.
- [ ] Không thay đổi bất ngờ dependency, config hay file ngoài phạm vi.
- [ ] Component có tên rõ; dữ liệu lặp không copy-paste khắp JSX.
- [ ] Loading, lỗi nhập liệu, empty state và thao tác click có phản hồi.
- [ ] Desktop/mobile không tràn ngang, chữ không bị cắt, nút dùng được.
- [ ] Accessibility cơ bản: button thật cho action, focus thấy được, màu đủ tương phản.
- [ ] URL/API/analytics thật được đánh dấu rõ; không giả vờ đã tích hợp backend.

## Câu hỏi review nên hỏi AI

- “Điểm nào đang khác mẫu, và vì sao?”
- “Có giả định nào về dữ liệu hoặc API không?”
- “Những phần nào dễ vỡ ở màn hình mobile?”
- “Nếu phải bảo trì tính năng này 6 tháng, bạn sẽ tách gì tiếp?”
- “Hãy đưa test case thủ công cho các trạng thái lỗi và biên.”

Nguyên tắc: mô tả càng cụ thể, feedback càng sớm, và kiểm tra càng dựa trên bằng chứng thì code AI sinh ra càng đáng tin.
