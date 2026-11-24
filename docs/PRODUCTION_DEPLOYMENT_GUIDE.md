# Production Deployment & Live Demonstration Guide

**Project:** Cloud Virtual Lab and Secure Storage Management System  
**Document Version:** 1.0.0 (Phase 8 Production Release)  
**Target Environments:** Linux / Docker / Cloud PaaS (Render, Railway, Fly.io, DigitalOcean, AWS)

---

## 1. Production Architecture Overview

The system utilizes a 3-tier production architecture engineered for strict tenant isolation, zero-knowledge AES-256-GCM encrypted file storage, and role-based laboratory access.

```mermaid
flowchart TD
    subgraph Client["Client Tier (Browser)"]
        UserBrowser["Web Browser (Student / Admin)"]
    end

    subgraph Edge["Edge & Reverse Proxy"]
        NginxGateway["Nginx Gateway (Port 80 / 443)<br/>TLS Termination • Gzip • Static Caching"]
    end

    subgraph Application["Application Tier (Docker / PaaS)"]
        ReactApp["React 18 SPA (Vite + Tailwind)<br/>Static Bundle (HTML/CSS/JS)"]
        ExpressAPI["Express API Server (Port 5000)<br/>Helmet • Rate Limit • JWT Cookie • RBAC"]
        SimulatorEngine["Lab Simulator Engine<br/>Linux • Net • Python/JS • SQL Playground"]
        CryptoSubsystem["Crypto Subsystem<br/>AES-256-GCM + PBKDF2 / SHA-256 Checksums"]
    end

    subgraph Data["Data & Storage Tier"]
        PostgresDB[("PostgreSQL 16 DB<br/>Relational Data & Audit Logs")]
        EncryptedVolume[("Encrypted Storage Volume<br/>/app/storage/uploads (.enc files)")]
    end

    UserBrowser -->|HTTPS Requests| NginxGateway
    NginxGateway -->|Serves Static Files| ReactApp
    NginxGateway -->|Proxies /api/*| ExpressAPI
    ExpressAPI --> SimulatorEngine
    ExpressAPI --> CryptoSubsystem
    ExpressAPI -->|Prisma Connection Pool| PostgresDB
    CryptoSubsystem -->|Read/Write IV + Tag + Ciphertext| EncryptedVolume
```

---

## 2. Cloud Hosting Options Evaluation

Because the system implements cryptographic at-rest file encryption, **ephemeral serverless functions (e.g. AWS Lambda, Vercel Serverless Functions) require setting `STORAGE_DRIVER=s3` (AWS S3, Cloudflare R2, or MinIO) to retain uploaded files across cold restarts**. Containerized hosts with persistent volumes or virtual servers also support `STORAGE_DRIVER=local` natively.

| Platform | Recommended Tier | Architecture Role | Pros | Limitations / Persistent Disk | Monthly Cost |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Option A: All-in-One Docker VPS** (DigitalOcean / Hetzner / AWS Lightsail) | 1-2 vCPU, 2-4GB RAM Ubuntu Server | Entire Docker Compose stack (Nginx + API + Postgres + Volume) | 100% parity with local development; full persistent SSD; zero vendor lock-in. | Requires basic Linux server maintenance & OS patching. | ~$4.00 – $6.00 / month |
| **Option B: Render.com** | Web Service (Starter) + Managed Postgres + Disk | Backend API + PostgreSQL + Frontend | Native Docker support; free TLS certificate; automated zero-downtime deploys. | Persistent Disk requires $1/GB/mo on a paid instance ($7/mo min). Free tier spins down on idle. | ~$7.00 – $15.00 / mo |
| **Option C: Railway.app** | Hobby Container + Volume + Postgres Plugin | Backend API + PostgreSQL + Frontend | Extremely fast deployment from GitHub; built-in persistent volume support. | Pay-as-you-go based on usage after initial trial credits. | ~$5.00 / mo |
| **Option D: Fly.io** | `fly launch` with Fly Volumes | API + Postgres + Static Frontend | Global edge routing; dedicated persistent NVMe volume support. | 3GB free persistent volume per organization. | Free tier eligible / ~$3-$5 |
| **Option E: Hybrid Architecture** (Vercel + Render + Neon) | Vercel Free (Frontend) + Render API + Neon Postgres | Frontend on Edge CDN, Backend on Container, DB on Serverless Postgres | Fast frontend static asset delivery; free database tier (Neon). | Requires cross-origin cookies (`COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`). | Free tier eligible |

### Recommended Production Topology
For demonstration and production evaluation, **Option A (Docker VPS via `docker-compose.prod.yml`)** or **Option C (Railway / Render with persistent disk)** provides maximum security, native file persistence, and zero cross-origin cookie complications.

