import { ProviderError, type ProviderId } from './types';

// Helper unico de HTTP para os providers. Roda no service worker (background),
// onde host_permissions cobrem os dominios e nao ha bloqueio de CORS.

export async function postJson<T>(
  providerId: ProviderId,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ProviderError(
      `Falha de rede ao acessar ${providerId}: ${(err as Error).message}`,
      providerId,
    );
  }
  return parseResponse<T>(providerId, res);
}

export async function postForm<T>(
  providerId: ProviderId,
  url: string,
  headers: Record<string, string>,
  form: FormData,
  signal?: AbortSignal,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, body: form, signal });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ProviderError(
      `Falha de rede ao acessar ${providerId}: ${(err as Error).message}`,
      providerId,
    );
  }
  return parseResponse<T>(providerId, res);
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
