.PHONY: tf-init tf-fmt tf-plan tf-apply tf-destroy

TF_DIR = infra/terraform

tf-init:
	cd $(TF_DIR) && terraform init

tf-fmt:
	cd $(TF_DIR) && terraform fmt -recursive && terraform validate

tf-plan:
	cd $(TF_DIR) && terraform plan

# Không dùng -auto-approve: luôn xem lại kế hoạch trước khi apply
tf-apply:
	cd $(TF_DIR) && terraform apply

# Chạy sau mỗi buổi làm việc để tránh tốn tiền Fargate và ALB
tf-destroy:
	cd $(TF_DIR) && terraform destroy