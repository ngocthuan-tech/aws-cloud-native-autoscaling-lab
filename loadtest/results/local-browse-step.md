# Local browse step-load

- Ngày chạy: 2026-11-14
- Môi trường: local Docker Desktop
- App: Retail Store v1.6.3
- Target: http://localhost:8888
- k6: v2.3.0
- Kịch bản: loadtest/scenarios/browse_load.js
- Tải: 1 → 5 → 10 VU, sau đó giảm về 0
- Thời lượng: 2m10s
- Max VU: 10

## Kết quả

- HTTP requests: 1,214
- Throughput tổng: 9.31 request/s
- Failed requests: 0 / 1,214 (0%)
- Checks: 2,428 / 2,428 đạt
- Median latency: 28.53 ms
- p95 latency: 58.24 ms
- p99 latency: 75.91 ms
- Max latency: 92.09 ms
- Threshold `rate<0.01`: đạt theo kết quả k6 hiển thị trong terminal

## Giới hạn

Đây là kết quả đo local trên một máy, không chứng minh autoscaling hoặc hiệu năng AWS.