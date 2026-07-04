import { useEffect, useState } from 'react';
import { PROVIDER_IDS, PROVIDERS } from '@/src/providers/registry';
import type { ProviderId } from '@/src/providers/types';
import {
  getConfig,
  updateConfig,
  type ProviderConfig,
  type TaskKind,
  type WebzapConfig,
} from '@/src/storage';
import { callBackground } from '@/src/messaging';

const TASK_LABELS: Record<TaskKind, string> = {
  summarize: 'Resumir conversa',
  explain: 'Explicar mensagem',
  suggest: 'Sugerir resposta',
  transcribe: 'Transcrever áudio',
  search: 'Pesquisar online',
};

function neededCap(task: TaskKind): 'chat' | 'transcribe' | 'search' {
  if (task === 'transcribe') return 'transcribe';
  if (task === 'search') return 'search';
  return 'chat';
}

const FEATURE_LABELS: { key: keyof WebzapConfig['features']; label: string; help: string }[] = [
  { key: 'enabled', label: 'Ativar a extensão', help: 'Interruptor mestre da UI injetada no WhatsApp.' },
  { key: 'summarize', label: 'Resumir conversa', help: 'Botão de resumo no menu flutuante.' },
  { key: 'perMessage', label: 'Ações por mensagem', help: 'Ícone de IA ao passar o mouse sobre uma mensagem.' },
  { key: 'transcribe', label: 'Transcrever áudios', help: 'Opção de transcrição em notas de voz.' },
  { key: 'suggest', label: 'Sugerir resposta', help: 'Geração de sugestões de resposta.' },
];

