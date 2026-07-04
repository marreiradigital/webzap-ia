import type { ChatMessage } from '@/src/providers/types';
import type { InterviewTurn, MemoryType } from './schema';

// Conduz a entrevista (a IA faz perguntas) e extrai memorias estruturadas das
// respostas. Ver .claude/SDD/persona-memory.md

const INTERVIEW_SYSTEM = `Voce entrevista o usuario para aprender sobre ele e como ele se comunica no WhatsApp, para depois ajudar a responder no lugar dele. Faca UMA pergunta por vez, curta e amigavel, em portugues do Brasil. Cubra aos poucos, sem repetir o que ja foi respondido: quem ele e, como costuma responder, tom/estilo, assuntos a evitar, contatos e grupos importantes e como falar em cada um. Responda apenas com a proxima pergunta.`;

export const INTERVIEW_OPENING =
  'Oi! Vou te fazer algumas perguntas rápidas pra aprender seu estilo e te ajudar a responder no WhatsApp. Pra começar: você prefere que eu fale por você de forma mais formal ou informal? E tem algum nome/apelido que eu devo usar?';

export function nextQuestionMessages(history: InterviewTurn[]): ChatMessage[] {
  const msgs: ChatMessage[] = [{ role: 'system', content: INTERVIEW_SYSTEM }];
  for (const t of history) {
    msgs.push({ role: t.role, content: t.content });
  }
  msgs.push({
    role: 'user',
    content: '(Continue a entrevista: faça a próxima pergunta relevante, apenas a pergunta.)',
  });
  return msgs;
}

export function extractMemoriesMessages(question: string, answer: string): ChatMessage[] {
  const system = `Extraia fatos duraveis sobre o usuario a partir da resposta dele, para memoria de longo prazo. Responda APENAS com um array JSON valido, sem nenhum texto fora do JSON. Cada item: {"type":"persona|preference|style|contact","content":"frase curta e clara sobre o usuario","contact":"nome do contato/grupo, se aplicavel"}. Use 'persona' para fatos sobre ele, 'preference' para preferencias/regras, 'style' para jeito de escrever, 'contact' para algo especifico de um contato/grupo. Se nao houver nada duravel, responda [].`;
  const user = `Pergunta: ${question}\nResposta do usuario: ${answer}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export interface ExtractedMemory {
  type: MemoryType;
  content: string;
  contact?: string;
}

const VALID_TYPES: MemoryType[] = ['persona', 'preference', 'style', 'contact'];

export function parseMemories(text: string): ExtractedMemory[] {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start < 0 || end < 0) return [];
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (x) =>
          x && typeof x.content === 'string' && VALID_TYPES.includes(x.type as MemoryType),
      )
      .map((x) => ({
        type: x.type as MemoryType,
        content: String(x.content).trim(),
        contact: x.contact ? String(x.contact).trim() : undefined,
      }))
      .filter((x) => x.content);
  } catch {
    return [];
  }
}
