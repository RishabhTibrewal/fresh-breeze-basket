// supabaseJwt.ts — JWT verification using remote JWKS
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_JWKS_URL = process.env.SUPABASE_JWKS_URL;
// SUPABASE_ISSUER is the real Supabase project URL used for JWT `iss` claim validation.
// It must match the `iss` embedded in every JWT Supabase signs (always the real project URL,
// never a proxy). Separate from SUPABASE_URL which may point to a Cloudflare proxy.
const SUPABASE_ISSUER = process.env.SUPABASE_ISSUER;

if (!SUPABASE_URL && !SUPABASE_JWKS_URL) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_JWKS_URL');
}

const normalizedSupabaseUrl = SUPABASE_URL?.replace(/\/$/, '');
// Use the explicit issuer URL if set, otherwise fall back to SUPABASE_URL.
// When SUPABASE_URL is a proxy (e.g. Cloudflare Worker), SUPABASE_ISSUER must be
// set to the real Supabase project URL so that JWT `iss` validation passes.
const normalizedIssuerUrl = (SUPABASE_ISSUER ?? SUPABASE_URL)?.replace(/\/$/, '');
const JWKS_URL = SUPABASE_JWKS_URL
  ? new URL(SUPABASE_JWKS_URL)
  : new URL(`${normalizedSupabaseUrl}/auth/v1/.well-known/jwks.json`);
const jwks = createRemoteJWKSet(JWKS_URL);

const decodeJwtPayload = (token: string) => {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payloadJson) as Record<string, unknown>;
  } catch (error) {
    console.warn('Failed to decode JWT payload for diagnostics:', error);
    return null;
  }
};

export type SupabaseJwtPayload = JWTPayload & {
  sub: string;
  email: string;
};

export class SupabaseJwtVerificationError extends Error {
  kind: 'invalid' | 'unavailable';

  constructor(kind: 'invalid' | 'unavailable', message: string) {
    super(message);
    this.name = 'SupabaseJwtVerificationError';
    this.kind = kind;
  }
}

const getErrorName = (error: unknown) => (error instanceof Error ? error.name : undefined);

const isInvalidTokenError = (error: unknown) => {
  const name = getErrorName(error);
  return (
    name === 'JWTExpired' ||
    name === 'JWTClaimValidationFailed' ||
    name === 'JWTInvalid' ||
    name === 'JWSSignatureVerificationFailed' ||
    name === 'JWKSNoMatchingKey'
  );
};

const isJwksUnavailableError = (error: unknown) => {
  if (error instanceof TypeError) {
    return true;
  }

  const name = getErrorName(error);
  return name === 'JWKSError' || name === 'JWKSInvalid' || name === 'JWKSTimeout';
};

export async function verifySupabaseJwt(token: string): Promise<SupabaseJwtPayload> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: normalizedIssuerUrl ? `${normalizedIssuerUrl}/auth/v1` : undefined,
      audience: 'authenticated'
    });

    if (!payload.sub || !payload.email) {
      throw new SupabaseJwtVerificationError(
        'invalid',
        'Token is missing required subject or email'
      );
    }

    return payload as SupabaseJwtPayload;
  } catch (error) {
    if (error instanceof SupabaseJwtVerificationError) {
      throw error;
    }

    if (isInvalidTokenError(error)) {
      const decoded = decodeJwtPayload(token);
      if (decoded) {
        console.warn('JWT verification failed with claims:', {
          iss: decoded.iss,
          aud: decoded.aud,
          sub: decoded.sub,
          email: decoded.email,
          exp: decoded.exp
        });
      }
      throw new SupabaseJwtVerificationError('invalid', 'Invalid or expired token');
    }

    if (isJwksUnavailableError(error)) {
      throw new SupabaseJwtVerificationError('unavailable', 'JWKS unavailable');
    }

    // Log the actual error for debugging
    console.error('JWT verification error (unhandled):', {
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined
    });
    
    // Always decode and log claims for debugging
    const decoded = decodeJwtPayload(token);
    if (decoded) {
      console.warn('JWT claims from token:', {
        iss: decoded.iss,
        aud: decoded.aud,
        sub: decoded.sub,
        email: decoded.email,
        exp: decoded.exp,
        expectedIssuer: `${normalizedIssuerUrl}/auth/v1`,
        expectedAudience: 'authenticated'
      });
    }

    throw new SupabaseJwtVerificationError('invalid', 'Token verification failed');
  }
}
