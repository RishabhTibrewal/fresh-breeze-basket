-- KOT (Kitchen Order Ticket): food counters, outlet settings, product mapping,
-- outlet-wide sequence (no counter in key), tickets with JSONB snapshot, RLS, Realtime.

-- ---------------------------------------------------------------------------
-- 1. Food counters (per outlet)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_food_counters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  outlet_id    UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  code         TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, outlet_id, code)
);

CREATE INDEX IF NOT EXISTS idx_pos_food_counters_company ON public.pos_food_counters (company_id);
CREATE INDEX IF NOT EXISTS idx_pos_food_counters_outlet ON public.pos_food_counters (outlet_id);

DROP TRIGGER IF EXISTS trg_pos_food_counters_updated_at ON public.pos_food_counters;
CREATE TRIGGER trg_pos_food_counters_updated_at
  BEFORE UPDATE ON public.pos_food_counters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. KOT settings per outlet (default counter required)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_kot_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  outlet_id           UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  reset_frequency     TEXT NOT NULL DEFAULT 'daily',
  timezone            TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  number_prefix       TEXT NOT NULL DEFAULT 'KOT',
  default_counter_id  UUID NOT NULL REFERENCES public.pos_food_counters(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, outlet_id),
  CONSTRAINT pos_kot_settings_reset_frequency_chk CHECK (
    reset_frequency IN ('daily', 'weekly', 'monthly', 'yearly', 'never')
  )
);

CREATE INDEX IF NOT EXISTS idx_pos_kot_settings_company ON public.pos_kot_settings (company_id);
CREATE INDEX IF NOT EXISTS idx_pos_kot_settings_outlet ON public.pos_kot_settings (outlet_id);

DROP TRIGGER IF EXISTS trg_pos_kot_settings_updated_at ON public.pos_kot_settings;
CREATE TRIGGER trg_pos_kot_settings_updated_at
  BEFORE UPDATE ON public.pos_kot_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.trg_pos_kot_settings_default_counter_same_outlet()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pos_food_counters c
    WHERE c.id = NEW.default_counter_id
      AND c.company_id = NEW.company_id
      AND c.outlet_id = NEW.outlet_id
  ) THEN
    RAISE EXCEPTION 'pos_kot_settings.default_counter_id must reference a counter for the same outlet';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_kot_settings_default_counter_outlet ON public.pos_kot_settings;
CREATE TRIGGER trg_pos_kot_settings_default_counter_outlet
  BEFORE INSERT OR UPDATE OF default_counter_id, outlet_id, company_id ON public.pos_kot_settings
  FOR EACH ROW EXECUTE FUNCTION public.trg_pos_kot_settings_default_counter_same_outlet();

