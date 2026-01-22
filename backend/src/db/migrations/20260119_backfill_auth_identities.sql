-- Ensure email identities exist for auth users (required for password sign-in)
INSERT INTO auth.identities (
  user_id,
  provider,
  provider_id,
  identity_data,
  created_at,
  updated_at
)
SELECT
  u.id,
  'email',
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  now(),
  now()
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.identities i
    WHERE i.user_id = u.id
      AND i.provider = 'email'
  );
