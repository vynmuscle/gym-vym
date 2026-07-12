# CLAUDE.md — Gym Vym

## Comunicação

- Sempre responder em **português (pt-BR)**.
- O usuário (Márcio) NÃO é programador: explicar decisões técnicas em linguagem simples, sem jargão desnecessário.
- Ao propor algo, explicar O QUE será feito e POR QUÊ antes de mostrar código.

## Regras de Trabalho (OBRIGATÓRIAS — gates de aprovação)

1. **Confirmar antes de executar qualquer alteração.** Nunca agir sem autorização explícita.
2. **Plano antes de código:** apresentar o plano da tarefa e aguardar aprovação antes de escrever qualquer arquivo.
3. **Diff antes de commit:** mostrar todas as alterações e aguardar aprovação antes de `git commit`.
4. **Push é aprovação separada:** nunca fazer `git push` junto com o commit. Perguntar explicitamente.
5. **Soluções simples:** preferir a solução mais prática. Não adicionar bibliotecas, frameworks ou abstrações sem necessidade real.
6. **Não consertar o que não foi pedido.** Escopo fechado por tarefa.
7. **Regra das duas tentativas:** se uma correção falhar duas vezes no mesmo arquivo, parar e refazer o arquivo do zero em vez de remendar.
8. Ao concluir uma tarefa, indicar como o Márcio pode **testar manualmente** no navegador antes de aprovar o commit.

## Contexto do Projeto

- **Gym Vym** ("Vym" = Vinicius e Márcio): PWA mobile-first de registro de treinos de academia.
- Documento de referência: **PLANO-FASE-1-gymvym.md** (na raiz) — contém escopo, schema SQL, estrutura de arquivos, identidade visual e ordem de execução. LER ANTES de qualquer tarefa.
- Referência visual APROVADA: **prototipo-train-gymvym-v2.html** — o train.html deve replicar esse layout e comportamento, trocando mock por Supabase.
- **Multiusuário desde o dia 1:** signup habilitado, RLS em todas as tabelas (`auth.uid() = user_id`), dados 100% isolados por usuário.

## Stack

- Vanilla JS (ES Modules) — SEM frameworks (sem React, sem build step)
- Supabase: PostgreSQL + Auth + RLS — **projeto NOVO, desvinculado do FinZen.** NUNCA referenciar o projeto Supabase `qgamphwnlrriwalcbhbl` neste repo.
- Vercel para hosting (projeto novo: gymvym)
- CSS puro em arquivos separados (base, layout, components, mobile, navigation)

## Segurança

- `SUPABASE_URL` e `ANON_KEY` no `js/config.js` (aceito para este projeto — RLS protege os dados).
- `SUPABASE_SERVICE_KEY` e `ANTHROPIC_API_KEY` (Fase 2): SOMENTE em variáveis de ambiente (Vercel/GitHub Secrets). NUNCA hardcoded em arquivo nenhum, nem em exemplos.
- Nunca commitar arquivos `.env`.

## Estrutura (resumo — detalhes no plano)

```
index.html  login.html  manifest.json  vercel.json  icons/
pages/      → exercises, workouts, workout-edit, train, history
js/         → módulos por página + services/workoutService.js + navigation.js centralizado
css/        → base, layout, components, mobile, navigation
database/   → migrations SQL datadas (YYYY_MM_DD_descricao.sql)
api/        → serverless functions (só na Fase 2)
```

## Convenções

- Migrations SQL: sempre em arquivo novo datado em `database/`, nunca editar migration antiga.
- Toda tabela nova: `user_id` + RLS com 4 policies (select/insert/update/delete).
- Cache-busting: `?v=XXX` nos imports de JS/CSS, incrementar `APP_VERSION` no `js/config.js` a cada deploy.
- `sw.js`: incrementar `CACHE_VERSION` (topo do arquivo) sempre que JS/CSS/HTML mudar — senão o service worker pode continuar servindo versão antiga do cache pro usuário offline. Ideal manter em sincronia com `APP_VERSION`.
- Mobile-first: alvos de toque com mínimo 52px; testar mentalmente o uso "na academia, com mão suada".
- Gravação resiliente: dados de treino são salvos a cada ação (✓ da série), nunca só no final.

## Verificação antes de dizer "pronto"

- Abrir a página alterada no navegador e confirmar que carrega sem erros no console.
- Confirmar que o fluxo tocado continua funcionando (login → página → ação principal).
- Em mudanças de banco: confirmar que a migration roda limpa e que o RLS está ativo na tabela.
