# Kế hoạch đo lường và giám sát Autoscaling (Nhóm 14)

## 1. Chỉ số trải nghiệm người dùng (Client-Side Metrics - Đo bằng k6)
- **RPS (Requests Per Second):** Số lượng request hệ thống xử lý thành công mỗi giây.
- **Độ trễ (Latency - p95 & p99):** 95% và 99% request phải phản hồi dưới mức thời gian này. Bắt buộc dùng phân vị, không dùng Average để tránh bị nhiễu.
- **Error Rate:** Tỉ lệ request lỗi (HTTP 5xx, 4xx hoặc timeout). Ngưỡng chấp nhận < 1%.

## 2. Chỉ số hiệu suất hệ thống (Server-Side Metrics - Đo bằng CloudWatch)
- **CPU & Memory Utilization:** Mức tiêu thụ trung bình theo từng dịch vụ (ui, catalog, cart, checkout, orders).
- **Active Task Count:** Số lượng container Fargate đang chạy thực tế tại một thời điểm.
- **Request Count per Target:** Tải thực tế phân bổ vào từng task qua Application Load Balancer.

## 3. Chỉ số đánh giá Autoscaling (Đo lường thời gian đáp ứng)
- **Detection Time (Thời gian phát hiện):** Khoảng thời gian từ lúc tải k6 tăng đột biến đến khi CloudWatch Alarm chuyển trạng thái \`ALARM\`.
- **Provisioning Time (Thời gian cấp phát):** Thời gian ECS gọi Fargate tạo task mới và pull image.
- **Ready Time (Thời gian sẵn sàng):** Thời gian ứng dụng khởi động xong và vượt qua ALB Health Check để bắt đầu nhận tải.
- **Scale-in Cooldown:** Thời gian hệ thống thu hồi task dư thừa sau khi k6 ngừng test.