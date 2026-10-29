.PHONY: local-up local-down tf-init tf-plan tf-apply tf-destroy

# P0: Chạy ứng dụng ở môi trường Local
local-up:
	docker compose -f app/docker-compose.yml up -d

local-down:
	docker compose -f app/docker-compose.yml down -v

# P1: Quản lý hạ tầng AWS bằng Terraform
tf-init:
	cd infra && terraform init

tf-plan:
	cd infra && terraform plan

tf-apply:
	cd infra && terraform apply -auto-approve

# QUAN TRỌNG: Chạy lệnh này sau mỗi buổi làm việc để tránh tốn tiền NAT Gateway & EKS!
tf-destroy:
	cd infra && terraform destroy -auto-approve
