import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../config/database';
import { Role, UserStatus } from '@prisma/client';

const app = createApp();

describe('Module 4: Admin Management & System Governance Tests', () => {
  let adminCookie: string;
  let studentCookie: string;
  let adminUserId: string;
  let studentUserId: string;
  let linuxLabId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    // 1. Login Admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@virtuallab.edu';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSecurePassword123!';
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    adminCookie = adminLoginRes.headers['set-cookie'][0];
    adminUserId = adminLoginRes.body.data.user.id;

    // 2. Register Student
    const studentEmail = `gov_student_${Date.now()}@virtuallab.edu`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Governance',
        lastName: 'Student',
        email: studentEmail,
        password: 'Password123!@#',
        studentId: `STU_${Date.now().toString().slice(-4)}`,
        department: 'Computer Science',
        semester: 4,
      });

    studentCookie = regRes.headers['set-cookie'][0];
    studentUserId = regRes.body.data.user.id;

    // 3. Retrieve Linux Lab ID
    const lab = await prisma.lab.findUnique({
      where: { slug: 'linux-command-basics' },
    });
    if (lab) linuxLabId = lab.id;
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: { id: studentUserId },
      });
      await prisma.$disconnect();
    } catch {
      // Ignore cleanup
    }
  });

  describe('1. Security & RBAC Guards', () => {
    it('should reject unauthenticated access to /admin/dashboard with 401', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('SECURITY CHECK: Student cannot access /admin/dashboard (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('SECURITY CHECK: Student cannot access /admin/users (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('SECURITY CHECK: Student cannot access /admin/audit-logs (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('2. Admin Dashboard Overview (/api/v1/admin/dashboard)', () => {
    it('Admin can retrieve system dashboard statistics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const metrics = res.body.data.metrics;
      expect(metrics.users).toHaveProperty('total');
      expect(metrics.users).toHaveProperty('active');
      expect(metrics.users).toHaveProperty('students');
      expect(metrics.users).toHaveProperty('admins');
      expect(metrics.laboratories.total).toBeGreaterThanOrEqual(4);
      expect(metrics.labSessions).toHaveProperty('total');
      expect(metrics.storage).toHaveProperty('totalFiles');
      expect(metrics.storage).toHaveProperty('usedBytes');
      expect(Array.isArray(metrics.recentActivities)).toBe(true);
      expect(Array.isArray(metrics.recentAuditLogs)).toBe(true);
    });
  });

  describe('3. User Management (/api/v1/admin/users)', () => {
    it('Admin can list registered users with pagination and search', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?search=Governance&page=1&limit=10')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.users[0].email).toContain('gov_student_');
      expect(res.body.data.pagination).toHaveProperty('totalUsers');
      expect(res.body.data.pagination.page).toBe(1);

      // Verify sensitive information exclusion
      expect(res.body.data.users[0]).not.toHaveProperty('passwordHash');
    });

    it('Admin can view detailed user profile, storage, and lab statistics', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users/${studentUserId}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(studentUserId);
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(res.body.data.storageStats).toHaveProperty('quotaBytes');
      expect(res.body.data.labStats).toHaveProperty('totalSessions');
      expect(Array.isArray(res.body.data.recentActivities)).toBe(true);
    });

    it('SELF-PROTECTION RULE: Admin cannot deactivate their own account', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminUserId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: UserStatus.INACTIVE });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Self-protection rule violation');
    });

    it('SELF-PROTECTION RULE: Admin cannot demote their own administrative role', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminUserId}/role`)
        .set('Cookie', adminCookie)
        .send({ role: Role.STUDENT });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Self-protection rule violation');
    });

    it('Admin can deactivate and reactivate a student account with AuditLog generation', async () => {
      // 1. Deactivate student
      const deactRes = await request(app)
        .patch(`/api/v1/admin/users/${studentUserId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: UserStatus.INACTIVE });

      expect(deactRes.status).toBe(200);
      expect(deactRes.body.success).toBe(true);
      expect(deactRes.body.data.user.status).toBe(UserStatus.INACTIVE);

      // Verify student login is now blocked
      const studentEmail = (await prisma.user.findUnique({ where: { id: studentUserId } }))!.email;
      const loginAttempt = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: studentEmail, password: 'Password123!@#' });

      expect(loginAttempt.status).toBe(403);
      expect(loginAttempt.body.message).toContain('Account access blocked');

      // 2. Reactivate student
      const reactRes = await request(app)
        .patch(`/api/v1/admin/users/${studentUserId}/status`)
        .set('Cookie', adminCookie)
        .send({ status: UserStatus.ACTIVE });

      expect(reactRes.status).toBe(200);
      expect(reactRes.body.data.user.status).toBe(UserStatus.ACTIVE);

      // Verify AuditLog record was created in PostgreSQL
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          targetEntity: 'USER',
          targetId: studentUserId,
          action: 'UPDATE_USER_STATUS',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.adminId).toBe(adminUserId);
    });
  });

  describe('4. System Activity & Audit Monitoring', () => {
    it('GET /api/v1/admin/activities: Admin can retrieve and filter system activities', async () => {
      const res = await request(app)
        .get('/api/v1/admin/activities?page=1&limit=15')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.activities)).toBe(true);
      expect(res.body.data.pagination).toHaveProperty('totalActivities');
    });

    it('GET /api/v1/admin/audit-logs: Admin can retrieve and filter administrative audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs?targetEntity=USER&page=1&limit=10')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.auditLogs.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.auditLogs[0].targetEntity).toBe('USER');
      expect(res.body.data.auditLogs[0].admin).toHaveProperty('email');
    });
  });

  describe('5. Laboratory Governance', () => {
    it('GET /api/v1/admin/labs/governance: Admin retrieves laboratory governance overview', async () => {
      const res = await request(app)
        .get('/api/v1/admin/labs/governance')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.laboratories.length).toBeGreaterThanOrEqual(4);

      const linuxGov = res.body.data.laboratories.find((l: any) => l.slug === 'linux-command-basics');
      expect(linuxGov).toBeDefined();
      expect(linuxGov).toHaveProperty('completionRatePercentage');
      expect(linuxGov).toHaveProperty('averageScore');
      expect(linuxGov).toHaveProperty('totalExercises');
    });

    it('PATCH /api/v1/admin/labs/:id/status: Admin can disable and re-enable a laboratory', async () => {
      // 1. Disable lab
      const disableRes = await request(app)
        .patch(`/api/v1/admin/labs/${linuxLabId}/status`)
        .set('Cookie', adminCookie)
        .send({ isActive: false });

      expect(disableRes.status).toBe(200);
      expect(disableRes.body.success).toBe(true);
      expect(disableRes.body.data.lab.isActive).toBe(false);

      // Verify student cannot start session on disabled lab
      const startRes = await request(app)
        .post(`/api/v1/labs/${linuxLabId}/sessions`)
        .set('Cookie', studentCookie);

      expect(startRes.status).toBe(404);
      expect(startRes.body.message).toContain('unavailable');

      // 2. Re-enable lab
      const enableRes = await request(app)
        .patch(`/api/v1/admin/labs/${linuxLabId}/status`)
        .set('Cookie', adminCookie)
        .send({ isActive: true });

      expect(enableRes.status).toBe(200);
      expect(enableRes.body.data.lab.isActive).toBe(true);
    });

    it('GET /api/v1/admin/labs/:id/performance: Admin retrieves student performance breakdown', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/labs/${linuxLabId}/performance`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lab.id).toBe(linuxLabId);
      expect(Array.isArray(res.body.data.sessions)).toBe(true);
      expect(res.body.data.pagination).toHaveProperty('totalSessions');
    });
  });
});
