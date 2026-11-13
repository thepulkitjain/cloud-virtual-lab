import { Response } from 'express';

export interface ApiResponseOptions<T = any> {
  res: Response;
  statusCode?: number;
  message: string;
  data?: T;
  errors?: any;
}

export const sendResponse = <T>({
  res,
  statusCode = 200,
  message,
  data,
  errors,
}: ApiResponseOptions<T>) => {
  const success = statusCode >= 200 && statusCode < 400;

  return res.status(statusCode).json({
    success,
    message,
    ...(data !== undefined && { data }),
    ...(errors !== undefined && { errors }),
  });
};
