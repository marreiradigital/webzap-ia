import { useEffect, useRef, useState, type ReactNode } from 'react';
import { callBackground } from '@/src/messaging';
import {
  addInterviewTurn,
  addMemory,
  clearInterview,
  deleteMemory,
  getInterview,
  listMemories,
  memoryExists,
  updateMemory,
} from '@/src/memory/db';
import {
  INTERVIEW_OPENING,
  extractMemoriesMessages,
  nextQuestionMessages,
  parseMemories,
} from '@/src/memory/interviewer';
import { MEMORY_TYPE_LABEL, type Memory, type InterviewTurn, type MemoryType } from '@/src/memory/schema';
import type { ChatMessage } from '@/src/providers/types';

async function askAI(messages: ChatMessage[]): Promise<string> {
  const res = await callBackground({ kind: 'chat', task: 'explain', messages, raw: true });
  if (!res.ok) throw new Error(res.error);
  return res.text;
}

/** Embedding do texto para busca semantica (undefined se nao houver provedor). */
async function embedText(text: string): Promise<number[] | undefined> {
  const res = await callBackground({ kind: 'embed', texts: [text] });
  return res.ok ? res.vectors?.[0] : undefined;
}

type Tab = 'entrevista' | 'memorias';

export default function MemoryApp() {
  const [tab, setTab] = useState<Tab>('entrevista');

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Persona & Memória</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Ensine a IA sobre você para respostas e sugestões mais suas. Tudo fica só no seu
            navegador.
          </p>
        </header>

        <div className="mb-6 inline-flex rounded-xl border border-neutral-200 p-1 dark:border-neutral-800">
          <TabButton active={tab === 'entrevista'} onClick={() => setTab('entrevista')}>
            Entrevista
          </TabButton>
          <TabButton active={tab === 'memorias'} onClick={() => setTab('memorias')}>
            Memórias
          </TabButton>
        </div>

        {tab === 'entrevista' ? <Interview /> : <Memories />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-emerald-600 text-white'
          : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
      }`}
    >
      {children}
    </button>
  );
}

function Interview() {
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  useEffect(() => {
    (async () => {
      let list = await getInterview();
      if (list.length === 0 && !seeded.current) {
        seeded.current = true;
        await addInterviewTurn('assistant', INTERVIEW_OPENING);
        list = await getInterview();
      }
      setTurns(list);
    })();
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [turns.length, busy]);

  async function send() {
    const answer = input.trim();
    if (!answer || busy) return;
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const lastQuestion = [...turns].reverse().find((t) => t.role === 'assistant')?.content ?? '';
      await addInterviewTurn('user', answer);
      const history = await getInterview();
      setTurns(history);

      // Extracao de memorias e proxima pergunta sao independentes: rodam em
      // PARALELO (antes eram sequenciais e dobravam a espera de cada turno).
      const [extractedRaw, question] = await Promise.all([
        askAI(extractMemoriesMessages(lastQuestion, answer)).catch(() => ''),
        askAI(nextQuestionMessages(history)),
      ]);

      await addInterviewTurn('assistant', question.trim());
      setTurns(await getInterview());

      // Salva memorias extraidas (best-effort; nao bloqueia a entrevista).
      try {
        const mems = parseMemories(extractedRaw);
        let saved = 0;
        for (const m of mems) {
          if (!(await memoryExists(m.content))) {
            const embedding = await embedText(m.content);
            await addMemory({ type: m.type, content: m.content, contact: m.contact, origin: 'entrevista', embedding });
            saved++;
          }
        }
        if (saved) setSavedCount((c) => c + saved);
      } catch {
        /* extracao e best-effort */
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    await clearInterview();
    seeded.current = true;
    await addInterviewTurn('assistant', INTERVIEW_OPENING);
    setTurns(await getInterview());
    setSavedCount(0);
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 text-xs text-neutral-500 dark:border-neutral-800">
        <span>{savedCount > 0 ? `${savedCount} memória(s) aprendida(s) nesta sessão` : 'A IA vai te entrevistar'}</span>
        <button onClick={restart} className="hover:text-emerald-600">
          Reiniciar
        </button>
      </div>
      <div ref={bodyRef} className="h-[52vh] space-y-3 overflow-y-auto p-4">
        {turns.map((t) => (
          <div key={t.id} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                t.role === 'user'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800'
              }`}
            >
              {t.content}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm text-neutral-400">Pensando…</div>}
        {error && <div className="text-sm text-rose-500">{error}</div>}
      </div>
      <div className="flex items-end gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
        <textarea
          rows={1}
          className="max-h-32 flex-1 resize-none rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          placeholder="Sua resposta…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || busy}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

function Memories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setMemories(await listMemories());
    setLoading(false);
  }
  useEffect(() => {
    reload();
  }, []);

  async function add(type: MemoryType) {
    await addMemory({ type, content: 'Nova memória (edite)', origin: 'manual' });
    reload();
  }

  const types: MemoryType[] = ['persona', 'preference', 'style', 'contact'];

  if (loading) return <div className="text-neutral-500">Carregando…</div>;

  return (
    <div className="space-y-6">
      {memories.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Nenhuma memória ainda. Faça a entrevista ou adicione manualmente abaixo.
        </div>
      )}
      {types.map((type) => {
        const items = memories.filter((m) => m.type === type);
        return (
          <section key={type}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                {MEMORY_TYPE_LABEL[type]}
              </h2>
              <button onClick={() => add(type)} className="text-xs text-emerald-600 hover:underline">
                + adicionar
              </button>
            </div>
            <div className="space-y-2">
              {items.length === 0 && <p className="text-xs text-neutral-400">—</p>}
              {items.map((m) => (
                <MemoryCard key={m.id} memory={m} onChange={reload} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MemoryCard({ memory, onChange }: { memory: Memory; onChange: () => void }) {
  const [content, setContent] = useState(memory.content);

  return (
    <div
      className={`rounded-xl border p-3 ${
        memory.archived
          ? 'border-neutral-200 bg-neutral-100 opacity-60 dark:border-neutral-800 dark:bg-neutral-900'
          : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
      }`}
    >
      <textarea
        rows={2}
        className="w-full resize-none rounded-lg border border-transparent bg-transparent text-sm focus:border-neutral-300 focus:bg-neutral-50 focus:p-2 dark:focus:border-neutral-700 dark:focus:bg-neutral-950"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={async () => {
          if (content.trim() && content !== memory.content) {
            const embedding = await embedText(content.trim());
            await updateMemory(memory.id!, { content: content.trim(), embedding });
            onChange();
          }
        }}
      />
      <div className="mt-1 flex items-center gap-3 text-xs text-neutral-400">
        {memory.contact && <span>📌 {memory.contact}</span>}
        <span>origem: {memory.origin}</span>
        <span className="flex-1" />
        <button
          onClick={() => updateMemory(memory.id!, { archived: !memory.archived }).then(onChange)}
          className="hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          {memory.archived ? 'Reativar' : 'Arquivar'}
        </button>
        <button
          onClick={() => deleteMemory(memory.id!).then(onChange)}
          className="text-rose-500 hover:text-rose-600"
        >
          Apagar
        </button>
      </div>
    </div>
  );
}
