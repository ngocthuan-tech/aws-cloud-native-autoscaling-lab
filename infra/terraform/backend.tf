terraform {
  backend "s3" {
    bucket       = "group14-tfstate-ngocthuan-1029"
    key          = "capstone/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }
}