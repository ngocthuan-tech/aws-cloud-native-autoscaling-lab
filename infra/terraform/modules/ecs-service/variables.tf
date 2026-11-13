variable "name" {
  type = string
}
variable "cluster_arn" {
  type = string
}
variable "task_definition_arn" {
  description = "A supplies an existing bootstrap task definition with health checks and linux/amd64"
  type        = string
}
variable "desired_count" {
  type    = number
  default = 1
}
variable "subnet_ids" {
  type = list(string)
}
variable "security_group_ids" {
  type = list(string)
}
variable "assign_public_ip" {
  description = "A decides egress; this module does not create NAT or public networking"
  type        = bool
  default     = false
}
variable "target_group_arn" {
  type    = string
  default = null
}
variable "container_name" {
  type    = string
  default = "ui"
}
variable "container_port" {
  type    = number
  default = 8080
}
variable "health_check_grace_period_seconds" {
  type    = number
  default = 120
}
