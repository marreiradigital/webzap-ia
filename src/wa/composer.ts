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
