import { ProviderError, type ProviderId } from './types';

// Helper unico de HTTP para os providers. Roda no service worker (background),
// onde host_permissions cobrem os dominios e nao ha bloqueio de CORS.

/** Timeout padrao: uma chamada pendurada nao pode deixar a UI em "Gerando…" para sempre. */
const JSON_TIMEOUT_MS = 120_000;
const STREAM_TIMEOUT_MS = 300_000;

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal | undefined {
  try {
    const t = AbortSignal.timeout(ms);
    return signal ? AbortSignal.any([signal, t]) : t;
  } catch {
    // Navegador sem AbortSignal.timeout/any: segue sem timeout.
    return signal;
  }
}

async function safeFetch(
  providerId: ProviderId,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: withTimeout(init.signal ?? undefined, timeoutMs) });
  } catch (err) {
    const name = (err as Error)?.name;
    if (name === 'AbortError') throw err;
    if (name === 'TimeoutError') {
      throw new ProviderError(
        `O ${providerId} demorou demais para responder (tempo esgotado). Tente novamente.`,
        providerId,
      );
    }
    throw new ProviderError(
      `Falha de rede ao acessar ${providerId}: ${(err as Error).message}`,
      providerId,
    );
  }
}

export async function postJson<T>(
  providerId: ProviderId,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await safeFetch(
    providerId,
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    },
    JSON_TIMEOUT_MS,
  );
  return parseResponse<T>(providerId, res);
}

export async function postForm<T>(
  providerId: ProviderId,
  url: string,
  headers: Record<string, string>,
  form: FormData,
  signal?: AbortSignal,
): Promise<T> {
  const res = await safeFetch(providerId, url, { method: 'POST', headers, body: form, signal }, JSON_TIMEOUT_MS);
  return parseResponse<T>(providerId, res);
}

/** POST que devolve a Response crua para leitura de SSE (streaming). */
export async function postForStream(
  providerId: ProviderId,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  const res = await safeFetch(
    providerId,
    url,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    },
    STREAM_TIMEOUT_MS,
  );
  if (!res.ok) {
    const raw = await res.text();
    throw new ProviderError(humanizeError(providerId, res.status, raw), providerId, res.status);
  }
  return res;
}

/** Le um corpo SSE linha a linha, chamando onData com o payload apos "data:". */
export async function readSSE(res: Response, onData: (data: string) => void): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('data:')) onData(t.slice(5).trim());
    }
  }
}

async function parseResponse<T>(providerId: ProviderId, res: Response): Promise<T> {
  const raw = await res.text();
  if (!res.ok) {
    throw new ProviderError(
      humanizeError(providerId, res.status, raw),
      providerId,
      res.status,
    );
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ProviderError(
      `Resposta inválida de ${providerId} (não era JSON).`,
      providerId,
      res.status,
    );
  }
}

function humanizeError(providerId: ProviderId, status: number, raw: string): string {
  let detail = raw;
  try {
    const parsed = JSON.parse(raw);
    detail = parsed?.error?.message ?? parsed?.message ?? raw;
  } catch {
    /* mantem o texto cru */
  }
  if (status === 401 || status === 403) {
    return `Chave de API inválida ou sem permissão no ${providerId} (HTTP ${status}). Confira a chave nas Opções.`;
  }
  if (status === 429) {
    return `Limite de uso atingido no ${providerId} (HTTP 429). Tente novamente em instantes.`;
  }
  return `Erro do ${providerId} (HTTP ${status}): ${String(detail).slice(0, 300)}`;
}
