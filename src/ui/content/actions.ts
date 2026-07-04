import { readVisibleChat } from '@/src/wa/chat-reader';
import { getMessageRows, parseRow, contextWindow } from '@/src/wa/message-nodes';
import { extractAudio, extractImage } from '@/src/wa/audio';
import {
  buildSummaryPrompt,
  buildExplainPrompt,
  buildSuggestPrompt,
  buildDescribeImagePrompt,
  type SummaryLength,
} from '@/src/ai/prompts';
import { callBackground } from '@/src/messaging';

// Acoes de alto nivel usadas pela UI injetada. Cada uma le o DOM, monta o prompt,
// delega o fetch ao background e devolve texto (ou lanca erro legivel em pt-BR).

/** Mensagem de erro com um diagnostico do DOM, para facilitar reportar quando os seletores quebram. */
function emptyChatError(): string {
  const main = document.querySelector('#main') ? 'sim' : 'não';
  const blocos = document.querySelectorAll('#main [data-pre-plain-text]').length;
  const linhas = document.querySelectorAll('#main div[role="row"]').length;
  const textos = document.querySelectorAll('#main .selectable-text').length;
  return `Não encontrei mensagens visíveis (main:${main} · blocos:${blocos} · linhas:${linhas} · textos:${textos}). Abra uma conversa e role o histórico. Se persistir, me envie esses números.`;
}

export async function summarize(length: SummaryLength): Promise<string> {
  const ctx = readVisibleChat();
  if (!ctx || ctx.messages.length === 0) {
    throw new Error(emptyChatError());
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
    throw new Error(emptyChatError());
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
  if (!target) {
    throw new Error('Não consegui interpretar esta mensagem.');
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

export async function describeImage(row: HTMLElement): Promise<string> {
  const image = await extractImage(row);
  if (!image) {
    throw new Error('Abra a imagem uma vez para carregá-la e tente descrever de novo.');
  }
  const target = parseRow(row);
  const ctx = readVisibleChat() ?? { chatName: '', isGroup: false, messages: [] };
  const messages = buildDescribeImagePrompt(ctx, target?.caption);
  const res = await callBackground({
    kind: 'chat',
    task: 'explain',
    messages,
    maxTokens: 700,
    images: [{ base64: image.base64, mimeType: image.mimeType }],
  });
  if (!res.ok) throw new Error(res.error);
  return res.text;
}
