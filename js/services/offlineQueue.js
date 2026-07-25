import { recordSet } from './workoutService.js';

const QUEUE_KEY = 'gymvym_pending_sets';

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// meta é opcional — usado pelo train.js pra achar a linha na tela (ei/setNumber)
export function queueSet(userId, payload, meta) {
  const queue = readQueue();
  const localId = `${payload.session_id}-${payload.exercise_id}-${payload.set_number}-${Date.now()}`;
  queue.push({ localId, userId, payload, meta: meta || null });
  writeQueue(queue);
  return localId;
}

// Trava simples: várias chamadas concorrentes (pwa.js + train.js, load + evento
// 'online' quase juntos) não podem processar a fila ao mesmo tempo, senão duas
// tentativas leem o mesmo item antes de qualquer uma remover -> insere duplicado.
let isFlushing = false;

// Quem quiser saber quando uma série sincronizou (ex: train.js atualizando o ⏳
// pra ✓) se inscreve aqui — assim funciona não importa qual chamada de
// flushQueue() "ganhou" a trava.
const listeners = new Set();

export function onSetSynced(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Remove da fila local uma série ainda não sincronizada (ex: usuário desmarcou
// ou excluiu a série antes de a conexão voltar).
export function removeQueuedSet(sessionId, exerciseId, setNumber) {
  const queue = readQueue().filter(q => !(
    q.payload.session_id === sessionId &&
    q.payload.exercise_id === exerciseId &&
    q.payload.set_number === setNumber
  ));
  writeQueue(queue);
}

// Ajusta o número de uma série ainda na fila — usado quando uma série
// anterior é excluída e as seguintes precisam ser renumeradas.
export function renumberQueuedSet(sessionId, exerciseId, oldSetNumber, newSetNumber) {
  const queue = readQueue();
  queue.forEach(q => {
    if(q.payload.session_id === sessionId && q.payload.exercise_id === exerciseId && q.payload.set_number === oldSetNumber){
      q.payload.set_number = newSetNumber;
      if(q.meta) q.meta.setNumber = newSetNumber;
    }
  });
  writeQueue(queue);
}

export async function flushQueue() {
  if (isFlushing) return;
  isFlushing = true;

  try {
    const queue = readQueue();

    for (const item of queue) {
      try {
        await recordSet(item.userId, item.payload);
        writeQueue(readQueue().filter(q => q.localId !== item.localId));
        listeners.forEach(cb => cb(item));
      } catch (err) {
        break; // ainda sem rede (ou erro real) — tenta de novo na próxima chamada
      }
    }
  } finally {
    isFlushing = false;
  }
}
