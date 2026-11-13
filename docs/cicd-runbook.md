# CI/CD — quy ước và bàn giao cho A, B, C, D

Ngày chuẩn bị: 05/11/2026. Nội dung này là đề xuất trong PR của C; có hiệu lực chung sau khi A duyệt và merge.

## 1. Quy trình Git của nhóm

- C làm trên nhánh `ci/...`; B dùng `app/...`; A dùng `infra/...`.
- Commit theo Conventional Commits. Không push trực tiếp `main`, không force-push, không tự bỏ bảo vệ nhánh.
- PR vào `main`, dùng mẫu PR hiện có, yêu cầu `ngocthuan-tech` review. A quyết định merge.
- Ruleset kiểm tra ngày 05/11 yêu cầu một approving review; chưa đặt CI thành required status checks. C không tự sửa ruleset. Đề xuất A yêu cầu `Delivery checks` và `Terraform checks` sau khi hai workflow chạy xanh trên PR.
- PR #6 về quy ước và Terraform CI đã merge. Công việc này bắt đầu từ `main` tại `bcbb3da17a790ffa76decbf250ceda10470f22d0`.

## 2. Pipeline chạy như thế nào?

1. PR vào `main`, push vào `ci/**` hoặc `main` kích hoạt `Application delivery`.
2. Job chọn service chạy các kiểm thử Node và tạo matrix từ file thay đổi.
3. Matrix build những service được chọn, tối đa năm job đồng thời, `linux/amd64`, có Docker layer cache riêng từng service.
4. PR và nhánh `ci/**` kết thúc ở kiểm tra build, không có quyền AWS trong job build.
5. Trên `main`, khi `AWS_PUBLISH_ENABLED=true`, job riêng dùng OIDC role build để push ECR.
6. Image dùng tag `sha-<40 ký tự commit của repo nhóm>`. Nếu tag đã tồn tại thì tái sử dụng digest; không ghi đè tag IMMUTABLE.
7. Khi `AWS_DEPLOY_ENABLED=true`, workflow gọi `deploy.yml`, chỉ nhận matrix vừa build/publish thành công. Từng service còn cần `enabled: true` trong `ci/deploy-targets.json`.
8. Deploy theo digest, lấy task definition hiện tại trên ECS, giữ nguyên cấu hình/sidecar và chỉ thay image của container đã chỉ định. Tạo revision mới rồi cập nhật đúng service.
9. Đợi đúng revision mới đạt `COMPLETED`, đủ running tasks, không còn pending task. Rollback về revision cũ làm workflow thất bại, dù bản cũ khỏe.

`Delivery checks` là check tổng hợp: lỗi/hủy ở một stage làm check thất bại; sửa tài liệu không cần build vẫn có check thành công. Publish/deploy bị tắt sẽ được ghi ở summary; CI xanh trong chế độ này **không có nghĩa đã triển khai AWS**.

## 3. Nguồn ứng dụng và cách B sửa một service

Nguồn chính thức: `aws-containers/retail-store-sample-app`.
Năm file `app/services/{ui,catalog,cart,checkout,orders}.json` ghim commit `d7a380b843e0759e58754f74188ea18252a51415`, đã đối chiếu tag `v1.6.3`.
Build context là `src/<service>` trong checkout upstream. Không tự lấy nhánh `main` mới nhất của upstream.

**Nếu chỉ nâng phiên bản:** sửa trường `revision` trong JSON của service cần nâng thành SHA đầy đủ đã được B kiểm tra. Một lần nâng toàn bộ có thể sửa cả năm file trong cùng PR.

**Nếu cần sửa source riêng của nhóm:**

1. B tạo nhánh `app/...` từ `main` mới nhất.
2. Đưa đầy đủ thư mục `src/<service>` từ upstream vào `app/src/<service>` của repo nhóm, giữ Dockerfile, `.mvn`, `mvnw`, attribution/license và các file dependency.
3. Đổi JSON tương ứng thành `{"source":"local"}`; bỏ `revision`.
4. Sửa và build source trong `app/src/<service>`, tạo PR cho A duyệt.
5. Source local sẽ dùng context `app/src/<service>`; các service khác tiếp tục dùng upstream đã ghim.

