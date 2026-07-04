import { useEffect, useRef, useState, useCallback } from 'react';
import {
  prepSummary,
  prepExplain,
  prepDescribe,
  prepSearchConversation,
  prepSearchMessage,
  suggest,
  transcribe,
  followupInput,
  type Prep,
  type Session,
} from './actions';
import Panel, { type PanelData } from './Panel';
import { RobotIcon, MicIcon, ImageIcon, LightbulbIcon, SearchIcon } from './icons';
import { insertIntoComposer } from '@/src/wa/composer';
import { detectKind } from '@/src/wa/message-nodes';
import { setupMessageButtons } from '@/src/wa/inject-buttons';
import { readHeaderTitle } from '@/src/wa/chat-reader';
import { callBackground, streamChat, type StreamChatInput } from '@/src/messaging';
import {
  watchConfig,
  getConfig,
  updateConfig,
  DEFAULT_CONFIG,
  type FeatureToggles,
  type GenerationSettings,
} from '@/src/storage';
import type { SummaryLength } from '@/src/ai/prompts';
import type { MediaKind } from '@/src/wa/types';

interface Anchor {
  row: HTMLElement;
  rect: DOMRect;
}

const KIND_TITLE: Record<MediaKind, string> = {
  text: 'Esta mensagem',
  audio: 'Mensagem de áudio',
  image: 'Imagem',
  video: 'Vídeo',
  document: 'Documento',
  other: 'Esta mensagem',
};

