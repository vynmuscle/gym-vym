// Assistente de IA conversacional — camada de INTERPRETAÇÃO, não de decisão.
// Nunca prescreve carga/série/reps (isso é o progressionService.js,
// determinístico); só explica dados que o próprio app já calculou. Overlay
// injetado via JS (sem HTML duplicado em cada página) — mesmo padrão do
// ex-info-overlay em train.js.

import { buildAssistantContext, askAssistant } from './services/assistantService.js';

let overlayEl = null;

function close(){
  overlayEl?.remove();
  overlayEl = null;
  document.removeEventListener('keydown', onKeydown);
}

function onKeydown(e){
  if(e.key === 'Escape') close();
}

export function openAiAssistant(){
  if(overlayEl) return;

  overlayEl = document.createElement('div');
  overlayEl.className = 'gv3-backdrop';
  overlayEl.innerHTML = `
    <div class="gv3-modal ai-assistant-modal" role="dialog" aria-modal="true" aria-label="Assistente GymVym">
      <div class="ai-assistant-head">
        <h3>✨ Assistente GymVym</h3>
        <button type="button" class="ai-assistant-close" aria-label="Fechar">✕</button>
      </div>
      <div class="ai-assistant-hint">Pergunte sobre seu treino, evolução ou recuperação. Não é orientação médica — pra dor ou lesão, procure um profissional.</div>
      <div class="ai-assistant-answer" id="aiAssistantAnswer" style="display:none"></div>
      <textarea class="ai-assistant-input" id="aiAssistantInput" placeholder="Ex.: como estou evoluindo no supino?" rows="2" maxlength="500"></textarea>
      <button type="button" class="gv3-btn gv3-btn--primary gv3-btn--full" id="aiAssistantSend">Perguntar</button>
    </div>`;
  document.body.appendChild(overlayEl);
  document.addEventListener('keydown', onKeydown);

  const closeBtn = overlayEl.querySelector('.ai-assistant-close');
  const sendBtn = overlayEl.querySelector('#aiAssistantSend');
  const input = overlayEl.querySelector('#aiAssistantInput');
  const answerEl = overlayEl.querySelector('#aiAssistantAnswer');

  closeBtn.addEventListener('click', close);
  overlayEl.addEventListener('click', (e) => { if(e.target === overlayEl) close(); });

  async function send(){
    const question = input.value.trim();
    if(!question || sendBtn.disabled) return;

    sendBtn.disabled = true;
    sendBtn.textContent = 'Pensando...';
    answerEl.classList.remove('ai-assistant-answer--error');
    answerEl.style.display = 'none';

    try {
      const context = await buildAssistantContext();
      const answer = await askAssistant(question, context);
      answerEl.textContent = answer;
      answerEl.style.display = 'block';
    } catch(err){
      answerEl.textContent = err.message || 'Não consegui responder agora.';
      answerEl.classList.add('ai-assistant-answer--error');
      answerEl.style.display = 'block';
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Perguntar';
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      send();
    }
  });
  input.focus();
}
