// Tipos normalizados da conversa lida do DOM do WhatsApp. Independem de seletores.

export type Direction = 'in' | 'out';

export interface WaMessage {
  /** Nome do autor (em grupo). Vazio/"Voce" quando for mensagem enviada. */
  author: string;
  text: string;
  /** Texto do atributo data-pre-plain-text (ex.: "[10:32, 03/07/2026] Fulano:"). */
  timestamp?: string;
  direction: Direction;
  /** Tipo de conteudo da mensagem. */
  kind: MediaKind;
  /** Legenda/nome de arquivo, quando a midia tem (imagem com legenda, documento). */
  caption?: string;
}

export type MediaKind = 'text' | 'audio' | 'image' | 'video' | 'document' | 'other';

export interface ChatContext {
  chatName: string;
  isGroup: boolean;
  /** Nome do proprio usuario, quando detectavel. */
  selfName?: string;
  messages: WaMessage[];
}
