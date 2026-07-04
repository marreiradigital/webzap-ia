// FONTE UNICA de seletores do WhatsApp Web. Quando o WhatsApp muda o layout,
// so este arquivo precisa ser atualizado. Ver .claude/HARNESS/atualizar-seletores.md
// Cada campo pode ter uma lista de seletores (tentados em ordem, fallback).

export const SEL = {
  /** Painel do chat aberto. */
  main: '#main',
  header: '#main header',
  /** Titulo (nome do contato/grupo) no header. */
  headerTitle: [
    '#main header span[dir="auto"][title]',
    '#main header span[dir="auto"]',
  ],
  /** Linha de mensagem (cada bolha fica em um role="row"). */
  messageRow: 'div[role="row"]',
  /** Bolha da mensagem (usada para ancorar o hover quando role="row" nao casa). */
  messageBubble: '.message-in, .message-out',
  /** Container do texto copiavel; carrega o atributo data-pre-plain-text. */
  copyableText: 'div.copyable-text',
  prePlainAttr: 'data-pre-plain-text',
  /** Seletor pronto para achar qualquer bloco de mensagem (o mais estavel). */
  prePlain: '[data-pre-plain-text]',
  /** Span com o texto da mensagem (varios fallbacks por causa da ofuscacao). */
  textSpan: ['span.selectable-text', '.selectable-text', 'span._ao3e', '.copyable-text > span'],
  bubbleIn: '.message-in',
  bubbleOut: '.message-out',
  /** Elemento de audio de nota de voz (existe apos o WhatsApp carregar o blob). */
  audio: 'audio',
  audioIcon: [
    '[data-icon="audio-play"]',
    '[data-icon="audio-pause"]',
    '[data-icon="ptt-status"]',
    '[data-icon*="ptt" i]',
    'button[aria-label*="udio" i]',
  ],
  /** Imagem enviada (blob), ignorando emojis e figurinhas. */
  imageEl: 'img[src^="blob:"]:not(.emoji)',
  imageIcon: ['[data-icon="media-download"]', '[data-icon*="image" i]'],
  /** Video enviado. */
  videoEl: 'video',
  videoIcon: ['[data-icon="media-play"]', '[data-icon*="video" i]'],
  /** Documento (PDF, etc.). */
  documentIcon: ['[data-icon*="document" i]', '[data-icon="poll"]'],
  /** Campo de digitacao (contenteditable) no rodape. */
  composer: [
    'footer div[contenteditable="true"][data-tab]',
    'footer div[contenteditable="true"]',
    'div[contenteditable="true"][data-tab="10"]',
  ],
} as const;

/** Primeiro elemento que casar com algum dos seletores. */
export function firstMatch<T extends Element = HTMLElement>(
  root: ParentNode,
  selectors: string | readonly string[],
): T | null {
  const list = typeof selectors === 'string' ? [selectors] : selectors;
  for (const sel of list) {
    const el = root.querySelector<T>(sel);
    if (el) return el;
  }
  return null;
}