-- ---------------------------------------------------------------------------
-- 3. Product → counter mapping (company-wide; validated at app layer vs outlet)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_food_counters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  counter_id   UUID NOT NULL REFERENCES public.pos_food_counters(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_food_counters_company ON public.product_food_counters (company_id);
CREATE INDEX IF NOT EXISTS idx_product_food_counters_counter ON public.product_food_counters (counter_id);

DROP TRIGGER IF EXISTS trg_product_food_counters_updated_at ON public.product_food_counters;
CREATE TRIGGER trg_product_food_counters_updated_at
  BEFORE UPDATE ON public.product_food_counters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Outlet-wide sequence state (counter_id NOT in key)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_kot_sequence_state (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  outlet_id        UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  reset_frequency  TEXT NOT NULL,
  bucket_start     TIMESTAMPTZ NOT NULL,
  last_value       BIGINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, outlet_id, reset_frequency, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_pos_kot_sequence_state_lookup
  ON public.pos_kot_sequence_state (company_id, outlet_id, reset_frequency, bucket_start);

DROP TRIGGER IF EXISTS trg_pos_kot_sequence_state_updated_at ON public.pos_kot_sequence_state;
CREATE TRIGGER trg_pos_kot_sequence_state_updated_at
  BEFORE UPDATE ON public.pos_kot_sequence_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Bucket start in outlet local timezone
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kot_local_bucket_start(
  p_now TIMESTAMPTZ,
  p_tz TEXT,
  p_freq TEXT
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  loc TIMESTAMP;
BEGIN
  loc := p_now AT TIME ZONE p_tz;

  IF p_freq = 'never' THEN
    RETURN TIMESTAMPTZ '1970-01-01 00:00:00+00';
  END IF;

  IF p_freq = 'daily' THEN
    RETURN (loc::date::timestamp AT TIME ZONE p_tz);
  END IF;

  IF p_freq = 'weekly' THEN
    RETURN (date_trunc('week', loc)::timestamp AT TIME ZONE p_tz);
  END IF;

  IF p_freq = 'monthly' THEN
    RETURN (date_trunc('month', loc)::timestamp AT TIME ZONE p_tz);
  END IF;

  IF p_freq = 'yearly' THEN
    RETURN (date_trunc('year', loc)::timestamp AT TIME ZONE p_tz);
  END IF;

  -- default to daily
  RETURN (loc::date::timestamp AT TIME ZONE p_tz);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Atomic next KOT number (outlet-wide for bucket)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_kot_number(
  p_company_id UUID,
  p_outlet_id UUID,
  p_reset_frequency TEXT,
  p_timezone TEXT,
  p_prefix TEXT DEFAULT 'KOT'
) RETURNS TABLE(kot_number_seq BIGINT, kot_number_text TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket TIMESTAMPTZ;
  v_seq BIGINT;
  v_local_date TEXT;
  v_freq TEXT;
BEGIN
  v_freq := COALESCE(NULLIF(trim(p_reset_frequency), ''), 'daily');
  v_bucket := public.kot_local_bucket_start(
    NOW(),
    COALESCE(NULLIF(trim(p_timezone), ''), 'UTC'),
    v_freq
  );

  INSERT INTO public.pos_kot_sequence_state (
    company_id, outlet_id, reset_frequency, bucket_start, last_value
  ) VALUES (
    p_company_id, p_outlet_id, v_freq, v_bucket, 1
  )
  ON CONFLICT (company_id, outlet_id, reset_frequency, bucket_start)
  DO UPDATE SET
    last_value = public.pos_kot_sequence_state.last_value + 1,
    updated_at = NOW()
  RETURNING last_value INTO v_seq;

  v_local_date := to_char((NOW() AT TIME ZONE COALESCE(NULLIF(trim(p_timezone), ''), 'UTC'))::date, 'YYYYMMDD');

  kot_number_seq := v_seq;
  kot_number_text := trim(both '-' FROM concat_ws('-', NULLIF(trim(p_prefix), ''), v_local_date, v_seq::text));
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.next_kot_number(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_kot_number(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.next_kot_number(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. KOT tickets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_kot_tickets (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id              UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  outlet_id             UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  counter_id            UUID NOT NULL REFERENCES public.pos_food_counters(id) ON DELETE RESTRICT,
  kot_number_seq        BIGINT NOT NULL,
  kot_number_text       TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'open',
  ticket_items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  printed_at            TIMESTAMPTZ,
  printed_count         INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pos_kot_tickets_status_chk CHECK (
    status IN ('open', 'preparing', 'ready', 'served', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_pos_kot_tickets_company ON public.pos_kot_tickets (company_id);
CREATE INDEX IF NOT EXISTS idx_pos_kot_tickets_order ON public.pos_kot_tickets (order_id);
CREATE INDEX IF NOT EXISTS idx_pos_kot_tickets_outlet ON public.pos_kot_tickets (outlet_id);
CREATE INDEX IF NOT EXISTS idx_pos_kot_tickets_counter ON public.pos_kot_tickets (counter_id);
CREATE INDEX IF NOT EXISTS idx_pos_kot_tickets_status_created
  ON public.pos_kot_tickets (company_id, outlet_id, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_pos_kot_tickets_updated_at ON public.pos_kot_tickets;
CREATE TRIGGER trg_pos_kot_tickets_updated_at
  BEFORE UPDATE ON public.pos_kot_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. RLS (company_memberships)
-- ---------------------------------------------------------------------------
ALTER TABLE public.pos_food_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_kot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_food_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_kot_sequence_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_kot_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY pos_food_counters_select ON public.pos_food_counters FOR SELECT USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY pos_food_counters_insert ON public.pos_food_counters FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY pos_food_counters_update ON public.pos_food_counters FOR UPDATE USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY pos_food_counters_delete ON public.pos_food_counters FOR DELETE USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);

CREATE POLICY pos_kot_settings_select ON public.pos_kot_settings FOR SELECT USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY pos_kot_settings_insert ON public.pos_kot_settings FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY pos_kot_settings_update ON public.pos_kot_settings FOR UPDATE USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY pos_kot_settings_delete ON public.pos_kot_settings FOR DELETE USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);

CREATE POLICY product_food_counters_select ON public.product_food_counters FOR SELECT USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY product_food_counters_insert ON public.product_food_counters FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY product_food_counters_update ON public.product_food_counters FOR UPDATE USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY product_food_counters_delete ON public.product_food_counters FOR DELETE USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);

CREATE POLICY pos_kot_sequence_state_select ON public.pos_kot_sequence_state FOR SELECT USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY pos_kot_sequence_state_insert ON public.pos_kot_sequence_state FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY pos_kot_sequence_state_update ON public.pos_kot_sequence_state FOR UPDATE USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY pos_kot_sequence_state_delete ON public.pos_kot_sequence_state FOR DELETE USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);

CREATE POLICY pos_kot_tickets_select ON public.pos_kot_tickets FOR SELECT USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY pos_kot_tickets_insert ON public.pos_kot_tickets FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY pos_kot_tickets_update ON public.pos_kot_tickets FOR UPDATE USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);
CREATE POLICY pos_kot_tickets_delete ON public.pos_kot_tickets FOR DELETE USING (
  company_id IN (SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() AND is_active = TRUE)
);

-- ---------------------------------------------------------------------------
-- 9. Realtime publication (idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pos_kot_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_kot_tickets;
  END IF;
END $$;
