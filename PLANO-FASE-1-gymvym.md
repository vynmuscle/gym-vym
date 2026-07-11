# Gym Vym — Plano Fase 1 (MVP)

> Documento de instruções para Claude Code. App de treino inspirado nas funcionalidades do Gym WP, com identidade visual e código 100% próprios. Segue os mesmos padrões do FinZen.

---

## Regras Obrigatórias (mesmo fluxo do FinZen)

1. Confirmar antes de executar qualquer alteração
2. Nunca agir sem autorização explícita do Márcio
3. Mostrar plano antes de codar, diff antes de commit, push só com aprovação separada
4. Soluções simples — evitar complexidade desnecessária
5. Se correção falhar duas vezes, refazer o arquivo do zero
6. Não consertar o que não foi pedido

---

## Visão Geral

- **Nome oficial:** Gym Vym ("Vym" = Vinicius e Márcio)
- **Marca:** "GYM" em branco + "VYM" em vermelho (--red)
- **Tipo:** PWA mobile-first (uso na academia = "abrir, marcar série, fechar")
- **Stack:** Vanilla JS (ES Modules) + Supabase (PostgreSQL + Auth + RLS) + Vercel
- **Supabase:** projeto NOVO, 100% desvinculado do FinZen. Criar em supabase.com, gerar novas SUPABASE_URL e ANON_KEY para o js/config.js deste app. NUNCA referenciar o projeto `qgamphwnlrriwalcbhbl` (FinZen) neste repo.
- **Vercel:** projeto novo também (gymvym), com sua própria `ANTHROPIC_API_KEY` nas variáveis de ambiente quando chegar a Fase 2.
- **Repo sugerido:** github.com/marcio-financeiro/gymvym (sem espaço em repo/URL)
- **Usuários:** Márcio e Vinicius — **MULTIUSUÁRIO OBRIGATÓRIO desde o dia 1.** Cada usuário tem seus próprios exercícios, fichas e sessões. RLS em todas as tabelas, cadastro via Supabase Auth (signup habilitado). Nenhum dado compartilhado entre usuários na Fase 1.
- **Desenvolvedor:** Márcio — não programador, desenvolve via Claude Code no Windows 11

## Escopo da Fase 1 (e SOMENTE isso)

1. Login/Auth (Supabase Auth, igual FinZen)
2. Cadastro de exercícios próprios (nome, grupo muscular, equipamento)
3. Montar ficha de treino (ex: Treino A, B, C) com exercícios, séries, reps, carga e descanso
4. **Executar treino:** tela mobile com checklist de séries + timer de descanso
5. Histórico simples: lista de treinos realizados

**Fora do escopo (fases futuras):** gráficos, calendário, biblioteca de 800 exercícios, medidas corporais, IMC, recuperação muscular.

---

## Identidade Visual (APROVADA — protótipo prototipo-train-gymvym-v2.html)

Conceito: cores de anilhas de competição sobre fundo escuro de borracha de academia.

```css
:root {
  --bg: #0b0d10;        /* fundo — borracha de academia */
  --surface: #14171c;   /* cards */
  --surface-2: #1b1f26; /* inputs, bottom sheet */
  --border: #262b33;
  --text: #f2f3f5;
  --muted: #8b93a1;
  --red: #d9333f;       /* anilha 25kg — ação principal, marca */
  --green: #3fa958;     /* anilha 10kg — série/exercício concluído */
  --yellow: #e9b93b;    /* anilha 15kg — destaque de carga, focus */
  --radius: 14px;
}
```

- **Fontes:** Anton (números grandes: timer, carga, cronômetro) + Inter (texto). Google Fonts.
- **Assinatura:** timer de descanso como bottom sheet com contagem gigante (88px), botões +30s / Pular, vibração ao zerar (`navigator.vibrate`).
- **Regra de toque:** todo elemento interativo com mínimo 52–56px de altura (uso com mão suada).
- **Acessibilidade:** focus-visible amarelo, `prefers-reduced-motion` respeitado.
- **Referência de implementação:** usar o protótipo aprovado (v2) como base do train.html — trocar dados mock por Supabase, mantendo layout e comportamento idênticos.

