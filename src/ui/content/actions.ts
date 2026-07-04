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
import { callBackground } from '@/src/messaging';
import type { ChatMessage, ImageInput } from '@/src/providers/types';
import type { ChatContext } from '@/src/wa/types';
import type { TaskKind } from '@/src/storage';

// Acoes de alto nivel da UI. Cada uma monta um prompt, chama a IA e devolve uma
// SESSAO de chat (que pode continuar com perguntas de follow-up no painel).

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export interface Session {
  title: string;
  /** Tarefa usada para resolver o provider nos follow-ups. */
  task: TaskKind;
  /** Thread completo enviado a IA (inclui system + contexto da conversa). */
  thread: ChatMessage[];
  /** Turnos visiveis no painel. */
  display: Turn[];
  /** Imagens mantidas para follow-ups (descrever imagem). */
  images?: ImageInput[];
  /** Se a sessao nasceu de busca online (mantem busca nos follow-ups). */
  searchDefault?: boolean;
  /** Modo sugestao: lista de opcoes clicaveis em vez de chat. */
  suggestions?: string[];
}

async function callChat(
  thread: ChatMessage[],
  task: TaskKind,
  opts?: { images?: ImageInput[]; search?: boolean },
): Promise<string> {
  const res = await callBackground({
    kind: 'chat',
    task,
    messages: thread,
    images: opts?.images,
    search: opts?.search,
  });
  if (!res.ok) throw new Error(res.error);
  return res.text;
}

/** Cria uma sessao a partir de uma semente [system, user], ja chamando a IA. */
async function startSession(
  title: string,
  seed: ChatMessage[],
  task: TaskKind,
  opts?: { images?: ImageInput[]; search?: boolean },
): Promise<Session> {
  const thread = [...seed];
  const answer = await callChat(thread, task, opts);
  thread.push({ role: 'assistant', content: answer });
  return {
    title,
    task,
    thread,
    display: [{ role: 'assistant', content: answer }],
    images: opts?.images,
    searchDefault: opts?.search,
  };
}

/** Continua a conversa da sessao com uma nova pergunta do usuario. */
export async function followUp(
  session: Session,
  question: string,
  useSearch: boolean,
): Promise<Session> {
  const thread = [...session.thread, { role: 'user' as const, content: question }];
  const task: TaskKind = useSearch ? 'search' : session.task;
  const answer = await callChat(thread, task, {
    images: session.images,
    search: useSearch || session.searchDefault,
  });
  thread.push({ role: 'assistant', content: answer });
  return {
    ...session,
    thread,
    display: [
      ...session.display,
      { role: 'user', content: question },
      { role: 'assistant', content: answer },
    ],
  };
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

export async function summarize(length: SummaryLength): Promise<Session> {
  const ctx = requireChat();
  const title =
    length === 'curto' ? 'Resumo curto' : length === 'detalhado' ? 'Resumo detalhado' : 'Resumo da conversa';
  return startSession(title, buildSummaryPrompt(ctx, length), 'summarize');
}

export async function suggest(): Promise<Session> {
  const ctx = requireChat();
  const thread = [...buildSuggestPrompt(ctx)];
  const answer = await callChat(thread, 'suggest', { search: false });
  thread.push({ role: 'assistant', content: answer });
  const suggestions = answer
    .split('\n')
    .map((s) => s.replace(/^\s*[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 3);
  return { title: 'Sugestões de resposta', task: 'suggest', thread, display: [], suggestions };
}

export async function explain(row: HTMLElement): Promise<Session> {
  const target = parseRow(row);
  if (!target) throw new Error('Não consegui interpretar esta mensagem.');
  const rows = getMessageRows();
  const index = rows.indexOf(row);
  const ctx = readVisibleChat() ?? { chatName: '', isGroup: false, messages: [] };
  const window = index >= 0 ? contextWindow(rows, index, 15) : [target];
  return startSession('Explicar mensagem', buildExplainPrompt(ctx, target, window), 'explain');
}

export async function describeImage(row: HTMLElement): Promise<Session> {
  const image = await extractImage(row);
  if (!image) throw new Error('Abra a imagem uma vez para carregá-la e tente descrever de novo.');
  const target = parseRow(row);
  const ctx = readVisibleChat() ?? { chatName: '', isGroup: false, messages: [] };
  return startSession('Descrição da imagem', buildDescribeImagePrompt(ctx, target?.caption), 'explain', {
    images: [image],
  });
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
  const thread = buildTranscriptionSeed(res.text);
  return {
    title: 'Transcrição do áudio',
    task: 'explain',
    thread,
    display: [{ role: 'assistant', content: res.text }],
  };
}

export async function searchConversation(): Promise<Session> {
  const ctx = requireChat();
  return startSession('Pesquisa online', buildSearchConversationPrompt(ctx), 'search', {
    search: true,
  });
}

export async function searchMessage(row: HTMLElement): Promise<Session> {
  const target = parseRow(row);
  if (!target) throw new Error('Não consegui interpretar esta mensagem.');
  const ctx = readVisibleChat() ?? { chatName: '', isGroup: false, messages: [] };
  return startSession('Pesquisa online', buildSearchMessagePrompt(ctx, target), 'search', {
    search: true,
  });
}
