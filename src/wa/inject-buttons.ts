// Injeta um botao de IA em CADA bolha de mensagem (light DOM), sempre visivel e
// colado na mensagem. A bolha e detectada pelo ESTILO REAL (fundo + cantos
// arredondados), o que independe de classes/atributos que o WhatsApp muda.
// Ao clicar, chama o handler com a bolha e a posicao do botao.

const STYLE_ID = 'wz-injected-styles';
const BTN_CLASS = 'wz-msg-action';

const STARS_SVG = `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31z"/></svg>`;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${BTN_CLASS} {
      position: absolute; top: 3px; right: 3px;
      width: 22px; height: 22px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid rgba(0,0,0,.15); background: #ffffff; color: #1da851;
      cursor: pointer; opacity: .68; transition: opacity .12s ease, transform .12s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,.25); z-index: 60; padding: 0; margin: 0;
    }
    .${BTN_CLASS}:hover { opacity: 1; transform: scale(1.1); }
    @media (prefers-color-scheme: dark) {
      .${BTN_CLASS} { background: #2a3942; color: #25d366; border-color: rgba(255,255,255,.16); }
    }
  `;
  (document.head ?? document.documentElement).appendChild(style);
}

function isBubbleLike(el: HTMLElement, rowWidth: number): boolean {
  const s = getComputedStyle(el);
  const radius = parseFloat(s.borderTopLeftRadius) || 0;
  if (radius < 6) return false;
  const bg = s.backgroundColor;
  if (!bg || bg === 'transparent' || bg.startsWith('rgba(0, 0, 0, 0')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 40 || r.height < 18) return false;
  if (r.width > rowWidth * 0.97) return false; // exclui containers de largura total
  return true;
}

/** Acha a bolha visivel (colorida, arredondada) dentro da linha da mensagem. */
function findBubble(row: HTMLElement): HTMLElement | null {
  const rowWidth = row.getBoundingClientRect().width || 1;
  let best: HTMLElement | null = null;
  let bestArea = 0;
  row.querySelectorAll<HTMLElement>('div').forEach((el) => {
    if (!isBubbleLike(el, rowWidth)) return;
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > bestArea) {
      bestArea = area;
      best = el;
    }
  });
  return best;
}

type Handler = (anchor: HTMLElement, rect: DOMRect) => void;

// Linhas ja processadas -> botao injetado. Evita re-varrer (getComputedStyle +
// getBoundingClientRect por div) linhas que ja tem botao vivo a cada mutacao do DOM.
const processed = new WeakMap<HTMLElement, HTMLElement>();

function isMessageRow(row: HTMLElement): boolean {
  const id = row.querySelector('[data-id]')?.getAttribute('data-id') ?? '';
  if (/^(true|false)_/.test(id)) return true;
  return !!row.querySelector('.copyable-text, audio, img[src^="blob:"], [data-icon]');
}

function processBubbles(handler: Handler) {
  const main = document.getElementById('main');
  if (!main) return;
  main.querySelectorAll<HTMLElement>('div[role="row"]').forEach((row) => {
    if (processed.get(row)?.isConnected) return; // ja tem botao vivo
    if (row.querySelector(`.${BTN_CLASS}`)) return; // ja tem botao (fallback)
    if (!isMessageRow(row)) return;
    const bubble = findBubble(row);
    if (!bubble) return;
    if (getComputedStyle(bubble).position === 'static') bubble.style.position = 'relative';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = BTN_CLASS;
    btn.title = 'Ações de IA (WebZap)';
    btn.setAttribute('aria-label', 'Ações de IA');
    btn.innerHTML = STARS_SVG;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handler(bubble, btn.getBoundingClientRect());
    });
    bubble.appendChild(btn);
    processed.set(row, btn);
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
    document.querySelectorAll(`.${BTN_CLASS}`).forEach((b) => b.remove());
  };
}
