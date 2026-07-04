// Utilitarios de conversao base64 <-> binario. O content script converte o blob
// do audio (ja decriptado pelo WhatsApp) para base64 e envia ao background via
// mensagem (structured clone nao carrega Blob de forma confiavel entre contextos).

/** Blob -> base64 (sem o prefixo data:). Usado no content script. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return arrayBufferToBase64(buffer);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** base64 -> Blob. Usado no background para montar o FormData da transcricao. */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}
