import { useEffect, useRef, useState, useCallback } from 'react';
import { HOST_TAG } from './constants';
import {
  prepSummary,
  prepExplain,
  prepDescribe,
  prepSearchConversation,
  prepSearchMessage,
  suggest,
  transcribeText,
  learnFromChat,
  followupInput,
  type Prep,
  type Session,
} from './actions';
import Panel, { type PanelData } from './Panel';
import { RobotIcon, StarsIcon, MicIcon, ImageIcon, LightbulbIcon, SearchIcon } from './icons';
import { insertIntoComposer, sendMessage } from '@/src/wa/composer';
import { detectKind } from '@/src/wa/message-nodes';
import { setupAutoReplyWatcher, type IncomingInfo } from '@/src/wa/auto-reply';
import { readHeaderTitle, readVisibleChat } from '@/src/wa/chat-reader';
import { callBackground, streamChat, type StreamChatInput } from '@/src/messaging';
import {
  watchConfig,
  getConfig,
  updateConfig,
  DEFAULT_CONFIG,
  type FeatureToggles,
  type GenerationSettings,
  type AutoReplyMode,
} from '@/src/storage';
import { buildAutoReplyPrompt, type SummaryLength } from '@/src/ai/prompts';
import type { MediaKind } from '@/src/wa/types';

const AUTO_MODES: { id: AutoReplyMode; label: string }[] = [
  { id: 'off', label: 'Desligada' },
  { id: 'suggest', label: 'Sugerir no painel' },
  { id: 'draft', label: 'Rascunho (revisar)' },
  { id: 'autosend', label: 'Auto-enviar ⚠️' },
];

/** Em grupo, a mensagem parece direcionada ao usuario? (@ ou nome/apelido configurado). */
function isDirectedToMe(text: string, mentions: string): boolean {
  if (text.includes('@')) return true;
  const words = mentions
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!words.length) return false;
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w));
}

interface Anchor {
  row: HTMLElement;
  rect: DOMRect;
}

