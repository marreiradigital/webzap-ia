import { memo, useMemo } from 'react';
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

// memo + useMemo: durante o streaming so o ULTIMO turno muda; os anteriores nao
// re-parseiam a cada token (marked+DOMPurify rodavam para todos, a cada delta).
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(text, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [text]);
  return <div className="wz-md" dangerouslySetInnerHTML={{ __html: html }} />;
});
