import { SEL, firstMatch } from './selectors';
import type { Direction, MediaKind, WaMessage } from './types';

// Localiza e interpreta os nos de mensagem do DOM do WhatsApp.
// Estrategia: ancorar no que e mais estavel (data-pre-plain-text e .selectable-text),
// com fallbacks. Ver .claude/HARNESS/atualizar-seletores.md

export function getMainNode(): HTMLElement {
  return document.querySelector<HTMLElement>(SEL.main) ?? document.body;
}

export function getMessageRows(main: HTMLElement = getMainNode()): HTMLElement[] {
  return Array.from(main.querySelectorAll<HTMLElement>(SEL.messageRow));
}

/** Extrai autor e timestamp de "[10:32, 03/07/2026] Fulano: ". */
export function parsePrePlain(pre: string | null | undefined): {
  author: string;
  timestamp?: string;
} {
  if (!pre) return { author: '' };
  const match = pre.match(/^\[(.*?)\]\s*(.*?):\s*$/);
  if (match) return { timestamp: match[1], author: match[2].trim() };
  return { author: '' };
}

/** Direcao via data-id do WhatsApp ("true_..." = enviada, "false_..." = recebida). */
export function directionFromDataId(el: Element | null): Direction | null {
  const holder =
    (el?.closest('[data-id]') as HTMLElement | null) ??
    (el?.querySelector?.('[data-id]') as HTMLElement | null) ??
    null;
  const id = holder?.getAttribute('data-id') ?? '';
  if (id.startsWith('true_')) return 'out';
  if (id.startsWith('false_')) return 'in';
  return null;
}

function directionOf(el: HTMLElement): Direction {
  const byId = directionFromDataId(el);
  if (byId) return byId;
  // Fallback (classes ofuscadas mudam com frequencia).
  if (el.closest(SEL.bubbleOut) || el.querySelector(SEL.bubbleOut)) return 'out';
  return 'in';
}

/** Descrimina o tipo de midia da mensagem/linha. */
export function detectKind(el: HTMLElement): MediaKind {
  if (el.querySelector(SEL.audio) || firstMatch(el, SEL.audioIcon)) return 'audio';
  if (el.querySelector(SEL.videoEl) || firstMatch(el, SEL.videoIcon)) return 'video';
  if (el.querySelector(SEL.imageEl) || firstMatch(el, SEL.imageIcon)) return 'image';
  if (firstMatch(el, SEL.documentIcon)) return 'document';
  return 'text';
}

function readText(scope: HTMLElement): string {
  const el = firstMatch<HTMLElement>(scope, SEL.textSpan);
  return (el?.innerText ?? '').trim();
}

/** Interpreta um bloco com data-pre-plain-text (mensagem com texto/legenda). */
function parseBlock(block: HTMLElement): WaMessage | null {
  const { author, timestamp } = parsePrePlain(block.getAttribute(SEL.prePlainAttr));
  const text = readText(block);
  const kind = detectKind(block.closest<HTMLElement>(SEL.messageBubble) ?? block);
  if (!text && kind === 'text') return null;
  const direction = directionOf(block);
  return {
    author: direction === 'out' ? '' : author,
    text,
    timestamp,
    direction,
    kind,
    caption: text || undefined,
  };
}

/** Le todas as mensagens visiveis, tentando estrategias da mais estavel para a menos. */
export function collectMessages(main: HTMLElement = getMainNode()): WaMessage[] {
  // 1) Blocos com data-pre-plain-text (o mais estavel).
  const blocks = Array.from(main.querySelectorAll<HTMLElement>(SEL.prePlain));
  const fromBlocks = blocks
    .map(parseBlock)
    .filter((m): m is WaMessage => m != null);
  if (fromBlocks.length) return fromBlocks;

  // 2) Linhas role="row".
  const fromRows = getMessageRows(main)
    .map(parseRow)
    .filter((m): m is WaMessage => m != null);
  if (fromRows.length) return fromRows;

  // 3) Ultimo recurso: qualquer .selectable-text.
  return Array.from(main.querySelectorAll<HTMLElement>('.selectable-text'))
    .map((el): WaMessage => ({
      author: '',
      text: (el.innerText ?? '').trim(),
      direction: directionFromDataId(el) ?? 'in',
      kind: 'text',
    }))
    .filter((m) => m.text);
}

/** Interpreta uma linha role="row" (usado no hover/explicar de uma mensagem). */
export function parseRow(row: HTMLElement): WaMessage | null {
  const block = row.querySelector<HTMLElement>(SEL.prePlain);
  const kind = detectKind(row);
  const { author, timestamp } = parsePrePlain(block?.getAttribute(SEL.prePlainAttr));
  const text = readText(block ?? row);

  // Nada util (separador de data, aviso de sistema).
  if (!text && kind === 'text') return null;

  const direction = directionOf(row);
  return {
    author: direction === 'out' ? '' : author,
    text,
    timestamp,
    direction,
    kind,
    caption: text || undefined,
  };
}

/** N mensagens anteriores (incl. a alvo) para dar contexto ao "explicar". */
export function contextWindow(rows: HTMLElement[], index: number, n = 15): WaMessage[] {
  const start = Math.max(0, index - n);
  const out: WaMessage[] = [];
  for (let i = start; i <= index; i++) {
    const m = parseRow(rows[i]);
    if (m) out.push(m);
  }
  return out;
}
