# Kubernetes manifests

Thư mục này lưu cấu hình Kubernetes của MyCoder. Các manifest chưa được triển khai tự động bởi Jenkins, vì vậy việc tạo hoặc thay đổi hạ tầng cần được kiểm tra thủ công trước khi thêm stage CI/CD.

## Cấu trúc

```text
k8s/
  bootstrap/
    namespace.yaml                 # Namespace mycoder-dev
    jenkins/                       # Jenkins, RBAC và local-path PVC của Jenkins
  infra/
    mongodb/values.yaml            # Helm values, chứa mật khẩu thật và bị git ignore
    redis/statefulset.yaml         # Redis StatefulSet và Service nội bộ
    elasticsearch/statefulset.yaml # Elasticsearch StatefulSet và Service nội bộ
    nginx-ingress/                 # NGINX Ingress Controller và NodePort HTTP
  app/
    backend/                       # ConfigMap, Secret mẫu, Deployment, Service
    frontend/                      # Deployment và Service
    embedding-api/                 # PVC model, Deployment, Service
    ingress/                       # Rule /api -> backend, / -> frontend
```

`k8s/app/backend/secret.yaml` và `k8s/infra/mongodb/values.yaml` có dữ liệu nhạy cảm nên bị `.gitignore`. Chỉ commit `secret.example.yaml`; không đưa mật khẩu, API key hoặc chuỗi kết nối thật vào Git.

## Thứ tự triển khai khi dựng lại cluster

1. Tạo namespace từ `bootstrap/namespace.yaml`.
2. Tạo Secret thật `app/backend/secret.yaml` từ `secret.example.yaml`.
3. Cài MongoDB bằng Helm với `infra/mongodb/values.yaml`.
4. Triển khai `infra/redis/statefulset.yaml`.
5. Trên từng worker có thể chạy Elasticsearch, đặt `vm.max_map_count=262144`, rồi triển khai `infra/elasticsearch/statefulset.yaml`.
6. Triển khai thủ công `app/embedding-api/pvc.yaml` một lần. Jenkins sẽ tạo/cập nhật Deployment và Service embedding API sau khi build image đầu tiên. Init container sẽ tải model `dangvantuan/vietnamese-document-embedding` vào PVC một lần; các lần Pod khởi động sau dùng lại model đã lưu.
7. Build và push backend/frontend, thay placeholder image trong manifest nếu chưa để Jenkins cập nhật image, sau đó triển khai backend và frontend.
8. Cluster admin chạy một lần `kubectl apply -f infra/nginx-ingress` để tạo Namespace, CRD, RBAC, ServiceAccount và IngressClass cho NGINX. Controller dùng NodePort `30080`; frontend Service phải là `ClusterIP` trước bước này.
9. Sau bootstrap, Jenkins có thể chạy với `DEPLOY_INGRESS_CONTROLLER=true` để cập nhật ConfigMap, Service và Deployment của controller. Jenkins không có quyền sửa ClusterRole, ClusterRoleBinding hay CRD.
10. Jenkins apply `app/ingress/jobgo-ingress.yaml` để route `/api` vào backend và `/` vào frontend. Giai đoạn chưa có domain, controller cho phép Ingress không có host và truy cập qua `http://192.168.53.128:30080`.

## Lưu ý vận hành

- `local-path` tạo volume cục bộ theo node. Các workload dùng PVC trong thư mục này đều để một replica và `ReadWriteOnce`; không tăng replica khi chưa có storage dùng chung.
- Redis dùng `REDIS_PASSWORD` lấy từ `mycoder-backend-secret`, nên Secret phải tồn tại trước khi Redis chạy.
- Elasticsearch đang để `xpack.security.enabled=false` cho môi trường development nội bộ. Không giữ cấu hình này cho môi trường public hoặc production.
- Backend đã trỏ tới các Service nội bộ `redis:6379`, `elasticsearch:9200` và `embedding-api:8000`.
- Jenkinsfile build/push embedding API khi `embedding-api/**` thay đổi, tạo/cập nhật Deployment và Service, và không quản lý PVC. Redis và Elasticsearch không có stage tự động.
- NGINX Ingress Controller dùng image `nginx/nginx-ingress:5.6.3`, có 2 replicas phân tán trên các node khác nhau. Stage cài/cập nhật controller chỉ chạy khi bật parameter `DEPLOY_INGRESS_CONTROLLER`; rule Ingress của JobGo được apply trong pipeline app.
- Giai đoạn hiện tại chỉ expose HTTP qua NodePort `30080`; chưa cấu hình domain, TLS, cert-manager hoặc HTTPS.
