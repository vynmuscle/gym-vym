-- 2026_07_18_user_achievements.sql
-- Etapa 2 da gamificacao: tabela de conquistas desbloqueadas por usuario.

create table user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  achievement_key text not null,
  unlocked_at timestamptz default now(),
  unique(user_id, achievement_key)
);

alter table user_achievements enable row level security;

create policy "user_achievements_select" on user_achievements for select using (auth.uid() = user_id);
create policy "user_achievements_insert" on user_achievements for insert with check (auth.uid() = user_id);
create policy "user_achievements_update" on user_achievements for update using (auth.uid() = user_id);
create policy "user_achievements_delete" on user_achievements for delete using (auth.uid() = user_id);
