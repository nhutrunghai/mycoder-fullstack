<div align="center">

# 🚀 MyCoder Fullstack

### Nền tảng kết nối việc làm giữa Ứng viên và Nhà tuyển dụng

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Elasticsearch](https://img.shields.io/badge/Elasticsearch-005571?style=for-the-badge&logo=elasticsearch&logoColor=white)

</div>

---

## ✨ Tổng quan

**MyCoder Fullstack** là dự án mô phỏng một nền tảng tuyển dụng hiện đại, hỗ trợ ứng viên tìm kiếm việc làm, quản lý hồ sơ/CV và ứng tuyển; đồng thời hỗ trợ nhà tuyển dụng quản lý công ty, tin tuyển dụng, hồ sơ ứng viên, ví giao dịch và các luồng tương tác với ứng viên.

Dự án được xây dựng theo hướng **full-stack** với backend API, frontend React application và hạ tầng hỗ trợ gồm MongoDB, Redis, Elasticsearch, Kibana, Docker Compose và embedding service cho tìm kiếm/RAG.

---

## 🧩 Các module chính

| Module | Trạng thái | Mô tả |
|---|---:|---|
| 🔐 Authentication | ✅ | Đăng ký, đăng nhập, refresh token, xác minh email, quên mật khẩu, Google OAuth |
| 👤 User/Candidate Profile | ✅ | Hồ sơ cá nhân, hồ sơ công khai, cập nhật thông tin người dùng, quản lý CV |
| 🏢 Company Profile | ✅ | Tạo/cập nhật hồ sơ công ty dành cho nhà tuyển dụng |
| 💼 Job Management | ✅ | Tạo, sửa, xóa, kiểm duyệt và quản lý tin tuyển dụng cho employer/admin |
| 📨 Job Application | ✅ | Ứng tuyển, lưu snapshot hồ sơ, quản lý danh sách ứng viên và chi tiết hồ sơ |
| ⭐ Favorite Jobs | ✅ | Lưu và quản lý công việc yêu thích của candidate |
| 🔔 Notifications | ✅ | Thông báo phía candidate/employer |
| 💬 Messages/Chat | ✅ | Trung tâm tin nhắn và luồng chat/RAG liên quan tuyển dụng |
| 💳 Wallet & Top-up | ✅ | Ví, nạp tiền, lịch sử giao dịch, tích hợp SePay webhook/config |
| 📢 Job Promotion | ✅ | Gói/quy trình quảng bá tin tuyển dụng |
| 🛡️ Admin Dashboard | ✅ | Quản lý user, company, job, promotion, ví, audit log và cấu hình hệ thống |
| 🔎 Search/RAG Infrastructure | ✅ | Elasticsearch, hybrid/semantic search, resume/job indexing, embedding API |
| 🧪 API Testing | ✅ | Postman environment/collection trong thư mục `docs/postman` |
| 🗄️ Backup Data | ✅ | Backup MongoDB và Elasticsearch trong thư mục `backups/` |

---

## 🏗️ Kiến trúc dự án

```text
mycoder-fullstack/
├── backend/
│   └── src/
│       ├── configs/        # Cấu hình env, database, Redis, Elasticsearch
│       ├── controllers/    # Controller cho client, admin, webhook
│       ├── middlewares/    # Auth, phân quyền, validate, error handling
│       ├── models/         # MongoDB schema/model
│       ├── providers/      # Provider tích hợp ngoài
│       ├── routes/         # API routes v1
│       ├── scripts/        # Script hỗ trợ/backfill/demo
│       ├── services/       # Business logic, search, RAG, wallet, notification
│       ├── types/          # Kiểu dữ liệu dùng chung
│       ├── utils/          # Tiện ích dùng chung
│       └── validators/     # Zod validation
├── frontend/
│   └── src/
│       ├── pages/          # Trang candidate, employer, admin
│       ├── components/     # Component giao diện
│       ├── data/           # API client
│       └── routes/         # Điều hướng frontend
├── embedding-api/          # API embedding phục vụ semantic search/RAG
├── docs/                   # Tài liệu và Postman config
├── backups/                # Dữ liệu backup MongoDB/Elasticsearch
└── docker-compose.yml      # Hạ tầng local
```

---

## 🛠️ Công nghệ sử dụng

### Backend

- Node.js, Express.js, TypeScript
- MongoDB native driver
- Redis/ioredis
- Elasticsearch client
- JWT, Google OAuth, OTP email
- Zod validation
- Jest, ESLint, Prettier

### Frontend

- React 19
- Vite
- React Router
- React Markdown
- UploadThing client

### Search / AI

- Elasticsearch/Kibana
- Embedding API Python
- Hybrid search, semantic search, resume/job indexing
- Gemini/OpenAI/HuggingFace provider tùy cấu hình env

### DevOps / Tooling

- Docker Compose
- Postman
- Git/GitHub
- Backup/restore MongoDB và Elasticsearch

---

## 🚀 Chạy dự án local

### 1. Cài dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Tạo file môi trường

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

Các nhóm biến quan trọng trong `backend/.env`:

- `DB_URL`, `DB_NAME`
- `SECRET_ACCESS_TOKEN`, `SECRET_REFRESH_TOKEN`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `RESEND_API_KEY`, `UPLOADTHING_TOKEN`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `ELASTICSEARCH_URL`, `EMBEDDING_API_URL`
- `GEMINI_API_KEY` hoặc `OPENAI_API_KEY` nếu dùng chat/RAG AI
- `SEPAY_API_TOKEN`, `SEPAY_WEBHOOK_SECRET` nếu dùng thanh toán SePay

### 3. Chạy hạ tầng local

```bash
docker compose up -d mongo redis elasticsearch kibana embedding-api
```

### 4. Chạy backend

```bash
cd backend
npm run dev
```

Backend mặc định chạy tại:

```text
http://localhost:4000
```

### 5. Chạy frontend

```bash
cd frontend
npm run dev
```

Frontend Vite sẽ in URL local sau khi khởi động, thường là:

```text
http://localhost:5173
```

---

## 🗄️ Restore dữ liệu backup

Dự án đã có dữ liệu backup tại:

```text
backups/jobgo_backup_20260423_032343
```

Xem hướng dẫn restore chi tiết trong:

```text
backups/jobgo_backup_20260423_032343/RESTORE_GUIDE.md
```

Lưu ý khi restore:

- Cần MongoDB chạy tại `localhost:27017`.
- Cần Elasticsearch chạy tại `localhost:9200`.
- Lệnh MongoDB trong guide dùng `--drop`, sẽ xóa dữ liệu cũ của database `jobgo` trước khi restore.
- Nếu đặt backup trong project này, thay path ví dụ bằng `D:\project_JobGo\backups\jobgo_backup_20260423_032343`.

---

## 📌 Trạng thái phát triển

Dự án hiện đã có các luồng chính ở cả backend và frontend:

- ✅ Xác thực người dùng, OTP email, Google OAuth và refresh token
- ✅ Hồ sơ user/candidate, hồ sơ công ty và quản lý CV
- ✅ CRUD tin tuyển dụng cho employer, kèm luồng quản trị/kiểm duyệt phía admin
- ✅ Luồng ứng tuyển của candidate, snapshot hồ sơ và màn hình employer xem ứng viên
- ✅ Dashboard candidate, employer và admin
- ✅ Ví, nạp tiền, giao dịch, cấu hình/webhook SePay
- ✅ Thông báo, yêu thích công việc, tin nhắn và các trang quản lý phía frontend
- ✅ Tìm kiếm nâng cao với Elasticsearch, embedding, hybrid/semantic search và RAG chat
- ✅ Backup dữ liệu MongoDB/Elasticsearch đã được đưa vào repo

---

## 🧭 Định hướng tiếp theo

- Hoàn thiện trải nghiệm UI/UX và responsive cho toàn bộ frontend
- Bổ sung test cho các service quan trọng
- Chuẩn hóa tài liệu API và luồng deploy production
- Bổ sung script backup tự động cho MongoDB/Elasticsearch
- Hoàn thiện cấu hình production cho domain, mail, upload và thanh toán

---

## 📄 License

Dự án sử dụng giấy phép MIT. Xem thêm tại [LICENSE](./LICENSE).

---

<div align="center">

Made with ❤️ by [Nhữ Trung Hải](https://github.com/nhutrunghai)

</div>
