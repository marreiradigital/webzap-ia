import { useEffect, useState } from 'react';
import { browser } from '#imports';
import { PROVIDER_IDS, PROVIDERS } from '@/src/providers/registry';
import { getConfig, updateConfig, type WebzapConfig } from '@/src/storage';

export default function PopupApp() {
  const [cfg, setCfg] = useState<WebzapConfig | null>(null);

  useEffect(() => {
    getConfig().then(setCfg);
  }, []);

  async function toggleMaster() {
    const next = await updateConfig((c) => ({
      ...c,
      features: { ...c.features, enabled: !c.features.enabled },
    }));
    setCfg(next);
  }

  const configured = cfg
    ? PROVIDER_IDS.filter((id) => cfg.providers[id]?.enabled && cfg.providers[id]?.apiKey)
    : [];

  return (
    <div className="w-[320px] bg-white p-4 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-xs font-bold text-white">
          Zap
        </div>
        <div>
          <div className="text-sm font-bold leading-tight">WebZap - IA</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            IA dentro do WhatsApp Web
          </div>
        </div>
      </div>

      {cfg && (
        <>
          <button
            onClick={toggleMaster}
            className={`mb-3 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
              cfg.features.enabled
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'border-neutral-300 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900'
            }`}
          >
            <span>{cfg.features.enabled ? 'Extensão ativa' : 'Extensão desativada'}</span>
            <span
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                cfg.features.enabled ? 'bg-emerald-600' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  cfg.features.enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>

          <div className="mb-3 rounded-xl border border-neutral-200 p-3 text-xs dark:border-neutral-800">
            {configured.length > 0 ? (
              <span className="text-neutral-600 dark:text-neutral-300">
                Provedores ativos:{' '}
                <strong>{configured.map((id) => PROVIDERS[id].label).join(', ')}</strong>
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">
                Nenhum provedor configurado. Abra as opções e adicione uma chave de API.
              </span>
            )}
          </div>

          <button
            onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/options.html') })}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Abrir opções
          </button>

          <p className="mt-3 text-center text-[11px] text-neutral-400">
            Abra o WhatsApp Web e clique no botão flutuante "Zap".
          </p>
        </>
      )}
    </div>
  );
}
