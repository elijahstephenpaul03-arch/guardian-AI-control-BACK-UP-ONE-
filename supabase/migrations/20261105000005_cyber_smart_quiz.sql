-- ==============================================================================
-- GUARDIAN AI: SUPABASE EDITION - CYBER-SMART QUIZ PROGRESS & HISTORY (PHASE 5)
-- ==============================================================================

-- 1. Child Quiz Progress Table
CREATE TABLE IF NOT EXISTS public.child_quiz_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_level INTEGER NOT NULL DEFAULT 1 CHECK (current_level BETWEEN 1 AND 3),
  questions_attempted INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  accuracy_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  streak INTEGER NOT NULL DEFAULT 0,
  weak_concepts TEXT[] NOT NULL DEFAULT '{}'::text[],
  exhausted_question_ids TEXT[] NOT NULL DEFAULT '{}'::text[],
  current_cycle INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_child_quiz_progress_child UNIQUE (child_id)
);

-- 2. Child Quiz History Table
CREATE TABLE IF NOT EXISTS public.child_quiz_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty_level INTEGER NOT NULL CHECK (difficulty_level BETWEEN 1 AND 3),
  selected_option_index INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for realtime and analytics performance
CREATE INDEX IF NOT EXISTS idx_quiz_progress_child ON public.child_quiz_progress(child_id);
CREATE INDEX IF NOT EXISTS idx_quiz_history_child ON public.child_quiz_history(child_id);
CREATE INDEX IF NOT EXISTS idx_quiz_history_answered_at ON public.child_quiz_history(answered_at DESC);

-- Enable and Force RLS
ALTER TABLE public.child_quiz_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_quiz_progress FORCE ROW LEVEL SECURITY;

ALTER TABLE public.child_quiz_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_quiz_history FORCE ROW LEVEL SECURITY;

-- Explicit Database Grants
GRANT SELECT, INSERT, UPDATE ON public.child_quiz_progress TO authenticated;
GRANT SELECT, INSERT ON public.child_quiz_history TO authenticated;
GRANT ALL ON public.child_quiz_progress TO service_role;
GRANT ALL ON public.child_quiz_history TO service_role;

-- Policies for child_quiz_progress
DROP POLICY IF EXISTS "child_quiz_progress_select_policy" ON public.child_quiz_progress;
CREATE POLICY "child_quiz_progress_select_policy"
  ON public.child_quiz_progress FOR SELECT
  TO authenticated
  USING (
    child_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = child_quiz_progress.child_id AND u.parent_id = auth.uid()
    ) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "child_quiz_progress_insert_policy" ON public.child_quiz_progress;
CREATE POLICY "child_quiz_progress_insert_policy"
  ON public.child_quiz_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    child_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "child_quiz_progress_update_policy" ON public.child_quiz_progress;
CREATE POLICY "child_quiz_progress_update_policy"
  ON public.child_quiz_progress FOR UPDATE
  TO authenticated
  USING (
    child_id = auth.uid() OR
    public.is_admin()
  )
  WITH CHECK (
    child_id = auth.uid() OR
    public.is_admin()
  );

-- Policies for child_quiz_history
DROP POLICY IF EXISTS "child_quiz_history_select_policy" ON public.child_quiz_history;
CREATE POLICY "child_quiz_history_select_policy"
  ON public.child_quiz_history FOR SELECT
  TO authenticated
  USING (
    child_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = child_quiz_history.child_id AND u.parent_id = auth.uid()
    ) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "child_quiz_history_insert_policy" ON public.child_quiz_history;
CREATE POLICY "child_quiz_history_insert_policy"
  ON public.child_quiz_history FOR INSERT
  TO authenticated
  WITH CHECK (
    child_id = auth.uid() OR
    public.is_admin()
  );
