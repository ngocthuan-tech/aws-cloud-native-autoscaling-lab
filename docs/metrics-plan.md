# Kế hoạch đo lường và giám sát autoscaling

## 1. Mục đích

Đo trải nghiệm người dùng, tải và trạng thái các service, thời gian phản ứng autoscaling. Kết quả local dùng để kiểm tra kịch bản; chỉ kết quả chạy vào ALB của nhóm mới dùng làm bằng chứng autoscaling trên AWS.

## 2. Chỉ số phía người dùng

| Chỉ số | Cách đo | Đơn vị | Ghi chú |
|---|---|---|---|
| Tổng request rate | k6 `http_reqs` theo thời lượng chạy | request/giây | Bao gồm mọi request đã gửi; không mặc định là request thành công |
| Successful request rate | Request trả status thuộc nhóm thành công chia cho thời lượng | request/giây | Báo riêng với tổng request rate |
| Latency p50 | k6 `http_req_duration`, median | ms | 50% request hoàn tất trong hoặc dưới giá trị này |
| Latency p95 | k6 `http_req_duration`, p(95) | ms | Đại diện độ trễ ở đuôi cao |
| Latency p99 | k6 `http_req_duration`, p(99) | ms | Cho biết nhóm request chậm nhất |
| Error rate | k6 `http_req_failed` và kiểm tra status | % | Ghi riêng timeout, HTTP 4xx và HTTP 5xx khi có thể |

Không dùng latency trung bình làm số liệu duy nhất. Ghi cả median, p95, p99 và điều kiện chạy.

## 3. Chỉ số phía hệ thống

| Chỉ số | Nguồn dự kiến | Đơn vị |
|---|---|---|
| CPU theo ECS service | CloudWatch / Container Insights | % |
| Memory theo ECS service | CloudWatch / Container Insights | % |
| Desired, running, pending task | ECS service và CloudWatch | task |
| Request count per target | ALB CloudWatch metrics | request |
| Target response time | ALB CloudWatch metrics | ms |
| Target 5xx | ALB CloudWatch metrics | response |
| Healthy / unhealthy target | ALB target group | target |

Tên metric, dimensions và chu kỳ lấy mẫu cần xác nhận với A theo hạ tầng thực tế.

## 4. Chỉ số autoscaling

Ghi thời điểm theo cùng múi giờ và đồng bộ đồng hồ:

- `T0`: bắt đầu tăng tải.
- `T1`: ECS bắt đầu thay đổi desired task count hoặc có sự kiện scale.
- `T2`: task mới qua health check và nhận được traffic.
- `T3`: bắt đầu giảm tải.
- `T4`: task count giảm về mức nền hoặc mức tối thiểu đã cấu hình.

Tính và báo cáo:

- Thời gian từ tăng tải đến yêu cầu scale: `T1 - T0`.
- Thời gian từ tăng tải đến task mới sẵn sàng: `T2 - T0`.
- Thời gian scale-in: `T4 - T3`.

Nếu không lấy được một mốc chính xác, ghi nguồn dữ liệu và cách ước lượng; không tự suy đoán.

## 5. Điều kiện phải ghi cho mỗi lần chạy

- Ngày giờ bắt đầu/kết thúc và múi giờ.
- Môi trường: local hay AWS; URL đích chỉ ghi ALB của nhóm khi được A cho phép.
- Phiên bản app/image, commit và kịch bản k6.
- Phiên bản k6 và máy chạy tải.
- Loại tải: smoke, step, spike hoặc soak.
- VU/stage/thời lượng/think time.
- Desired/min/max task, chính sách scaling và cooldown nếu đã được A xác nhận.
- Kết quả: request rate, error rate, p50/p95/p99, CPU, memory, task count, các mốc scale.
- Link tới summary JSON, ghi chú và ảnh dashboard.

## 6. Nguyên tắc chạy tải

- Local test chỉ dùng để kiểm tra kịch bản và lấy baseline local.
- Chỉ chạy load test AWS vào ALB của nhóm sau khi báo A và chốt khung giờ.
- A xác nhận cấu hình autoscaling, task limits, ngưỡng và quyền CloudWatch trước thí nghiệm.
- Ngưỡng lỗi dưới 1% là mục tiêu ban đầu trong kế hoạch; xác nhận với A trước khi dùng làm tiêu chí pass/fail chính thức.
