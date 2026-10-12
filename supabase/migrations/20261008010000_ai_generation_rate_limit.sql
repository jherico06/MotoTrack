-- AI Installation Preview Rate Limiting Tables
CREATE TABLE IF NOT EXISTS public.ai_generation_usage (
  id text NOT NULL DEFAULT ('aigu-' || substr(md5(random()::text), 1, 12)) PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  week_start date NOT NULL,
  weekly_generation_count integer NOT NULL DEFAULT 0,
  consecutive_generation_count integer NOT NULL DEFAULT 0,
  last_generated_at timestamp with time zone,
  cooldown_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_generation_usage_user ON public.ai_generation_usage(user_id);

CREATE TABLE IF NOT EXISTS public.ai_generation_history (
  id text NOT NULL DEFAULT ('aigh-' || substr(md5(random()::text), 1, 12)) PRIMARY KEY,
  user_id text NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  status text NOT NULL DEFAULT 'success',
  motorcycle_id text,
  product_id text,
  image_url text,
  prompt text,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_generation_history_user ON public.ai_generation_history(user_id, generated_at DESC);

-- Enable RLS
ALTER TABLE public.ai_generation_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_history ENABLE ROW LEVEL SECURITY;

-- Allow reading
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_generation_usage' AND policyname = 'Users can view their own usage'
  ) THEN
    CREATE POLICY "Users can view their own usage"
      ON public.ai_generation_usage
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ai_generation_history' AND policyname = 'Users can view their own history'
  ) THEN
    CREATE POLICY "Users can view their own history"
      ON public.ai_generation_history
      FOR SELECT
      USING (true);
  END IF;
END $$;
