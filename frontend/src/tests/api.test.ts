import { describe, it, expect, vi, afterEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  normalizeApiBaseUrl,
  apiClient,
  SESSION_EXPIRED_EVENT,
} from '../services/api';

describe('API Configuration & Interceptors', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeApiBaseUrl', () => {
    it('defaults empty or root-slash URLs to /api/v1', () => {
      expect(normalizeApiBaseUrl('')).toBe('/api/v1');
      expect(normalizeApiBaseUrl('   ')).toBe('/api/v1');
      expect(normalizeApiBaseUrl('/')).toBe('/api/v1');
    });

    it('prevents duplicate /api/api/v1 when URL ends with /api', () => {
      expect(normalizeApiBaseUrl('/api')).toBe('/api/v1');
      expect(normalizeApiBaseUrl('/api/')).toBe('/api/v1');
      expect(normalizeApiBaseUrl('https://api.example.com/api')).toBe(
        'https://api.example.com/api/v1'
      );
      expect(normalizeApiBaseUrl('http://localhost:5000/api/')).toBe(
        'http://localhost:5000/api/v1'
      );
    });

    it('preserves URLs already ending with /api/v1', () => {
      expect(normalizeApiBaseUrl('/api/v1')).toBe('/api/v1');
      expect(normalizeApiBaseUrl('https://api.example.com/api/v1/')).toBe(
        'https://api.example.com/api/v1'
      );
    });

    it('appends /api/v1 to bare origin URLs', () => {
      expect(normalizeApiBaseUrl('https://api.example.com')).toBe(
        'https://api.example.com/api/v1'
      );
      expect(normalizeApiBaseUrl('https://api.example.com/')).toBe(
        'https://api.example.com/api/v1'
      );
    });
  });

  describe('apiClient response interceptor & 401 session expiry', () => {
    const getRejectedInterceptor = () => {
      const handlers = (apiClient.interceptors.response as any).handlers;
      return handlers[0].rejected as (err: AxiosError) => Promise<never>;
    };

    const makeAxiosError = (status: number, url: string, message?: string): AxiosError => {
      const headers = new AxiosHeaders();
      return {
        isAxiosError: true,
        name: 'AxiosError',
        message: 'Request failed',
        config: { url, headers },
        response: {
          status,
          statusText: 'Error',
          headers,
          config: { url, headers },
          data: message ? { success: false, message } : undefined,
        },
        toJSON: () => ({}),
      } as AxiosError;
    };

    it('dispatches SESSION_EXPIRED_EVENT on 401 for protected endpoints', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const rejected = getRejectedInterceptor();

      await expect(rejected(makeAxiosError(401, '/labs'))).rejects.toThrow(
        'Your session has expired. Please sign in again.'
      );

      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      const evt = dispatchSpy.mock.calls[0][0] as CustomEvent;
      expect(evt.type).toBe(SESSION_EXPIRED_EVENT);
    });

    it('does NOT dispatch SESSION_EXPIRED_EVENT on 401 for auth lifecycle endpoints', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const rejected = getRejectedInterceptor();

      for (const path of ['/auth/me', '/auth/login', '/auth/register', '/auth/logout']) {
        await expect(rejected(makeAxiosError(401, path))).rejects.toThrow();
      }

      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('attaches statusCode and backend message for 403/404/429 errors', async () => {
      const rejected = getRejectedInterceptor();

      await expect(
        rejected(makeAxiosError(403, '/admin/users', 'Forbidden access'))
      ).rejects.toMatchObject({
        message: 'Forbidden access',
        statusCode: 403,
      });

      await expect(rejected(makeAxiosError(429, '/auth/login'))).rejects.toMatchObject({
        message: 'Too many requests. Please wait a moment before trying again.',
        statusCode: 429,
      });
    });
  });
});
