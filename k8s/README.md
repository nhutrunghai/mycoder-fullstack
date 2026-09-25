# Kubernetes manifests

Thu muc nay luu cau hinh Kubernetes cua MyCoder. Cac manifest chua duoc trien khai tu dong boi Jenkins, vi vay viec tao hoac thay doi ha tang can duoc kiem tra thu cong truoc khi them stage CI/CD.

## Cau truc

```text
k8s/
  bootstrap/
    namespace.yaml                 # Namespace mycoder-dev
    jenkins/                       # Jenkins, RBAC va local-path PVC cua Jenkins
  infra/
    mongodb/values.yaml            # Helm values, chua mat khau that va bi git ignore
    redis/statefulset.yaml         # Redis StatefulSet va Service noi bo
    elasticsearch/statefulset.yaml # Elasticsearch StatefulSet va Service noi bo
  app/
    backend/                       # ConfigMap, Secret mau, Deployment, Service
    frontend/                      # Deployment va Service
    embedding-api/                 # PVC model, Deployment, Service
```

`k8s/app/backend/secret.yaml` va `k8s/infra/mongodb/values.yaml` co du lieu nhay cam nen bi `.gitignore`. Chi commit `secret.example.yaml`; khong dua mat khau, API key hoac chuoi ket noi that vao Git.

## Thu tu trien khai khi dung lai cluster

1. Tao namespace tu `bootstrap/namespace.yaml`.
2. Tao Secret that `app/backend/secret.yaml` tu `secret.example.yaml`.
3. Cai MongoDB bang Helm voi `infra/mongodb/values.yaml`.
4. Trien khai `infra/redis/statefulset.yaml`.
5. Tren tung worker co the chay Elasticsearch, dat `vm.max_map_count=262144`, roi trien khai `infra/elasticsearch/statefulset.yaml`.
6. Trien khai thu cong `app/embedding-api/pvc.yaml` mot lan. Jenkins se tao/cap nhat Deployment va Service embedding API sau khi build image dau tien. Init container se tai model `dangvantuan/vietnamese-document-embedding` vao PVC mot lan; cac lan Pod khoi dong sau dung lai model da luu.
7. Build va push backend/frontend, thay placeholder image trong manifest neu chua de Jenkins cap nhat image, sau do trien khai backend va frontend.

## Luu y van hanh

- `local-path` tao volume cuc bo theo node. Cac workload dung PVC trong thu muc nay deu de mot replica va `ReadWriteOnce`; khong tang replica khi chua co storage dung chung.
- Redis dung `REDIS_PASSWORD` lay tu `mycoder-backend-secret`, nen Secret phai ton tai truoc khi Redis chay.
- Elasticsearch dang de `xpack.security.enabled=false` cho moi truong development noi bo. Khong giu cau hinh nay cho moi truong public hoac production.
- Backend da tro toi cac Service noi bo `redis:6379`, `elasticsearch:9200` va `embedding-api:8000`.
- Jenkinsfile build/push embedding API khi `embedding-api/**` thay doi, tao/cap nhat Deployment va Service, va khong quan ly PVC. Redis va Elasticsearch khong co stage tu dong.