export default function App() {
  const [features, setFeatures] = useState<FeatureToggles>(DEFAULT_CONFIG.features);
  const [generation, setGeneration] = useState<GenerationSettings>(DEFAULT_CONFIG.generation);
  const [chatKey, setChatKey] = useState('');
  const [panels, setPanels] = useState<Record<string, PanelData>>({});
  const [menu, setMenu] = useState<Anchor | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const chatKeyRef = useRef('');
  const genTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Config (features + geracao), com observacao de mudancas.
  useEffect(() => {
    getConfig().then((c) => {
      setFeatures(c.features);
      setGeneration(c.generation);
    });
    return watchConfig((c) => {
      setFeatures(c.features);
      setGeneration(c.generation);
    });
  }, []);

  // Rastreia a conversa aberta (pelo titulo do header). Cada conversa tem seu painel.
  useEffect(() => {
    const read = () => readHeaderTitle() ?? '';
    let last = read();
    chatKeyRef.current = last;
    setChatKey(last);
    const check = () => {
      const k = read();
      if (k !== last) {
        last = k;
        chatKeyRef.current = k;
        setChatKey(k);
        setMenu(null);
      }
    };
    const obs = new MutationObserver(check);
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    const iv = window.setInterval(check, 800);
    return () => {
      obs.disconnect();
      window.clearInterval(iv);
    };
  }, []);

  // Botoes injetados em cada mensagem (ancorados a bolha, rolam junto).
  useEffect(() => {
    if (!features.enabled || !features.perMessage) return;
    return setupMessageButtons((row, rect) => setMenu({ row, rect }));
  }, [features.enabled, features.perMessage]);

  // Esc fecha menus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFabOpen(false);
        setMenu(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  // Otimista: atualiza na hora (slider fluido) e persiste com debounce.
  const saveGeneration = useCallback((patch: Partial<GenerationSettings>) => {
    setGeneration((prev) => {
      const next = { ...prev, ...patch };
      if (genTimer.current) clearTimeout(genTimer.current);
      genTimer.current = setTimeout(() => {
        updateConfig((c) => ({ ...c, generation: next }));
      }, 250);
      return next;
    });
  }, []);

  // Transmite a resposta ao vivo para o painel da conversa `key`.
  function streamInto(key: string, input: StreamChatInput) {
    let acc = '';
    let started = false;
    streamChat(input, {
      onDelta: (t) => {
        acc += t;
        setPanels((p) => {
          const cur = p[key];
          if (!cur?.session) return p;
          const display = [...cur.session.display];
          if (!started) display.push({ role: 'assistant', content: acc });
          else display[display.length - 1] = { role: 'assistant', content: acc };
          return { ...p, [key]: { ...cur, loading: false, session: { ...cur.session, display } } };
        });
        started = true;
      },
      onDone: (full) => {
        const finalText = full || acc;
        setPanels((p) => {
          const cur = p[key];
          if (!cur?.session) return p;
          const display = [...cur.session.display];
          if (!started && finalText) display.push({ role: 'assistant', content: finalText });
          else if (display.length) display[display.length - 1] = { role: 'assistant', content: finalText };
          const thread = [...input.messages, { role: 'assistant' as const, content: finalText }];
          return { ...p, [key]: { ...cur, loading: false, session: { ...cur.session, thread, display } } };
        });
      },
      onError: (error) => {
        setPanels((p) => {
          const cur = p[key];
          if (!cur) return p;
          return { ...p, [key]: { ...cur, loading: false, error } };
        });
      },
    });
  }

  // Acao de chat com streaming (resumir/explicar/descrever/pesquisar).
  function runStream(thunk: () => Prep | Promise<Prep>, fallbackTitle: string) {
    setMenu(null);
    setFabOpen(false);
    const key = chatKeyRef.current;
    setPanels((p) => ({ ...p, [key]: { open: true, loading: true, title: fallbackTitle } }));
    Promise.resolve()
      .then(thunk)
      .then((prep) => {
        const session: Session = {
          title: prep.title,
          task: prep.task,
          thread: [...prep.thread],
          display: [],
          images: prep.images,
          searchDefault: prep.search,
          chatName: prep.chatName,
        };
        setPanels((p) => ({ ...p, [key]: { open: true, loading: true, title: prep.title, session } }));
        streamInto(key, {
          task: prep.task,
          messages: prep.thread,
          images: prep.images,
          search: prep.search,
          chatName: prep.chatName,
          usePersona: prep.usePersona,
        });
      })
      .catch((err) => {
        setPanels((p) => ({
          ...p,
          [key]: { open: true, loading: false, title: fallbackTitle, error: (err as Error).message },
        }));
      });
  }

  // Acao sem streaming (sugerir/transcrever).
  async function runSession(fallbackTitle: string, fn: () => Promise<Session>) {
    setMenu(null);
    setFabOpen(false);
    const key = chatKeyRef.current;
    setPanels((p) => ({ ...p, [key]: { open: true, loading: true, title: fallbackTitle } }));
    try {
      const session = await fn();
      setPanels((p) => ({ ...p, [key]: { open: true, loading: false, title: session.title, session } }));
    } catch (err) {
      setPanels((p) => ({
        ...p,
        [key]: { open: true, loading: false, title: fallbackTitle, error: (err as Error).message },
      }));
    }
  }

  function handleFollowup(question: string, useSearch: boolean) {
    const key = chatKeyRef.current;
    const cur = panels[key];
    if (!cur?.session) return;
    const session = cur.session;
    const input = followupInput(session, question, useSearch);
    setPanels((p) => ({
      ...p,
      [key]: {
        ...cur,
        loading: true,
        error: undefined,
        session: { ...session, display: [...session.display, { role: 'user', content: question }] },
      },
    }));
    streamInto(key, input);
  }

  function closePanel() {
    const key = chatKeyRef.current;
    setPanels((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
  }

  function useSuggestion(text: string) {
    const ok = insertIntoComposer(text);
    flash(ok ? 'Sugestão inserida no campo (revise e envie).' : 'Não achei o campo de mensagem.');
  }

  function runSummary(length: SummaryLength) {
    runStream(() => prepSummary(length), 'Resumo');
  }

  if (!features.enabled) return null;

  const menuKind: MediaKind = menu?.row ? detectKind(menu.row) : 'text';
  const current = panels[chatKey];

  return (
    <div className="wz-root">
      {/* Menu de acoes por mensagem (contextual ao tipo de midia) */}
      {menu && (
        <div
          className="wz-menu"
          style={{
            top: Math.min(window.innerHeight - 220, Math.max(8, menu.rect.top - 8)),
            left: Math.min(window.innerWidth - 250, Math.max(8, menu.rect.left - 210)),
          }}
        >
          <div className="wz-menu-title">{KIND_TITLE[menuKind]}</div>
          <button className="wz-menu-item" onClick={() => runStream(() => prepExplain(menu.row), 'Explicar mensagem')}>
            <LightbulbIcon /> Explicar do que se trata
          </button>
          {menuKind === 'audio' && (
            <button
              className="wz-menu-item"
              disabled={!features.transcribe}
              onClick={() => runSession('Transcrição do áudio', () => transcribe(menu.row))}
            >
              <MicIcon /> Transcrever áudio
            </button>
          )}
          {menuKind === 'image' && (
            <button className="wz-menu-item" onClick={() => runStream(() => prepDescribe(menu.row), 'Descrição da imagem')}>
              <ImageIcon /> Descrever imagem
            </button>
          )}
          <button className="wz-menu-item" onClick={() => runStream(() => prepSearchMessage(menu.row), 'Pesquisa online')}>
            <SearchIcon /> Pesquisar online
          </button>
          {(menuKind === 'video' || menuKind === 'document') && (
            <div className="wz-hint" style={{ padding: '4px 10px 8px' }}>
              {menuKind === 'video' ? 'Vídeo' : 'Documento'}: análise direta ainda não suportada — o
              "Explicar" usa a legenda e o contexto.
            </div>
          )}
        </div>
      )}

      {/* FAB principal */}
      <button
        className="wz-fab"
        title="WebZap - IA"
        aria-label="Abrir menu do WebZap - IA"
        onClick={() => setFabOpen((v) => !v)}
      >
        <RobotIcon size={26} />
      </button>

      {fabOpen && (
        <div className="wz-menu" style={{ right: 18, bottom: 150, position: 'fixed' }}>
          <div className="wz-menu-title">Conversa aberta</div>
          {features.summarize && (
            <>
              <button className="wz-menu-item" onClick={() => runSummary('curto')}>
                📝 Resumo curto
              </button>
              <button className="wz-menu-item" onClick={() => runSummary('medio')}>
                📄 Resumir conversa
              </button>
              <button className="wz-menu-item" onClick={() => runSummary('detalhado')}>
                📚 Resumo detalhado
              </button>
            </>
          )}
          {features.suggest && (
            <button className="wz-menu-item" onClick={() => runSession('Sugestões de resposta', () => suggest())}>
              ✨ Sugerir resposta
            </button>
          )}
          <button className="wz-menu-item" onClick={() => runStream(() => prepSearchConversation(), 'Pesquisa online')}>
            <SearchIcon /> Pesquisar online
          </button>
          <button
            className="wz-menu-item"
            onClick={() => {
              setFabOpen(false);
              callBackground({ kind: 'openMemory' });
            }}
          >
            🧠 Persona & Memória
          </button>
          <button
            className="wz-menu-item"
            onClick={() => {
              setFabOpen(false);
              callBackground({ kind: 'openOptions' });
            }}
          >
            ⚙️ Opções / provedores
          </button>
        </div>
      )}

      {/* Painel da conversa atual (cada conversa tem o seu) */}
      {current?.open && (
        <Panel
          chatName={chatKey || 'Conversa'}
          data={current}
          generation={generation}
          onClose={closePanel}
          onFollowup={handleFollowup}
          onUseSuggestion={useSuggestion}
          onGeneration={saveGeneration}
          onCopy={(t) => {
            navigator.clipboard.writeText(t);
            flash('Copiado.');
          }}
        />
      )}

      {toast && (
        <div
          className="wz-menu"
          style={{ left: '50%', bottom: 24, transform: 'translateX(-50%)', padding: '12px 16px' }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
