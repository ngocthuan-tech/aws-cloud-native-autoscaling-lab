# Kiểm tra Terraform trước khi A duyệt PR

Cập nhật 08/11/2026. Chủ trì CI: C; A review mọi thay đổi hạ tầng và tự chạy apply.

## Các bước trong Terraform CI

| Bước | Mục đích | Truy cập AWS/state chung? |
|---|---|---|
| `terraform fmt -check -recursive -diff` | Giữ định dạng nhất quán | Không |
| `tflint --init` | Cài bộ quy tắc đã ghim từ GitHub | Không; cần mạng tải plugin |
| `tflint --recursive ...` | Tìm lỗi tĩnh trong root và module con | Không |
| `terraform init -backend=false -input=false -lockfile=readonly` | Nạp provider/module để validate, giữ lockfile | Không truy cập backend; có thể cần tải provider |
| `terraform validate` | Kiểm tra cấu trúc, kiểu và tham chiếu | Không |
| `terraform test` | Kiểm tra các tình huống mock hiện có | Không, các file test hiện tại đều dùng mock AWS |

Workflow chạy trên PR vào `main`, push `main` và `ci/**`. Tên check vẫn là `Terraform checks`; quyền workflow vẫn chỉ `contents: read`. Không có `terraform plan`, apply hoặc AWS credentials trong workflow này.

Lint có lỗi/cảnh báo sẽ trả mã khác 0, làm check thất bại. Không dùng `--force`, `continue-on-error` hoặc tắt cả bộ quy tắc để làm check xanh. Nếu có cảnh báo sai, C/A review lý do cụ thể trong PR trước khi điều chỉnh rule.

## Phiên bản và phạm vi quét

- TFLint `0.65.0`, đọc từ `.tflint-version`; `.tflint.hcl` yêu cầu đúng phiên bản đó.
- Bộ quy tắc Terraform `recommended`, phiên bản `0.15.0` đi kèm TFLint.
- AWS ruleset `0.50.0`, ghim trong `.tflint.hcl`.
- Action setup-tflint `v6.3.2` ghim bằng commit đầy đủ; archive TFLint Linux trong CI được kiểm tra SHA256.
- Cache plugin dựa trên `.tflint.hcl`, giảm tải lại nhưng vẫn chạy lint mỗi lần.
- Truyền **đường dẫn tuyệt đối** tới `.tflint.hcl` khi dùng `--recursive`, để module con cũng dùng đúng rule AWS và cấu hình chung.

Khi nâng phiên bản, C cập nhật `.tflint-version`, `required_version` trong `.tflint.hcl`, checksum Linux ở workflow và hướng dẫn Windows bên dưới trong cùng PR. Bản AWS plugin nâng riêng cũng cần chạy lại lint trước khi A merge. Các rule tĩnh không thay thế kiểm thử AWS, review least privilege hoặc quét bảo mật chuyên dụng.

## Chạy trên máy Windows

Mở PowerShell tại repo. Không cần quyền Administrator, không cần đăng nhập AWS. Các lệnh sau tải TFLint vào thư mục tạm và kiểm tra hash của bản Windows đã ghim:

```powershell
Set-Location 'E:\HTTPB\aws-cloud-native-autoscaling-lab'
$tflintHome = Join-Path $env:TEMP 'group14-tflint-0.65.0'
New-Item -ItemType Directory -Force $tflintHome | Out-Null
$tflintZip = Join-Path $tflintHome 'tflint.zip'
Invoke-WebRequest -Uri 'https://github.com/terraform-linters/tflint/releases/download/v0.65.0/tflint_windows_amd64.zip' -OutFile $tflintZip
$expectedHash = '292e760adf0e9c7e0f10ddeb0f6add67fd6d2c68b5449fdf766ff6ffddce465c'
if ((Get-FileHash $tflintZip -Algorithm SHA256).Hash.ToLower() -ne $expectedHash) {
    throw 'Checksum TFLint khong khop; dung lai, khong chay file nay.'
}
Expand-Archive -LiteralPath $tflintZip -DestinationPath $tflintHome -Force
$tflintExe = Join-Path $tflintHome 'tflint.exe'
$env:TFLINT_PLUGIN_DIR = Join-Path $tflintHome 'plugins'
$lintConfig = (Resolve-Path '.tflint.hcl').Path
& $tflintExe --init --config $lintConfig
if ($LASTEXITCODE -ne 0) { throw 'Khong cai duoc plugin TFLint' }
& $tflintExe --chdir=infra/terraform --recursive --config $lintConfig --format compact
if ($LASTEXITCODE -ne 0) { throw 'TFLint phat hien loi/canh bao; doc vi tri va ten rule' }
```

Nếu dùng terminal khác, khai báo lại biến đường dẫn hoặc dùng đầy đủ đường dẫn executable. Đây là công cụ local; không commit thư mục tạm hay plugin binary.

Ví dụ cảnh báo đã gặp: module `ecs-service` thiếu version constraint của AWS provider. Sửa `required_providers` trong module để có `version = "~> 6.0"`, khớp cấu hình root. Provider đang khóa vẫn `6.71.0`, không chạy upgrade hay đổi lockfile để xử lý cảnh báo này.

## Bằng chứng kiểm tra ngày 08/11

- Repo thực tế sau sửa: TFLint recursive exit 0, cả root và module ECS không có cảnh báo.
- Fixture riêng trong thư mục tạm, không commit: đặt biến không dùng và instance type không hợp lệ trong một module con. TFLint trả exit 2 và phát hiện cả `terraform_unused_declarations` lẫn `aws_instance_invalid_type`.
- Sửa hai lỗi trong fixture, chạy lại: exit 0. Fixture chỉ dùng để lint; không init/plan/apply, không tạo EC2.
- Terraform fmt, init không backend/lockfile readonly, validate đạt; 4 Terraform mock tests đạt.
- actionlint 1.7.12 kiểm tra cú pháp workflow đạt; chưa có kiểm tra shellcheck ngoài.

Kết quả local này chưa thay thế kết quả Actions trên PR. Chỉ ghi CI online đạt khi run thực tế hoàn tất thành công.

## Phần tiếp theo của C

1. Terraform plan/comment trong PR: cần thiết kế quyền đọc state, OIDC và phạm vi chạy cùng A; chưa bật trong thay đổi TFLint này.
2. Tổng hợp số liệu build/deploy cho D. Số liệu ECS chỉ có sau khi AWS delivery được kích hoạt.
3. Quét image/secrets/IaC ở mốc DevSecOps tiếp theo.

Nguồn chính thức: [TFLint 0.65.0](https://github.com/terraform-linters/tflint/releases/tag/v0.65.0), [cấu hình recursive](https://github.com/terraform-linters/tflint/blob/v0.65.0/docs/user-guide/working-directory.md), [setup-tflint 6.3.2](https://github.com/terraform-linters/setup-tflint/tree/v6.3.2).