---

## 3. Production Environment Variables Reference

| Variable | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables production optimizations, error masking, and strict cookies. |
| `PORT` | Yes | `5000` | Port Express API listens on inside container. |
| `CLIENT_URL` | Yes | `https://yourdomain.com` | Allowed CORS origin(s) (supports comma-separated URLs). |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/db?schema=public` | Prisma database connection string. |
| `JWT_SECRET` | Yes | *(Must be ≥ 32 characters)* | Cryptographic signing key for authentication tokens. |
| `JWT_EXPIRES_IN` | No | `1d` | Expiration lifespan of user login sessions. |
| `COOKIE_SAME_SITE` | No | `lax` (`none` for cross-site) | SameSite attribute for the `token` HTTP-only cookie. |
| `COOKIE_SECURE` | No | `true` | Requires HTTPS transmission for auth cookies (set `false` only for local HTTP Docker testing). |
| `STORAGE_DRIVER` | No | `local` | Storage driver: `local` (disk/volume) or `s3` (AWS S3, Cloudflare R2, MinIO). |
| `STORAGE_ENCRYPTION_SECRET` | Yes | *(64-character hexadecimal key)* | 256-bit AES-GCM master encryption secret. |
| `STORAGE_UPLOAD_PATH` | Yes | `/app/storage/uploads` | Path to the persistent storage directory on disk (when `STORAGE_DRIVER=local`). |
| `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` | If `s3` | `us-east-1` | Required bucket, region, and optional R2/MinIO endpoint when `STORAGE_DRIVER=s3`. |
| `REDIS_ENABLED` | No | `true` | Enables Redis-backed distributed rate limiting and JWT session revocation. |
| `REDIS_HOST` / `REDIS_PORT` | If Redis | `redis` / `6379` | Redis host and port inside Docker or managed Redis cluster. |
| `REDIS_REQUIRED` | No | `true` (prod) / `false` (dev) | Fails startup if Redis is unreachable when `true`; falls back to in-memory when `false`. |
| `MAX_FILE_SIZE_MB` | No | `25` | Maximum individual file upload threshold (MB). |
| `DEFAULT_USER_QUOTA_MB` | No | `100` | Default per-student storage allocation (MB). |
| `ADMIN_EMAIL` | No | `admin@virtuallab.edu` | Default admin email populated by seeder. |
| `ADMIN_PASSWORD` | No | *(Strong password)* | Default admin password populated by seeder. |

---

## 4. Single-Command Turnkey Deployment (Docker Compose)

### 1. Prerequisites
- Docker Engine 24.0+ and Docker Compose 2.20+
- Port 80 (and optionally 443) available

### 2. Configure Environment
```bash
# Clone the repository
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>

# Copy production environment template
cp .env.example .env

# Generate high-entropy secrets for JWT and AES-256 Storage
JWT_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
STORAGE_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Update secrets in .env
sed -i "s/super_secret_jwt_signing_key_change_in_production_min32chars/$JWT_KEY/" .env
sed -i "s/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef/$STORAGE_KEY/" .env
```

### 3. Build & Launch Containers
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Apply Database Migrations & Initial Seed
```bash
# Run migrations inside the backend container
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Seed baseline laboratories, exercises, and admin account
docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
```

### 5. Verify Container Health
```bash
docker compose -f docker-compose.prod.yml ps
```
All four services (`cvl_prod_postgres`, `cvl_prod_redis`, `cvl_prod_backend`, `cvl_prod_frontend`) should display `Up (healthy)`.

---

## 5. Database Reliability & Backup Procedures

### Automated Database Backup
To create a timestamped, gzip-compressed PostgreSQL database dump:
```bash
# On Linux / Docker host:
./scripts/backup-db.sh

# Or on Windows host:
powershell -ExecutionPolicy Bypass -File ./scripts/backup-db.ps1
```
Backups are archived into `./backups/database/cvl_backup_<TIMESTAMP>.sql.gz`.

### Database Restoration Procedure
To restore from an existing backup:
```bash
# On Linux / Docker host:
./scripts/restore-db.sh ./backups/database/cvl_backup_20261113_120000.sql.gz

# Or on Windows host:
powershell -ExecutionPolicy Bypass -File ./scripts/restore-db.ps1 -BackupFile ./backups/database/cvl_backup_20261113_120000.sql
```

### Zero-Downtime Prisma Migration Procedure
When deploying updates to database schemas:
1. Always apply migrations using `npx prisma migrate deploy` (never use `migrate dev` in production).
2. Schema changes are backward-compatible and validated in `backend/prisma/migrations/`.

---

## 6. Live Demonstration Walkthrough Runbook

Use this curated walkthrough during presentations, evaluations, and demonstration sessions:

### Flow 1: Public Portal & Student Registration
1. Navigate to the landing page at `http://localhost/` (or your production domain).
2. Point out features: Modern dark-mode UI, platform capabilities overview, responsive design.
3. Click **"Get Started"** or **"Register"**.
4. Create a student account:
   - Name: `Alex Chen`
   - Email: `alex.chen@student.edu`
   - Password: `StudentPassword123!`
