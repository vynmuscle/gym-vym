-- 2026_08_27b_correcoes_seguranca_linter.sql
-- Correções apontadas pelo linter de segurança do Supabase (aba Advisors).

-- pg_trgm estava instalada no schema public ("Extension in Public") --
-- move pra schema dedicado. search_path do projeto já inclui "extensions"
-- por padrão, então nenhuma query quebra (checado: nenhum índice do banco
-- usa gin_trgm_ops hoje, extensão está instalada mas sem uso).
alter extension pg_trgm set schema extensions;

-- rls_auto_enable() é função de EVENT TRIGGER (só dispara sozinha em
-- CREATE TABLE, habilitando RLS automaticamente) -- não tem motivo pra
-- ser chamável via RPC por anon/authenticated. Revogar não afeta o
-- funcionamento do event trigger em si.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- api_usage: RLS habilitado sem nenhuma policy já bloqueia anon/authenticated
-- por padrão (só service_role, que ignora RLS, grava aqui via
-- api/_rateLimit.js). Policy abaixo só torna esse "bloqueio total"
-- explícito pro linter parar de avisar -- não muda nenhum comportamento.
create policy "api_usage_no_client_access" on api_usage for all using (false);
