// Corta a espera de uma promise que pode ficar pendurada com sinal fraco (o
// fetch não tem timeout próprio — em wifi/celular ruim ele pode nunca
// resolver). Não cancela a chamada de verdade, só desiste de esperar por ela.
export function withTimeout(promise, ms = 6000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}