5. Confirm immediate registration and automatic redirect to the **Student Dashboard**.

### Flow 2: Virtual Laboratory Simulations
1. In the sidebar, select **"Virtual Labs"** (`/student/labs`).
2. Launch the **Linux Fundamentals Lab**:
   - Execute commands in the terminal: `pwd`, `ls`, `mkdir test_folder`, `cd test_folder`, `touch notes.txt`, `cat notes.txt`, `clear`.
   - Show command history navigation with Up/Down arrow keys.
3. Launch the **Computer Networks Lab**:
   - Execute networking utilities: `ping 8.8.8.8`, `ifconfig`, `traceroute 1.1.1.1`, `curl https://api.github.com`.
4. Launch the **Python / JavaScript Programming Lab**:
   - Inspect the interactive exercise prompts and run sandboxed evaluation.
   - Point out zero-host OS execution (safe in-memory virtualized evaluation).
5. Launch the **SQL Playground**:
   - Query tables: `SELECT * FROM students;`
   - Execute joins and filters: `SELECT s.name, c.course_name FROM students s JOIN enrollments e ON s.id = e.student_id JOIN courses c ON e.course_id = c.id;`
   - Demonstrate query safety protections against unauthorized database access.

### Flow 3: AES-256-GCM Secure Cloud Storage
1. Navigate to **"Secure Storage"** (`/student/storage`).
2. Point out the live **Quota Meter** (e.g. `0.0 MB / 100 MB used`).
3. Create a folder: `Project Reports`.
4. Upload files:
   - Upload sample PDF, DOCX, TXT, or image files.
   - Show drag-and-drop support, real-time progress bar, and instant encrypted storage confirmation.
5. Demonstrate cryptographic at-rest protection:
   - Explain how file contents are encrypted via AES-256-GCM with a unique 12-byte IV per file.
   - Open inspection modal to view file metadata, category tag, and cryptographic checksum.
6. Download the file:
   - Demonstrate on-the-fly streaming decryption and verified file integrity.
7. Demonstrate folder navigation, renaming, moving, and soft/hard deletion.

### Flow 4: Administrator Governance & System Telemetry
1. Log out or open a private window and log in as Administrator:
   - Email: `admin@virtuallab.edu`
   - Password: `AdminSecurePassword123!`
2. Inspect the **Admin Governance Dashboard** (`/admin`):
   - Real-time KPI statistics: Total users, active sessions, storage allocation, lab completion metrics.
3. Navigate to **User Management** (`/admin/users`):
   - Demonstrate user search, role filtering, account status toggle (Active / Suspended), and quota adjustments.
4. Navigate to **Laboratory Governance** (`/admin/labs`):
   - Review live lab sessions, completion rates, and exercise performance metrics.
5. Navigate to **Storage Monitoring** (`/admin/storage`):
   - View system-wide storage utilization, top consumers, and file distribution by MIME type.
6. Navigate to **Audit Logs** (`/admin/audit-logs`):
   - Show tamper-evident security audit trail tracking user logins, file uploads, permission changes, and lab launches.

---

## 7. Troubleshooting Guide

| Issue | Likely Cause | Remediation |
| :--- | :--- | :--- |
| **502 Bad Gateway from Nginx** | Backend container still initializing or unhealthy. | Check backend logs: `docker compose -f docker-compose.prod.yml logs backend`. Wait 15 seconds for startup healthcheck to pass. |
| **Database Connection Refused (`P1001`)** | PostgreSQL container not ready or invalid `DATABASE_URL`. | Check postgres logs: `docker compose -f docker-compose.prod.yml logs postgres`. Verify credentials in `.env`. |
| **401 Unauthorized after login on HTTPS domain** | Cookie `SameSite` or `Secure` mismatch on cross-domain setup. | Set `COOKIE_SAME_SITE=none` and `COOKIE_SECURE=true` in backend environment if frontend and backend use different domains. |
| **File Upload Returns 413 Payload Too Large** | File exceeds configured limit. | Adjust `MAX_FILE_SIZE_MB` in `.env` and `client_max_body_size` in `frontend/nginx.conf`. |
| **Files Lost After Container Restart** | Persistent volume not mapped to `/app/storage/uploads`. | Ensure `encrypted_storage` Docker volume is mounted in `docker-compose.prod.yml`. |
