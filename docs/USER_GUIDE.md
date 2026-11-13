# User Manual & Operational Guide

## 1. Introduction

The **Cloud Virtual Lab and Secure Storage Management System** is an integrated educational computing platform designed for computer science students and university staff.

### System Roles
- **Student:** Can access simulated laboratories, submit programming and terminal exercises, earn scores, and manage files in an encrypted cloud storage vault.
- **Administrator:** Exercises oversight over user accounts, adjusts storage quotas, provisions new laboratory exercises, monitors student completion telemetry, and reviews security audit trails.

---

## 2. Student Walkthrough

### 2.1 Registration & Authentication
1. **Registration:**
   - Navigate to `http://localhost:5173/register`.
   - Enter your First Name, Last Name, Institutional Email, Password, Student Roll Number, Department, and Semester.
   - Password must contain at least 8 characters, an uppercase letter, a lowercase letter, a digit, and a special symbol.
   - Upon successful registration, you are immediately logged in via a secure HTTP-only cookie.
2. **Login:**
   - Navigate to `http://localhost:5173/login`.
   - Provide your email and password.
   - If your account has been deactivated or suspended by an administrator, login access is denied with a notice to contact staff.

---

### 2.2 Student Dashboard Overview
The Student Dashboard (`/dashboard`) provides an overview of:
- **Active Quota & Vault Usage:** Storage percentage used, remaining megabytes, and total uploaded files.
- **Virtual Laboratory Engagement:** Completed sessions count, active sessions, and cumulative score.
- **Quick Links:** One-click shortcuts to explore laboratories, open cloud storage, or modify security settings.

---

### 2.3 Working in Virtual Laboratories

Navigate to `/labs` to view available virtual laboratories:

```
[Linux Command-Line Essentials]       [Networking & Connectivity]
[Python & JS Programming Lab]          [SQL Database Playground]
```

Click **"Start Laboratory Session"** on any laboratory to launch its workspace:

#### 1. Linux Command-Line Terminal
- Interactive simulated terminal environment.
- **Allowed Commands:** `pwd`, `ls [-la]`, `cd <dir>`, `mkdir <dir>`, `touch <file>`, `cat <file>`, `echo "text" > <file>`, `whoami`, `uname`, `clear`, `help`.
- Tasks displayed in the **Exercise Sidebar** evaluate your commands in real time. When an exercise is completed, your score increases automatically.
- Type `help` at any time to display available commands.

#### 2. Networking Diagnostics Console
- Simulates realistic network diagnostic utilities.
- Supported commands: `ping <host>`, `ifconfig`, `nslookup <domain>`, `traceroute <host>`, `netstat`, `curl <url>`.
- Teaches network latency, subnet masks, DNS records, and HTTP request headers.

#### 3. Programming Runner
- Test Python (`python3 app.py`) and Node.js (`node index.js`) scripts and code snippets.
- Evaluates script logic and reports automated test case passes/failures.

#### 4. Relational Database & SQL Playground
- In-memory simulated PostgreSQL terminal.
- Supports catalog inspection (`\dt`, `\d students`, `\l`).
- Practice queries:
  ```sql
  SELECT * FROM students;
  SELECT * FROM students WHERE gpa > 3.5;
  SELECT * FROM courses;
  ```
- Exercises verify SQL syntax and result sets without risking corruption to any real database.

When finished, click **"Complete Session"** to lock your final score and record completion in your history (`/labs/history`).

---

### 2.4 Using the Secure Cloud Storage Vault

Navigate to `/storage` to access your encrypted personal vault:

#### 1. Storage Quota Meter
Displays your total allocated quota (default: 100 MB), used megabytes, remaining capacity, and total encrypted file count.

#### 2. Uploading Files
1. Click **"Upload File"**.
2. Select any document (`.pdf`, `.docx`, `.txt`), image (`.png`, `.jpg`), code file (`.py`, `.ts`, `.js`, `.sql`), or archive (`.zip`).
3. *(Security note: Executable programs such as `.exe`, `.bat`, `.sh`, `.ps1`, `.msi` are strictly blocked).*
4. Select an optional destination folder.
5. Click **"Encrypt & Upload"**. The file is encrypted in memory using **AES-256-GCM** before writing to disk.

#### 3. Organizing Folders
- Click **"New Folder"** to create directories (e.g. `Lab Reports`, `Assignment 1`).
- Double-click any folder to navigate inside it; use the interactive breadcrumb navigation bar to return to root.

