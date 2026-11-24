# REST API Specification & Integration Reference

## 1. Overview & Protocol Standards

The **Cloud Virtual Lab and Secure Storage Management System** provides a versioned, secure REST API mounted under `/api/v1/`.

### 1.1 Base URLs
- **Local Development:** `http://localhost:5000/api/v1`
- **Frontend Reverse Proxy:** `/api/v1`
- **Production Host:** `https://api.yourdomain.com/api/v1`

### 1.2 Authentication & Session Protocol
Authentication relies on signed **JSON Web Tokens (JWT)** transmitted via an HTTP-only cookie named `token`:
```http
Cookie: token=<jwt-token-string>
```
For API tools or CLI automated requests, the standard `Authorization` Bearer header is also supported:
```http
Authorization: Bearer <jwt-token-string>
```

### 1.3 Uniform API Response Envelope
All API endpoints return JSON conforming to the standard response structure:
```json
{
  "success": true,
  "message": "Human-readable description of the operation result.",
  "data": { ... }
}
```

In the event of a client or server error:
```json
{
  "success": false,
  "message": "Error description or policy violation explanation.",
  "errors": [
    {
      "field": "email",
      "message": "Please enter a valid institutional email address"
    }
  ]
}
```

---

## 2. Authentication & Profile Endpoints (`/api/v1/auth`)

### 2.1 Register Student Account
- **Route:** `POST /api/v1/auth/register`
- **Access:** Public (Rate-limited)
- **Request Body:**
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@virtuallab.edu",
    "password": "Password123!@#",
    "studentId": "CSE-2026-001",
    "department": "Computer Science & Engineering",
    "semester": 4
  }
  ```
- **Response (`201 Created`):**
  Sets `Set-Cookie: token=...; HttpOnly; Path=/` and returns user profile data.

---

### 2.2 User Login
- **Route:** `POST /api/v1/auth/login`
- **Access:** Public (Rate-limited)
- **Request Body:**
  ```json
  {
    "email": "student@virtuallab.edu",
    "password": "Password123!@#"
  }
  ```
- **Response (`200 OK`):**
  Sets `Set-Cookie: token=...; HttpOnly; Path=/` and returns authenticated user object.

---

### 2.3 User Logout
- **Route:** `POST /api/v1/auth/logout`
- **Access:** Authenticated
- **Response (`200 OK`):**
  Clears the `token` cookie.

---

### 2.4 Get Current Session User
- **Route:** `GET /api/v1/auth/me`
- **Access:** Authenticated (`STUDENT` or `ADMIN`)
- **Response (`200 OK`):**
  Returns user profile, active storage quota in bytes, and aggregate file/lab metrics.

---

### 2.5 Update Profile
- **Route:** `PUT /api/v1/auth/profile`
- **Access:** Authenticated
- **Request Body:**
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "department": "Computer Science",
    "semester": 5,
    "bio": "Specializing in Cloud Computing and Security"
  }
  ```

---

### 2.6 Change Password
- **Route:** `POST /api/v1/auth/change-password`
- **Access:** Authenticated
- **Request Body:**
  ```json
  {
    "currentPassword": "Password123!@#",
    "newPassword": "NewSecurePassword456!@#",
    "confirmPassword": "NewSecurePassword456!@#"
  }
  ```

---

## 3. Virtual Laboratory Endpoints (`/api/v1/labs`)

### 3.1 List Laboratories
- **Route:** `GET /api/v1/labs`
- **Query Parameters:**
  - `category`: `LINUX` | `NETWORKING` | `PROGRAMMING` | `DATABASE`
  - `difficulty`: `BEGINNER` | `INTERMEDIATE` | `ADVANCED`
  - `search`: Keyword string
- **Response (`200 OK`):** Array of active labs with exercise counts and session totals.

---

### 3.2 Get Laboratory Details
- **Route:** `GET /api/v1/labs/:idOrSlug`
- **Access:** Authenticated
- **Response (`200 OK`):** Returns lab details, ordered exercises, and student's active session (if any).

---

### 3.3 Start or Resume Lab Session
- **Route:** `POST /api/v1/labs/:id/sessions`
- **Access:** Authenticated Student
- **Response (`200 OK` or `201 Created`):**
  ```json
  {
    "success": true,
    "message": "Virtual laboratory session started successfully.",
    "data": {
      "session": {
        "id": "c8a41785-...",
        "status": "IN_PROGRESS",
        "score": 0,
        "startedAt": "2026-11-12T15:00:00.000Z"
      },
      "lab": { ... }
    }
  }
  ```

---

### 3.4 Execute Command in Simulator
- **Route:** `POST /api/v1/labs/sessions/:id/execute`
- **Access:** Authenticated (Session Owner Only)
- **Request Body:**
  ```json
  {
    "command": "ls -la",
    "exerciseId": "optional-uuid"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Command executed successfully.",
    "data": {
      "output": "-rw-r--r-- 1 student student 142 Nov 12 12:00 welcome.txt",
      "currentPath": "/home/student",
      "exercisePassed": true,
      "feedbackMessage": "Exercise requirement satisfied! Great work.",
      "currentScore": 25
    }
  }
  ```

---

### 3.5 Tab Autocomplete in Terminal Simulator
- **Route:** `POST /api/v1/labs/sessions/:sessionId/complete`
- **Access:** Authenticated (Session Owner Only)
- **Request Body:**
  ```json
  {
    "line": "cd st"
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Tab completion resolved.",
    "data": {
      "line": "cd student/",
      "matches": [
        "student/"
      ],
      "hasMultiple": false,
      "completed": true
    }
  }
  ```
