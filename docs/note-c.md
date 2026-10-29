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
### Bổ sung workflow Terraform CI

- Tạo workflow .github/workflows/terraform-ci.yml.
- Workflow chạy khi có PR vào main và khi có push vào main.
- Dùng Terraform 1.17.1 trên GitHub-hosted runner Ubuntu.
- Kiểm tra định dạng bằng terraform fmt -check.
- Khởi tạo phục vụ validation bằng terraform init -backend=false.
- Kiểm tra cấu hình bằng terraform validate.
- Chỉ cấp quyền đọc nội dung repository cho workflow.

### Bằng chứng thực hiện

- Link Pull Request: https://github.com/ngocthuan-tech/aws-cloud-native-autoscaling-lab/pull/6
- Link GitHub Actions: https://github.com/ngocthuan-tech/aws-cloud-native-autoscaling-lab/actions/runs/40897467644
- Kết quả: Terraform CI thành công; kiểm tra định dạng, khởi tạo phục vụ validation và validate đều đạt.

### Lỗi CI và cách khắc phục

- Hiện tượng: validate thất bại vì checksum provider AWS không khớp lockfile trên runner Linux.
- Nguyên nhân: lockfile thiếu checksum dành cho linux_amd64.
- Xử lý: dùng Terraform providers lock bổ sung checksum cho Windows và Linux.
- Kết quả: giữ nguyên provider AWS 6.71.0 và chế độ lockfile readonly; CI chạy lại thành công.

### Trạng thái bàn giao

- PR #6 đã mở, CI đạt, đang chờ A review.
- Việc tiếp theo: nhận cấu hình build từ B và chuẩn bị đề xuất OIDC với A.