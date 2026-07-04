import { getMainNode, getMessageRows, parseRow } from './message-nodes';
import { readHeaderTitle } from './chat-reader';

// Observa novas mensagens RECEBIDAS no chat aberto e dispara a auto-resposta.
// Guard-rails: rebaseline ao trocar de conversa (nao dispara no historico), nao
// responde a propria mensagem, e throttle entre disparos. Ver .claude/SDD/auto-reply.md

export interface IncomingInfo {
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
  let cooldownUntil = 0;

  const scan = () => {
    if (!isActive()) return;

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
    if (Date.now() < cooldownUntil) return;
    cooldownUntil = Date.now() + 8000; // throttle entre auto-respostas

    const authors = new Set(
      rows
        .map(parseRow)
        .filter((m): m is NonNullable<typeof m> => !!m)
        .filter((m) => m.direction === 'in' && m.author)
        .map((m) => m.author),
    );
    const isGroup = authors.size > 1;
    onIncoming({ text: parsed.text, isGroup });
  };

  const obs = new MutationObserver(() => requestAnimationFrame(scan));
  obs.observe(document.body, { childList: true, subtree: true });
  return () => obs.disconnect();
}
