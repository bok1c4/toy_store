import axios from 'axios';

export interface ApiErrorData {
  error: string;
  code?: string;
  fields?: Record<string, string>;
}

export interface ApiErrorResponse {
  response: {
    data: ApiErrorData;
    status: number;
  };
}

export function isApiError(err: unknown): err is ApiErrorResponse {
  return (
    axios.isAxiosError(err) &&
    err.response != null &&
    typeof err.response.data?.error === 'string'
  );
}

export function getErrorMessage(err: unknown): string {
  if (isApiError(err)) return err.response.data.error;
  if (err instanceof Error) return err.message;
  return 'Neočekivana greška';
}

export function getFieldErrors(err: unknown): Record<string, string> {
  if (isApiError(err) && err.response.data.fields) {
    return err.response.data.fields;
  }
  return {};
}

/** @deprecated Use getErrorMessage instead */
export function extractApiError(error: unknown, fallback = 'Došlo je do greške'): string {
  return getErrorMessage(error) || fallback;
}
