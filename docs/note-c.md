# Nhật ký thành viên C — CI/CD & DevSecOps

## Ngày 29/10/2026

### Đã thực hiện

- Clone repository aws-cloud-native-autoscaling-lab về máy Windows.
- Kiểm tra remote origin trỏ đúng repository của nhóm.
- Cấu hình tên và email dùng cho Git commit.
- Tạo và chuyển sang nhánh ci/bootstrap.

### Lỗi gặp phải và cách xử lý

1. Chạy git clone lần thứ hai báo thư mục đã tồn tại.
   - Nguyên nhân: lần clone đầu tiên đã thành công.
   - Xử lý: sử dụng thư mục đã clone và kiểm tra bằng git status.

2. Gõ nhầm cấu hình user.emial.
   - Nguyên nhân: sai chính tả tên cấu hình.
   - Xử lý: xóa cấu hình sai, đặt lại user.email và kiểm tra kết quả.

### Công việc đang thực hiện

- Bổ sung CODEOWNERS.
- Bổ sung mẫu Pull Request.
- Chuẩn bị PR đầu tiên để nhóm trưởng A review.

### Công việc tiếp theo

- Phối hợp với A kiểm tra quy định bảo vệ nhánh main.
- Nhận từ B đường dẫn Dockerfile, build context và lệnh build từng service.
- Thiết lập kiểm tra Terraform trong GitHub Actions.
- Chuẩn bị đề xuất Terraform cho GitHub Actions OIDC.