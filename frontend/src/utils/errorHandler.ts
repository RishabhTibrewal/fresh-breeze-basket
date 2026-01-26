import { toast } from 'sonner';

export interface ApiError {
  response?: {
    status?: number;
    data?: {
      error?: string | { message?: string; code?: number };
      message?: string;
    };
  };
  message?: string;
}

/**
 * Extract error message from API error response
 */
export function getErrorMessage(error: ApiError): string {
  // Handle nested error object structure: { error: { message: "...", code: 400 } }
  if (error.response?.data?.error) {
    const errorData = error.response.data.error;
    if (typeof errorData === 'string') {
      return errorData;
    }
    if (typeof errorData === 'object' && errorData.message) {
      return errorData.message;
    }
  }
  // Handle direct message field
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  // Handle error message property
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

/**
 * Get user-friendly error message with role context
 */
export function getRoleContextErrorMessage(
  error: ApiError,
  action: string,
  requiredRoles?: string[]
): string {
  const status = error.response?.status;
  const baseMessage = getErrorMessage(error);

  // Handle permission errors (403)
  if (status === 403) {
    if (requiredRoles && requiredRoles.length > 0) {
      const roleText = requiredRoles.length === 1 
        ? `the "${requiredRoles[0]}" role` 
        : `one of these roles: ${requiredRoles.join(', ')}`;
      return `You do not have permission to ${action}. This action requires ${roleText}.`;
    }
    return `You do not have permission to ${action}. Please contact an administrator if you believe this is an error.`;
  }

  // Handle authentication errors (401)
  if (status === 401) {
    return 'Your session has expired. Please log in again.';
  }

  // Handle validation errors (400)
  if (status === 400) {
    return baseMessage || `Invalid request. Please check your input and try again.`;
  }

  // Handle not found errors (404)
  if (status === 404) {
    return `The requested resource was not found.`;
  }

  // Handle server errors (500+)
  if (status && status >= 500) {
    return `Server error occurred while ${action}. Please try again later or contact support.`;
  }

  // Default: return the base message
  return baseMessage || `Failed to ${action}. Please try again.`;
}

/**
 * Handle API error with toast notification and role context
 */
export function handleApiError(
  error: ApiError,
  action: string,
  requiredRoles?: string[]
): void {
  const message = getRoleContextErrorMessage(error, action, requiredRoles);
  toast.error(message);
}

/**
 * Handle API error with custom fallback message
 */
export function handleApiErrorWithFallback(
  error: ApiError,
  fallbackMessage: string
): void {
  const message = getErrorMessage(error) || fallbackMessage;
  toast.error(message);
}