Không chỉ thêm source local rồi quên đổi JSON: pipeline chọn context theo JSON. Khi bật chế độ local, B phải giữ nguồn và license đầy đủ. `.gitattributes` giữ LF cho Maven wrapper và shell script.

## 4. Quy tắc lọc thay đổi

| Thay đổi | Service được chọn |
|---|---|
| `app/services/cart.json` | Cart |
| `app/src/cart/**` | Cart |
| Đổi tên/chuyển file Cart sang Orders | Cart và Orders |
| `scripts/ci/**`, `ci/**`, `build.yml`, `deploy.yml`, `.gitattributes` | Cả năm |
| Chỉ `docs/**`, README, Terraform, load test | Không build app |
| Không đọc được base commit / lần main đầu tiên | Cả năm |
| Chạy thủ công `services=all` | Cả năm |

PR dùng diff từ merge base. Push `main` dùng SHA của **lần Application delivery trên main thành công gần nhất**, không chỉ push trước đó. Vì vậy service chưa giao thành công ở lần trước được chọn lại, kể cả push tiếp theo chỉ sửa tài liệu. Không truy cập được lịch sử Actions thì chọn cả năm để tránh bỏ sót.

Các lần delivery cùng nhánh chạy tuần tự; không tự hủy deployment đang chạy. GitHub có thể thay thế một run đang chờ khi nhiều push liên tiếp; việc so với lần thành công gần nhất giúp bao phủ phần thay đổi bị gộp. Trước publish/deploy kiểm tra commit còn là đầu `main`; chạy lại run cũ sẽ bị chặn.

**Khôi phục sau lỗi hoặc sau khi A bật AWS lần đầu:** GitHub → Actions → Application delivery → Run workflow → Branch `main` → `services=all` → Run workflow. Có thể nhập `ui` hoặc `ui,cart` để thử từng service đã sẵn sàng. Không chạy lại commit main cũ để cố rollback; rollback là quy trình riêng của A.

## 5. A kích hoạt AWS — không cần họp, làm theo checklist

Các mặc định hiện tại không tạo IAM mới và không tự deploy. C không chạy `terraform apply`.

### Bước A1 — duyệt và áp dụng OIDC/publisher

1. Review `infra/terraform/github-actions.tf` và merge PR theo quy trình nhóm.
2. Kiểm tra tài khoản đã có OIDC provider `token.actions.githubusercontent.com` chưa. Nếu có, truyền ARN qua `github_oidc_provider_arn` để tái sử dụng, tránh tạo trùng.
3. Trong cấu hình Terraform local của A đặt `github_actions_enabled = true`. Chưa có ECS service thì giữ `github_actions_ecs_services = {}`.
4. A tự chạy init/plan/review/apply trong `infra/terraform`, theo backend và thông tin đăng nhập của A. Kiểm tra plan không có thay đổi ngoài dự kiến.
5. Lấy `terraform output -raw github_build_role_arn`.
6. GitHub repo → Settings → Secrets and variables → Actions → **Variables** → New repository variable. Thêm:

| Variable | Giá trị |
|---|---|
| `AWS_BUILD_ROLE_ARN` | Output role build từ Terraform |
| `AWS_PUBLISH_ENABLED` | `true` |
| `AWS_DEPLOY_ENABLED` | `false` lúc đầu |

7. Chạy Application delivery trên `main`, `services=all` (hoặc một service để kiểm tra đầu tiên).
8. Xem artifact `image-<service>-<attempt>`: commit, nguồn, tag và digest. Image phải nằm trong ECR `group14-capstone/<service>`, Singapore.

OIDC chỉ tin tưởng **đúng repo và `refs/heads/main`**, audience `sts.amazonaws.com`. Không dùng AWS access key trong Secrets. Không thêm `environment:` vào job tùy tiện vì GitHub sẽ đổi định dạng OIDC subject; muốn dùng environment phải review lại trust policy cùng A.

