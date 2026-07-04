import { getMainNode, getMessageRows, parseRow } from './message-nodes';
import { readHeaderTitle } from './chat-reader';

// Observa novas mensagens RECEBIDAS no chat aberto e dispara a auto-resposta.
// Guard-rails: rebaseline ao trocar de conversa OU ao reativar (nao dispara no
// historico nem em mensagem que chegou com o modo desligado), e nao responde a
// propria mensagem. O throttle entre respostas fica no chamador (App), que so
// consome cooldown quando decide responder de fato. Ver .claude/SDD/auto-reply.md

export interface IncomingInfo {
  /** Conversa em que a mensagem chegou (titulo do header no momento da deteccao). */
  chat: string;
  text: string;
  isGroup: boolean;
}

function messageKey(row: HTMLElement): string {
  // data-id e unico por mensagem — deteccao de "nova mensagem" precisa.
  const id = row.querySelector('[data-id]')?.getAttribute('data-id');
  if (id) return id;
  const pre = row.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') ?? '';
  const text = row.querySelector('.selectable-text')?.textContent ?? '';
  return `${pre}|${text.slice(0, 60)}`;
}

export function setupAutoReplyWatcher(
  isActive: () => boolean,
  onIncoming: (info: IncomingInfo) => void,
): () => void {
  let lastKey = '';
  let baselined = false;
  let lastChat = '';

  const scan = () => {
    if (!isActive()) {
      // Inativo: perde a baseline para nao disparar, ao reativar, numa mensagem
      // que chegou enquanto o modo estava desligado.
      baselined = false;
      return;
    }

    const chat = readHeaderTitle() ?? '';
    if (chat !== lastChat) {
      // Troca de conversa: rebaseline, nao dispara no que ja estava aberto.
      lastChat = chat;
      baselined = false;
    }

    const rows = getMessageRows(getMainNode());
    if (!rows.length) return;
    const lastRow = rows[rows.length - 1];
    const key = messageKey(lastRow);

    if (!baselined) {
      baselined = true;
      lastKey = key;
      return;
    }
    if (key === lastKey) return;
    lastKey = key;

    const parsed = parseRow(lastRow);
    if (!parsed || parsed.direction === 'out' || !parsed.text) return; // nossa msg / sem texto

    const authors = new Set(
      rows
        .map(parseRow)
        .filter((m): m is NonNullable<typeof m> => !!m)
        .filter((m) => m.direction === 'in' && m.author)
        .map((m) => m.author),
    );
    const isGroup = authors.size > 1;
    onIncoming({ chat, text: parsed.text, isGroup });
  };

  // rAF coalesce: varias mutacoes num mesmo frame viram UM scan.
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  };
  const obs = new MutationObserver(schedule);
  obs.observe(document.body, { childList: true, subtree: true });
  return () => obs.disconnect();
}
