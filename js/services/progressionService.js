// Motor de progressão determinístico — decide se a carga de um exercício
// deve subir, manter ou reduzir pro próximo treino, com base no histórico
// recente (sessões passadas já vêm prontas de getExerciseProgress). Sem IA,
// sem tabela nova: calculado na hora, igual o sinal que já existia antes
// (shouldSuggestWeightIncrease), só que agora com RPE e mais estados além de
// "subir sim/não". Conservador por desenho: nunca decide com menos de 2
// sessões de histórico, nunca sugere subir se o esforço já estava alto.

const RECENT_WINDOW = 3;
const RETURN_GAP_DAYS = 14;
const REDUCE_PCT_RETURN = 10;
const REDUCE_PCT_BELOW_RANGE = 5;

function daysBetween(isoA, isoB) {
  return Math.round((new Date(isoB) - new Date(isoA)) / 86400000);
}

function roundToStep(value, step) {
  return Math.round(value / step) * step;
}

// Incremento fixo (não escala com o peso) — evita sugestões tipo "32.37kg"
// que não existem em anilha nenhuma. 2.5kg abaixo de 40kg, 5kg acima.
function increaseWeight(currentWeight) {
  if (!currentWeight) return currentWeight;
  const step = currentWeight >= 40 ? 5 : 2.5;
  return roundToStep(currentWeight + step, 0.5);
}

function reduceWeight(currentWeight, pct) {
  if (!currentWeight) return currentWeight;
  return roundToStep(currentWeight * (1 - pct / 100), 0.5);
}

// sessions: retorno de getExerciseProgress (asc por data), já excluindo a
// sessão em andamento — o último item é a última vez que o exercício foi
// treinado de verdade. repsMin/repsMax: faixa alvo da ficha (ex.: "8-12").
// currentWeight: peso da última sessão, base pra calcular a sugestão.
export function decideProgression({ sessions, repsMin, repsMax, currentWeight }) {
  if (sessions.length === 0) {
    return { action: 'hold', reason: null };
  }

  const last = sessions[sessions.length - 1];

  if (sessions.length >= 2) {
    const gapDays = daysBetween(sessions[sessions.length - 2].date, last.date);
    if (gapDays > RETURN_GAP_DAYS) {
      return {
        action: 'reduce',
        suggestedWeight: reduceWeight(currentWeight, REDUCE_PCT_RETURN),
        reason: `${gapDays} dias sem treinar esse exercício — carga reduzida pra retomar com segurança.`
      };
    }
  }

  if (sessions.length < 2) {
    return { action: 'hold', reason: null };
  }

  const recent = sessions.slice(-RECENT_WINDOW);

  if (repsMax != null) {
    const allHitTop = recent.length >= 2 && recent.every(s => s.topReps >= repsMax);
    const rpeBlocksIncrease = recent.some(s => s.topRpe != null && s.topRpe >= 9);

    if (allHitTop && !rpeBlocksIncrease) {
      return {
        action: 'increase',
        suggestedWeight: increaseWeight(currentWeight),
        reason: `Bateu o topo da faixa (${repsMax} reps) nas últimas ${recent.length} sessões.`
      };
    }
    if (allHitTop && rpeBlocksIncrease) {
      return { action: 'hold', reason: 'Bateu a meta de reps, mas com esforço alto (RPE 9+) — mantendo a carga.' };
    }
  }

  if (repsMin != null && last.topReps < repsMin) {
    const last2 = sessions.slice(-2);
    const droppedTwice = last2.length === 2 && last2.every(s => s.topReps < repsMin);
    if (droppedTwice) {
      return {
        action: 'reduce',
        suggestedWeight: reduceWeight(currentWeight, REDUCE_PCT_BELOW_RANGE),
        reason: 'Reps abaixo da faixa alvo em 2 sessões seguidas — reduzindo a carga.'
      };
    }
  }

  return { action: 'hold', reason: null };
}
