import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../config/database';
import { Role } from '@prisma/client';

const app = createApp();

describe('Module 1: Authentication and Authorization Tests', () => {
  const testEmail = `student_${Date.now()}@virtuallab.edu`;
  const testPassword = 'Password123!@#';
  let studentCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    // Ensure test environment variable
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    // Clean up created test user
    try {
      await prisma.user.deleteMany({
        where: { email: { contains: 'student_' } },
      });
      await prisma.$disconnect();
    } catch {
      // Ignore cleanup error if record already removed
    }
  });

  describe('1. Student Registration', () => {
    it('should successfully register a student with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          firstName: 'Ankit',
          lastName: 'Sharma',
          email: testEmail,
          password: testPassword,
          studentId: `CS2026_${Date.now().toString().slice(-4)}`,
          department: 'Computer Science',
          semester: 6,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
      expect(res.body.data.user.role).toBe(Role.STUDENT);
      expect(res.body.data.user).not.toHaveProperty('passwordHash');

      // Verify HTTP-only cookie is set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/token=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);
    });

    it('SECURITY CHECK: should prevent privilege escalation and ignore client-supplied role: ADMIN', async () => {
      const maliciousEmail = `hacker_${Date.now()}@virtuallab.edu`;
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          firstName: 'Mallory',
          lastName: 'Attacker',
          email: maliciousEmail,
          password: testPassword,
          role: 'ADMIN', // Malicious attempt to elevate privileges
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe(Role.STUDENT); // Forced to STUDENT

      // Verify directly in PostgreSQL
      const dbUser = await prisma.user.findUnique({
        where: { email: maliciousEmail },
      });
      expect(dbUser?.role).toBe(Role.STUDENT);

      // Clean up malicious test user
      await prisma.user.delete({ where: { email: maliciousEmail } });
    });

    it('should reject registration with duplicate email address', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          firstName: 'Another',
          lastName: 'User',
          email: testEmail, // Already registered
          password: testPassword,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should reject registration when password does not meet complexity requirements', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          firstName: 'Weak',
          lastName: 'Pass',
          email: `weak_${Date.now()}@virtuallab.edu`,
          password: 'simplepassword', // Missing uppercase, digit, special char
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
    });
  });

  describe('2. User Login', () => {
    it('should log in the registered student and return an HTTP-only cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe(Role.STUDENT);

      // Save cookie for subsequent authenticated tests
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      studentCookie = cookies[0];
    });

    it('should log in the seeded Admin user and return role: ADMIN', async () => {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@virtuallab.edu';
      const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSecurePassword123!';

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: adminEmail,
          password: adminPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe(Role.ADMIN);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      adminCookie = cookies[0];
    });

    it('should reject login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@virtuallab.edu',
          password: testPassword,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email or password');
    });
  });

  describe('3. Session Validation & Profile (/api/v1/auth/me)', () => {
    it('should return 401 when accessing /me without authentication cookie', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return current user details and storage stats with valid student cookie', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
      expect(res.body.data.user).toHaveProperty('storageStats');
      expect(res.body.data.user.storageStats).toHaveProperty('quotaBytes');
      expect(res.body.data.user.storageStats).toHaveProperty('usedBytes');
    });

    it('should update user profile details', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Cookie', studentCookie)
        .send({
          firstName: 'Ankit Updated',
          department: 'Information Technology',
          bio: 'Passionate about cloud systems and Linux kernels.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.firstName).toBe('Ankit Updated');
      expect(res.body.data.user.profile.department).toBe('Information Technology');
    });
  });

  describe('4. Password Change & Verification', () => {
    const updatedPassword = 'NewSecretPassword456!#';

    it('should reject password change when current password is wrong', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', studentCookie)
        .send({
          currentPassword: 'IncorrectOldPassword!',
          newPassword: updatedPassword,
          confirmPassword: updatedPassword,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Current password is incorrect');
    });

    it('should successfully change password with valid current password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', studentCookie)
        .send({
          currentPassword: testPassword,
          newPassword: updatedPassword,
          confirmPassword: updatedPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Password changed successfully');
    });

    it('should allow login with the new password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testEmail,
          password: updatedPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('5. Logout', () => {
    it('should clear the authentication cookie upon logout', async () => {
      const res = await request(app).post('/api/v1/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      // On cookie clear, maxAge/expires is in the past
      expect(cookies[0]).toMatch(/token=;/);
    });
  });

  describe('6. Role-Based Access Control (RBAC)', () => {
    it('should reject a STUDENT accessing an ADMIN-only endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/test/admin-only')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden: Access denied');
    });

    it('should allow an ADMIN accessing an ADMIN-only endpoint with 200 OK', async () => {
      const res = await request(app)
        .get('/api/v1/test/admin-only')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Admin authorized access granted.');
    });
  });
});
