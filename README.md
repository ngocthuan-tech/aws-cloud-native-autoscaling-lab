# Cloud-Native Microservices with Multi-Tier Autoscaling on AWS EKS

![AWS](https://img.shields.io/badge/AWS-EKS%20%7C%20RDS%20%7C%20DynamoDB-FF9900?logo=amazon-aws)
![Terraform](https://img.shields.io/badge/IaC-Terraform-7B42BC?logo=terraform)
![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes%20%7C%20Helm-326CE5?logo=kubernetes)
![Observability](https://img.shields.io/badge/Observability-Prometheus%20%7C%20Grafana-E6522C?logo=prometheus)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions%20%7C%20Trivy-2088FF?logo=github-actions)

## 📌 Tổng quan dự án (Overview)
Dự án nghiên cứu, triển khai và đánh giá hiệu năng hệ thống Microservices trên nền tảng **Amazon EKS** với cơ chế **Tự động co giãn đa tầng (Multi-tier Autoscaling)**:
- **Tầng Pod (HPA):** Co giãn theo chỉ số tùy chỉnh **RPS (Requests Per Second)** qua Prometheus Adapter thay vì chỉ dùng CPU truyền thống (bám sát Định luật Little).
- **Tầng Node (Cluster Autoscaler):** Tự động cấp phát/thu hồi EC2 instances khi Pod rơi vào trạng thái `Pending`.

## 🎯 Phân định phạm vi đóng góp (Scope of Contribution)
* **Workload tham chiếu:** Sử dụng mã nguồn ứng dụng từ `aws-containers/retail-store-sample-app` (MIT-0 License) làm đối tượng chịu tải.
* **Phần tự thiết kế & triển khai (100% thực hiện trong đồ án):**
  1. **Infrastructure as Code (Terraform):** Thiết kế mạng VPC Multi-AZ, EKS Cluster, RDS, DynamoDB, Redis, ECR và bảo mật qua IRSA + AWS Secrets Manager.
  2. **CI/CD & DevSecOps:** Pipeline GitHub Actions xác thực qua OIDC (Zero long-lived keys), quét lỗ hổng image bằng Trivy và tự động deploy qua Helm.
  3. **Observability Stack:** Thiết lập Prometheus ServiceMonitor thu thập custom metrics và thiết kế Grafana Dashboard theo dõi Golden Signals.
  4. **Multi-tier Autoscaling & Tuning:** Cấu hình HPA (CPU vs RPS), Cluster Autoscaler, PodDisruptionBudget và tinh chỉnh chống dao động (flapping).
  5. **Benchmarking & Chaos Engineering:** Kịch bản tải k6 (10 -> 500 VUs) qua 4 kịch bản (A, B, C, D), đo MTTR khi tiêm lỗi và phân tích chi phí trên mỗi 1,000 requests.

## 🏗️ Kiến trúc hệ thống (Architecture)
*(Chèn sơ đồ kiến trúc từ thư mục `docs/architecture/` vào đây ở P0.3 và P1)*

## 📊 Kết quả thực nghiệm nổi bật (Key Findings)
| Kịch bản | Cơ chế co giãn | Độ trễ p95 (ms) | Tỷ lệ lỗi (%) | Thời gian Scale-out (s) | Chi phí / 1k reqs ($) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **A (Baseline)** | Tắt toàn bộ | *TBD* | *TBD* | N/A | *TBD* |
| **B** | Chỉ bật HPA | *TBD* | *TBD* | *TBD* | *TBD* |
| **C** | HPA + Cluster Autoscaler | *TBD* | *TBD* | *TBD* | *TBD* |
| **D (Optimized)**| HPA (RPS) + CA + Tuned | *TBD* | *TBD* | *TBD* | *TBD* |

## 🚀 Hướng dẫn tái lập (Reproducibility)
*(Cập nhật các lệnh chạy Local Docker Compose và Terraform Apply tại đây)*
