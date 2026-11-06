# ADR 0001 — nguồn ứng dụng và ranh giới CI/CD

Trạng thái: đề xuất cho A review qua PR, 05/11/2026.

## Bối cảnh

Repo nhóm chưa chứa source app hay ECS service. B đã mô tả năm service ở nhánh `app/SERVICES`; cả nhóm chưa thể họp để bàn giao đồng bộ. C cần làm trước pipeline mà không tự quyết định datastore/mạng hoặc tạo tài nguyên AWS.

## Đề xuất

1. Dùng source upstream commit `d7a380b843e0759e58754f74188ea18252a51415` (tag v1.6.3) làm mặc định. Mỗi service có file ghim riêng, cho phép nâng riêng hoặc chuyển sang source local có chủ đích.
2. PR/nhánh C chỉ build. Publish và deploy chỉ trên main, OIDC trust đúng repo/main. Tách IAM role push ECR khỏi role cập nhật ECS.
3. Tag theo SHA repo nhóm; ghi thêm source SHA trong receipt. Deploy bằng digest để không nhầm image do tag di chuyển. Chạy lại dùng image đã có, phù hợp ECR IMMUTABLE.
4. Chọn service theo đường dẫn; push main so với lần delivery thành công gần nhất để không bỏ sót thay đổi sau lỗi/hủy/những run đang chờ bị thay thế. Workflow dispatch là đường phục hồi và kích hoạt lần đầu.
5. A sở hữu bootstrap task/network/datastore/IAM; C chỉ đổi image trên task definition đang chạy. CD yêu cầu baseline khỏe, rolling deployment và circuit breaker/rollback trước khi thay phiên bản.
6. Chưa có ECS service thì để deploy target disabled. C cung cấp module Terraform tùy chọn và checklist kiểm chứng AWS, không tạo service mặc định hoặc gọi apply.

## Hệ quả

- Có thể review/test pipeline độc lập với tiến độ A/B; không cần họp để quyết định path/manifest.
- B cần tuân theo `app/services/<service>.json` và `app/src/<service>` khi đưa source riêng vào repo.
- Cơ chế đọc task definition đang chạy giữ cấu hình A, nhưng thay đổi cấu hình Terraform của A cần rollout riêng trước khi CD dùng nó.
- Các service deploy tuần tự trong mỗi run, không phải một giao dịch rollback đồng loạt. A/B cần đảm bảo tương thích giữa phiên bản service.
- Build và publish dùng hai job, đổi thêm một lượt khôi phục cache lấy việc job kiểm tra không có AWS credentials. Cache và upstream dependency vẫn có thể biến đổi; digest là bằng chứng của artifact thực tế, không tuyên bố build bit-for-bit.
- Mock/unit tests không chứng minh IAM OIDC thực tế, luồng nghiệp vụ ECS hay rollback thật. Các điểm đó phải được đo sau khi A bật hạ tầng.
