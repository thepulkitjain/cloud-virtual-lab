# Secure Cloud Storage & AES-256-GCM Architecture

## 1. Overview

The **Secure Cloud Storage Module** provides encrypted file storage for students and staff within the Cloud Virtual Lab platform. To guarantee confidentiality, integrity, and non-repudiation, files are **never** stored in plaintext on disk or inside any public web directory.

Every file uploaded is encrypted using **AES-256-GCM** (Advanced Encryption Standard with Galois/Counter Mode) prior to touching the disk filesystem.

---

## 2. Cryptographic Architecture (AES-256-GCM)

### What is AES-256-GCM?
AES-256-GCM is an **Authenticated Encryption with Associated Data (AEAD)** algorithm. Unlike older modes like CBC or ECB:
1. **Confidentiality:** Scrambles raw file bytes into pseudorandom ciphertext using a 256-bit secret key.
2. **Integrity & Authenticity:** Produces a 128-bit authentication tag (`authTag`). If an attacker or disk error alters even a single bit of the encrypted file on the server, decryption immediately fails with an integrity error.
3. **Replay & Chosen-Ciphertext Attack Prevention:** Each file encryption uses a freshly generated, cryptographically random 96-bit Initialization Vector (`IV`). No two files ever share the same IV, even if their contents are identical.

### Key Management
- The master encryption secret is read from the `STORAGE_ENCRYPTION_SECRET` environment variable.
- The secret must be 256 bits (32 bytes). In production, this is supplied as a 64-character hexadecimal string or a 32-character high-entropy secret.
- The encryption key is loaded strictly into server memory and is **never** sent to clients, logged, or stored in PostgreSQL.

---

## 3. End-to-End Workflow

### A. File Upload & Encryption Flow
```
[Client (Browser / Postman)]
       │  multipart/form-data (file buffer)
       ▼
[Upload Middleware (Multer Memory Storage)]
       │  In-Memory Buffer (Plaintext NEVER written to disk)
       ▼
[Validation Tier]
       │  1. Check file extension (block .exe, .bat, .sh, etc.)
       │  2. Check User Storage Quota: currentUsed + newFileSize <= quotaBytes
       ▼
[Crypto Engine (crypto.util.ts)]
       │  1. Generate random 96-bit IV (crypto.randomBytes(12))
       │  2. Compute SHA-256 Checksum of original plaintext
       │  3. Encrypt buffer using aes-256-gcm
       │  4. Extract 128-bit Authentication Tag (cipher.getAuthTag())
       ▼
[Persistence Tier]
       ├──> Write Ciphertext to: storage/uploads/<UUIDv4>.enc
       └──> Store Metadata in PostgreSQL (StoredFile):
            - Original filename (e.g., "report.pdf")
            - Stored filename (e.g., "f47ac10b-58cc-4372-a567-0e02b2c3d479.enc")
            - MIME type & FileCategory
            - File size in bytes
            - Hex-encoded IV (24 hex characters)
            - Hex-encoded AuthTag (32 hex characters)
            - SHA-256 Checksum
```

### B. File Download & Decryption Flow
```
[Client Request: GET /api/v1/storage/files/:id/download]
       │  HTTP-only JWT Cookie
       ▼
[Authentication & Ownership Verification]
       │  Verify user owns file (file.userId === req.user.id) OR is ADMIN
       ▼
[Disk Read]
       │  Read encrypted ciphertext from storage/uploads/<storedName>
       ▼
[Decryption & Integrity Check]
       │  1. Initialize decipher with Master Key and stored IV
       │  2. Set stored AuthTag (decipher.setAuthTag(authTag))
       │  3. Decrypt ciphertext: decipher.update(ciphertext) + decipher.final()
       │     * If tag verification fails -> Throw 400 Integrity Error (Abort)
       ▼
[Client Response Stream]
       │  Content-Type: <file.mimeType>
       │  Content-Disposition: attachment; filename="<originalName>"
       │  Stream Decrypted Plaintext directly to HTTP response
```

