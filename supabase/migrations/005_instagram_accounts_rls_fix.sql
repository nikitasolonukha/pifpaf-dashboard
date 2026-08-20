-- Ensure update policy works with upsert/insert+update flows
drop policy if exists "Users can update own instagram accounts" on public.instagram_accounts;

create policy "Users can update own instagram accounts"
  on public.instagram_accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.instagram_accounts to authenticated;
grant select, insert, update, delete on public.instagram_accounts to service_role;
