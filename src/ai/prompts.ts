import type { ChatMessage } from '@/src/providers/types';
import type { ChatContext, WaMessage } from '@/src/wa/types';

// Templates de prompt (fonte unica). Toda a UI em pt-BR; as respostas da IA tambem.

const LANG_INSTRUCTION =
  'Responda sempre em portugues do Brasil, com acentuacao correta, de forma clara e natural.';

function renderTranscript(messages: WaMessage[], limit = 200): string {
  return messages
    .slice(-limit)
    .map((m) => {
      const who = m.direction === 'out' ? 'Eu' : m.author || 'Contato';
      const body = m.kind && m.kind !== 'text' && !m.text ? `[${m.kind}]` : m.text;
      return `${who}: ${body}`;
    })
    .join('\n');
}

export type SummaryLength = 'curto' | 'medio' | 'detalhado';

export function buildSummaryPrompt(
  ctx: ChatContext,
  length: SummaryLength = 'medio',
): ChatMessage[] {
  const escopo = ctx.isGroup
    ? `um grupo chamado "${ctx.chatName}"`
    : `uma conversa privada com "${ctx.chatName}"`;
  const tamanho =
    length === 'curto'
      ? 'Seja bem conciso: 3 a 5 bullets no maximo.'
      : length === 'detalhado'
        ? 'Traga um resumo detalhado, cobrindo os principais topicos, decisoes e pendencias.'
        : 'Resuma em bullets objetivos, destacando os pontos principais.';

  const system = `Voce e um assistente que resume conversas de WhatsApp. ${LANG_INSTRUCTION} Nao invente informacoes que nao estejam na conversa.`;
  const user = `Resuma a conversa a seguir de ${escopo}. ${tamanho}
Se houver perguntas em aberto, tarefas ou combinados, liste-os separadamente ao final em "Pendencias".

Conversa:
"""
${renderTranscript(ctx.messages)}
"""`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

const KIND_LABEL: Record<string, string> = {
  audio: 'uma mensagem de áudio',
  image: 'uma imagem',
  video: 'um vídeo',
  document: 'um documento',
  other: 'uma mídia',
};

export function buildExplainPrompt(
  ctx: ChatContext,
  target: WaMessage,
  contextWindow: WaMessage[],
): ChatMessage[] {
  const system = `Voce ajuda a entender mensagens de WhatsApp. Explique de forma breve do que se trata a mensagem, considerando o contexto anterior. ${LANG_INSTRUCTION}`;
  const alvo = target.text
    ? `esta mensagem${target.author ? ` de ${target.author}` : ''}:\n"${target.text}"`
    : `${KIND_LABEL[target.kind] ?? 'esta mensagem'}${target.author ? ` enviada por ${target.author}` : ''} (sem texto), considerando o contexto`;
  const user = `Contexto recente:
"""
${renderTranscript(contextWindow, 15)}
"""

Explique do que se trata ${alvo}.
Se houver termos, siglas ou referencias que mereçam esclarecimento, comente brevemente.`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/** Prompt para descrever/analisar uma imagem (enviada junto como anexo de visao). */
export function buildDescribeImagePrompt(
  ctx: ChatContext,
  caption?: string,
): ChatMessage[] {
  const system = `Voce descreve imagens enviadas no WhatsApp. Diga de forma clara o que a imagem mostra e, se houver texto na imagem, transcreva-o. ${LANG_INSTRUCTION}`;
  const user = caption
    ? `Descreva a imagem a seguir. Legenda enviada junto: "${caption}".`
    : 'Descreva a imagem a seguir: o que ela mostra e, se tiver texto, transcreva.';
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export function buildSuggestPrompt(ctx: ChatContext): ChatMessage[] {
  const escopo = ctx.isGroup ? `no grupo "${ctx.chatName}"` : `com "${ctx.chatName}"`;
  const system = `Voce sugere respostas para o usuario enviar no WhatsApp. Gere de 2 a 3 opcoes curtas, em tom natural e adequado ao contexto, como se fosse o proprio usuario respondendo. ${LANG_INSTRUCTION} Retorne apenas as opcoes, uma por linha, sem numeracao nem aspas.`;
  const user = `Baseie-se na conversa ${escopo} abaixo e sugira o que eu (Eu) poderia responder agora:
"""
${renderTranscript(ctx.messages, 40)}
"""`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