export default function OptionsApp() {
  const [cfg, setCfg] = useState<WebzapConfig | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getConfig().then(setCfg);
  }, []);

  async function patch(fn: (c: WebzapConfig) => WebzapConfig) {
    const next = await updateConfig(fn);
    setCfg(next);
    setSaved(true);
    window.clearTimeout((patch as any)._t);
    (patch as any)._t = window.setTimeout(() => setSaved(false), 1400);
  }

  if (!cfg) {
    return (
      <div className="min-h-screen bg-neutral-50 text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400 grid place-items-center">
        Carregando…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">WebZap - IA</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Configuração de provedores de IA e funcionalidades.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity ${
              saved ? 'bg-emerald-100 text-emerald-700 opacity-100 dark:bg-emerald-900/40 dark:text-emerald-300' : 'opacity-0'
            }`}
          >
            Salvo ✓
          </span>
        </header>

        {/* Provedores */}
        <section className="mb-8">
          <h2 className="mb-1 text-lg font-semibold">Provedores de IA</h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            Adicione a chave de API de pelo menos um provedor. As chaves ficam apenas no seu
            navegador (armazenamento local da extensão).
          </p>
          <div className="space-y-4">
            {PROVIDER_IDS.map((id) => (
              <ProviderCard
                key={id}
                id={id}
                value={cfg.providers[id]}
                onChange={(pc) =>
                  patch((c) => ({ ...c, providers: { ...c.providers, [id]: pc } }))
                }
              />
            ))}
          </div>
        </section>

        {/* Modelo por tarefa */}
        <section className="mb-8">
          <h2 className="mb-1 text-lg font-semibold">Modelo por tarefa</h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            Opcional. Escolha qual provedor e modelo usar em cada tarefa. Em "Automático", usa o
            primeiro provedor habilitado e compatível.
          </p>
          <div className="space-y-3">
            {(Object.keys(TASK_LABELS) as TaskKind[]).map((task) => (
              <TaskRow
                key={task}
                task={task}
                cfg={cfg}
                onChange={(providerId, model) =>
                  patch((c) => {
                    const tasks = { ...c.tasks };
                    if (!providerId) delete tasks[task];
                    else tasks[task] = { providerId, model };
                    return { ...c, tasks };
                  })
                }
              />
            ))}
          </div>
        </section>

        {/* Funcionalidades */}
        <section className="mb-8">
          <h2 className="mb-1 text-lg font-semibold">Funcionalidades</h2>
          <div className="rounded-xl border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900">
            {FEATURE_LABELS.map(({ key, label, help }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400">{help}</span>
                </span>
                <Switch
                  checked={cfg.features[key]}
                  onChange={(v) => patch((c) => ({ ...c, features: { ...c.features, [key]: v } }))}
                />
              </label>
            ))}
          </div>
        </section>

        {/* Geracao: limites e regras */}
        <section className="mb-8">
          <h2 className="mb-1 text-lg font-semibold">Geração (limites e regras)</h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            Também dá para ajustar isso rapidinho pelo painel dentro do WhatsApp (ícone de
            engrenagem).
          </p>
          <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <label className="block">
              <span className="mb-1 flex justify-between text-sm font-medium">
                <span>Temperatura (criatividade)</span>
                <span className="text-neutral-500">{cfg.generation.temperature.toFixed(1)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                className="w-full accent-emerald-600"
                value={cfg.generation.temperature}
                onChange={(e) =>
                  patch((c) => ({ ...c, generation: { ...c.generation, temperature: Number(e.target.value) } }))
                }
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Limite de tokens da resposta</span>
              <input
                type="number"
                min={256}
                max={8192}
                step={128}
                className="w-40 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={cfg.generation.maxTokens}
                onChange={(e) =>
                  patch((c) => ({ ...c, generation: { ...c.generation, maxTokens: Number(e.target.value) } }))
                }
              />
              <span className="mt-1 block text-xs text-neutral-500">
                Aumente se as respostas estiverem sendo cortadas.
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Regras / instruções personalizadas</span>
              <textarea
                rows={3}
                placeholder="Ex.: responda de forma curta e informal; me chame de Paulo; use bullets quando fizer sentido."
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={cfg.generation.rules}
                onChange={(e) =>
                  patch((c) => ({ ...c, generation: { ...c.generation, rules: e.target.value } }))
                }
              />
              <span className="mt-1 block text-xs text-neutral-500">
                Aplicadas em todas as respostas da IA (resumo, explicar, sugerir, etc.).
              </span>
            </label>
          </div>
        </section>

        {/* Idioma */}
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">Idioma das respostas</h2>
          <select
            className="w-full max-w-xs rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={cfg.language}
            onChange={(e) => patch((c) => ({ ...c, language: e.target.value }))}
          >
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </section>

        <footer className="border-t border-neutral-200 pt-6 text-xs text-neutral-400 dark:border-neutral-800">
          ⚠️ Automatizar o WhatsApp Web pode violar os Termos de Uso e resultar em bloqueio da
          conta. Os recursos de envio automático são opcionais e desligados por padrão.
        </footer>
      </div>
    </div>
  );
}

function ProviderCard({
  id,
  value,
  onChange,
}: {
  id: ProviderId;
  value: ProviderConfig | undefined;
  onChange: (pc: ProviderConfig) => void;
}) {
  const provider = PROVIDERS[id];
  const pc: ProviderConfig = value ?? { apiKey: '', enabled: false };
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const canTranscribe = provider.capabilities.includes('transcribe');

  async function test() {
    setTesting(true);
    setTestResult(null);
    const res = await callBackground({ kind: 'testProvider', providerId: id });
    setTestResult(res.ok ? { ok: true, msg: 'Conexão OK ✓' } : { ok: false, msg: res.error });
    setTesting(false);
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{provider.label}</span>
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {provider.capabilities.includes('transcribe') ? 'chat + áudio' : 'chat'}
          </span>
        </div>
        <Switch checked={pc.enabled} onChange={(v) => onChange({ ...pc, enabled: v })} />
      </div>

      <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
        Chave de API
      </label>
      <div className="mb-3 flex gap-2">
        <input
          type={showKey ? 'text' : 'password'}
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          placeholder="Cole a chave de API aqui"
          value={pc.apiKey}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onChange({ ...pc, apiKey: e.target.value.trim() })}
        />
        <button
          type="button"
          className="rounded-lg border border-neutral-300 px-3 text-sm dark:border-neutral-700"
          onClick={() => setShowKey((v) => !v)}
        >
          {showKey ? 'Ocultar' : 'Ver'}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ModelField
          label="Modelo de chat"
          listId={`models-${id}-chat`}
          suggestions={provider.suggestedModels.chat}
          placeholder={provider.defaultModels.chat}
          value={pc.chatModel ?? ''}
          onChange={(v) => onChange({ ...pc, chatModel: v || undefined })}
        />
        {canTranscribe && (
          <ModelField
            label="Modelo de transcrição"
            listId={`models-${id}-transcribe`}
            suggestions={provider.suggestedModels.transcribe ?? []}
            placeholder={provider.defaultModels.transcribe ?? ''}
            value={pc.transcribeModel ?? ''}
            onChange={(v) => onChange({ ...pc, transcribeModel: v || undefined })}
          />
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!pc.apiKey || testing}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          onClick={test}
        >
          {testing ? 'Testando…' : 'Testar conexão'}
        </button>
        {testResult && (
          <span className={`text-sm ${testResult.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {testResult.msg}
          </span>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  cfg,
  onChange,
}: {
  task: TaskKind;
  cfg: WebzapConfig;
  onChange: (providerId: ProviderId | '', model: string) => void;
}) {
  const needed = neededCap(task);
  const options = PROVIDER_IDS.filter(
    (id) => PROVIDERS[id].capabilities.includes(needed) && cfg.providers[id]?.enabled,
  );
  const current = cfg.tasks[task];

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row sm:items-center">
      <span className="w-44 text-sm font-medium">{TASK_LABELS[task]}</span>
      <select
        className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        value={current?.providerId ?? ''}
        onChange={(e) => {
          const pid = e.target.value as ProviderId | '';
          const model = pid ? PROVIDERS[pid].defaultModels[needed === 'transcribe' ? 'transcribe' : 'chat'] ?? '' : '';
          onChange(pid, model);
        }}
      >
        <option value="">Automático</option>
        {options.map((id) => (
          <option key={id} value={id}>
            {PROVIDERS[id].label}
          </option>
        ))}
      </select>
      {current?.providerId && (
        <input
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          placeholder="modelo"
          value={current.model}
          onChange={(e) => onChange(current.providerId, e.target.value)}
        />
      )}
    </div>
  );
}

function ModelField({
  label,
  listId,
  suggestions,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  listId: string;
  suggestions: string[];
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </label>
      <input
        list={listId}
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
      />
      <datalist id={listId}>
        {suggestions.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-emerald-600' : 'bg-neutral-300 dark:bg-neutral-700'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
