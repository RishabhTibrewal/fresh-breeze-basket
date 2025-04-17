/**
 * Common error messages used throughout the application
 */

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_EXPIRED: 'Authentication token has expired',
  TOKEN_INVALID: 'Invalid authentication token',
  TOKEN_MISSING: 'Authentication token is missing',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  USER_NOT_FOUND: 'User not found',
  EMAIL_ALREADY_EXISTS: 'Email already exists',
  WEAK_PASSWORD: 'Password is too weak',
};

export const PRODUCT_ERRORS = {
  NOT_FOUND: 'Product not found',
  OUT_OF_STOCK: 'Product is out of stock',
  INSUFFICIENT_STOCK: 'Insufficient stock available',
  INVALID_PRICE: 'Invalid price',
  INVALID_CATEGORY: 'Invalid category',
};

export const ORDER_ERRORS = {
  NOT_FOUND: 'Order not found',
  INVALID_STATUS: 'Invalid order status',
  CANNOT_CANCEL: 'Order cannot be cancelled',
  EMPTY_CART: 'Cart is empty',
  INVALID_PAYMENT: 'Invalid payment method',
};

export const PAYMENT_ERRORS = {
  FAILED: 'Payment failed',
  REFUND_FAILED: 'Refund failed',
  INVALID_AMOUNT: 'Invalid payment amount',
  STRIPE_ERROR: 'Stripe payment error',
};

export const VALIDATION_ERRORS = {
  INVALID_INPUT: 'Invalid input data',
  MISSING_REQUIRED: 'Missing required fields',
  INVALID_FORMAT: 'Invalid data format',
};

export const DATABASE_ERRORS = {
  CONNECTION_FAILED: 'Database connection failed',
  QUERY_FAILED: 'Database query failed',
  TRANSACTION_FAILED: 'Database transaction failed',
};

export const SERVER_ERRORS = {
  INTERNAL_ERROR: 'Internal server error',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
}; 