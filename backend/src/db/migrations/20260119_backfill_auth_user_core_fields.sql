-- Backfill missing core auth fields to keep GoTrue happy
WITH auth_instance AS (
  SELECT id
  FROM auth.instances
  LIMIT 1
)
UPDATE auth.users
SET instance_id = (SELECT id FROM auth_instance)
WHERE instance_id IS NULL
   OR instance_id = '00000000-0000-0000-0000-000000000000';

UPDATE auth.users
SET aud = 'authenticated'
WHERE aud IS NULL;

UPDATE auth.users
SET role = 'authenticated'
WHERE role IS NULL;

UPDATE auth.users
SET raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'))
WHERE raw_app_meta_data IS NULL;

-- Ensure email identities exist for all users
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
