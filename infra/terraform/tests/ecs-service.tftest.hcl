mock_provider "aws" {}

run "rolling_service_has_rollback" {
  command = plan
  module {
    source = "./modules/ecs-service"
  }
  variables {
    name                = "test-ui"
    cluster_arn         = "arn:aws:ecs:ap-southeast-1:123456789012:cluster/test"
    task_definition_arn = "arn:aws:ecs:ap-southeast-1:123456789012:task-definition/test-ui:1"
    subnet_ids          = ["subnet-12345678"]
    security_group_ids  = ["sg-12345678"]
  }
  assert {
    condition     = aws_ecs_service.this.deployment_circuit_breaker[0].enable && aws_ecs_service.this.deployment_circuit_breaker[0].rollback
    error_message = "Circuit breaker and rollback must both be enabled."
  }
  assert {
    condition     = aws_ecs_service.this.deployment_controller[0].type == "ECS" && aws_ecs_service.this.launch_type == "FARGATE"
    error_message = "Only rolling ECS/Fargate deployments are supported."
  }
  assert {
    condition     = !aws_ecs_service.this.network_configuration[0].assign_public_ip
    error_message = "Public IP must be an explicit decision by A."
  }
}
