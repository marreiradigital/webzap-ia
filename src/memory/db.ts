import Dexie, { type Table } from 'dexie';
import type { Memory, InterviewTurn } from './schema';

// Banco local (IndexedDB via Dexie) na ORIGEM DA EXTENSAO. Como a pagina de memoria
// (chrome-extension://) e o background rodam na mesma origem, ambos compartilham este
// banco. O content script (origem web.whatsapp.com) NAO acessa direto — usa o
// background por mensagem. db.ts isola o Dexie atras de funcoes (troca futura por SQLite).

class WebzapMemoryDB extends Dexie {
  memories!: Table<Memory, number>;
  interview!: Table<InterviewTurn, number>;

  constructor() {
    super('webzap-memory');
    this.version(1).stores({
      memories: '++id, type, contact, origin, archived, updatedAt',
      interview: '++id, createdAt',
    });
  }
}

export const db = new WebzapMemoryDB();

function now(): number {
  return Date.now();
}

export async function addMemory(
  m: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<number> {
  const ts = now();
  return db.memories.add({ ...m, createdAt: ts, updatedAt: ts });
}

export async function updateMemory(id: number, patch: Partial<Memory>): Promise<void> {
  await db.memories.update(id, { ...patch, updatedAt: now() });
}

export async function deleteMemory(id: number): Promise<void> {
  await db.memories.delete(id);
}

export async function listMemories(): Promise<Memory[]> {
  return db.memories.orderBy('updatedAt').reverse().toArray();
}

/** Memorias ativas (nao arquivadas) — usadas na recuperacao para os prompts. */
export async function activeMemories(): Promise<Memory[]> {
  const all = await db.memories.toArray();
  return all.filter((m) => !m.archived);
}

/** Conjunto normalizado dos conteudos existentes — dedupe em lote com UMA leitura
 *  do banco (em vez de varrer a tabela inteira por item). */
export async function existingContents(): Promise<Set<string>> {
  const all = await db.memories.toArray();
  return new Set(all.map((m) => m.content.trim().toLowerCase()));
}

/** Evita duplicar memorias com o mesmo conteudo (usado no auto-treino). */
export async function memoryExists(content: string): Promise<boolean> {
  const set = await existingContents();
  return set.has(content.trim().toLowerCase());
}

// ---- Entrevista ----

export async function getInterview(): Promise<InterviewTurn[]> {
  return db.interview.orderBy('createdAt').toArray();
}

export async function addInterviewTurn(
  role: InterviewTurn['role'],
  content: string,
): Promise<void> {
  await db.interview.add({ role, content, createdAt: now() });
}

export async function clearInterview(): Promise<void> {
  await db.interview.clear();
}
