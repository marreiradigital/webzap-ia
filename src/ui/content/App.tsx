import { useEffect, useRef, useState, useCallback } from 'react';
import { HOST_TAG } from './constants';
import { summarize, suggest, explain, transcribe } from './actions';
import { insertIntoComposer } from '@/src/wa/composer';
import { hasAudio } from '@/src/wa/audio';
import { callBackground } from '@/src/messaging';
import { watchConfig, getConfig, type FeatureToggles } from '@/src/storage';
import type { SummaryLength } from '@/src/ai/prompts';

interface RowAnchor {
  row: HTMLElement;
  rect: DOMRect;
}

interface PanelState {
  title: string;
  sub?: string;
  loading: boolean;
  error?: string;
  text?: string;
  suggestions?: string[];
}

const DEFAULT_FEATURES: FeatureToggles = {
  enabled: true,
  summarize: true,
  perMessage: true,
  transcribe: true,
  suggest: true,
};

function isMessageRow(row: Element): boolean {
  return !!row.querySelector('.message-in, .message-out');
}

export default function App() {
  const [features, setFeatures] = useState<FeatureToggles>(DEFAULT_FEATURES);
  const [fabOpen, setFabOpen] = useState(false);
  const [hover, setHover] = useState<RowAnchor | null>(null);
  const [menu, setMenu] = useState<RowAnchor | null>(null);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carrega e observa a config (interruptor mestre + toggles de feature).
  useEffect(() => {
    getConfig().then((c) => setFeatures(c.features));
    return watchConfig((c) => setFeatures(c.features));
  }, []);

  // Deteccao de mensagem sob o cursor (mini botao que segue a mensagem).
  useEffect(() => {
    if (!features.enabled || !features.perMessage) {
      setHover(null);
      return;
    }
    function onMove(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t || !t.tagName) return;
      if (t.tagName.toLowerCase() === HOST_TAG) return; // sobre a nossa propria UI
      const main = document.getElementById('main');
      const row = t.closest?.('div[role="row"]') as HTMLElement | null;
      if (main && row && main.contains(row) && isMessageRow(row)) {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setHover({ row, rect: row.getBoundingClientRect() });
      } else {
        scheduleHide();
      }
    }
    function scheduleHide() {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setHover(null), 220);
    }
    document.addEventListener('mousemove', onMove, { passive: true });
    return () => document.removeEventListener('mousemove', onMove);
  }, [features.enabled, features.perMessage]);

  // Fecha menus ao apertar Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setFabOpen(false);
        setMenu(null);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  async function run(title: string, sub: string | undefined, fn: () => Promise<string>) {
    setMenu(null);
    setFabOpen(false);
    setPanel({ title, sub, loading: true });
    try {
      const text = await fn();
      setPanel({ title, sub, loading: false, text });
    } catch (err) {
      setPanel({ title, sub, loading: false, error: (err as Error).message });
    }
  }

  async function runSuggest() {
    setMenu(null);
    setFabOpen(false);
    setPanel({ title: 'Sugestoes de resposta', loading: true });
    try {
      const suggestions = await suggest();
      setPanel({ title: 'Sugestoes de resposta', loading: false, suggestions });
    } catch (err) {
      setPanel({ title: 'Sugestoes de resposta', loading: false, error: (err as Error).message });
    }
  }

  function useSuggestion(text: string) {
    const ok = insertIntoComposer(text);
    flash(ok ? 'Sugestão inserida no campo (revise e envie).' : 'Não achei o campo de mensagem.');
  }

  if (!features.enabled) return null;

  const menuRow = menu?.row ?? null;
  const menuHasAudio = menuRow ? hasAudio(menuRow) : false;

  return (
    <div className="wz-root">
      {/* Mini botao que segue a mensagem sob o cursor */}
      {hover && features.perMessage && (
        <button
          className="wz-hover-btn"
          style={{
            top: Math.max(6, hover.rect.top + 4),
            left: Math.min(window.innerWidth - 32, hover.rect.right - 30),
          }}
          title="Ações de IA nesta mensagem"
          onClick={() => {
            setMenu({ row: hover.row, rect: hover.row.getBoundingClientRect() });
          }}
        >
          IA
        </button>
      )}

      {/* Menu de acoes por mensagem */}
      {menu && (
        <div
          className="wz-menu"
          style={{
            top: Math.min(window.innerHeight - 160, menu.rect.top + 4),
            left: Math.min(window.innerWidth - 240, menu.rect.right - 30),
          }}
        >
          <div className="wz-menu-title">Esta mensagem</div>
          <button
            className="wz-menu-item"
            onClick={() => run('Explicar mensagem', undefined, () => explain(menu.row))}
          >
            💡 Explicar do que se trata
          </button>
          <button
            className="wz-menu-item"
            disabled={!features.transcribe || !menuHasAudio}
            title={!menuHasAudio ? 'Sem áudio nesta mensagem' : ''}
            onClick={() => run('Transcrição do áudio', undefined, () => transcribe(menu.row))}
          >
            🎙️ Transcrever áudio
          </button>
        </div>
      )}

      {/* FAB principal */}
      <button
        className="wz-fab"
        title="WebZap - IA"
        onClick={() => setFabOpen((v) => !v)}
      >
        Zap
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
            <button className="wz-menu-item" onClick={runSuggest}>
              ✨ Sugerir resposta
            </button>
          )}
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

      {/* Painel de resultados */}
      {panel && (
        <div className="wz-panel">
          <div className="wz-panel-head">
            <div>
              <div className="wz-panel-title">{panel.title}</div>
              {panel.sub && <div className="wz-panel-sub">{panel.sub}</div>}
            </div>
            <button className="wz-icon-btn" title="Fechar" onClick={() => setPanel(null)}>
              ✕
            </button>
          </div>
          <div className="wz-panel-body">
            {panel.loading && (
              <span>
                <span className="wz-spinner" /> Gerando com a IA...
              </span>
            )}
            {panel.error && <div className="wz-error">{panel.error}</div>}
            {panel.text && <div>{panel.text}</div>}
            {panel.suggestions && (
              <div>
                {panel.suggestions.length === 0 && <div>Nenhuma sugestão gerada.</div>}
                {panel.suggestions.map((s, i) => (
                  <button key={i} className="wz-suggestion" onClick={() => useSuggestion(s)}>
                    {s}
                  </button>
                ))}
                <div className="wz-hint">
                  Clique numa sugestão para inserir no campo. Nada é enviado sem você.
                </div>
              </div>
            )}
          </div>
          {panel.text && (
            <div className="wz-panel-foot">
              <button
                className="wz-btn"
                onClick={() => {
                  navigator.clipboard.writeText(panel.text ?? '');
                  flash('Copiado.');
                }}
              >
                Copiar
              </button>
            </div>
          )}
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

  function runSummary(length: SummaryLength) {
    const label =
      length === 'curto' ? 'Resumo curto' : length === 'detalhado' ? 'Resumo detalhado' : 'Resumo da conversa';
    run(label, undefined, () => summarize(length));
  }
}
