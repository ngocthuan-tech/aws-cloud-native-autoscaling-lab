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

## Ngày 05/11/2026 — CI/CD đến lọc service và circuit breaker

- Đã xác minh PR #6 được A merge; nhánh công việc mới `ci/ecs-delivery` xuất phát từ main mới nhất khi bắt đầu.
- Chuẩn bị matrix build năm service, cache riêng, nguồn ứng dụng ghim SHA, OIDC publisher và reusable workflow deploy.
- Lọc đường dẫn từng service; main so với lần delivery thành công gần nhất để bao phủ thay đổi sau run lỗi; từ chối publish/deploy lại main cũ.
- Tag ECR theo commit, chạy lại tái dùng immutable tag, deploy bằng digest và kiểm tra đúng ECS revision.
- Đề xuất Terraform OIDC/IAM opt-in cùng module ECS service có circuit breaker + rollback. A review/apply, C không tạo tài nguyên AWS.
- Viết `docs/cicd-runbook.md` để A/B/D tiếp nhận bất đồng bộ và ADR ghi lý do quyết định.
- Gặp lỗi `mvnw: cannot execute` trong Docker build local do Git Windows checkout CRLF. Đổi wrapper ở clone kiểm thử về LF; thêm quy tắc LF cho source local của nhóm. Không sửa Dockerfile upstream để che lỗi môi trường.
- Bằng chứng kiểm tra và phần còn chờ AWS ghi tại `docs/evidence/2026-11-05-ci-delivery.md`.
