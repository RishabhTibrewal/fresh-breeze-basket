declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      email?: string;
      role?: string;
      company_id?: string;
    }

    interface Request {
      user?: AuthenticatedUser;
      companyId?: string;
      companySlug?: string;
    }
  }
} 