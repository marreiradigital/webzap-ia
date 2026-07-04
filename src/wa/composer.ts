import { SEL, firstMatch } from './selectors';

// Escreve texto no campo de digitacao do WhatsApp. NAO envia (envio = Fase 2,
// sempre opt-in). Usado por "Sugerir resposta" para inserir a sugestao escolhida.

export function getComposer(): HTMLElement | null {
  return firstMatch<HTMLElement>(document, SEL.composer);
}

/**
 * Insere o texto no campo, substituindo o conteudo atual. Usa execCommand insertText
 * para que os handlers internos do WhatsApp reconheçam a digitacao.
 */
export function insertIntoComposer(text: string): boolean {
  const box = getComposer();
  if (!box) return false;

  box.focus();
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(box);
    selection.addRange(range);
  }
  // Substitui a selecao (todo o conteudo) pelo texto.
  const ok = document.execCommand('insertText', false, text);
  if (!ok) {
    // Fallback: dispara evento de input manualmente.
    box.textContent = text;
    box.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }
  return true;
}

/** Clica no botao de enviar (ou pressiona Enter no campo). */
export function clickSend(): boolean {
  const btn = firstMatch<HTMLElement>(document, SEL.sendButton);
  if (btn) {
    (btn.closest('button') ?? btn).click();
    return true;
  }
  // Fallback: Enter no campo de digitacao.
  const box = getComposer();
  if (!box) return false;
  box.focus();
  const opts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
  box.dispatchEvent(new KeyboardEvent('keydown', opts));
  box.dispatchEvent(new KeyboardEvent('keyup', opts));
  return true;
}

/** Insere o texto e envia. USADO SO no modo auto-enviar (opt-in, com aviso). */
export function sendMessage(text: string): boolean {
  if (!insertIntoComposer(text)) return false;
  // Pequeno atraso para o WhatsApp registrar o texto antes de enviar.
  setTimeout(() => clickSend(), 250);
  return true;
}