### Layout da tela de treino (aprovado na v2)

- Cada exercício é um card com: thumbnail redondo (placeholder na Fase 1), nome + equipamento em amarelo, menu ⋮, campo de notas, descanso visível (⏱ Descanso: Xmin Ys).
- Séries em **tabela**: `Série | Anterior | KG | Reps | ✓` com linhas alternadas.
- Coluna **Anterior** mostra "60kg x 12" da última sessão daquele exercício (query no último `session_sets` do usuário).
- **KG e Reps editáveis** por série, pré-preenchidos com os valores da última sessão (fallback: prescrição da ficha).
- Botão **+ Adicionar série** por exercício — copia kg/reps da última série do card.
- Concluir série (✓) grava imediatamente em `session_sets` e dispara o timer de descanso.

---

## Estrutura de Arquivos

```
index.html            → Dashboard (treino de hoje + últimos treinos)
login.html
manifest.json         → PWA (theme_color a definir; sugestão: #22c55e verde)
vercel.json           → {}
icons/                → icon-192.png, icon-512.png
pages/
  exercises.html      → CRUD de exercícios
  workouts.html       → CRUD de fichas de treino
  workout-edit.html   → Montar/editar uma ficha
  train.html          → Tela de execução do treino (a mais importante)
  history.html        → Histórico de sessões
js/
  config.js           → SUPABASE_URL, SUPABASE_ANON_KEY, APP_VERSION
  supabaseClient.js
  navigation.js       → menu centralizado (copiar padrão do FinZen)
  utils.js
  exercises.js  workouts.js  workoutEdit.js  train.js  history.js
  services/
    workoutService.js → toda a lógica de dados (CRUD Supabase)
css/
  base.css  layout.css  components.css  mobile.css  navigation.css
database/
  2026_07_10_schema_inicial.sql
```

---

## Banco de Dados — Migration inicial

```sql
-- 2026_07_10_schema_inicial.sql

-- Exercícios cadastrados pelo usuário
create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  muscle_group text not null,      -- peito, costas, pernas, ombros, biceps, triceps, abdomen, gluteos
  equipment text,                  -- barra, halter, maquina, polia, peso corporal
  notes text,
  created_at timestamptz default now()
);

-- Fichas de treino (Treino A, Treino B...)
create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,              -- "Treino A - Peito e Tríceps"
  description text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Exercícios dentro de uma ficha (a "prescrição")
create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  sort_order int default 0,
  target_sets int not null default 3,
  target_reps text not null default '10',   -- text permite "8-12" ou "até a falha"
  target_weight numeric,                     -- kg sugerido
  rest_seconds int default 90,
  notes text                                 -- notas do exercício na ficha (v2)
);

-- Uma sessão de treino realizada (o que aconteceu de verdade)
create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  workout_id uuid references workouts(id) on delete set null,
  started_at timestamptz default now(),
  finished_at timestamptz,
  notes text
);

-- Cada série executada dentro da sessão
create table session_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  set_number int not null,
  reps int,
  weight numeric,                  -- kg
  completed_at timestamptz default now()
);

-- RLS (padrão FinZen: auth.uid() = user_id em tudo)
alter table exercises enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table workout_sessions enable row level security;
alter table session_sets enable row level security;

-- Criar 4 policies (select/insert/update/delete) por tabela com: auth.uid() = user_id
```

**Por que `target_reps` é texto e `session_sets.reps` é número?** A prescrição pode ser uma faixa ("8-12"), mas o que você executou é sempre um número exato. Esse é o mesmo raciocínio de "orçado vs realizado" do FinZen.

---

## Tela de Execução (train.html) — coração do app

Fluxo na academia:

