import { useEffect, useRef, useState, useCallback } from 'react';
import {
  summarize,
  suggest,
  explain,
  transcribe,
  describeImage,
  searchConversation,
  searchMessage,
  followUp,
  type Session,
} from './actions';
import Panel, { type PanelData } from './Panel';
import { RobotIcon, MicIcon, ImageIcon, LightbulbIcon, SearchIcon } from './icons';
import { insertIntoComposer } from '@/src/wa/composer';
import { detectKind } from '@/src/wa/message-nodes';
import { setupMessageButtons } from '@/src/wa/inject-buttons';
import { readHeaderTitle } from '@/src/wa/chat-reader';
import { callBackground } from '@/src/messaging';
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

  const saveGeneration = useCallback(async (patch: Partial<GenerationSettings>) => {
    const next = await updateConfig((c) => ({
      ...c,
      generation: { ...c.generation, ...patch },
    }));
    setGeneration(next.generation);
  }, []);

  async function runAction(fallbackTitle: string, fn: () => Promise<Session>) {
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

  async function handleFollowup(question: string, useSearch: boolean) {
    const key = chatKeyRef.current;
    const cur = panels[key];
    if (!cur?.session) return;
    setPanels((p) => ({ ...p, [key]: { ...cur, loading: true, error: undefined } }));
    try {
      const next = await followUp(cur.session, question, useSearch);
      setPanels((p) => ({ ...p, [key]: { ...p[key], loading: false, title: next.title, session: next } }));
    } catch (err) {
      setPanels((p) => ({ ...p, [key]: { ...p[key], loading: false, error: (err as Error).message } }));
    }
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
    runAction('Resumo', () => summarize(length));
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
          <button className="wz-menu-item" onClick={() => runAction('Explicar mensagem', () => explain(menu.row))}>
            <LightbulbIcon /> Explicar do que se trata
          </button>
          {menuKind === 'audio' && (
            <button
              className="wz-menu-item"
              disabled={!features.transcribe}
              onClick={() => runAction('Transcrição do áudio', () => transcribe(menu.row))}
            >
              <MicIcon /> Transcrever áudio
            </button>
          )}
          {menuKind === 'image' && (
            <button className="wz-menu-item" onClick={() => runAction('Descrição da imagem', () => describeImage(menu.row))}>
              <ImageIcon /> Descrever imagem
            </button>
          )}
          <button className="wz-menu-item" onClick={() => runAction('Pesquisa online', () => searchMessage(menu.row))}>
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
            <button className="wz-menu-item" onClick={() => runAction('Sugestões de resposta', () => suggest())}>
              ✨ Sugerir resposta
            </button>
          )}
          <button className="wz-menu-item" onClick={() => runAction('Pesquisa online', () => searchConversation())}>
            <SearchIcon /> Pesquisar online
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
