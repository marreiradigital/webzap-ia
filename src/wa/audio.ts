import { SEL, firstMatch } from './selectors';
import { blobToBase64 } from '@/src/lib/binary';

// Extrai midia (ja decriptada pelo WhatsApp) de uma mensagem para enviar a IA.
// O WhatsApp expoe a midia como blob: URL local ja decriptado; fetch nele devolve
// os bytes, sem precisar lidar com a criptografia do WhatsApp.

export interface ExtractedMedia {
  base64: string;
  mimeType: string;
}

async function fetchBlobAsBase64(url: string): Promise<ExtractedMedia | null> {
  if (!url.startsWith('blob:')) return null;
  const res = await fetch(url);
  const blob = await res.blob();
  const base64 = await blobToBase64(blob);
  return { base64, mimeType: blob.type || 'application/octet-stream' };
}

function audioSrc(row: HTMLElement): string {
  const audio = row.querySelector<HTMLAudioElement>(SEL.audio);
  return audio?.currentSrc || audio?.src || audio?.querySelector('source')?.src || '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Muta qualquer <audio> da linha (chamado repetidamente ate o elemento existir). */
function muteRowAudio(row: HTMLElement): HTMLAudioElement | null {
  const a = row.querySelector<HTMLAudioElement>(SEL.audio);
  if (a) {
    a.muted = true;
    a.volume = 0;
  }
  return a;
}

/** Carrega o blob do audio SEM o usuario precisar ouvir: clica no play ja com o
 *  audio mutado, espera o WhatsApp baixar/decriptar (o blob: aparece), pausa pelo
 *  proprio botao do WhatsApp e restaura o volume. A ideia da transcricao e
 *  justamente nao ter que ouvir o audio. */
export async function ensureAudioLoaded(row: HTMLElement, timeoutMs = 8000): Promise<boolean> {
  if (audioSrc(row).startsWith('blob:')) return true;

  const playIcon = firstMatch<HTMLElement>(row, SEL.audioPlayButton);
  const playBtn = (playIcon?.closest('button') as HTMLElement | null) ?? playIcon;
  if (!playBtn) return false;

  muteRowAudio(row);
  playBtn.click();

  const deadline = Date.now() + timeoutMs;
  let ok = false;
  while (Date.now() < deadline) {
    const a = muteRowAudio(row); // re-muta a cada volta (o elemento pode nascer depois do click)
    if (a && audioSrc(row).startsWith('blob:')) {
      ok = true;
      break;
    }
    await sleep(50);
  }

  // Para a reproducao pelo controle do proprio WhatsApp (mantem a UI consistente)
  // e devolve o volume ao normal para quando o usuario quiser ouvir de verdade.
  const pauseIcon = firstMatch<HTMLElement>(row, SEL.audioPauseButton);
  ((pauseIcon?.closest('button') as HTMLElement | null) ?? pauseIcon)?.click();
  const a = row.querySelector<HTMLAudioElement>(SEL.audio);
  if (a) {
    try {
      a.pause();
      a.currentTime = 0;
    } catch {
      /* estado do player pode variar */
    }
    a.muted = false;
    a.volume = 1;
  }
  return ok;
}

/** Audio de nota de voz. Carrega o blob automaticamente (sem tocar audivel) se
 *  ainda nao foi carregado; null se nem assim der. */
export async function extractAudio(row: HTMLElement): Promise<ExtractedMedia | null> {
  if (!audioSrc(row).startsWith('blob:')) {
    await ensureAudioLoaded(row);
  }
  const media = await fetchBlobAsBase64(audioSrc(row));
  if (media && !media.mimeType.startsWith('audio')) media.mimeType = 'audio/ogg';
  return media;
}

/** Imagem enviada. null se ainda nao carregou o blob (usuario pode abrir a imagem uma vez). */
export async function extractImage(row: HTMLElement): Promise<ExtractedMedia | null> {
  const img = row.querySelector<HTMLImageElement>(SEL.imageEl);
  const src = img?.currentSrc || img?.src || '';
  const media = await fetchBlobAsBase64(src);
  if (media && !media.mimeType.startsWith('image')) media.mimeType = 'image/jpeg';
  return media;
}

export function hasAudio(row: HTMLElement): boolean {
  return !!row.querySelector(SEL.audio) || !!firstMatch(row, SEL.audioIcon);
}
