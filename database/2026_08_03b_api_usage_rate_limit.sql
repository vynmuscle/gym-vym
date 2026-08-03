-- 2026_08_03b_api_usage_rate_limit.sql
-- Tabela de controle de uso das serverless functions (api/*.js), usada pelo
-- helper api/_rateLimit.js para limitar chamadas diárias por usuário/endpoint.
-- Só é lida/escrita pelas functions via SUPABASE_SERVICE_KEY (bypassa RLS) —
-- RLS fica ativo mas sem policies, bloqueando acesso direto do client.

create table api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  endpoint text not null,
  used_at timestamptz not null default now()
);

create index idx_api_usage_lookup on api_usage(user_id, endpoint, used_at);

alter table api_usage enable row level security;