interface InlineResult {
  id: number;
  anchor: HTMLElement;
  loading: boolean;
  text?: string;
  error?: string;
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
  const [hover, setHover] = useState<{ el: HTMLElement; out: boolean } | null>(null);
  const [inlineResults, setInlineResults] = useState<InlineResult[]>([]);
  const [, forceTick] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inlineIdRef = useRef(0);
  const [fabOpen, setFabOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [autoByChat, setAutoByChat] = useState<Record<string, AutoReplyMode>>({});
  const [autoSuggestion, setAutoSuggestion] = useState<string | null>(null);
  const [warnAutosend, setWarnAutosend] = useState(false);
  const [autoTrain, setAutoTrain] = useState(false);
  const [autoMentions, setAutoMentions] = useState('');
  const mentionsRef = useRef('');
  mentionsRef.current = autoMentions;
  const chatKeyRef = useRef('');
  const genTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRef = useRef(autoByChat);
  const enabledRef = useRef(features.enabled);
  const learnedRef = useRef<Set<string>>(new Set());
  autoRef.current = autoByChat;
  enabledRef.current = features.enabled;

  // Config (features + geracao), com observacao de mudancas.
  useEffect(() => {
    getConfig().then((c) => {
      setFeatures(c.features);
      setGeneration(c.generation);
      setAutoByChat(c.autoReply.byChat);
      setAutoMentions(c.autoReply.mentions);
      setAutoTrain(c.autoTrain);
    });
    return watchConfig((c) => {
      setFeatures(c.features);
      setGeneration(c.generation);
      setAutoByChat(c.autoReply.byChat);
      setAutoMentions(c.autoReply.mentions);
      setAutoTrain(c.autoTrain);
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

  // Botao de acoes ancorado a bolha sob o cursor (overlay no shadow root: nao
  // conflita com o React do WhatsApp, fica colado na mensagem).
  useEffect(() => {
    if (!features.enabled || !features.perMessage) return;
    function onMove(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t?.tagName) return;
      if (t.tagName.toLowerCase() === HOST_TAG) {
        if (hideTimer.current) clearTimeout(hideTimer.current); // sobre a nossa UI
        return;
      }
      const main = document.getElementById('main');
      const container = t.closest?.('[data-id]') as HTMLElement | null;
      const id = container?.getAttribute('data-id') ?? '';
      const isMsg = /^(true|false)_/.test(id);
      if (main && container && isMsg && main.contains(container)) {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setHover({ el: container, out: id.startsWith('true_') });
      } else {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setHover(null), 250);
      }
    }
    document.addEventListener('mousemove', onMove, { passive: true });
    return () => document.removeEventListener('mousemove', onMove);
  }, [features.enabled, features.perMessage]);

  // Reposiciona o botao de hover e as caixas inline conforme a rolagem.
  useEffect(() => {
    if (!hover && inlineResults.length === 0) return;
    const onScroll = () => forceTick((n) => n + 1);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [hover, inlineResults.length]);

  // Watcher de auto-resposta (le refs para nao ficar com estado velho).
  useEffect(() => {
    if (!features.enabled) return;
    return setupAutoReplyWatcher(
      () => enabledRef.current,
      (info) => void onIncoming(info),
    );
  }, [features.enabled]);

  // Auto-treino: aprende uma vez por conversa ao abrir (quando ligado).
  useEffect(() => {
    if (!features.enabled || !autoTrain || !chatKey) return;
    if (learnedRef.current.has(chatKey)) return;
    learnedRef.current.add(chatKey);
    const t = window.setTimeout(() => {
      learnFromChat()
        .then((n) => {
          if (n) flash(`Aprendi ${n} memória(s) desta conversa.`);
        })
        .catch(() => {});
    }, 4000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatKey, autoTrain, features.enabled]);

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

  // ---- Auto-resposta ----
  async function onIncoming(info: IncomingInfo) {
    const key = chatKeyRef.current;
    const mode = autoRef.current[key] ?? 'off';
    if (mode === 'off') return;
    if (info.isGroup && !isDirectedToMe(info.text, mentionsRef.current)) return; // grupo: so quando direcionado
    const ctx = readVisibleChat();
    if (!ctx || ctx.messages.length === 0) return;
    const res = await callBackground({
      kind: 'chat',
      task: 'suggest',
      messages: buildAutoReplyPrompt(ctx),
      usePersona: true,
      chatName: ctx.chatName,
    });
    if (!res.ok) return; // silencioso: nao atrapalha a conversa
    const reply = res.text.trim();
    if (!reply || reply.toUpperCase().includes('[SKIP]')) return;
    if (mode === 'suggest') {
      setAutoSuggestion(reply);
    } else if (mode === 'draft') {
      insertIntoComposer(reply);
      flash('Rascunho de resposta inserido — revise e envie.');
    } else if (mode === 'autosend') {
      sendMessage(reply);
      flash('Resposta enviada automaticamente.');
    }
  }

  function persistAutoMode(key: string, mode: AutoReplyMode) {
    setAutoByChat((prev) => ({ ...prev, [key]: mode }));
    updateConfig((c) => ({
      ...c,
      autoReply: { ...c.autoReply, byChat: { ...c.autoReply.byChat, [key]: mode } },
    }));
  }

  function setAutoMode(mode: AutoReplyMode) {
    const key = chatKeyRef.current;
    if (mode === 'autosend' && (autoByChat[key] ?? 'off') !== 'autosend') {
      setFabOpen(false);
      setWarnAutosend(true);
      return;
    }
    persistAutoMode(key, mode);
    setFabOpen(false);
  }

  function runLearn() {
    setFabOpen(false);
    flash('Aprendendo desta conversa…');
    learnFromChat()
      .then((n) => flash(n ? `Aprendi ${n} memória(s).` : 'Nada novo para aprender.'))
      .catch((err) => flash((err as Error).message));
  }

  // Transcricao aparece numa caixinha embaixo da propria bolha (nao no painel).
  function runTranscribeInline(row: HTMLElement) {
    setMenu(null);
    const id = (inlineIdRef.current += 1);
    setInlineResults((r) => [...r, { id, anchor: row, loading: true }]);
    transcribeText(row)
      .then((text) =>
        setInlineResults((r) => r.map((x) => (x.id === id ? { ...x, loading: false, text } : x))),
      )
      .catch((err) =>
        setInlineResults((r) =>
          r.map((x) => (x.id === id ? { ...x, loading: false, error: (err as Error).message } : x)),
        ),
      );
  }

  function closeInline(id: number) {
    setInlineResults((r) => r.filter((x) => x.id !== id));
  }

  function runSummary(length: SummaryLength) {
    runStream(() => prepSummary(length), 'Resumo');
  }

  if (!features.enabled) return null;

  const menuKind: MediaKind = menu?.row ? detectKind(menu.row) : 'text';
  const current = panels[chatKey];
  const autoMode = autoByChat[chatKey] ?? 'off';

  return (
    <div className="wz-root">
      {/* Botao de acoes ancorado a bolha sob o cursor */}
      {hover &&
        features.perMessage &&
        (() => {
          const rect = hover.el.getBoundingClientRect();
          if (rect.height === 0) return null;
          const top = Math.max(6, Math.min(window.innerHeight - 32, rect.top + rect.height / 2 - 13));
          const left = hover.out
            ? Math.max(6, rect.left - 32)
            : Math.min(window.innerWidth - 32, rect.right + 6);
          return (
            <button
              className="wz-hover-btn"
              style={{ top, left }}
              title="Ações de IA nesta mensagem"
              onClick={() => {
                const row = (hover.el.closest('div[role="row"]') as HTMLElement) ?? hover.el;
                setMenu({ row, rect });
              }}
            >
              <StarsIcon size={15} />
            </button>
          );
        })()}

      {/* Caixas de transcricao inline (embaixo da bolha) */}
      {inlineResults.map((res) => {
        if (!res.anchor.isConnected) return null;
        const rect = res.anchor.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return null;
        const left = Math.max(8, Math.min(window.innerWidth - 320, rect.left));
        return (
          <div
            key={res.id}
            className="wz-inline"
            style={{ top: rect.bottom + 4, left, maxWidth: Math.min(380, window.innerWidth - 16) }}
          >
            <div className="wz-inline-head">
              <span>🎙️ Transcrição</span>
              <button className="wz-inline-close" title="Fechar" onClick={() => closeInline(res.id)}>
                ✕
              </button>
            </div>
            <div className="wz-inline-body">
              {res.loading && (
                <span>
                  <span className="wz-spinner" /> Transcrevendo…
                </span>
              )}
              {res.error && <span className="wz-error">{res.error}</span>}
              {res.text && <span>{res.text}</span>}
            </div>
          </div>
        );
      })}

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
              onClick={() => runTranscribeInline(menu.row)}
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
        title={autoMode === 'off' ? 'WebZap - IA' : `WebZap - IA — auto-resposta: ${autoMode}`}
        aria-label="Abrir menu do WebZap - IA"
        onClick={() => setFabOpen((v) => !v)}
      >
        <RobotIcon size={26} />
        {autoMode !== 'off' && (
          <span className={`wz-fab-badge ${autoMode === 'autosend' ? 'wz-fab-badge-danger' : ''}`} />
        )}
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

          <div className="wz-menu-title">Auto-resposta (esta conversa)</div>
          {AUTO_MODES.map((m) => (
            <button
              key={m.id}
              className={`wz-menu-item ${autoMode === m.id ? 'wz-active' : ''}`}
              onClick={() => setAutoMode(m.id)}
            >
              {autoMode === m.id ? '● ' : '○ '}
              {m.label}
            </button>
          ))}

          <button className="wz-menu-item" onClick={runLearn}>
            📚 Aprender desta conversa
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

      {/* Cartao de sugestao de auto-resposta (modo "sugerir") */}
      {autoSuggestion && (
        <div className="wz-autocard">
          <div className="wz-autocard-head">🤖 Resposta sugerida</div>
          <div className="wz-autocard-body">{autoSuggestion}</div>
          <div className="wz-autocard-foot">
            <button className="wz-btn" onClick={() => setAutoSuggestion(null)}>
              Ignorar
            </button>
            <button
              className="wz-btn wz-btn-primary"
              onClick={() => {
                insertIntoComposer(autoSuggestion);
                setAutoSuggestion(null);
                flash('Inserido no campo (revise e envie).');
              }}
            >
              Inserir
            </button>
          </div>
        </div>
      )}

      {/* Aviso ao ativar auto-envio */}
      {warnAutosend && (
        <div className="wz-modal-backdrop">
          <div className="wz-modal">
            <div className="wz-modal-title">⚠️ Ativar auto-envio?</div>
            <div className="wz-modal-body">
              Neste modo a IA vai <strong>enviar mensagens sozinha</strong> nesta conversa quando
              achar que deve responder. Isso pode <strong>violar os Termos do WhatsApp</strong> e
              resultar em <strong>bloqueio da conta</strong>. Use por sua conta e risco.
            </div>
            <div className="wz-modal-foot">
              <button className="wz-btn" onClick={() => setWarnAutosend(false)}>
                Cancelar
              </button>
              <button
                className="wz-btn wz-btn-primary"
                onClick={() => {
                  persistAutoMode(chatKeyRef.current, 'autosend');
                  setWarnAutosend(false);
                }}
              >
                Entendo o risco, ativar
              </button>
            </div>
          </div>
        </div>
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
