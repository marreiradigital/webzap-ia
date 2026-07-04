// Injeta um pequeno botao de IA ancorado a CADA bolha de mensagem (light DOM),
// para o icone ficar colado na mensagem e rolar junto com ela (nao so no hover,
// nao preso no canto). Ao clicar, chama o handler com a linha e a posicao do botao.

const STYLE_ID = 'wz-injected-styles';
const BTN_CLASS = 'wz-msg-action';
const ANCHOR_CLASS = 'wz-anchored';

const STARS_SVG = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31z"/></svg>`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${ANCHOR_CLASS} { position: relative; overflow: visible !important; }
    .${BTN_CLASS} {
      position: absolute; top: 4px; right: 4px;
      width: 24px; height: 24px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid rgba(0,0,0,.12); background: #ffffff; color: #1da851;
      cursor: pointer; opacity: .6; transition: opacity .12s ease, transform .12s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,.22); z-index: 50; padding: 0;
    }
    .${BTN_CLASS}:hover { opacity: 1; transform: scale(1.08); }
    @media (prefers-color-scheme: dark) {
      .${BTN_CLASS} { background: #233138; color: #25d366; border-color: rgba(255,255,255,.14); }
    }
  `;
  document.head.appendChild(style);
}

type Handler = (row: HTMLElement, rect: DOMRect) => void;

function processBubbles(handler: Handler) {
  const main = document.getElementById('main');
  if (!main) return;
  const bubbles = main.querySelectorAll<HTMLElement>('.message-in, .message-out');
  bubbles.forEach((bubble) => {
    if (bubble.querySelector(`:scope > .${BTN_CLASS}`)) return;
    bubble.classList.add(ANCHOR_CLASS);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BTN_CLASS;
    btn.title = 'Ações de IA (WebZap)';
    btn.setAttribute('aria-label', 'Ações de IA');
    btn.innerHTML = STARS_SVG;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const row = (bubble.closest('div[role="row"]') as HTMLElement) ?? bubble;
      handler(row, btn.getBoundingClientRect());
    });
    bubble.appendChild(btn);
  });
}

/** Liga a injecao dos botoes; retorna funcao para desligar. */
export function setupMessageButtons(handler: Handler): () => void {
  ensureStyles();
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      processBubbles(handler);
    });
  };
  const obs = new MutationObserver(schedule);
  obs.observe(document.body, { childList: true, subtree: true });
  schedule();
  return () => {
    obs.disconnect();
    document
      .querySelectorAll(`.${BTN_CLASS}`)
      .forEach((b) => b.remove());
  };
}
