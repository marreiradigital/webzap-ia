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

/** Audio de nota de voz. null se o blob ainda nao foi carregado (usuario precisa tocar o play). */
export async function extractAudio(row: HTMLElement): Promise<ExtractedMedia | null> {
  const audio = row.querySelector<HTMLAudioElement>(SEL.audio);
  const src =
    audio?.currentSrc || audio?.src || audio?.querySelector('source')?.src || '';
  const media = await fetchBlobAsBase64(src);
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
