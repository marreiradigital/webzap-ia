import { SEL, firstMatch } from './selectors';
import { getMainNode, collectMessages } from './message-nodes';
import type { ChatContext } from './types';

// Le a conversa VISIVEL (o que esta rolado/renderizado) do chat aberto e devolve
// um contexto normalizado para virar prompt. Nao carrega historico do WhatsApp.

export function readHeaderTitle(): string | null {
  const el = firstMatch<HTMLElement>(document, SEL.headerTitle);
  if (!el) return null;
  // textContent (nao innerText): roda em caminho quente (observers) e innerText
  // forca reflow sincrono a cada chamada.
  return (el.getAttribute('title') || el.textContent || '').trim() || null;
}

export function readVisibleChat(): ChatContext | null {
  const main = getMainNode();
  const chatName = readHeaderTitle() ?? 'Conversa';
  const messages = collectMessages(main);

  // Heuristica de grupo: mais de um autor distinto entre as mensagens recebidas.
  const authors = new Set(
    messages.filter((m) => m.direction === 'in' && m.author).map((m) => m.author),
  );
  const isGroup = authors.size > 1;

  return { chatName, isGroup, messages };
}
