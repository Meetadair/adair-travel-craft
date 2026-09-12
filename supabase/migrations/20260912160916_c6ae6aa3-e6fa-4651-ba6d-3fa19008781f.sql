REVOKE EXECUTE ON FUNCTION public.owns_creator(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_creator_status() FROM anon, authenticated;