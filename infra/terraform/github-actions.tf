# A reviews/applies this file. Defaults do not create any new IAM resources.
variable "github_actions_enabled" {
  description = "Enable GitHub OIDC and the ECR publisher after A reviews the policy"
  type        = bool
  default     = false
}

variable "github_oidc_provider_arn" {
  description = "Reuse an existing GitHub OIDC provider in this AWS account; null creates one"
  type        = string
  default     = null
}

variable "github_actions_ecs_services" {
  description = "Map of app name to existing ECS service NAME; only these services may be deployed"
  type        = map(string)
  default     = {}
  validation {
    condition = alltrue([
      for key, name in var.github_actions_ecs_services :
      contains(["ui", "catalog", "cart", "checkout", "orders"], key) && can(regex("^[a-zA-Z0-9_-]+$", name))
    ])
    error_message = "Use only the five app keys and valid existing ECS service names."
  }
}

locals {
  github_repository = "ngocthuan-tech/aws-cloud-native-autoscaling-lab"
  github_deploy     = var.github_actions_enabled && length(var.github_actions_ecs_services) > 0
  github_service_arns = [
    for name in values(var.github_actions_ecs_services) :
    "arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:service/${aws_ecs_cluster.main.name}/${name}"
  ]
}

resource "aws_iam_openid_connect_provider" "github" {
  count          = var.github_actions_enabled && var.github_oidc_provider_arn == null ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  # IAM validates GitHub's certificate using its trusted CA store.
}

data "aws_iam_policy_document" "github_assume" {
  count = var.github_actions_enabled ? 1 : 0
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.github_oidc_provider_arn != null ? var.github_oidc_provider_arn : aws_iam_openid_connect_provider.github[0].arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${local.github_repository}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_build" {
  count              = var.github_actions_enabled ? 1 : 0
  name               = "${var.project}-github-build"
  assume_role_policy = data.aws_iam_policy_document.github_assume[0].json
}

data "aws_iam_policy_document" "github_build" {
  count = var.github_actions_enabled ? 1 : 0
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"] # ECR authorization tokens do not support resource-level permissions.
    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["ap-southeast-1"]
    }
  }
  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload",
      "ecr:PutImage", "ecr:DescribeImages"
    ]
    resources = [for repo in aws_ecr_repository.service : repo.arn]
  }
}

resource "aws_iam_role_policy" "github_build" {
  count  = var.github_actions_enabled ? 1 : 0
  role   = aws_iam_role.github_build[0].id
  policy = data.aws_iam_policy_document.github_build[0].json
}

resource "aws_iam_role" "github_deploy" {
  count              = local.github_deploy ? 1 : 0
  name               = "${var.project}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume[0].json
}

data "aws_iam_policy_document" "github_deploy" {
  count = local.github_deploy ? 1 : 0
  statement {
    actions   = ["ecs:DescribeServices", "ecs:UpdateService"]
    resources = local.github_service_arns
  }
  statement {
    # These APIs require Resource="*"; PassRole and UpdateService remain restricted below.
    actions   = ["ecs:DescribeTaskDefinition", "ecs:RegisterTaskDefinition"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = ["ap-southeast-1"]
    }
  }
  statement {
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.ecs_execution.arn, aws_iam_role.ecs_task.arn]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
  statement {
    actions   = ["ecr:DescribeImages"]
    resources = [for repo in aws_ecr_repository.service : repo.arn]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  count  = local.github_deploy ? 1 : 0
  role   = aws_iam_role.github_deploy[0].id
  policy = data.aws_iam_policy_document.github_deploy[0].json
}

output "github_build_role_arn" {
  value = try(aws_iam_role.github_build[0].arn, null)
}

output "github_deploy_role_arn" {
  value = try(aws_iam_role.github_deploy[0].arn, null)
}
