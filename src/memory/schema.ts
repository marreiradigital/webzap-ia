// Tipos do subsistema de memoria (Persona & Memoria). Ver .claude/SDD/persona-memory.md

export type MemoryType = 'persona' | 'preference' | 'contact' | 'style';

export type MemoryOrigin = 'manual' | 'entrevista' | 'auto-train';

export interface Memory {
  id?: number;
  /** persona = fatos sobre o usuario; preference = tom/o que fazer/evitar;
   *  contact = contexto de um contato/grupo; style = exemplo de como ele escreve. */
  type: MemoryType;
  content: string;
  /** Nome do contato/grupo, para memorias do tipo 'contact'. */
  contact?: string;
  tags?: string[];
  origin: MemoryOrigin;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Turno do chat de entrevista (persistido para retomar a conversa). */
export interface InterviewTurn {
  id?: number;
  role: 'assistant' | 'user';
  content: string;
  createdAt: number;
}

export const MEMORY_TYPE_LABEL: Record<MemoryType, string> = {
  persona: 'Sobre você',
  preference: 'Preferências',
  contact: 'Contatos/Grupos',
  style: 'Estilo de escrita',
};