---

## 4. Storage Quotas & Capacity Management

- Each student account receives an initial quota (default: **100 MB** = 104,857,600 bytes).
- Administrators can increase individual student quotas (e.g., 500 MB, 1 GB).
- Before an upload is written to disk, an atomic database transaction aggregates the user's current storage usage:
  $$\text{currentUsed} + \text{fileSize} \le \text{storageQuotaBytes}$$
- If an upload would exceed the quota, the server rejects it with HTTP 400 without writing any files or altering state.
- When a file is deleted, its encrypted blob is unlinked from disk, the PostgreSQL record is removed, and the storage usage drops immediately.

---

## 5. Storage REST API Reference

All endpoints are mounted under `/api/v1/storage` and require authentication (`token` cookie):

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/quota` | Retrieves total quota, used bytes, remaining bytes, percentage used, total files and folders. |
| `POST` | `/files/upload` | Uploads a file (`multipart/form-data`, field: `file`, optional `folderId`). Encrypts and saves file. |
| `GET` | `/files` | Lists files with optional filters: `?folderId=`, `?search=`, `?category=`, `?sortBy=`, `?sortOrder=`. |
| `GET` | `/files/:id` | Returns metadata for a single file (without exposing encryption keys/IV). |
| `GET` | `/files/:id/download` | Decrypts and streams file to client. |
| `PUT` | `/files/:id` | Renames a file (`{ "name": "new_name.txt" }`). |
| `PATCH`| `/files/:id/move` | Moves file to another folder or root (`{ "targetFolderId": "<uuid> \| null" }`). |
| `DELETE` | `/files/:id` | Deletes file record and unlinks encrypted ciphertext from server disk. |
| `POST` | `/folders` | Creates a new folder (`{ "name": "Folder Name", "parentId": null }`). |
| `GET` | `/folders` | Lists folders with file counts and subfolder counts (`?parentId=`). |
| `PUT` | `/folders/:id` | Renames a folder (`{ "name": "Updated Name" }`). |
| `DELETE` | `/folders/:id` | Deletes an empty folder (blocks deletion if folder contains files). |

---

## 6. How to Test File Uploads Using Postman

1. **Log In First:**
   - Send `POST http://localhost:5000/api/v1/auth/login` with `{ "email": "student@virtuallab.edu", "password": "..." }`.
   - Postman will automatically store the `token` cookie.
2. **Upload a File:**
   - Method: `POST`
   - URL: `http://localhost:5000/api/v1/storage/files/upload`
   - In the **Body** tab, select **form-data**.
   - Set Key: `file` (change key type from *Text* to **File** in the dropdown).
   - Select any local file (e.g. `document.pdf` or `notes.txt`).
   - (Optional) Add Key: `folderId`, Value: `<folder_uuid>`.
   - Click **Send**.
   - Expected Response: `201 Created` with file metadata and SHA-256 checksum.
3. **Download the File:**
   - Method: `GET`
   - URL: `http://localhost:5000/api/v1/storage/files/<file_id>/download`
   - Click the arrow next to **Send** and choose **Send and Download**.
   - The file will download and decrypt to its exact original state.

---

## 7. How to Verify Files Are Encrypted at Rest

To verify that files on the server are truly encrypted:
1. Open PowerShell on Windows and navigate to the storage upload directory:
   ```powershell
   cd "storage\uploads"
   Get-ChildItem
   ```
2. You will see filenames like `f47ac10b-58cc-4372-a567-0e02b2c3d479.enc`.
3. Try viewing the contents of any `.enc` file in Notepad or terminal:
   ```powershell
   Get-Content .\<filename>.enc -Raw
   ```
4. **Result:** The contents are scrambled binary ciphertext. No plaintext, headers, or readable student data exist on disk.
