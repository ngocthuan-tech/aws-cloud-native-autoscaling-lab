resource "aws_ecs_cluster" "main" {
  name = "${var.project}-cluster"

  # Tạm tắt Container Insights để tiết kiệm; bật lại ở Phần 2 khi D làm dashboard
  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}