- **Multiple Matches Example Response (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Tab completion resolved.",
    "data": {
      "line": "c",
      "matches": [
        "cat",
        "cd",
        "clear"
      ],
      "hasMultiple": true,
      "completed": false
    }
  }
  ```

---

### 3.6 Submit Code or Command for Evaluation
- **Route:** `POST /api/v1/labs/sessions/:id/submit`
- **Request Body:**
  ```json
  {
    "exerciseId": "exercise-uuid",
    "commandInput": "python3 solution.py"
  }
  ```

---

### 3.7 End Lab Session
- **Route:** `POST /api/v1/labs/sessions/:id/end`
- **Access:** Authenticated Session Owner
- **Response (`200 OK`):** Closes session, sets `status: COMPLETED`, records `endedAt`.

---

## 4. Secure Cloud Storage Endpoints (`/api/v1/storage`)

### 4.1 Get Storage Quota Metrics
- **Route:** `GET /api/v1/storage/quota`
- **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "quota": {
        "quotaBytes": "104857600",
        "usedBytes": "15428900",
        "remainingBytes": "89428700",
        "percentageUsed": 14.71,
        "totalFiles": 6,
        "totalFolders": 2
      }
    }
  }
  ```

---

### 4.2 Upload and Encrypt File (AES-256-GCM)
- **Route:** `POST /api/v1/storage/files/upload`
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `file`: Raw file payload
  - `folderId`: (Optional) Target folder UUID
- **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "File encrypted with AES-256-GCM and stored securely.",
    "data": {
      "file": {
        "id": "file-uuid",
        "originalName": "research_report.pdf",
        "mimeType": "application/pdf",
        "fileCategory": "PDF",
        "sizeBytes": "2451000",
        "checksumSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "createdAt": "2026-11-12T15:10:00.000Z"
      }
    }
  }
  ```

---

### 4.3 List Files
- **Route:** `GET /api/v1/storage/files`
- **Query Parameters:** `folderId`, `search`, `category`, `sortBy` (`name` | `size` | `date`), `sortOrder` (`asc` | `desc`).

---

### 4.4 Download and Decrypt File
- **Route:** `GET /api/v1/storage/files/:id/download`
- **Access:** Owner or Admin
- **Response (`200 OK`):** Streams decrypted file stream with appropriate `Content-Type` and `Content-Disposition: attachment; filename="..."`.

---

### 4.5 Rename File
- **Route:** `PATCH /api/v1/storage/files/:id`
- **Request Body:** `{ "name": "updated_document.pdf" }`

---

### 4.6 Move File
- **Route:** `PATCH /api/v1/storage/files/:id/move`
- **Request Body:** `{ "targetFolderId": "folder-uuid" | null }`

---

### 4.7 Delete File Permanently
- **Route:** `DELETE /api/v1/storage/files/:id`
- **Access:** Owner or Admin
- **Response (`200 OK`):** Removes ciphertext from disk and deletes database record.

---

### 4.8 Folder Operations
- `POST /api/v1/storage/folders`: Create folder `{ "name": "Lab Reports", "parentId": null }`
- `GET /api/v1/storage/folders`: List user folders
- `PATCH /api/v1/storage/folders/:id`: Rename folder
- `DELETE /api/v1/storage/folders/:id`: Delete empty folder

---

## 5. Admin Governance Endpoints (`/api/v1/admin`)

*All admin endpoints require an active session with `Role.ADMIN`.*

### 5.1 Dashboard Telemetry
- **Route:** `GET /api/v1/admin/dashboard`
- **Response:** Global metrics for users, laboratories, sessions, storage vault capacity, recent activities, and audit logs.

### 5.2 User Governance
- `GET /api/v1/admin/users`: Search, filter, and paginate all users.
- `GET /api/v1/admin/users/:id`: Comprehensive user profile with storage and lab stats.
- `PATCH /api/v1/admin/users/:id/status`: Update status (`ACTIVE`, `INACTIVE`, `SUSPENDED`).
- `PATCH /api/v1/admin/users/:id/role`: Change role (`STUDENT`, `ADMIN`).

### 5.3 Storage Monitoring
- `GET /api/v1/admin/storage/overview`: System-wide storage utilization and category distribution.
- `GET /api/v1/admin/storage/users`: User-by-user quota usage table.
- `PATCH /api/v1/admin/storage/users/:userId/quota`: Modify storage quota `{ "quotaBytes": 524288000 }`.
- `GET /api/v1/admin/storage/files`: List all files across the platform.
- `DELETE /api/v1/admin/storage/files/:id`: Forcibly purge orphaned or policy-violating file.

### 5.4 Virtual Lab Governance
- `GET /api/v1/admin/labs/governance`: Overview of all labs with student pass rates and scores.
- `GET /api/v1/admin/labs/:id/performance`: Granular student session completion performance.
- `PATCH /api/v1/admin/labs/:id/status`: Toggle lab active status `{ "isActive": true | false }`.
- `POST /api/v1/admin/labs`: Deploy new lab suite.
- `PUT /api/v1/admin/labs/:id`: Update lab metadata.
- `POST /api/v1/admin/labs/:labId/exercises`: Add exercise.
- `PUT /api/v1/admin/exercises/:exerciseId`: Edit exercise.
- `DELETE /api/v1/admin/exercises/:exerciseId`: Delete exercise.

### 5.5 Audit & Activity Feeds
- `GET /api/v1/admin/audit-logs`: Filter and paginate immutable administrative audit trail.
- `GET /api/v1/admin/activities`: Filter and paginate platform user activity telemetry.
