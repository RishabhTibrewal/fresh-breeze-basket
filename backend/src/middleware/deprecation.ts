import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to add deprecation warnings to API responses
 * Checks for deprecated query parameters and adds warnings to response headers
 */
export const deprecationWarning = (req: Request, res: Response, next: NextFunction) => {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to add deprecation headers
  res.json = function (body: any) {
    const warnings: string[] = [];

    // Check for deprecated query parameters
    if (req.query.format === 'legacy') {
      warnings.push('The "format=legacy" parameter is deprecated. Use default format to get variants information.');
    }

    if (req.query.include === 'false') {
      warnings.push('The "include=false" parameter is deprecated. Use default format to get variants information.');
    }

    // Check for deprecated fields in request body
    const deprecatedFields = [
      'image_url',
      'is_featured',
      'unit',
      'unit_type',
      'best_before',
      'tax',
      'hsn_code',
      'badge',
    ];

    if (req.method === 'POST' || req.method === 'PUT') {
      const hasDeprecatedFields = deprecatedFields.some(field => field in req.body);
      if (hasDeprecatedFields) {
        warnings.push(
          'Product-level fields (image_url, is_featured, unit, unit_type, best_before, tax, hsn_code, badge) are deprecated. Use variant-level fields instead.'
        );
      }
    }

    // Add warnings to response headers
    if (warnings.length > 0) {
      res.setHeader('X-API-Deprecation-Warning', warnings.join('; '));
      res.setHeader('X-API-Deprecation-Date', '2024-12-31');
      res.setHeader('X-API-Deprecation-Docs', '/docs/API_MIGRATION_GUIDE.md');
    }

    // Call original json method
    return originalJson(body);
  };

  next();
};

