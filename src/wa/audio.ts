import { SEL } from './selectors';
import { blobToBase64 } from '@/src/lib/binary';

// Extrai o audio (ja decriptado pelo WhatsApp) de uma nota de voz para transcrever.
// O <audio> do WhatsApp aponta para um blob: URL local; fazer fetch nele devolve
// os bytes decriptados, sem precisar lidar com a criptografia do WhatsApp.

export interface ExtractedAudio {
  base64: string;
  mimeType: string;
}

function findAudioSrc(row: HTMLElement): string | null {
  const audio = row.querySelector<HTMLAudioElement>(SEL.audio);
  if (audio) {
    const src = audio.currentSrc || audio.src || audio.querySelector('source')?.src || '';
    if (src.startsWith('blob:')) return src;
  }
  return null;
}

/**
 * Tenta obter o audio da mensagem. Retorna null se o blob ainda nao foi carregado
 * (nesse caso o usuario precisa tocar o audio uma vez para o WhatsApp materializar o blob).
 */
export async function extractAudio(row: HTMLElement): Promise<ExtractedAudio | null> {
  const src = findAudioSrc(row);
  if (!src) return null;

  const res = await fetch(src);
  const blob = await res.blob();
  const base64 = await blobToBase64(blob);
  return { base64, mimeType: blob.type || 'audio/ogg' };
}

export function hasAudio(row: HTMLElement): boolean {
  return !!row.querySelector(SEL.audio) || !!row.querySelector('[data-icon*="audio" i]');
}
