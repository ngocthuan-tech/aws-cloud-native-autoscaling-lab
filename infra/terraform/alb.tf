# Công tắc: mặc định TẮT. Quên tắt thì tốn tiền, quên bật thì không sao.
variable "enable_runtime" {
  description = "Bật ALB và ECS service (tính tiền theo giờ). Tắt sau mỗi buổi làm."
  type        = bool
  default     = false
}

locals {
  runtime = var.enable_runtime ? 1 : 0
}

resource "aws_lb" "main" {
  count              = local.runtime
  name               = "${var.project}-alb"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "ui" {
  count                = local.runtime
  name                 = "${var.project}-ui-tg"
  port                 = var.container_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.main.id
  deregistration_delay = 30

  health_check {
    path                = "/actuator/health"
    matcher             = "200"
    interval            = 15
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  count             = local.runtime
  load_balancer_arn = aws_lb.main[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ui[0].arn
  }
}

output "alb_url" {
  value = try("http://${aws_lb.main[0].dns_name}", null)
}