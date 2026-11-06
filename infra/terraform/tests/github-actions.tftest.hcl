mock_provider "aws" {
  # This test checks resource gates/scoping, not IAM authorization semantics.
  # Policy-document data sources need valid JSON for downstream schema validation.
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
    }
  }
  mock_data "aws_availability_zones" {
    defaults = {
      names = ["ap-southeast-1a", "ap-southeast-1b"]
    }
  }
}

run "iam_is_opt_in" {
  command = plan
  assert {
    condition     = length(aws_iam_role.github_build) == 0 && length(aws_iam_role.github_deploy) == 0 && length(aws_iam_openid_connect_provider.github) == 0
    error_message = "Default configuration must not create GitHub IAM resources."
  }
}

run "publisher_does_not_enable_deployer" {
  command = plan
  variables {
    github_actions_enabled = true
  }
  assert {
    condition     = length(aws_iam_role.github_build) == 1 && length(aws_iam_role.github_deploy) == 0
    error_message = "Publisher must not implicitly enable ECS deployment."
  }
}

run "reuse_provider_and_scope_deploy_targets" {
  command = plan
  variables {
    github_actions_enabled      = true
    github_oidc_provider_arn    = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
    github_actions_ecs_services = { ui = "group14-ui" }
  }
  assert {
    condition     = length(aws_iam_openid_connect_provider.github) == 0 && length(aws_iam_role.github_deploy) == 1
    error_message = "Reuse the existing provider and create a deploy role only when targets exist."
  }
  assert {
    condition     = local.github_service_arns == ["arn:aws:ecs:ap-southeast-1:123456789012:service/group14-capstone-cluster/group14-ui"]
    error_message = "Deploy service ARNs must be scoped to the configured account, region, cluster and service."
  }
}
