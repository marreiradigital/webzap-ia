# HARNESS — Atualizar seletores quando o WhatsApp muda

O WhatsApp Web usa classes obfuscadas e muda o layout sem aviso. Quando algo para de funcionar, o problema quase sempre é seletor.

## Sintomas → suspeita

- "Nenhuma mensagem visível para resumir" mesmo com conversa aberta → `messageRow`/`copyableText`/`textSpan` ou `bubbleIn/Out`.
- Resumo vem sem autores → `prePlainAttr` (`data-pre-plain-text`) mudou de formato.
- "Toque no play do áudio…" sempre → `audio`/`audioIcon`.
- Sugestão não entra no campo → `composer`.
- Título do chat vazio → `headerTitle`.

## Como corrigir (só um arquivo)

1. Abra o WhatsApp Web, DevTools, inspecione o elemento real.
2. Ajuste **apenas** [`src/wa/selectors.ts`](../../src/wa/selectors.ts). Cada campo aceita uma **lista** de seletores (tentados em ordem) — adicione o novo no início e mantenha os antigos como fallback.
3. Prefira seletores estáveis: `#main`, `[role="row"]`, atributos `data-*`, `[data-icon]`, `contenteditable`. Evite classes ofuscadas (ex.: `.x1abc23`).
4. Reconstrua/teste no `pnpm dev` sobre uma conversa real.

## Não faça

- Não espalhe seletores por outros arquivos — sempre via `selectors.ts` + `firstMatch`.
- Não parta para hooks internos do WhatsApp (Store/wa-js): decisão do projeto é **DOM only** (menor risco de ban). Ver [`../SDD/00-overview.md`](../SDD/00-overview.md).
