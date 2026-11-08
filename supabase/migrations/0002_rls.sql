-- Row Level Security. Pretpostavka: server koristi service role (zaobilazi RLS) za sve ZAPISE stanja igre.
-- Klijent (anon/authenticated) smije samo ČITATI ono što mu pripada i ne smije pisati stanje igre.

create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaign_players cp where cp.campaign_id = cid and cp.user_id = auth.uid());
$$;
create or replace function public.my_player(cid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select cp.id from campaign_players cp where cp.campaign_id = cid and cp.user_id = auth.uid();
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false);
$$;

alter table profiles enable row level security;
alter table campaigns enable row level security;
alter table campaign_players enable row level security;
alter table resources enable row level security;
alter table territories enable row level security;
alter table buildings enable row level security;
alter table military_units enable row level security;
alter table armies enable row level security;
alter table orders enable row level security;
alter table conditional_orders enable row level security;
alter table alliances enable row level security;
alter table diplomatic_offers enable row level security;
alter table messages enable row level security;
alter table espionage_reports enable row level security;
alter table technology_progress enable row level security;
alter table secret_objectives enable row level security;
alter table world_events enable row level security;
alter table battle_reports enable row level security;
alter table daily_reports enable row level security;
alter table campaign_scores enable row level security;
alter table resolutions enable row level security;
alter table notifications enable row level security;
alter table push_subscriptions enable row level security;
alter table error_log enable row level security;
alter table audit_log enable row level security;

-- Profili: vlastiti + imena suigrača (kroz campaign_players); uređivati smije samo vlasnik (ne is_admin!)
create policy profiles_self_read on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid() and is_admin = (select p.is_admin from profiles p where p.id = auth.uid()));

-- Kampanje: članovi i admin čitaju; invite-kod se ne objavljuje nečlanovima
create policy campaigns_member_read on campaigns for select using (is_member(id) or owner_id = auth.uid() or is_admin());
create policy campaign_players_member_read on campaign_players for select using (is_member(campaign_id) or is_admin());

-- Resursi: samo vlasnik (tuđi su skriveni; procjene idu kroz espionage_reports)
create policy resources_own_read on resources for select using (campaign_player_id in (select id from campaign_players where user_id = auth.uid()) or is_admin());

-- Teritoriji: pun red samo vlasnik (garnizon, zgrade, stabilnost). Ostali dobivaju samo javni pogled.
create policy territories_owner_read on territories for select using (owner_player_id = my_player(campaign_id) or is_admin());
create view public.territories_public with (security_invoker = false) as
  select t.id, t.campaign_id, t.code, t.name, t.col, t.row, t.terrain, t.deposit, t.owner_player_id, t.region_id, t.is_capital, t.capital_of, t.importance
  from territories t where is_member(t.campaign_id);
grant select on public.territories_public to authenticated;
create policy buildings_owner_read on buildings for select using (territory_id in (select id from territories where owner_player_id = my_player(campaign_id)) or is_admin());
create policy armies_owner_read on armies for select using (territory_id in (select id from territories where owner_player_id = my_player(campaign_id)) or is_admin());
create policy military_units_read on military_units for select using (true);

-- Naredbe i uvjetne naredbe: STROGO privatne (nitko drugi ih ne vidi ni nakon razrješenja kroz ovu tablicu)
create policy orders_own_read on orders for select using (campaign_player_id = my_player(campaign_id) or is_admin());
create policy conditional_orders_own_read on conditional_orders for select using (campaign_player_id = my_player(campaign_id) or is_admin());
-- Izmjene naredbi idu preko servera (validacija pravila igre); nema direktnih INSERT/UPDATE polica za klijente.

-- Diplomacija: sudionici; tajni savezi samo strane
create policy alliances_read on alliances for select using ((not secret and is_member(campaign_id)) or player_a = my_player(campaign_id) or player_b = my_player(campaign_id) or is_admin());
create policy offers_read on diplomatic_offers for select using (from_player = my_player(campaign_id) or to_player = my_player(campaign_id) or is_admin());
create policy messages_read on messages for select using (from_player = my_player(campaign_id) or to_player = my_player(campaign_id) or is_admin());

-- Obavještajna izvješća i tajni ciljevi: samo vlasnik
create policy espionage_own_read on espionage_reports for select using (owner_player = my_player(campaign_id) or is_admin());
create policy tech_own_read on technology_progress for select using (campaign_player_id in (select id from campaign_players where user_id = auth.uid()) or is_admin());
create policy objectives_own_read on secret_objectives for select using (campaign_player_id in (select id from campaign_players where user_id = auth.uid()) or is_admin());

-- Događaji (samo objavljeni), bojna izvješća (sudionici), dnevna izvješća (vlasnik), bodovi (javni dio)
create policy events_read on world_events for select using ((announced and is_member(campaign_id)) or is_admin());
create policy battles_read on battle_reports for select using (my_player(campaign_id) = any(attacker_players) or defender_player = my_player(campaign_id) or is_admin());
create policy daily_reports_own on daily_reports for select using (campaign_player_id in (select id from campaign_players where user_id = auth.uid()) or is_admin());
create policy scores_read on campaign_scores for select using (is_member(campaign_id) or is_admin());
create view public.campaign_scores_public with (security_invoker = false) as
  select s.campaign_id, s.campaign_player_id, s.round, s.public_score,
         case when c.status = 'completed' then s.breakdown else null end as breakdown
  from campaign_scores s join campaigns c on c.id = s.campaign_id where is_member(s.campaign_id);
grant select on public.campaign_scores_public to authenticated;
revoke select on campaign_scores from authenticated;   -- tablica sadrži rastav s tajnim ciljem; klijent koristi view

-- Obavijesti i push: samo vlasnik; administrativni zapisnici: samo admin
create policy notifications_own on notifications for select using (user_id = auth.uid());
create policy notifications_own_update on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_own on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy error_admin on error_log for select using (is_admin());
create policy audit_admin on audit_log for select using (is_admin());
create policy resolutions_read on resolutions for select using (is_member(campaign_id) or is_admin());

-- Privilegije: klijent smije samo čitati (RLS dalje sužava) — sve zapise stanja igre obavlja server (service role).
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to authenticated;
revoke select on campaign_scores from authenticated;   -- tablica sadrži rastav s tajnim ciljem; klijent koristi view
revoke insert, update, delete on all tables in schema public from anon, authenticated;
grant update (display_name, preferred_faction, notification_prefs) on profiles to authenticated;
grant update (read_at) on notifications to authenticated;
grant insert, update, delete on push_subscriptions to authenticated;
