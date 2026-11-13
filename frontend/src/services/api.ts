import axios, { AxiosError, AxiosResponse } from 'axios';
import { ApiResponse } from '../types/api.types';

const rawApiUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').trim();
const normalizedBaseUrl = rawApiUrl
  ? rawApiUrl.endsWith('/api/v1')
    ? rawApiUrl
    : rawApiUrl.endsWith('/')
    ? `${rawApiUrl}api/v1`
    : `${rawApiUrl}/api/v1`
  : '/api/v1';

export const apiClient = axios.create({
  baseURL: normalizedBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    let message = 'An unexpected server error occurred. Please try again.';

    if (error.response?.data?.message) {
      message = error.response.data.message;
    } else if (error.response?.status === 401) {
      message = 'Your session has expired. Please sign in again.';
    } else if (error.response?.status === 403) {
      message = 'You do not have permission to perform this action.';
    } else if (error.response?.status === 404) {
      message = 'The requested resource was not found.';
    } else if (error.response?.status === 429) {
      message = 'Too many requests. Please wait a moment before trying again.';
    } else if (error.code === 'ECONNABORTED') {
      message = 'Request timed out. Please check your network connection.';
    } else if (!error.response && error.message) {
      message = error.message;
    }

    const enhancedError = new Error(message) as Error & {
      statusCode?: number;
      fieldErrors?: Array<{ field: string; message: string }>;
      rawResponse?: any;
    };
    enhancedError.statusCode = error.response?.status;
    enhancedError.fieldErrors = error.response?.data?.errors;
    enhancedError.rawResponse = error.response?.data;

    return Promise.reject(enhancedError);
  }
);

export default apiClient;
