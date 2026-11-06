# ECS service cho A tích hợp

Module tùy chọn, chưa được gọi trong root. C không apply module.
Module tạo một ECS Fargate service dùng ECS rolling, circuit breaker và rollback luôn bật.
Không tạo task definition, ALB, target group, subnet, security group hoặc datastore.

A truyền các input sau sau khi review kiến trúc:

| Input | Nguồn |
|---|---|
| `name` | Tên ECS service do A chọn; đồng bộ JSON CD và map IAM |
| `cluster_arn` | `aws_ecs_cluster.main.arn` |
| `task_definition_arn` | Bootstrap task đã có image ECR, role, log, health check và cấu hình B |
| `subnet_ids` | Subnet A chọn với egress thích hợp để kéo ECR |
| `security_group_ids` | SG task do A quản lý |
| `assign_public_ip` | A quyết định; mặc định false, không tự tạo NAT |
| `target_group_arn` | Target group có sẵn nếu service sau ALB; còn lại null |
| `container_name`, `container_port` | Container nhận traffic, mặc định ui:8080 |
| `health_check_grace_period_seconds` | Mặc định 120 khi có ALB; B/A điều chỉnh theo thời gian khởi động |

ALB listener phải gắn target group trước khi tạo service; A thêm `depends_on` ở module call nếu cần.
Task definition của backend không dùng ALB cần container health check.
Network mặc định không hứa sẽ có Internet: private subnet hiện tại của repo chưa có NAT. A chọn giải pháp egress theo kiến trúc/chi phí của nhóm.

Nếu resource ECS service đã tồn tại, tích hợp hai block sau vào resource đang được Terraform quản lý thay vì tạo trùng:

```hcl
deployment_controller {
  type = "ECS"
}
deployment_circuit_breaker {
  enable   = true
  rollback = true
}
```

Module đặt minimum healthy 100%, maximum 200% để rolling update có chỗ chạy phiên bản mới. Điều này có thể tăng task tạm thời; A tính vào khung giờ thử.

Sau bootstrap, `ignore_changes = [task_definition, desired_count]` phân quyền sở hữu: CD quản lý revision, autoscaling quản lý số task. Nếu A sửa environment/role/log/health check trong một task definition mới, A phải chủ động rollout revision cấu hình đó và đợi khỏe; chỉ apply Terraform sẽ không đổi revision của service qua module này. CD sau đó lấy revision đang chạy làm nền và thay image. Không kỳ vọng CD tự lấy mọi task definition vừa đăng ký nhưng chưa triển khai.

Thử nghiệm mặc định nằm ở `../../tests/ecs-service.tftest.hcl`, dùng mock AWS. Muốn thử rollback thật, dùng checklist mục 6 trong `docs/cicd-runbook.md`.
