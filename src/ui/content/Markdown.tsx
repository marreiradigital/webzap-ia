import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Renderiza Markdown (GFM) das respostas da IA como HTML sanitizado.
// Ver regra rich-text-markdown: as respostas nao podem aparecer com markdown cru.

marked.setOptions({ gfm: true, breaks: true });

// Links abrem em nova aba com seguranca.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function Markdown({ text }: { text: string }) {
  const raw = marked.parse(text, { async: false }) as string;
  const html = DOMPurify.sanitize(raw);
  return <div className="wz-md" dangerouslySetInnerHTML={{ __html: html }} />;
}
