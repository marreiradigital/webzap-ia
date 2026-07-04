import type { Memory, MemoryType } from './schema';

// Recupera as memorias mais relevantes para um contexto e monta o "perfil" que vai
// como system no prompt. Estrategia leve: tipo + match de contato + palavras-chave +
// recencia (sem embeddings por enquanto — ver .claude/SDD/persona-memory.md).

const STOPWORDS = new Set([
  'a', 'o', 'os', 'as', 'de', 'da', 'do', 'e', 'que', 'para', 'com', 'um', 'uma',
  'no', 'na', 'em', 'por', 'se', 'me', 'meu', 'minha', 'eu', 'ele', 'ela',
]);

function tokenize(text?: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function scoreMemory(m: Memory, contact: string | undefined, queryWords: string[]): number {
  let score = 0;
  // Persona/preferencia/estilo sao sempre relevantes (perfil base).
  if (m.type === 'persona' || m.type === 'preference' || m.type === 'style') score += 2;
  // Nota de contato so importa se casar com o contato atual.
  if (m.type === 'contact') {
    if (contact && m.contact && m.contact.toLowerCase() === contact) score += 4;
    else score -= 3;
  }
  // Sobreposicao de palavras-chave.
  if (queryWords.length) {
    const mem = tokenize(m.content);
    const overlap = mem.filter((w) => queryWords.includes(w)).length;
    score += Math.min(overlap, 4);
  }
  return score;
}

export function selectRelevant(
  memories: Memory[],
  opts: { contact?: string; query?: string; limit?: number } = {},
): Memory[] {
  const limit = opts.limit ?? 12;
  const contact = opts.contact?.toLowerCase();
  const queryWords = tokenize(opts.query);
  return memories
    .filter((m) => !m.archived)
    .map((m) => ({ m, s: scoreMemory(m, contact, queryWords) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (b.m.updatedAt ?? 0) - (a.m.updatedAt ?? 0))
    .slice(0, limit)
    .map((x) => x.m);
}

const TYPE_HEADING: Record<MemoryType, string> = {
  persona: 'Sobre o usuario',
  preference: 'Preferencias e regras dele',
  style: 'Como ele costuma escrever',
  contact: 'Sobre este contato/grupo',
};

/** Monta o system com o perfil do usuario a partir das memorias selecionadas. */
export function personaSystemPrompt(memories: Memory[]): string | null {
  if (!memories.length) return null;
  const groups = new Map<MemoryType, string[]>();
  for (const m of memories) {
    const arr = groups.get(m.type) ?? [];
    arr.push(m.content.trim());
    groups.set(m.type, arr);
  }
  const parts: string[] = [
    'Perfil do usuario (use para responder no lugar dele, com o tom e o contexto dele):',
  ];
  (['persona', 'preference', 'style', 'contact'] as MemoryType[]).forEach((type) => {
    const items = groups.get(type);
    if (items?.length) {
      parts.push(`\n${TYPE_HEADING[type]}:`);
      items.forEach((i) => parts.push(`- ${i}`));
    }
  });
  return parts.join('\n');
}
