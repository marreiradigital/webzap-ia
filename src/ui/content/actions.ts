import { readVisibleChat } from '@/src/wa/chat-reader';
import { getMessageRows, parseRow, contextWindow } from '@/src/wa/message-nodes';
import { extractAudio, extractImage } from '@/src/wa/audio';
import {
  buildSummaryPrompt,
  buildExplainPrompt,
  buildSuggestPrompt,
  buildDescribeImagePrompt,
  buildSearchConversationPrompt,
  buildSearchMessagePrompt,
  buildTranscriptionSeed,
  type SummaryLength,
} from '@/src/ai/prompts';
import { callBackground, type StreamChatInput } from '@/src/messaging';
import type { ChatMessage, ImageInput } from '@/src/providers/types';
import type { ChatContext } from '@/src/wa/types';
import type { TaskKind } from '@/src/storage';

// Acoes da UI. As de chat retornam uma "Prep" (semente + parametros) e o App faz
// o streaming ao vivo. Sugerir/transcrever nao usam streaming (retornam Session).

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export interface Session {
  title: string;
  task: TaskKind;
  thread: ChatMessage[];
  display: Turn[];
  images?: ImageInput[];
  searchDefault?: boolean;
  chatName?: string;
  suggestions?: string[];
}

/** Semente para uma acao de chat que sera transmitida ao vivo. */
export interface Prep {
  title: string;
  task: TaskKind;
  thread: ChatMessage[];
  images?: ImageInput[];
  search?: boolean;
  chatName?: string;
  usePersona?: boolean;
}

/** Erro com diagnostico do DOM (facilita reportar quando os seletores quebram). */
function emptyChatError(): string {
  const main = document.querySelector('#main') ? 'sim' : 'não';
  const blocos = document.querySelectorAll('#main [data-pre-plain-text]').length;
  const linhas = document.querySelectorAll('#main div[role="row"]').length;
  const textos = document.querySelectorAll('#main .selectable-text').length;
  return `Não encontrei mensagens visíveis (main:${main} · blocos:${blocos} · linhas:${linhas} · textos:${textos}). Abra uma conversa e role o histórico. Se persistir, me envie esses números.`;
}

function requireChat(): ChatContext {
  const ctx = readVisibleChat();
  if (!ctx || ctx.messages.length === 0) throw new Error(emptyChatError());
  return ctx;
}

// ---- Preps de chat (streaming) ----

export function prepSummary(length: SummaryLength): Prep {
  const ctx = requireChat();
  const title =
    length === 'curto' ? 'Resumo curto' : length === 'detalhado' ? 'Resumo detalhado' : 'Resumo da conversa';
  return { title, task: 'summarize', thread: buildSummaryPrompt(ctx, length), chatName: ctx.chatName };
}

export function prepExplain(row: HTMLElement): Prep {
  const target = parseRow(row);
  if (!target) throw new Error('Não consegui interpretar esta mensagem.');
  const rows = getMessageRows();
  const index = rows.indexOf(row);
  const ctx = readVisibleChat() ?? { chatName: '', isGroup: false, messages: [] };
  const window = index >= 0 ? contextWindow(rows, index, 15) : [target];
  return { title: 'Explicar mensagem', task: 'explain', thread: buildExplainPrompt(ctx, target, window), chatName: ctx.chatName };
}

export async function prepDescribe(row: HTMLElement): Promise<Prep> {
  const image = await extractImage(row);
  if (!image) throw new Error('Abra a imagem uma vez para carregá-la e tente descrever de novo.');
  const target = parseRow(row);
  const ctx = readVisibleChat() ?? { chatName: '', isGroup: false, messages: [] };
  return {
    title: 'Descrição da imagem',
    task: 'explain',
    thread: buildDescribeImagePrompt(ctx, target?.caption),
    images: [image],
    chatName: ctx.chatName,
  };
}

export function prepSearchConversation(): Prep {
  const ctx = requireChat();
  return {
    title: 'Pesquisa online',
    task: 'search',
    thread: buildSearchConversationPrompt(ctx),
    search: true,
    chatName: ctx.chatName,
  };
}

export function prepSearchMessage(row: HTMLElement): Prep {
  const target = parseRow(row);
  if (!target) throw new Error('Não consegui interpretar esta mensagem.');
  const ctx = readVisibleChat() ?? { chatName: '', isGroup: false, messages: [] };
  return {
    title: 'Pesquisa online',
    task: 'search',
    thread: buildSearchMessagePrompt(ctx, target),
    search: true,
    chatName: ctx.chatName,
  };
}

/** StreamChatInput para um follow-up dentro de uma sessao. */
export function followupInput(
  session: Session,
  question: string,
  useSearch: boolean,
): StreamChatInput {
  return {
    task: useSearch ? 'search' : session.task,
    messages: [...session.thread, { role: 'user', content: question }],
    images: session.images,
    search: useSearch || session.searchDefault,
    chatName: session.chatName,
  };
}

// ---- Acoes sem streaming ----

export async function suggest(): Promise<Session> {
  const ctx = requireChat();
  const thread = [...buildSuggestPrompt(ctx)];
  const res = await callBackground({
    kind: 'chat',
    task: 'suggest',
    messages: thread,
    usePersona: true,
    chatName: ctx.chatName,
  });
  if (!res.ok) throw new Error(res.error);
  const suggestions = res.text
    .split('\n')
    .map((s) => s.replace(/^\s*[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
  thread.push({ role: 'assistant', content: res.text });
  return { title: 'Sugestões de resposta', task: 'suggest', thread, display: [], suggestions, chatName: ctx.chatName };
}

export async function transcribe(row: HTMLElement): Promise<Session> {
  const audio = await extractAudio(row);
  if (!audio) {
    const found = document.querySelectorAll('#main audio').length;
    throw new Error(
      `Não consegui pegar o áudio (elementos de áudio na tela: ${found}). Toque no play do áudio uma vez para carregá-lo e tente de novo.`,
    );
  }
  const res = await callBackground({
    kind: 'transcribe',
    audioBase64: audio.base64,
    mimeType: audio.mimeType,
  });
  if (!res.ok) throw new Error(res.error);
  return {
    title: 'Transcrição do áudio',
    task: 'explain',
    thread: buildTranscriptionSeed(res.text),
    display: [{ role: 'assistant', content: res.text }],
  };
}