1. Dashboard mostra "Treino de hoje" → botão **Iniciar Treino** cria `workout_session`
2. Lista de exercícios da ficha, cada um com suas séries como cards
3. Cada série mostra: reps alvo + campo de carga (pré-preenchido com a última carga usada naquele exercício — busca no último `session_sets`)
4. Tocar em ✓ → grava a série em `session_sets` e dispara **timer de descanso** (contagem regressiva + vibração via `navigator.vibrate()`)
5. Botão **Finalizar** → grava `finished_at` e mostra resumo (duração, séries, volume total em kg)

**Detalhe importante:** cada série é gravada na hora do ✓ (não só no final). Se o celular travar ou a conexão cair no meio do treino, nada se perde.

---

## Dados de Seed (exemplo prático — treino real do Márcio)

Após o schema, popular com um ABC de exemplo para testar de verdade na academia:

- **Treino A — Peito/Tríceps:** Supino reto (4x8-12), Supino inclinado halteres (3x10), Crucifixo (3x12), Tríceps polia (4x12), Tríceps francês (3x10)
- **Treino B — Costas/Bíceps:** Puxada frontal (4x10), Remada curvada (4x8-12), Remada baixa (3x12), Rosca direta (4x10), Rosca martelo (3x12)
- **Treino C — Pernas/Ombros:** Agachamento (4x8-10), Leg press (4x12), Cadeira extensora (3x15), Desenvolvimento halteres (4x10), Elevação lateral (3x15)

---

## Ordem de Execução Sugerida (com gates de aprovação)

1. **Setup:** repo + estrutura de pastas + config.js → *aprovar*
2. **Migration SQL** no Supabase (novo projeto ou schema separado) → *aprovar antes de rodar*
3. **Auth + login.html** (copiar padrão FinZen) → *aprovar*
4. **CRUD exercícios + fichas** → *aprovar*
5. **Tela de execução + timer** → *aprovar*
6. **Histórico + dashboard + PWA/manifest** → *aprovar*
7. **Deploy Vercel** → *push só com aprovação*

---

## Fase 2 — Módulo IA (executar APÓS o MVP estar estável)

**Objetivo:** gerar fichas de treino personalizadas com IA, que o usuário revisa e aprova antes de salvar.

### Arquitetura (mesmo padrão do Chat IA do FinZen)

```
pages/ai-workout.html + js/aiWorkout.js   → formulário + tela de revisão
api/ai-workout.js                          → Serverless Function (Vercel)
```

- Modelo: `claude-sonnet-4-6` via api.anthropic.com
- `ANTHROPIC_API_KEY` **somente** em variável de ambiente da Vercel — NUNCA no código cliente
- System prompt exige resposta APENAS em JSON (sem preâmbulo, sem markdown) — parsear com try/catch e retry 1x em caso de JSON inválido

### Fluxo

1. Usuário responde: objetivo (hipertrofia/emagrecimento/força), nível, dias/semana, equipamento disponível, restrições/lesões
2. Serverless monta o prompt e chama o Claude
3. Resposta JSON esperada:

```json
{
  "workouts": [
    {
      "name": "Treino A - Peito e Tríceps",
      "exercises": [
        { "name": "Supino reto", "muscle_group": "peito", "equipment": "barra",
          "target_sets": 4, "target_reps": "8-12", "rest_seconds": 90,
          "notes": "Foco na fase excêntrica" }
      ]
    }
  ],
  "rationale": "Explicação curta da estrutura do treino"
}
```

4. **Tela de revisão:** app renderiza as fichas propostas em modo edição — usuário ajusta, remove ou adiciona exercícios e só então salva em `workouts` / `workout_exercises` (exercícios inexistentes são criados em `exercises`)
5. Exibir aviso fixo na tela: "Treino gerado por IA. Revise com um profissional de educação física antes de executar."

### Evolução futura (Fase 2.1)

- "Sugerir progressão": enviar histórico do `session_sets` (últimas 4 semanas do exercício) e pedir sugestão de nova carga/reps
- Contexto de recuperação muscular como entrada do prompt