#### 4. Downloading & Decrypting Files
- Click the download icon on any file row.
- The server verifies your ownership, reads the encrypted ciphertext, validates the 128-bit authentication tag, decrypts the bytes in memory, and streams the original file to your browser.

#### 5. Renaming, Moving & Deleting
- **Rename:** Click the file actions menu $\rightarrow$ **"Rename"** $\rightarrow$ enter new name.
- **Move:** Click **"Move"** $\rightarrow$ select destination folder.
- **Delete:** Click **"Delete"**. This permanently unlinks the encrypted file from server disk and frees up your storage quota immediately.

---

### 2.5 Profile & Security Settings

Navigate to `/profile` to:
- Update your Academic Profile: First Name, Last Name, Department, Semester, and Bio.
- **Change Password:** Enter current password and new password conforming to complexity requirements.

---

## 3. Administrator Walkthrough

*Administrative tools are protected and only accessible to accounts with `Role.ADMIN`.*

### 3.1 Administrator Governance Console (`/admin`)
- **Key Metrics:** Real-time counts of total registered users, active vs. suspended accounts, active virtual laboratories, student sessions started, and global cloud storage capacity.
- **System Telemetry:** Health indicators for PostgreSQL 18.6, AES-256-GCM Cryptographic Subsystem, HTTP-only JWT Cookie Session Guard, and Vitest suite verification.
- **Live Feeds:** Real-time previews of the 10 most recent system activity events and 10 most recent administrative audit logs.

---

### 3.2 User Management & RBAC Directory (`/admin/users`)
- **Search & Filter:** Search by name, email, or student roll number. Filter by Role (`STUDENT`, `ADMIN`) or Status (`ACTIVE`, `INACTIVE`, `SUSPENDED`).
- **Inspect User Details:** Click the eye icon on any user to view their academic profile, storage vault statistics (used vs quota), virtual lab engagement (sessions, pass rate), and individual audit logs.
- **Update Account Status:**
  - `ACTIVE`: Full platform access.
  - `INACTIVE`: Account disabled.
  - `SUSPENDED`: Access blocked due to disciplinary or security violation. Revokes login immediately.
  - *(Self-protection rule prevents deactivating your own account or the primary root administrator).*
- **Role Elevation / Demotion:** Switch users between `STUDENT` and `ADMIN`.

---

### 3.3 Virtual Laboratory Governance (`/admin/labs`)
- **Laboratory Overview:** Review all virtual laboratories, categories, difficulty levels, total exercises, total sessions, and completion percentages.
- **Active Toggle Switch:** Enable or disable laboratories instantly. Disabled laboratories are hidden from student listings.
- **Deploy Laboratory:** Click **"Deploy Laboratory"** to create a new curriculum module with title, slug, category, difficulty, and duration.
- **Exercise Management:**
  - Click **"Exercises"** on any laboratory to open the drawer.
  - Add, edit, or delete exercises. Specify task title, instructions, hints, expected command pattern, and output validation criteria.
- **Student Performance Telemetry:**
  - Click **"Performance"** to review granular student session results, individual scores, pass rates, and completion timestamps.

---

### 3.4 Cloud Storage Vault Governance (`/admin/storage`)
- **System-Wide Capacity:** Review aggregate allocated quota vs. actual encrypted bytes on disk.
- **Adjusting Student Quotas:**
  - Switch to the **"Users Storage"** tab.
  - Click **"Adjust Quota"** on any student to set custom allocations (e.g. 250 MB, 500 MB, 1024 MB).
- **All Files Audit & Purge:**
  - Switch to the **"All Files"** tab to inspect every file uploaded across the university.
  - Forcibly delete any orphaned or policy-violating file. Purging an encrypted file automatically unlinks it from disk and writes an audit log.

---

### 3.5 System Activity & Audit Trail (`/admin/audit-logs`)
- **Administrative Audit Trail (Tab 1):**
  - Search by action keyword (`UPDATE_USER_STATUS`, `UPDATE_USER_ROLE`, `UPDATE_USER_QUOTA`, `LAB_CREATE`).
  - Filter by Target Entity (`USER`, `LABORATORY`, `STORED_FILE`).
  - Click **"Inspect"** on any audit log to open the **State Differential Inspector**, comparing `previousVal` against `newVal` in color-coded JSON.
- **User Platform Activities (Tab 2):**
  - Real-time stream of student logins, file uploads, file downloads, and lab session events with origin IP addresses.
