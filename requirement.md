Saya ingin membuat struktur folder untuk sebuah aplikasi backend MVP menggunakan stack berikut:

* Runtime: Bun
* Language: TypeScript
* Framework: Express.js
* Database: SQLite
* ORM: Drizzle ORM
* Validation: Zod

## Konteks Aplikasi

Aplikasi ini adalah bot edukasi/sosialisasi bahaya rokok yang terintegrasi dengan platform Threads.

Fitur utama MVP:

1. Menerima webhook atau event dari Threads.
2. Mengelola konten kampanye edukasi bahaya rokok.
3. Mendeteksi dan memproses konten atau event yang relevan.
4. Menggunakan AI API eksternal untuk membantu analisis atau membuat respons edukatif.
5. Memiliki scheduler untuk menjalankan kampanye atau posting otomatis.
6. Menyimpan data posting, campaign, log, dan histori aktivitas ke SQLite.
7. Memiliki mekanisme sederhana untuk approval konten sebelum dipublikasikan.
8. Memposting konten melalui API Threads.
9. Memiliki logging dan error handling yang rapi.

## Arsitektur yang Diinginkan

Gunakan pendekatan:

**Modular Monolith**

Jangan menggunakan microservices, Redis, Kafka, RabbitMQ, atau queue system karena ini masih tahap MVP.

Struktur kode harus:

* Mudah dipahami oleh developer baru.
* Mudah dikembangkan ketika aplikasi bertambah besar.
* Menggunakan separation of concerns.
* Tidak terlalu over-engineering.
* Setiap fitur memiliki module sendiri.
* Dependency antar module tetap sederhana.
* Mudah dimigrasikan ke PostgreSQL di masa depan.

## Buatkan Struktur Folder

Saya ingin struktur folder seperti konsep berikut, tetapi silakan perbaiki jika ada struktur yang lebih baik:

```text
src/
├── config/
├── database/
├── modules/
│   ├── threads/
│   ├── campaign/
│   ├── content/
│   └── ai/
├── jobs/
├── middleware/
├── shared/
├── app.ts
└── index.ts
```

Untuk setiap module, gunakan struktur yang jelas, misalnya jika diperlukan:

```text
module/
├── controller.ts
├── service.ts
├── repository.ts
├── routes.ts
├── schema.ts
└── types.ts
```

Namun jangan membuat file atau layer yang sebenarnya tidak diperlukan. Hindari over-engineering.

## Detail Module yang Dibutuhkan

### 1. Threads Module

Menangani:

* Integrasi Threads API.
* Webhook.
* Publish post.
* OAuth/token management jika diperlukan.
* Client HTTP untuk komunikasi dengan Threads API.

### 2. Campaign Module

Menangani:

* Pembuatan campaign.
* Scheduling campaign.
* Status campaign.
* Approval sebelum publishing.

### 3. Content Module

Menangani:

* Pembuatan konten.
* Penyimpanan konten.
* Status konten: draft, pending_approval, approved, rejected, published.
* Validasi konten.

### 4. AI Module

Menangani:

* Integrasi AI API eksternal.
* Content generation.
* Content analysis.
* Prompt management.

Pastikan AI provider tidak tightly coupled sehingga nantinya mudah mengganti provider.

### 5. Jobs Module

Menangani:

* Scheduled jobs.
* Campaign scheduler.
* Automatic publishing.

Gunakan pendekatan sederhana yang cocok untuk MVP tanpa Redis atau message broker.

### 6. Database

Gunakan:

* SQLite
* Drizzle ORM

Pisahkan:

* Database connection.
* Schema.
* Migration.

## Output yang Saya Inginkan

Lakukan hal berikut:

1. Buat struktur folder lengkap dalam bentuk tree.
2. Jelaskan tanggung jawab setiap folder.
3. Buat file-file dasar yang diperlukan.
4. Jangan membuat implementasi bisnis yang terlalu kompleks.
5. Buat project agar langsung bisa dijalankan menggunakan Bun.
6. Gunakan TypeScript strict mode.
7. Gunakan environment variables untuk API keys dan secrets.
8. Tambahkan `.env.example`.
9. Tambahkan centralized error handling.
10. Tambahkan logging sederhana.
11. Tambahkan health check endpoint:

```text
GET /health
```

12. Pastikan struktur siap untuk dikembangkan menjadi production application, tetapi tetap sederhana untuk MVP.

## Penting

Jangan gunakan:

* Microservices
* Redis
* Kafka
* RabbitMQ
* Kubernetes
* CQRS
* Event Sourcing
* Dependency Injection yang berlebihan

Prioritaskan:

**Simplicity > Performance optimization > Scalability**

Buat struktur yang clean, modular, dan pragmatic.

Setelah membuat struktur folder, buat juga:

* `package.json`
* `tsconfig.json`
* `.env.example`
* `src/index.ts`
* `src/app.ts`

Gunakan dependency seminimal mungkin.
