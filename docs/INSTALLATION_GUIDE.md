# Installation, Setup & Verification Guide

This guide walks through configuring, installing dependencies, provisioning PostgreSQL, applying Prisma migrations, seeding the initial curriculum, and running the **Cloud Virtual Lab and Secure Storage Management System**.

---

## 1. System Requirements & Prerequisites

### 1.1 Software Dependencies
- **Node.js:** v20.x or v22.x LTS (Node.js 20.12.0+ recommended)
- **Package Manager:** npm (v10+) or pnpm (v9+)
- **Database Engine:** PostgreSQL 16.x or 18.x
- **Operating System:** Windows 10/11, Ubuntu 22.04/24.04 LTS, or macOS 13+
- **Git:** v2.30+

### 1.2 Hardware Recommendations
- **CPU:** Dual-core 2.0 GHz or higher (Quad-core recommended for test suites).
- **RAM:** Minimum 4 GB (8 GB recommended).
- **Disk Space:** Minimum 2 GB free disk space (accounting for Node modules and encrypted storage volume).

---

## 2. Quick Setup with Docker (PostgreSQL & Redis)

If you have Docker and Docker Compose installed, start PostgreSQL and Redis with a single command:
```bash
docker compose up -d
```
This spins up:
- PostgreSQL on port `5432` with volume persistence in `postgres_data`.
- Redis 7 on port `6379` with volume persistence in `redis_data` and healthcheck monitoring.

To verify services are running:
```bash
docker ps
```

---

## 3. Manual Local Installation

### Step 1: Clone Repository & Inspect Directory Structure
```bash
git clone https://github.com/your-org/cloud-virtual-lab.git
cd "cloud-virtual-lab"
```

Verify repository root structure:
```
├── backend/          # Express + Prisma API
├── frontend/         # React 18 + Vite SPA
├── docs/             # Technical specifications
├── storage/uploads/  # AES-256-GCM encrypted blob storage
├── .env.example      # Root environment template
└── docker-compose.yml
```

---

### Step 2: Configure Environment Variables

#### Backend Environment
Navigate to `backend/` and copy the environment template:
```bash
cd backend
cp .env.example .env
```

Generate secure 256-bit keys for `JWT_SECRET` and `STORAGE_ENCRYPTION_SECRET`:
```bash
# Generate 64-hex-character string (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Edit `backend/.env` with your PostgreSQL database credentials and generated secrets:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# PostgreSQL Database
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/cloud_virtual_lab?schema=public"

# Authentication & Cryptography
JWT_SECRET=paste_your_generated_64_char_secret_here
JWT_EXPIRES_IN=1d

# AES-256-GCM Master Encryption Secret (64 hex characters)
STORAGE_ENCRYPTION_SECRET=paste_your_generated_64_char_secret_here
STORAGE_UPLOAD_PATH=../storage/uploads
MAX_FILE_SIZE_MB=25
DEFAULT_USER_QUOTA_MB=100

# Redis Distributed Security & Rate Limiting
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your_redis_password
REDIS_REQUIRED=false

# Seed Administrator Credentials
ADMIN_EMAIL=admin@virtuallab.edu
ADMIN_PASSWORD=AdminSecurePassword123!
ADMIN_FIRST_NAME=System
ADMIN_LAST_NAME=Administrator
```

#### Frontend Environment
Navigate to `frontend/` and configure `.env`:
```bash
cd ../frontend
cp .env.example .env
```
Ensure `VITE_API_URL=/api` is set (Vite development proxy handles routing to `:5000`).

---

### Step 3: Install Node.js Dependencies

#### Backend Dependencies
```bash
cd ../backend
npm install
```

#### Frontend Dependencies
```bash
cd ../frontend
npm install
```

---

### Step 4: Database Migrations & Initial Seeding

#### 1. Generate Prisma Client
```bash
cd ../backend
npm run prisma:generate
```

#### 2. Apply Database Migrations
```bash
npx prisma migrate deploy
```
*(In development, you may also use `npm run prisma:migrate`)*

To verify migration status:
```bash
npx prisma migrate status
```
Expected output:
```
Database schema is up to date!
```

#### 3. Seed Root Admin & Default Virtual Laboratories
```bash
npm run prisma:seed
```
Expected output:
```
🌱 Starting database seed...
✅ Admin account seeded: admin@virtuallab.edu (Role: ADMIN)
✅ Lab & exercises seeded: Linux Command-Line Essentials
✅ Lab & exercises seeded: Networking & Connectivity Fundamentals
✅ Lab & exercises seeded: Python & JavaScript Programming Lab
✅ Lab & exercises seeded: Relational Database & SQL Playground
🎉 Seeding successfully completed!
```

#### 4. (Optional) Run Seed Verification Script
```bash
npm run prisma:verify
```

---

## 4. Running the Development Servers

### 1. Start Backend Server (Port 5000)
```bash
cd backend
npm run dev
```
Terminal output:
```
🚀 Virtual Lab & Secure Storage API running on http://localhost:5000
📡 Environment: development
🌐 Allowed Client URL: http://localhost:5173
📡 Health check accessible at: http://localhost:5000/api/health
```

### 2. Start Frontend Development Server (Port 5173)
In a separate terminal window:
```bash
cd frontend
npm run dev
```
Terminal output:
```
  VITE v5.4.21  ready in 450 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open `http://localhost:5173` in your browser.

---

## 5. Verification & Running Test Suites

### 1. Execute Backend Automated Tests (127 Tests)
```bash
cd backend
npm test
```
Vitest will run all 6 test suites:
- `health.test.ts`
- `auth.test.ts`
- `storage.test.ts`
- `lab.test.ts`
- `admin.test.ts`
- `security.test.ts`

Expected output:
```
 Test Files  6 passed (6)
      Tests  127 passed (127)
   Duration  25s
```

### 2. Verify Frontend Production Build
```bash
cd ../frontend
npm run build
```
Expected output:
```
✓ 1600 modules transformed.
dist/index.html                   0.88 kB
dist/assets/index-QfyitAe0.css   51.22 kB
dist/assets/index-BJNF8HdY.js   525.34 kB
✓ built in ~8s
```

### 3. Verify Backend Production TypeScript Build
```bash
cd ../backend
npm run build
```
Expected output:
```
> tsc
```
Compiled JavaScript bundles are generated cleanly into `backend/dist/`.

---

## 6. Running in Production Mode

To run the compiled backend production build:
```bash
cd backend
npm start
```
This executes `node dist/server.js` using production optimizations.

---

## 7. Troubleshooting Guide

| Issue | Cause | Solution |
|---|---|---|
| `error: Environment variable not found: DATABASE_URL` | Missing `.env` file in `backend/` | Ensure `backend/.env` exists and contains a valid PostgreSQL connection string. |
| `connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running | Start PostgreSQL service or run `docker compose up -d`. |
| `Storage quota exceeded` (400) | File upload exceeds student quota | Increase student quota via Admin Console (`/admin/storage`) or upload a smaller file. |
| `File upload rejected: Executable programs and dangerous scripts prohibited` | Uploaded file has dangerous extension (`.exe`, `.sh`, `.bat`, `.ps1`) | Upload standard documents (`.pdf`, `.docx`, `.txt`), images, code, or zip archives. |
| `CORS Error` on frontend API calls | `CLIENT_URL` in `backend/.env` mismatch | Ensure `CLIENT_URL` matches the frontend host (default: `http://localhost:5173`). |
