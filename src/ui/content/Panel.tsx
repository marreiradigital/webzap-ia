import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { Session, Turn } from './actions';
import type { GenerationSettings } from '@/src/storage';
import { GearIcon, SendIcon, SearchIcon, CloseIcon } from './icons';
import { Markdown } from './Markdown';

export interface PanelData {
  open: boolean;
  loading: boolean;
  title: string;
  error?: string;
  session?: Session;
}

interface PanelProps {
  chatName: string;
  data: PanelData;
  generation: GenerationSettings;
  onClose: () => void;
  onFollowup: (question: string, useSearch: boolean) => void;
  onUseSuggestion: (text: string) => void;
  onGeneration: (patch: Partial<GenerationSettings>) => void;
  onCopy: (text: string) => void;
}

// Memoizado: durante o streaming so o ultimo turno muda; os anteriores nao re-renderizam.
const TurnView = memo(function TurnView({
  turn,
  onCopy,
}: {
  turn: Turn;
  onCopy: (text: string) => void;
}) {
  return (
    <div className={`wz-turn wz-turn-${turn.role}`}>
      <div className="wz-turn-content">
        {turn.role === 'assistant' ? <Markdown text={turn.content} /> : turn.content}
      </div>
      {turn.role === 'assistant' && (
        <button className="wz-copy" title="Copiar" onClick={() => onCopy(turn.content)}>
          Copiar
        </button>
      )}
    </div>
  );
});

export default function Panel({
  chatName,
  data,
  generation,
  onClose,
  onFollowup,
  onUseSuggestion,
  onGeneration,
  onCopy,
}: PanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [useSearch, setUseSearch] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Identidade estavel para o memo dos turnos (o App passa arrow inline).
  const onCopyRef = useRef(onCopy);
  onCopyRef.current = onCopy;
  const stableCopy = useCallback((t: string) => onCopyRef.current(t), []);

  const session = data.session;
  const isSuggest = !!session?.suggestions;
  const canChat = !!session && !isSuggest;

  // Rola para o fim conforme o texto chega (streaming), turnos novos ou carregamento —
  // mas so se o usuario estiver perto do fim (nao "rouba" a rolagem de quem leu acima).
  const lastLen = session?.display[session.display.length - 1]?.content.length ?? 0;
  const pinnedRef = useRef(true);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onScroll = () => {
      pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (pinnedRef.current) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [session?.display.length, lastLen, data.loading]);

  function send() {
    const q = input.trim();
    if (!q || data.loading) return;
    pinnedRef.current = true; // enviar pergunta re-ancora a rolagem no fim
    onFollowup(q, useSearch);
    setInput('');
  }

  return (
    <div className="wz-panel" role="complementary" aria-label="WebZap - IA">
      <div className="wz-panel-head">
        <div className="wz-panel-headtext">
          <div className="wz-panel-title">{data.title}</div>
          <div className="wz-panel-sub">{chatName}</div>
        </div>
        <div className="wz-panel-actions">
          <button
            className={`wz-icon-btn ${settingsOpen ? 'wz-active' : ''}`}
            title="Limites e regras"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <GearIcon />
          </button>
          <button className="wz-icon-btn" title="Fechar" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div className="wz-settings">
          <label className="wz-field">
            <span>Temperatura: {generation.temperature.toFixed(1)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={generation.temperature}
              onChange={(e) => onGeneration({ temperature: Number(e.target.value) })}
            />
          </label>
          <label className="wz-field">
            <span>Limite de tokens da resposta</span>
            <input
              type="number"
              min={256}
              max={8192}
              step={128}
              value={generation.maxTokens}
              onChange={(e) => onGeneration({ maxTokens: Number(e.target.value) })}
            />
          </label>
          <label className="wz-field">
            <span>Regras / instruções (aplicadas em tudo)</span>
            <textarea
              rows={3}
              placeholder="Ex.: responda sempre de forma curta e informal, me chame de Paulo."
              value={generation.rules}
              onChange={(e) => onGeneration({ rules: e.target.value })}
            />
          </label>
        </div>
      )}

      <div className="wz-panel-body" ref={bodyRef}>
        {data.error && <div className="wz-error">{data.error}</div>}

        {isSuggest && session?.suggestions && (
          <div>
            {session.suggestions.length === 0 && <div>Nenhuma sugestão gerada.</div>}
            {session.suggestions.map((s, i) => (
              <button key={i} className="wz-suggestion" onClick={() => onUseSuggestion(s)}>
                {s}
              </button>
            ))}
            <div className="wz-hint">
              Clique numa sugestão para inserir no campo. Nada é enviado sem você.
            </div>
          </div>
        )}

        {!isSuggest &&
          session?.display.map((turn, i) => (
            <TurnView key={i} turn={turn} onCopy={stableCopy} />
          ))}

        {data.loading && (
          <div className="wz-turn wz-turn-assistant">
            <span className="wz-spinner" /> <span className="wz-hint">Gerando…</span>
          </div>
        )}
      </div>

      {canChat && (
        <div className="wz-panel-foot">
          <button
            className={`wz-chip ${useSearch ? 'wz-chip-on' : ''}`}
            title="Pesquisar na internet ao responder"
            onClick={() => setUseSearch((v) => !v)}
          >
            <SearchIcon size={13} /> Online
          </button>
          <div className="wz-composer-row">
            <textarea
              className="wz-input"
              rows={1}
              placeholder="Pergunte mais, peça detalhes, contexto…"
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
              className="wz-send"
              title="Enviar"
              disabled={!input.trim() || data.loading}
              onClick={send}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
