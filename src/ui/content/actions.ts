import { readVisibleChat } from '@/src/wa/chat-reader';
import { getMessageRows, parseRow, contextWindow } from '@/src/wa/message-nodes';
import { extractAudio } from '@/src/wa/audio';
import {
  buildSummaryPrompt,
  buildExplainPrompt,
  buildSuggestPrompt,
  type SummaryLength,
} from '@/src/ai/prompts';
import { callBackground } from '@/src/messaging';

// Acoes de alto nivel usadas pela UI injetada. Cada uma le o DOM, monta o prompt,
// delega o fetch ao background e devolve texto (ou lanca erro legivel em pt-BR).

export async function summarize(length: SummaryLength): Promise<string> {
  const ctx = readVisibleChat();
  if (!ctx || ctx.messages.length === 0) {
    throw new Error('Nenhuma mensagem visível para resumir. Abra uma conversa e role o histórico.');
  }
  const messages = buildSummaryPrompt(ctx, length);
  const res = await callBackground({
    kind: 'chat',
    task: 'summarize',
    messages,
    maxTokens: length === 'detalhado' ? 1600 : 800,
  });
  if (!res.ok) throw new Error(res.error);
  return res.text;
}

export async function suggest(): Promise<string[]> {
  const ctx = readVisibleChat();
  if (!ctx || ctx.messages.length === 0) {
    throw new Error('Nenhuma mensagem visível para basear a sugestão.');
  }
  const messages = buildSuggestPrompt(ctx);
  const res = await callBackground({
    kind: 'chat',
    task: 'suggest',
    messages,
    maxTokens: 500,
    temperature: 0.7,
  });
  if (!res.ok) throw new Error(res.error);
  return res.text
    .split('\n')
    .map((s) => s.replace(/^\s*[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
}

export async function explain(row: HTMLElement): Promise<string> {
  const target = parseRow(row);
  if (!target || !target.text) {
    throw new Error('Não consegui ler o texto desta mensagem.');
  }
  const rows = getMessageRows();
  const index = rows.indexOf(row);
  const ctx = readVisibleChat() ?? { chatName: '', isGroup: false, messages: [] };
  const window = index >= 0 ? contextWindow(rows, index, 15) : [target];
  const messages = buildExplainPrompt(ctx, target, window);
  const res = await callBackground({ kind: 'chat', task: 'explain', messages, maxTokens: 600 });
  if (!res.ok) throw new Error(res.error);
  return res.text;
}

export async function transcribe(row: HTMLElement): Promise<string> {
  const audio = await extractAudio(row);
  if (!audio) {
    throw new Error('Toque no play do áudio uma vez para carregá-lo e tente transcrever de novo.');
  }
  const res = await callBackground({
    kind: 'transcribe',
    audioBase64: audio.base64,
    mimeType: audio.mimeType,
  });
  if (!res.ok) throw new Error(res.error);
  return res.text;
}
