import { useEffect, useRef, useState, useCallback } from 'react';
import {
  prepSummary,
  prepExplain,
  prepDescribe,
  prepTranslate,
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
import { RobotIcon, MicIcon, ImageIcon, LightbulbIcon, SearchIcon } from './icons';
import { insertIntoComposer, sendMessage, getComposer, getComposerText } from '@/src/wa/composer';
import { detectKind } from '@/src/wa/message-nodes';
import { setupMessageButtons } from '@/src/wa/inject-buttons';
import { setupAutoReplyWatcher, type IncomingInfo } from '@/src/wa/auto-reply';
import { readHeaderTitle, readVisibleChat } from '@/src/wa/chat-reader';
import { blobToBase64 } from '@/src/lib/binary';
import { buildTranslateTextPrompt, buildImproveTextPrompt } from '@/src/ai/prompts';
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Em grupo, a mensagem parece direcionada ao usuario? Nome/apelido configurado
 *  casa como PALAVRA INTEIRA ("chefe" nao casa com "chefeteria"), com ou sem @.
 *  Sem apelidos configurados, mantem a heuristica de qualquer @. */
function isDirectedToMe(text: string, mentions: string): boolean {
  const words = mentions
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!words.length) return text.includes('@');
  return words.some((w) =>
    new RegExp(`(^|[^\\p{L}\\p{N}])@?${escapeRegExp(w)}($|[^\\p{L}\\p{N}])`, 'iu').test(text),
  );
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
  const [inlineResults, setInlineResults] = useState<InlineResult[]>([]);
  const [, forceTick] = useState(0);
  const inlineIdRef = useRef(0);
  const [fabOpen, setFabOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [autoByChat, setAutoByChat] = useState<Record<string, AutoReplyMode>>({});
  const [autoSuggestion, setAutoSuggestion] = useState<{ chat: string; text: string } | null>(null);
  const [warnAutosend, setWarnAutosend] = useState(false);
  const [autoTrain, setAutoTrain] = useState(false);
  const [recording, setRecording] = useState(false);
  const [toolBusy, setToolBusy] = useState<string | null>(null);
  const recRef = useRef<{ rec: MediaRecorder; stream: MediaStream } | null>(null);
  const [autoMentions, setAutoMentions] = useState('');
  const mentionsRef = useRef('');
  mentionsRef.current = autoMentions;
  const chatKeyRef = useRef('');
  const genTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRef = useRef(autoByChat);
  const enabledRef = useRef(features.enabled);
  const learnedRef = useRef<Set<string>>(new Set());
  const autoCooldownRef = useRef(0);
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
    // rAF coalesce: o WhatsApp muta o DOM constantemente; varias mutacoes num
    // frame viram UMA checagem (e sem characterData, que disparava a cada texto).
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        check();
      });
    };
    const obs = new MutationObserver(schedule);
    obs.observe(document.body, { subtree: true, childList: true });
    const iv = window.setInterval(check, 800);
    return () => {
      obs.disconnect();
      window.clearInterval(iv);
    };
  }, []);

  // Botao de acoes injetado em cada bolha (aparece no hover da mensagem).
  useEffect(() => {
    if (!features.enabled || !features.perMessage) return;
    return setupMessageButtons((anchor, rect) => {
      // Entrega a LINHA da mensagem: parseRow/contextWindow dependem dela para
      // achar o indice e montar o contexto (a bolha sozinha perdia o contexto).
      const row = (anchor.closest('div[role="row"]') as HTMLElement) ?? anchor;
      setMenu({ row, rect });
    });
  }, [features.enabled, features.perMessage]);

  // Reposiciona as caixas inline conforme a rolagem.
  useEffect(() => {
    if (inlineResults.length === 0) return;
    const onScroll = () => forceTick((n) => n + 1);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [inlineResults.length]);

  // Mantem a barra de ferramentas do campo na posicao (o campo aparece/some ao
  // abrir/fechar conversa). So re-renderiza quando a posicao do campo MUDA —
  // um tick incondicional a cada 700ms re-renderizava o App inteiro para sempre.
  const composerSigRef = useRef('');
  useEffect(() => {
    if (!features.enabled) return;
    const iv = window.setInterval(() => {
      const r = getComposer()?.getBoundingClientRect();
      const sig = r && r.width ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}` : '';
      if (sig !== composerSigRef.current) {
        composerSigRef.current = sig;
        forceTick((n) => n + 1);
      }
    }, 700);
    return () => window.clearInterval(iv);
  }, [features.enabled]);

  // Watcher de auto-resposta (le refs para nao ficar com estado velho). So fica
  // ativo quando a conversa aberta tem algum modo ligado — com tudo "off" o scan
  // nem roda (o WhatsApp muta o DOM o tempo todo).
  useEffect(() => {
    if (!features.enabled) return;
    return setupAutoReplyWatcher(
      () => enabledRef.current && (autoRef.current[chatKeyRef.current] ?? 'off') !== 'off',
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

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current); // toast novo renova o prazo
    toastTimer.current = setTimeout(() => setToast(null), 2200);
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

  // Streams ativos por conversa — fechar o painel cancela a geracao (abort real
  // no background, nao gasta tokens a toa).
  const streamsRef = useRef<Record<string, () => void>>({});

  // Transmite a resposta ao vivo para o painel da conversa `key`.
  function streamInto(key: string, input: StreamChatInput) {
    let acc = '';
    let started = false;
    streamsRef.current[key]?.(); // cancela stream anterior da mesma conversa
    streamsRef.current[key] = streamChat(input, {
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
        delete streamsRef.current[key];
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
        delete streamsRef.current[key];
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
    streamsRef.current[key]?.(); // aborta a geracao em andamento desta conversa
    delete streamsRef.current[key];
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
    const mode = autoRef.current[info.chat] ?? 'off';
    if (mode === 'off') return;
    if (info.isGroup && !isDirectedToMe(info.text, mentionsRef.current)) return; // grupo: so quando direcionado
    if (chatKeyRef.current !== info.chat) return; // usuario ja trocou de conversa
    if (Date.now() < autoCooldownRef.current) return; // throttle entre auto-respostas
    autoCooldownRef.current = Date.now() + 8000;
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
    // Re-checa DEPOIS da geracao: se o usuario trocou de conversa ou desligou o
    // modo enquanto a IA gerava, nao insere/envia no chat errado.
    const modeNow = autoRef.current[info.chat] ?? 'off';
    if (modeNow === 'off' || chatKeyRef.current !== info.chat) return;
    if (modeNow === 'suggest') {
      setAutoSuggestion({ chat: info.chat, text: reply });
    } else if (modeNow === 'draft') {
      insertIntoComposer(reply);
      flash('Rascunho de resposta inserido — revise e envie.');
    } else if (modeNow === 'autosend') {
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

  // ---- Ferramentas do campo de mensagem ----
  async function startDictation() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setToolBusy('dictation');
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          const base64 = await blobToBase64(blob);
          const res = await callBackground({
            kind: 'transcribe',
            audioBase64: base64,
            mimeType: blob.type || 'audio/webm',
          });
          if (res.ok && res.text) {
            const cur = getComposerText();
            insertIntoComposer(cur ? `${cur} ${res.text}` : res.text);
            flash('Ditado inserido no campo.');
          } else {
            flash(res.ok ? 'Nada foi transcrito.' : res.error);
          }
        } catch (err) {
          flash((err as Error).message);
        } finally {
          setToolBusy(null);
        }
      };
      rec.start();
      recRef.current = { rec, stream };
      setRecording(true);
    } catch {
      flash('Não consegui acessar o microfone (permita o acesso).');
    }
  }

  function stopDictation() {
    recRef.current?.rec.stop();
    recRef.current = null;
  }

  async function runComposerText(mode: 'translate' | 'improve') {
    const text = getComposerText();
    if (!text) {
      flash('Escreva algo no campo primeiro.');
      return;
    }
    setToolBusy(mode);
    try {
      const messages = mode === 'translate' ? buildTranslateTextPrompt(text) : buildImproveTextPrompt(text);
      const res = await callBackground({ kind: 'chat', task: 'explain', messages, raw: true });
      if (res.ok && res.text) {
        insertIntoComposer(res.text.trim());
        flash(mode === 'translate' ? 'Texto traduzido.' : 'Texto melhorado.');
      } else {
        flash(res.ok ? 'Sem resposta.' : res.error);
      }
    } finally {
      setToolBusy(null);
    }
  }

  async function speakComposer() {
    const text = getComposerText();
    if (!text) {
      flash('Escreva algo no campo primeiro.');
      return;
    }
    setToolBusy('tts');
    try {
      const res = await callBackground({ kind: 'tts', text });
      if (res.ok && res.audio) {
        new Audio(`data:${res.audio.mimeType};base64,${res.audio.base64}`).play().catch(() => {});
        flash('Tocando áudio.');
      } else {
        flash(res.ok ? 'Sem áudio gerado.' : res.error);
      }
    } finally {
      setToolBusy(null);
    }
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
          <button className="wz-menu-item" onClick={() => runStream(() => prepTranslate(menu.row), 'Tradução')}>
            🌐 Traduzir
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

      {/* Barra de ferramentas do campo de mensagem */}
      {(() => {
        const el = getComposer();
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (!r.width) return null;
        return (
          <div
            className="wz-tools"
            style={{
              left: Math.max(6, r.right - 6),
              top: Math.max(6, r.top - 44),
              transform: 'translateX(-100%)',
            }}
          >
            <button
              className={`wz-tool ${recording ? 'wz-tool-rec' : ''}`}
              title={recording ? 'Parar e transcrever' : 'Ditar (gravar e transcrever)'}
              onClick={recording ? stopDictation : startDictation}
            >
              <MicIcon size={15} />
            </button>
            <button
              className="wz-tool"
              title="Traduzir meu texto"
              disabled={!!toolBusy}
              onClick={() => runComposerText('translate')}
            >
              🌐
            </button>
            <button
              className="wz-tool"
              title="Melhorar meu texto"
              disabled={!!toolBusy}
              onClick={() => runComposerText('improve')}
            >
              ✨
            </button>
            <button
              className="wz-tool"
              title="Ouvir (gerar áudio do texto)"
              disabled={!!toolBusy}
              onClick={speakComposer}
            >
              🔊
            </button>
            {(toolBusy || recording) && <span className="wz-spinner" style={{ marginLeft: 2 }} />}
          </div>
        );
      })()}

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

      {/* Cartao de sugestao de auto-resposta (modo "sugerir") — amarrado a conversa
          em que a mensagem chegou: some ao trocar de chat (nao insere no chat errado). */}
      {autoSuggestion && autoSuggestion.chat === chatKey && (
        <div className="wz-autocard">
          <div className="wz-autocard-head">🤖 Resposta sugerida</div>
          <div className="wz-autocard-body">{autoSuggestion.text}</div>
          <div className="wz-autocard-foot">
            <button className="wz-btn" onClick={() => setAutoSuggestion(null)}>
              Ignorar
            </button>
            <button
              className="wz-btn wz-btn-primary"
              onClick={() => {
                insertIntoComposer(autoSuggestion.text);
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
