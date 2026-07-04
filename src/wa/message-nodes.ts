import { SEL, firstMatch } from './selectors';
import type { Direction, WaMessage } from './types';

// Localiza e interpreta os nos de mensagem do DOM do WhatsApp.

export function getMainNode(): HTMLElement | null {
  return document.querySelector<HTMLElement>(SEL.main);
}

export function getMessageRows(main: HTMLElement = document.body): HTMLElement[] {
  const scope = main.querySelector<HTMLElement>(SEL.main) ?? main;
  return Array.from(scope.querySelectorAll<HTMLElement>(SEL.messageRow));
}

/** Direcao da mensagem (recebida/enviada), ou null se a row nao for mensagem. */
function directionOf(row: HTMLElement): Direction | null {
  if (row.querySelector(SEL.bubbleOut)) return 'out';
  if (row.querySelector(SEL.bubbleIn)) return 'in';
  return null;
}

/** Extrai autor e timestamp do atributo data-pre-plain-text: "[10:32, 03/07/2026] Fulano: ". */
function parsePrePlain(pre: string | null): { author: string; timestamp?: string } {
  if (!pre) return { author: '' };
  const match = pre.match(/^\[(.*?)\]\s*(.*?):\s*$/);
  if (match) return { timestamp: match[1], author: match[2].trim() };
  return { author: '' };
}

function detectMedia(row: HTMLElement): WaMessage['kind'] {
  if (row.querySelector(SEL.audio) || firstMatch(row, SEL.audioIcon)) return 'audio';
  if (row.querySelector('img[src^="blob:"]')) return 'image';
  if (row.querySelector('video')) return 'video';
  return 'text';
}

export function parseRow(row: HTMLElement): WaMessage | null {
  const direction = directionOf(row);
  if (!direction) return null; // separadores de data, avisos de sistema, etc.

  const copyable = row.querySelector<HTMLElement>(SEL.copyableText);
  const { author, timestamp } = parsePrePlain(
    copyable?.getAttribute(SEL.prePlainAttr) ?? null,
  );

  const textEl = copyable ? firstMatch<HTMLElement>(copyable, SEL.textSpan) : null;
  const text = (textEl?.innerText ?? copyable?.innerText ?? '').trim();
  const kind = detectMedia(row);

  // Ignora linhas sem conteudo util (nem texto, nem midia reconhecida).
  if (!text && kind === 'text') return null;

  return {
    author: direction === 'out' ? '' : author,
    text,
    timestamp,
    direction,
    kind,
  };
}

/** Retorna as N mensagens anteriores (incl. a alvo) para dar contexto ao "explicar". */
export function contextWindow(rows: HTMLElement[], index: number, n = 15): WaMessage[] {
  const start = Math.max(0, index - n);
  const out: WaMessage[] = [];
  for (let i = start; i <= index; i++) {
    const m = parseRow(rows[i]);
    if (m) out.push(m);
  }
  return out;
}