Role build chỉ push/read năm repo ECR. Role deploy tách riêng, chỉ update/describe những ECS service đã khai báo, chỉ PassRole hai ECS role của nhóm. `GetAuthorizationToken`, `RegisterTaskDefinition`, `DescribeTaskDefinition` có wildcard theo khả năng phân quyền API; các quyền tạo IAM, xóa service, sửa mạng không được cấp.

### Bước A2 — tạo/bàn giao ECS service

1. A tạo bootstrap task definition dùng image digest từ ECR, container name đúng cấu hình, Linux/X86_64, port 8080 và health check phù hợp.
2. A quyết định network, datastore, DNS/service discovery, log và secret references. Không dùng DNS Compose làm DNS ECS.
3. Khi tạo service, có thể dùng module `infra/terraform/modules/ecs-service` (README trong module). Module chưa được gọi ở root nên merge PR không tự tạo Fargate service.
4. Nếu A đã có resource `aws_ecs_service`, thêm cấu hình circuit breaker vào resource đó; không tạo thêm service trùng tên bằng module.
5. Chờ bootstrap deployment đạt `COMPLETED`, có ít nhất một task khỏe. Lần deploy đầu không có bản thành công trước đó thì ECS chưa có bản để rollback.
6. Tạo PR sửa `ci/deploy-targets.json`: đặt tên service thực tế, container name thực tế và `enabled: true` cho service sẵn sàng. Các service khác giữ false.
7. Trong cấu hình Terraform của A đặt map ví dụ `github_actions_ecs_services = { ui = "TEN_UI_SERVICE_THUC_TE" }`, review/apply và lấy `github_deploy_role_arn`.
8. Thêm repository variable `AWS_DEPLOY_ROLE_ARN` từ output, đặt `AWS_DEPLOY_ENABLED=true`.
9. Chạy thủ công Application delivery trên `main` với `services=ui`. Kiểm tra artifact deployment và ECS revision/digest.
10. Lặp lại cho những service còn lại khi hạ tầng sẵn sàng. Cấu hình JSON và map IAM phải cùng tên service/cluster.

Tắt deploy khẩn bằng `AWS_DEPLOY_ENABLED=false` ngăn run tiếp theo, không hủy một AWS deployment đã bắt đầu. A xử lý deployment đang chạy trên ECS. Không cấp thêm quyền khi gặp AccessDenied; đối chiếu tên tài nguyên với policy và báo A.

## 6. Circuit breaker: kiểm tra đúng mức

**Đã kiểm tra tự động:** Terraform mock xác nhận `enable=true`, `rollback=true`, ECS rolling/Fargate. Kiểm thử Node xác nhận CD từ chối service thiếu circuit breaker, thiếu health check, không có baseline, sai kiến trúc, hoặc revision mới bị rollback.

**Chưa thay thế được thử nghiệm AWS:** cần ECS service chạy thật và A phụ trách môi trường thử. Chưa được báo cáo “đã rollback thành công” chỉ dựa trên mock.

Checklist A/C dùng trong khung giờ demo:

