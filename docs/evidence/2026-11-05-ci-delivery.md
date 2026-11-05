# Bằng chứng kiểm tra CI/CD — 05/11/2026

Nhánh: `ci/ecs-delivery`. Nền lúc bắt đầu: main `bcbb3da17a790ffa76decbf250ceda10470f22d0`.
Source ứng dụng kiểm tra: tag upstream `v1.6.3`, commit `d7a380b843e0759e58754f74188ea18252a51415`.

## Kết quả thực tế trên Windows/Docker Desktop

| Kiểm tra | Kết quả |
|---|---|
| `node --test scripts/ci/tests/*.test.mjs` | 22 passed, 0 failed |
| actionlint 1.7.12, ba workflow | Không phát hiện lỗi; kiểm tra shellcheck ngoài không chạy vì chưa có binary |
| Terraform 1.17.1 `fmt -check -recursive -diff` | Đạt |
| `init -backend=false -input=false -lockfile=readonly` | Đạt, giữ provider AWS 6.71.0 và lockfile hiện có |
| `terraform validate` | Đạt |
| `terraform test` với mock AWS | 4 passed, 0 failed |
| Docker build UI | Thành công |
| Docker build Catalog | Thành công |
| Docker build Cart | Thành công |
| Docker build Checkout | Thành công |
| Docker build Orders | Thành công |
| Metadata năm image | `linux/amd64`, runtime user `appuser` |

Các kiểm thử logic bao gồm lọc một service, thay đổi dùng chung, đổi tên/xóa file, diff thật bằng Git, bỏ sót sau run thất bại, khôi phục thủ công, chặn main cũ, ECR tag bất biến, receipt sai commit/digest, sửa đúng container, health check, circuit breaker, rollout lỗi, rollback và timeout.

Terraform mock kiểm tra circuit breaker/rollback và các cổng bật IAM, tách publisher/deployer, map ARN service. Mock không kiểm chứng AWS thực sự chấp nhận quyền OIDC/IAM.

Log build local (không đưa vào Git): `E:\HTTPB\tmp\ci-tools\build-{ui,catalog,cart,checkout,orders}.log`.
Image local: `group14/<service>:local-ci-check`. Không push các image local này lên ECR.
Actionlint tải từ release chính thức và đối chiếu SHA256 trước khi dùng.

## Lỗi đã xử lý

- Git Windows `core.autocrlf=true` khiến Maven wrapper có CRLF; Docker Linux báo `cannot execute: required file not found`. Chuẩn hóa ba wrapper trong checkout thử về LF rồi build thành công. Thêm `.gitattributes` cho source local của nhóm; ghi cách clone upstream với LF trong runbook.
- Terraform mock policy-document ban đầu tạo chuỗi ngẫu nhiên không phải JSON, khiến test schema của role cũ thất bại. Cung cấp policy JSON giả hợp lệ trong mock, giữ nguyên policy thật.
- Terraform filter đường dẫn test dùng dấu `/` không khớp đường dẫn Windows. Dùng `terraform test` với các file mock trong repo, xác minh có **4 tests thực sự chạy**, không lấy kết quả 0 tests làm bằng chứng đạt.
- Cart/Orders có cảnh báo viết hoa `FROM/as` của Dockerfile upstream; không ảnh hưởng kết quả build và không sửa upstream chỉ để loại cảnh báo.

## Phần chưa xác minh trên AWS

- Chưa assume OIDC role thật, chưa push ECR bằng workflow.
- Chưa deploy task lên ECS hoặc kiểm tra luồng nghiệp vụ trên ALB.
- Chưa kích hoạt/thử rollback circuit breaker thật và chưa có số đo hồi phục.
- AWS target vẫn disabled; A cần review/apply IAM, bàn giao service và bật variables theo runbook.

Build thành công chỉ chứng minh source/Dockerfile tạo được image. Java Dockerfile upstream bỏ qua application tests; B vẫn phụ trách kiểm thử chức năng và cấu hình backend.

## Trạng thái xuất bản nhánh

Mã đã commit local trên `ci/ecs-delivery`. Chưa push được từ phiên hỗ trợ: Git Credential Manager cần đăng nhập tương tác; kết nối GitHub đang dùng trả `403 Resource not accessible by integration` khi thử ghi. Không thay đổi nhánh main hoặc tạo PR.

Chủ tài khoản chạy `git push -u origin ci/ecs-delivery` trong terminal của mình rồi tạo PR. Chưa có kết quả GitHub-hosted Actions cho commit này; cần chờ `Application delivery` và `Terraform CI` trên PR xanh trước khi A merge. Kết quả local ở trên không được trình bày là kết quả CI online.
