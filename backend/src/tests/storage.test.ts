import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../app';
import { prisma } from '../config/database';
import { getStorageUploadDirectory } from '../services/storage.service';

const app = createApp();

describe('Module 3: Secure Cloud Storage Management Tests', () => {
  let studentCookie: string;
  let otherStudentCookie: string;
  let adminCookie: string;
  let studentId: string;
  let otherStudentId: string;
  let uploadedFileId: string;
  let storedEncryptedFileName: string;
  let createdFolderId: string;

  const sampleFileContent = 'Hello Cloud Virtual Lab! Confidential Academic Report.\nLine 2 content.';
  const sampleFileName = 'research_paper.txt';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    // 1. Register Student A
    const studentEmail = `storage_student_${Date.now()}@virtuallab.edu`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Storage',
        lastName: 'Student',
        email: studentEmail,
        password: 'Password123!@#',
      });
    studentId = regRes.body.data.user.id;
    studentCookie = regRes.headers['set-cookie'][0];

    // 2. Register Student B (for multi-tenant isolation testing)
    const otherEmail = `storage_other_${Date.now()}@virtuallab.edu`;
    const otherRegRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Other',
        lastName: 'Student',
        email: otherEmail,
        password: 'Password123!@#',
      });
    otherStudentId = otherRegRes.body.data.user.id;
    otherStudentCookie = otherRegRes.headers['set-cookie'][0];

    // 3. Login Admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@virtuallab.edu';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSecurePassword123!';
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    adminCookie = adminLoginRes.headers['set-cookie'][0];
  });

  afterAll(async () => {
    try {
      // Clean up files on disk if any remain
      const uploadDir = getStorageUploadDirectory();
      const files = await prisma.storedFile.findMany({
        where: { userId: { in: [studentId, otherStudentId] } },
      });
      for (const f of files) {
        const p = path.join(uploadDir, f.storedName);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }

      await prisma.user.deleteMany({
        where: { id: { in: [studentId, otherStudentId] } },
      });
      await prisma.$disconnect();
    } catch {
      // Ignore cleanup error
    }
  });

  describe('1. File Upload & AES-256-GCM Encryption', () => {
    it('should successfully upload a file with multipart/form-data', async () => {
      const res = await request(app)
        .post('/api/v1/storage/files/upload')
        .set('Cookie', studentCookie)
        .attach('file', Buffer.from(sampleFileContent), sampleFileName);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.file).toHaveProperty('id');
      expect(res.body.data.file.originalName).toBe(sampleFileName);
      expect(res.body.data.file.fileCategory).toBe('DOCUMENT');
      expect(res.body.data.file).toHaveProperty('checksumSha256');

      uploadedFileId = res.body.data.file.id;

      // Verify file in PostgreSQL
      const dbFile = await prisma.storedFile.findUnique({
        where: { id: uploadedFileId },
      });
      expect(dbFile).toBeDefined();
      expect(dbFile?.encryptionIv).toHaveLength(24); // 12 bytes = 24 hex chars
      expect(dbFile?.authTag).toHaveLength(32); // 16 bytes = 32 hex chars
      storedEncryptedFileName = dbFile!.storedName;
    });

    it('ENCRYPTION VERIFICATION: Disk payload must be ciphertext and NOT contain plaintext', () => {
      const uploadDir = getStorageUploadDirectory();
      const filePath = path.join(uploadDir, storedEncryptedFileName);

      expect(fs.existsSync(filePath)).toBe(true);
      const rawDiskBuffer = fs.readFileSync(filePath);

      // Verify disk buffer is completely different from plaintext
      expect(rawDiskBuffer.toString()).not.toContain('Hello Cloud Virtual Lab!');
      expect(rawDiskBuffer.toString()).not.toContain('Confidential Academic Report');
    });

    it('should reject upload of prohibited dangerous executable files (.exe)', async () => {
      const res = await request(app)
        .post('/api/v1/storage/files/upload')
        .set('Cookie', studentCookie)
        .attach('file', Buffer.from('malicious payload'), 'malware.exe');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('prohibited for security');
    });
  });

  describe('2. File Download & Decryption Verification', () => {
    it('should download and decrypt the file to its original plaintext', async () => {
      const res = await request(app)
        .get(`/api/v1/storage/files/${uploadedFileId}/download`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.headers['content-disposition']).toContain(sampleFileName);
      expect(res.text).toBe(sampleFileContent);
    });

    it('should return file metadata without exposing encryption keys or IV', async () => {
      const res = await request(app)
        .get(`/api/v1/storage/files/${uploadedFileId}`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.file.id).toBe(uploadedFileId);
      expect(res.body.data.file).not.toHaveProperty('encryptionIv');
      expect(res.body.data.file).not.toHaveProperty('authTag');
      expect(res.body.data.file).not.toHaveProperty('storedName');
    });
  });

  describe('3. Multi-Tenant Authorization & Security Isolation', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/storage/files');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('SECURITY CHECK: Student B cannot download Student A file (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/storage/files/${uploadedFileId}/download`)
        .set('Cookie', otherStudentCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('SECURITY CHECK: Student B cannot delete Student A file (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/v1/storage/files/${uploadedFileId}`)
        .set('Cookie', otherStudentCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('ADMIN AUTHORIZATION: Admin can download and view any student file', async () => {
      const res = await request(app)
        .get(`/api/v1/storage/files/${uploadedFileId}/download`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.text).toBe(sampleFileContent);
    });
  });

  describe('4. Folder Management & File Organization', () => {
    it('should create a new folder', async () => {
      const res = await request(app)
        .post('/api/v1/storage/folders')
        .set('Cookie', studentCookie)
        .send({ name: 'Lab Reports' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.folder.name).toBe('Lab Reports');
      createdFolderId = res.body.data.folder.id;
    });

    it('should reject creating duplicate folder with the same name under the same parent', async () => {
      const res = await request(app)
        .post('/api/v1/storage/folders')
        .set('Cookie', studentCookie)
        .send({ name: 'Lab Reports' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should move a file into the created folder', async () => {
      const res = await request(app)
        .patch(`/api/v1/storage/files/${uploadedFileId}/move`)
        .set('Cookie', studentCookie)
        .send({ targetFolderId: createdFolderId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.file.folderId).toBe(createdFolderId);
    });

    it('should prevent deleting a folder that contains files', async () => {
      const res = await request(app)
        .delete(`/api/v1/storage/folders/${createdFolderId}`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Folder is not empty');
    });

    it('should move the file back to root and then allow empty folder deletion', async () => {
      // Move back to root (null)
      await request(app)
        .patch(`/api/v1/storage/files/${uploadedFileId}/move`)
        .set('Cookie', studentCookie)
        .send({ targetFolderId: null });

      // Delete folder
      const delRes = await request(app)
        .delete(`/api/v1/storage/folders/${createdFolderId}`)
        .set('Cookie', studentCookie);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    });
  });

  describe('5. Storage Quota Management & Limits', () => {
    it('GET /api/v1/storage/quota: should return accurate quota calculations', async () => {
      const res = await request(app)
        .get('/api/v1/storage/quota')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quota).toHaveProperty('quotaBytes');
      expect(res.body.data.quota).toHaveProperty('usedBytes');
      expect(res.body.data.quota).toHaveProperty('remainingBytes');
      expect(res.body.data.quota).toHaveProperty('percentageUsed');
      expect(res.body.data.quota.totalFiles).toBeGreaterThanOrEqual(1);
    });

    it('QUOTA ENFORCEMENT: should reject uploads exceeding user storage limit', async () => {
      // Temporarily set student quota to 50 bytes in PostgreSQL
      await prisma.user.update({
        where: { id: studentId },
        data: { storageQuotaBytes: BigInt(50) },
      });

      const res = await request(app)
        .post('/api/v1/storage/files/upload')
        .set('Cookie', studentCookie)
        .attach('file', Buffer.from('This buffer is longer than 50 bytes limit'), 'large.txt');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Storage quota exceeded');

      // Restore quota to 100 MB
      await prisma.user.update({
        where: { id: studentId },
        data: { storageQuotaBytes: BigInt(104857600) },
      });
    });
  });

  describe('6. Tampering & Corruption Detection (AES-256-GCM)', () => {
    it('should detect corrupted or tampered ciphertext and fail with an integrity error', async () => {
      const uploadDir = getStorageUploadDirectory();
      const filePath = path.join(uploadDir, storedEncryptedFileName);

      // Save valid content and tamper one byte in the middle of ciphertext
      const originalEncrypted = fs.readFileSync(filePath);
      const tampered = Buffer.from(originalEncrypted);
      tampered[5] = tampered[5] ^ 0xff; // Flip bits
      fs.writeFileSync(filePath, tampered);

      const res = await request(app)
        .get(`/api/v1/storage/files/${uploadedFileId}/download`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Integrity verification failed');

      // Restore original valid ciphertext
      fs.writeFileSync(filePath, originalEncrypted);
    });

    it('should return 404 when physical encrypted file is missing from disk', async () => {
      const uploadDir = getStorageUploadDirectory();
      const filePath = path.join(uploadDir, storedEncryptedFileName);
      const backup = fs.readFileSync(filePath);
      fs.unlinkSync(filePath); // Temporarily remove

      const res = await request(app)
        .get(`/api/v1/storage/files/${uploadedFileId}/download`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('missing from storage');

      // Restore file
      fs.writeFileSync(filePath, backup);
    });
  });

  describe('7. File Renaming & Deletion', () => {
    it('should rename an existing file via PUT and PATCH', async () => {
      const resPut = await request(app)
        .put(`/api/v1/storage/files/${uploadedFileId}`)
        .set('Cookie', studentCookie)
        .send({ name: 'final_paper_put.txt' });

      expect(resPut.status).toBe(200);
      expect(resPut.body.success).toBe(true);
      expect(resPut.body.data.file.originalName).toBe('final_paper_put.txt');

      const resPatch = await request(app)
        .patch(`/api/v1/storage/files/${uploadedFileId}`)
        .set('Cookie', studentCookie)
        .send({ name: 'final_paper.txt' });

      expect(resPatch.status).toBe(200);
      expect(resPatch.body.success).toBe(true);
      expect(resPatch.body.data.file.originalName).toBe('final_paper.txt');
    });

    it('should delete file record and unlink physical encrypted blob from disk', async () => {
      const uploadDir = getStorageUploadDirectory();
      const filePath = path.join(uploadDir, storedEncryptedFileName);
      expect(fs.existsSync(filePath)).toBe(true);

      const res = await request(app)
        .delete(`/api/v1/storage/files/${uploadedFileId}`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify removed from DB
      const dbFile = await prisma.storedFile.findUnique({
        where: { id: uploadedFileId },
      });
      expect(dbFile).toBeNull();

      // Verify removed from disk
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe('8. Concurrent Upload Handling & Concurrency Safety', () => {
    it('should safely handle parallel uploads without race condition quota bypass', async () => {
      // Set student quota to exactly 150 bytes
      await prisma.user.update({
        where: { id: studentId },
        data: { storageQuotaBytes: BigInt(150) },
      });

      // Launch 3 simultaneous uploads in parallel of 80 bytes each
      // Total = 240 bytes. Only 1 should succeed (80 <= 150), others must fail (80 + 80 = 160 > 150)
      const buffer80 = Buffer.alloc(80, 'a');

      const p1 = request(app)
        .post('/api/v1/storage/files/upload')
        .set('Cookie', studentCookie)
        .attach('file', buffer80, 'concurrent_1.txt');

      const p2 = request(app)
        .post('/api/v1/storage/files/upload')
        .set('Cookie', studentCookie)
        .attach('file', buffer80, 'concurrent_2.txt');

      const p3 = request(app)
        .post('/api/v1/storage/files/upload')
        .set('Cookie', studentCookie)
        .attach('file', buffer80, 'concurrent_3.txt');

      const results = await Promise.all([p1, p2, p3]);
      const statusCodes = results.map((r) => r.status);

      // Exactly one should succeed with 201, others should fail with 400 (quota exceeded)
      const successCount = statusCodes.filter((s) => s === 201).length;
      const rejectCount = statusCodes.filter((s) => s === 400).length;

      expect(successCount).toBe(1);
      expect(rejectCount).toBe(2);

      // Clean up uploaded file and restore quota
      const userFiles = await prisma.storedFile.findMany({ where: { userId: studentId } });
      const uploadDir = getStorageUploadDirectory();
      for (const uf of userFiles) {
        const fp = path.join(uploadDir, uf.storedName);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      await prisma.storedFile.deleteMany({ where: { userId: studentId } });

      await prisma.user.update({
        where: { id: studentId },
        data: { storageQuotaBytes: BigInt(104857600) },
      });
    });
  });

  describe('9. Administrative Storage Management (/api/v1/admin/storage)', () => {
    let adminTestFileId: string;

    beforeAll(async () => {
      // Upload a file as Student A for admin operations testing
      const upRes = await request(app)
        .post('/api/v1/storage/files/upload')
        .set('Cookie', studentCookie)
        .attach('file', Buffer.from('Admin inspection test content'), 'admin_test.txt');

      adminTestFileId = upRes.body.data.file.id;
    });

    it('SECURITY CHECK: Student cannot access administrative storage routes (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/storage/overview')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/admin/storage/overview: Admin retrieves system-wide storage overview', async () => {
      const res = await request(app)
        .get('/api/v1/admin/storage/overview')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.overview).toHaveProperty('totalFiles');
      expect(res.body.data.overview).toHaveProperty('totalStorageUsedBytes');
      expect(res.body.data.overview).toHaveProperty('categoryDistribution');
      expect(res.body.data.overview).toHaveProperty('topConsumers');
    });

    it('GET /api/v1/admin/storage/users: Admin lists user storage allocations', async () => {
      const res = await request(app)
        .get('/api/v1/admin/storage/users')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/v1/admin/storage/users/:userId/quota: Admin updates student quota with AuditLog', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/storage/users/${studentId}/quota`)
        .set('Cookie', adminCookie)
        .send({ quotaMb: 250 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.storageQuotaBytes).toBe((250 * 1024 * 1024).toString());

      // Verify AuditLog record exists in PostgreSQL
      const audit = await prisma.auditLog.findFirst({
        where: {
          targetEntity: 'USER',
          targetId: studentId,
          action: 'UPDATE_STORAGE_QUOTA',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(audit).toBeDefined();
      expect(audit?.action).toBe('UPDATE_STORAGE_QUOTA');
    });

    it('GET /api/v1/admin/storage/files: Admin lists all files across the system', async () => {
      const res = await request(app)
        .get('/api/v1/admin/storage/files')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.files.some((f: any) => f.id === adminTestFileId)).toBe(true);
    });

    it('DELETE /api/v1/admin/storage/files/:id: Admin forcibly deletes file with AuditLog', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/storage/files/${adminTestFileId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify removed from DB
      const dbFile = await prisma.storedFile.findUnique({
        where: { id: adminTestFileId },
      });
      expect(dbFile).toBeNull();

      // Verify AuditLog record created
      const audit = await prisma.auditLog.findFirst({
        where: {
          targetEntity: 'STORED_FILE',
          targetId: adminTestFileId,
          action: 'ADMIN_DELETE_FILE',
        },
      });
      expect(audit).toBeDefined();
    });
  });
});
