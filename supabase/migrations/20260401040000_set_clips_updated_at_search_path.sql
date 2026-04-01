-- Align with Supabase linter: immutable search_path on trigger helper (same idea as fix_set_updated_at_search_path).
alter function public.set_clips_updated_at() set search_path = public, pg_temp;
