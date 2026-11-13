# Nơi lưu log của container; tự xóa log sau 7 ngày để không tốn phí lưu trữ
resource "aws_cloudwatch_log_group" "ui" {
  name              = "/ecs/${var.project}/ui"
  retention_in_days = 7
}

# Task definition: "bản vẽ" mô tả container ui cần gì để chạy (miễn phí)
resource "aws_ecs_task_definition" "ui" {
  family                   = "${var.project}-ui"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512  # 0.5 vCPU
  memory                   = 1024 # 1 GB, ui là Java nên cần đủ RAM
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "ui"
    image     = "public.ecr.aws/aws-containers/retail-store-sample-ui:1.6.3"
    essential = true

    portMappings = [{
      containerPort = var.container_port
      protocol      = "tcp"
    }]

    # Không khai báo địa chỉ catalog/cart/... nên ui tự dùng dữ liệu giả lập

    healthCheck = {
      command     = ["CMD-SHELL", "curl -sf http://localhost:${var.container_port}/actuator/health || exit 1"]
      interval    = 15
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.ui.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "ui"
      }
    }
  }])
}

# ECS service: giữ cho task ui luôn chạy, gắn vào ALB. Dùng module của C.
module "ui_service" {
  source = "./modules/ecs-service"
  count  = local.runtime

  name                = "${var.project}-ui"
  cluster_arn         = aws_ecs_cluster.main.arn
  task_definition_arn = aws_ecs_task_definition.ui.arn
  desired_count       = 1
  subnet_ids          = aws_subnet.public[*].id
  security_group_ids  = [aws_security_group.tasks.id]
  assign_public_ip    = true # bắt buộc: không có NAT, task cần IP công khai để kéo image
  target_group_arn    = aws_lb_target_group.ui[0].arn
  container_name      = "ui"
  container_port      = var.container_port

  depends_on = [aws_lb_listener.http]
}