-- Storage: service role bypasses RLS. Remove open INSERT policy from 001.
-- Public READ for reel-covers stays (UI needs it). Authenticated clients must not upload arbitrarily.

drop policy if exists "Service role can upload covers" on storage.objects;