1. Chọn service thử nghiệm không phục vụ buổi demo chính; ghi cluster/service, task revision đang `COMPLETED`, image digest, thời điểm bắt đầu và URL health.
2. Xác minh service dùng ECS rolling, circuit breaker bật cả hai cờ, health check hoạt động, desired count > 0. Đảm bảo A có cách quay lại revision đã ghi.
3. A tạo revision thử từ task đang khỏe, giữ nguyên network/roles/secrets; dùng thay đổi có chủ đích khiến container thử không khởi động hoặc health check thất bại. Không dùng bản hỏng cho toàn bộ năm service.
4. A cập nhật service thử sang revision đó. Theo dõi ECS → Cluster → Service → Deployments và Events. Không sửa cờ circuit breaker trong lúc thử.
5. Ghi bằng chứng revision thử `FAILED`, ECS quay về revision khỏe, task/target group khỏe trở lại. Rollback cần một deployment thành công trước đó; không ấn định thời gian phục hồi khi chưa đo.
6. Kiểm tra luồng chức năng cùng B. Ghi thời gian từ bắt đầu lỗi đến phục hồi cho D; lưu ảnh và ARN/digest, không lưu secrets hoặc toàn bộ environment.
7. Nếu diễn tập qua pipeline, workflow phải đỏ cho revision lỗi dù rollback đã cứu service. Nếu chỉ cập nhật từ Console thì không lấy kết quả đó làm bằng chứng đã kiểm tra toàn bộ workflow CD.
8. Kết thúc: xác nhận service thử chạy bản tốt, dừng tài nguyên thử theo quy trình của A; C không tự destroy hạ tầng.

## 7. Kiểm tra local và bằng chứng

Yêu cầu Node.js >= 20, Git, Docker Desktop Linux containers, Terraform tương thích lockfile (hiện kiểm tra bằng 1.17.1). Node tests không cần `npm install`.

Tại thư mục repo, PowerShell:

```powershell
node --test scripts/ci/tests/*.test.mjs
terraform -chdir=infra/terraform fmt -check -recursive -diff
terraform -chdir=infra/terraform init -backend=false -input=false -lockfile=readonly
terraform -chdir=infra/terraform validate
terraform -chdir=infra/terraform test
```

`terraform test` trong PR này chỉ có mock provider: không dùng AWS thật, không tạo tài nguyên. `init -backend=false` không truy cập state chung. Không chạy Makefile apply/destroy để kiểm tra CI.

Build upstream từ PowerShell mà không làm CRLF hỏng `mvnw`:

```powershell
git -c 'core.autocrlf=false' clone --depth 1 --branch v1.6.3 https://github.com/aws-containers/retail-store-sample-app.git upstream
git -C upstream rev-parse HEAD
# Phải đúng d7a380b843e0759e58754f74188ea18252a51415
docker build --platform linux/amd64 -t group14/ui:local-check -f upstream/src/ui/Dockerfile upstream/src/ui
```

Lệnh clone dành cho lúc chưa có thư mục `upstream`. Nếu đã có clone cá nhân, không ghi đè hoặc xóa nó. Với clone dùng `core.autocrlf=true`, kiểm tra `git ls-files --eol src/ui/mvnw`; wrapper cần `w/lf` khi build Linux. GitHub-hosted runner Linux không có cấu hình Windows này.

Artifacts cho D:

- `image-<service>-<attempt>`: commit, source SHA/context, ECR tag/digest, run ID, thời gian job publish (không phải tổng thời gian toàn pipeline).
- `deployment-<service>-<attempt>`: kết quả deploy, task revision trước/sau và thời gian chờ rollout thành công. Lỗi có thông báo rõ; không ghi task definition chứa environment vào artifact.
- Thời gian build thật: lấy timestamps job Build từ GitHub Actions. Tổng commit→ECS và thời gian rollback cần đo riêng; chưa có số liệu AWS trong PR này.

Giới hạn hiện tại: Dockerfile upstream có base tag và tải dependency/package khi build, nên ghim source không đảm bảo tái tạo bit-for-bit. Image đã publish được truy vết bằng digest. Upstream Dockerfile Java có `-DskipTests`; build thành công không thay kiểm thử chức năng của B. Trivy/Gitleaks/plan comment là mốc tiếp theo, chưa có trong pipeline này.

Cập nhật 08/11: bổ sung TFLint cho Terraform root và module con; xem [cách chạy và bằng chứng kiểm tra](terraform-checks.md).

Tài liệu tham chiếu: [GitHub OIDC với AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws), [ECS circuit breaker](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-circuit-breaker.html), [nguồn ứng dụng đã ghim](https://github.com/aws-containers/retail-store-sample-app/tree/d7a380b843e0759e58754f74188ea18252a51415).
