# Service Dependency Diagram – Nhóm 14

**Đề tài:** Cloud-native Microservices with Autoscaling  
**Phụ trách:** B – App & Container  
**Ứng dụng:** AWS Retail Store Sample App v1.6.3

## 1. Tổng quan

Tài liệu mô tả mối quan hệ giữa năm microservice của ứng dụng Retail Store và các thành phần lưu trữ, messaging trong môi trường Docker Compose local.

Sơ đồ được tách từ tài liệu [SERVICES.md](../../app/SERVICES.md) để thành viên A, C, D dễ tham khảo khi triển khai ECS Fargate, CI/CD và kiểm thử tải.

## 2. Sơ đồ phụ thuộc

```mermaid
flowchart TD
  Browser["Người dùng"] --> UI["UI :8080 / host :8888"]

  UI -->|carts:8080| Cart["Cart"]
  UI -->|catalog:8080| Catalog["Catalog"]
  UI -->|checkout:8080| Checkout["Checkout"]
  UI -->|orders:8080| Orders["Orders"]

  Catalog -->|catalog-db:3306| MariaDB[("MariaDB")]
  Catalog -.->|Tìm kiếm đang tắt| OpenSearch[("OpenSearch :9200")]

  Cart -->|carts-db:8000| DynamoDB[("DynamoDB Local")]

  Checkout -->|Redis URL| Redis[("Redis")]
  Checkout -->|orders:8080| Orders

  Orders -->|orders-db:5432| PostgreSQL[("PostgreSQL")]
  Orders -->|rabbitmq:5672| RabbitMQ["RabbitMQ"]
```

## 3. Bảng kết nối giữa các service

| Service | Thành phần phụ thuộc | Mục đích |
|---|---|---|
| UI | Catalog, Cart, Checkout, Orders | Gọi các API nghiệp vụ |
| Catalog | MariaDB | Lưu trữ thông tin sản phẩm |
| Catalog | OpenSearch | Tìm kiếm sản phẩm, hiện đang tắt |
| Cart | DynamoDB Local | Lưu dữ liệu giỏ hàng |
| Checkout | Redis | Lưu trạng thái checkout |
| Checkout | Orders | Gửi yêu cầu tạo đơn |
| Orders | PostgreSQL | Lưu dữ liệu đơn hàng |
| Orders | RabbitMQ | Trao đổi thông điệp |

### 3.1. Phân biệt kết nối runtime và thứ tự khởi động

Các mũi tên trong sơ đồ thể hiện kết nối ứng dụng được cấu hình, không đại diện trực tiếp cho `depends_on` của Docker Compose.

| Service | `depends_on` trong Compose đã khảo sát |
|---|---|
| UI | Cart, Catalog, Checkout, Orders |
| Catalog | catalog-db, opensearch |
| Cart | carts-db |
| Checkout | checkout-redis |
| Orders | orders-db |

Checkout gọi Orders và Orders kết nối RabbitMQ khi xử lý nghiệp vụ, dù những kết nối này không được khai báo trong `depends_on` tương ứng.

OpenSearch vẫn có trong Compose và trong `depends_on` của Catalog, mặc dù tính năng tìm kiếm đang tắt.

### 3.2. Phạm vi bằng chứng

- Ngày khảo sát: 13/11/2026.
- Source commit: `d7a380b843e0759e58754f74188ea18252a51415`.
- File Compose local đã được đối chiếu với asset của release `v1.6.3`.
- Cấu hình và DNS local đã được kiểm tra; tên `carts` có trong DNS metadata của container Cart và đã được

## 4. Lưu ý khi triển khai trên ECS Fargate

- Các hostname như `carts`, `catalog-db`, `orders-db` là địa chỉ trong Docker Compose local, không tự động sử dụng được trên ECS.
- A cần cấu hình mạng nội bộ, service discovery và endpoint các backend phù hợp trên AWS.
- Năm microservice đều sử dụng cổng container `8080`.
- Health check của UI, Cart và Orders là `/actuator/health`; Catalog và Checkout là `/health`.
- Khi scale nhiều task, dữ liệu cần thiết phải được lưu trữ hoặc chia sẻ phù hợp để tránh mất trạng thái.
- Hiện chưa có bằng chứng xác nhận đầy đủ kết nối AWS và khả năng hoạt động với nhiều replica.

## 5. Phân công sử dụng tài liệu

- **A – Platform:** Tham khảo để cấu hình networking, ECS Services và backend.
- **B – App & Container:** Duy trì sơ đồ, xác minh dependencies và kiểm thử.
- **C – CI/CD:** Tham khảo cấu hình các service khi build và deploy.
- **D – Observability:** Xác định luồng nghiệp vụ cho k6 và theo dõi lỗi.

## 6. Tài liệu tham khảo

- [Đặc tả microservices của nhóm](../../app/SERVICES.md)
- [AWS Retail Store Sample App](https://github.com/aws-containers/retail-store-sample-app)

**Trạng thái:** Đã khảo sát trên Docker Compose local; chưa xác nhận triển khai AWS.