# Số liệu build trên GitHub Actions

Nguồn: [run trên main ngày 06/11/2026](https://github.com/ngocthuan-tech/aws-cloud-native-autoscaling-lab/actions/runs/42184773100). Thời gian dưới đây tính từ started_at đến completed_at của job, gồm cả setup và checkout.

| Job | Bắt đầu (UTC) | Kết thúc (UTC) | Thời lượng |
|---|---|---|---|
| checkout | 08:01:57 | 08:04:06 | 2m09s |
| catalog | 08:01:57 | 08:04:47 | 2m50s |
| ui | 08:01:57 | 08:04:34 | 2m37s |
| cart | 08:01:57 | 08:04:34 | 2m37s |
| orders | 08:01:57 | 08:05:39 | 3m42s |

Năm job chạy song song nên khoảng thời gian từ lúc job build đầu tiên bắt đầu đến khi job cuối cùng xong là **3 phút 42 giây**. Đây là một lần đo trước khi thêm quét bảo mật. Publish và deploy bị bỏ qua trong run này. D sẽ bổ sung thời gian commit → ECS khỏe từ một run triển khai thật.
