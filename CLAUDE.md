# CLAUDE.md — WebZap - IA

Memória e regras do projeto para desenvolvimento (inclusive assistido por IA). Leia antes de mexer no código. Complementa as specs em [`.claude/SDD/`](./.claude/SDD/) e os guias em [`.claude/HARNESS/`](./.claude/HARNESS/).

## O que é

Extensão de navegador (Manifest V3, via **WXT**) que injeta funcionalidades de IA no **WhatsApp Web**. Leitura via DOM (só o visível); nunca envia mensagens sozinha na v1. Ver [`README.md`](./README.md).

## Stack e comandos

- WXT + React + TypeScript + Tailwind CSS v4 + Dexie. Gerenciador: **pnpm**.
- `pnpm dev` (dev+HMR) · `pnpm build` · `pnpm zip` · `pnpm compile` (typecheck) · `pnpm exec wxt prepare` (gera tipos de `#imports`).
- Após mudar entrypoints ou instalar deps, rode `wxt prepare` para atualizar os tipos.

## Arquitetura (camadas isoladas)

```
entrypoints/background.ts   -> service worker: ÚNICO lugar que faz fetch aos provedores (guarda as chaves)
entrypoints/content/        -> UI injetada no WhatsApp (shadow root, CSS próprio em style.css)
entrypoints/options|popup/  -> páginas React (Tailwind)
src/providers/              -> camada de IA (1 arquivo por provedor + registry.ts)
src/wa/                     -> camada DOM do WhatsApp (selectors.ts é a fonte única de seletores)
src/ai/                     -> prompts.ts (templates) + resolve.ts (provedor por tarefa)
src/storage.ts              -> config tipada (chrome.storage.local)
src/messaging.ts            -> protocolo tipado content <-> background
```

**Fluxo:** content lê o DOM → monta prompt (`src/ai/prompts.ts`) → `callBackground` → background resolve provedor (`src/ai/resolve.ts`) e faz `fetch` → devolve texto → content renderiza. As chaves nunca chegam ao content script.

## Fonte única (não duplicar!)

- **Seletores do WhatsApp** → só em [`src/wa/selectors.ts`](./src/wa/selectors.ts). Nunca hardcode `div[role="row"]`, `#main`, etc. espalhado. Ao adaptar a mudanças do WhatsApp, mexa só aqui (guia: [`.claude/HARNESS/atualizar-seletores.md`](./.claude/HARNESS/atualizar-seletores.md)).
- **Provedores** → registrados só em [`src/providers/registry.ts`](./src/providers/registry.ts). Para adicionar um: implemente `ProviderModule` e registre ali (guia: [`.claude/HARNESS/adicionar-provider.md`](./.claude/HARNESS/adicionar-provider.md)).
- **Endpoints/hosts** → cada provedor tem sua base no próprio arquivo; `host_permissions` só em `wxt.config.ts`. Não espalhe URLs.
- **Prompts** → só em [`src/ai/prompts.ts`](./src/ai/prompts.ts).
- **Config/estado** → só via [`src/storage.ts`](./src/storage.ts) (`getConfig`/`updateConfig`/`watchConfig`).

## Padrões de UI (obrigatórios)

- **pt-BR com acentuação correta** em TODO texto que o usuário lê (labels, botões, mensagens de erro exibidas, toasts, títulos). Identificadores de código, slugs, enums e headers de commit ficam **sem** acento.
- **Sem scroll-lock** em dropdowns/menus: a UI injetada é overlay por CSS (nada de `overflow:hidden` no body). Nas páginas, `scrollbar-gutter: stable`. Preferir `<select>`/`<datalist>` nativos.
- **Responsivo** em todos os viewports; a UI injetada usa `position: fixed` e não empurra o layout do WhatsApp.
- A UI injetada usa **CSS próprio** (`entrypoints/content/style.css`, escopado no shadow root), **não** Tailwind — para evitar o problema de variáveis `:root` do Tailwind v4 dentro de shadow DOM. Tailwind é só para options/popup (documentos normais).

## Segurança / conformidade

- Chaves de API só em `chrome.storage.local`; `fetch` só no background. Nunca logar chave nem commitar `.env`.
- Envio de mensagens é **opt-in** e não existe na v1 (só inserir sugestão no campo). Auto-envio (Fase 2) exige confirmação com aviso de banimento.

## Disciplina de commits

- 1 commit por preocupação lógica; conventional commits; header em **pt-BR sem acento**; corpo pode ter acento e explica o "porquê".
- `pnpm compile` (typecheck) deve passar antes de commitar. Stage por caminho específico (nunca `git add -A`).
- Terminar com: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Painel-chat e geração

- O painel de resultados é um **chat** (`src/ui/content/Panel.tsx`): após uma ação dá para continuar perguntando (`followUp` em `actions.ts`). Cada conversa tem seu painel (indexado por `readHeaderTitle()`); trocar de conversa troca o painel.
- Botões de IA são **injetados por mensagem** (`src/wa/inject-buttons.ts`, light DOM) — colados à bolha e rolam junto.
- `config.generation` (`maxTokens`/`temperature`/`rules`) é editável no painel (engrenagem) e nas Opções; aplicada no `background.ts` (rules vira `system` extra). `maxTokens` padrão 2048 para não cortar respostas.
- **Streaming**: chat transmite token a token via porta `wz-chat` (`streamChat` em `messaging.ts` → `background` → `provider.chatStream` SSE). O `background.prepareChat` unifica persona+regras+limites para chat normal e streaming.
- **Markdown**: respostas renderizadas com `marked` + `dompurify` (`src/ui/content/Markdown.tsx`) — nunca mostrar markdown cru.
- **Memória** (`src/memory/`): Dexie na origem da extensão (compartilhado background↔página); persona injetada no `suggest` via `usePersona`+`chatName`. Página em `entrypoints/memory/`.

## Roadmap

- **Fase 1 (feito):** resumir, explicar, transcrever, descrever imagem, sugerir, pesquisar online, painel-chat por conversa, streaming, markdown, config de geração, multi-provedor.
- **Fase 2 (em andamento):** Persona & Memória (entrevista + injeção no sugerir — **feito**; auto-treino pendente); **resposta automática** (3 modos — pendente). Specs em [`.claude/SDD/`](./.claude/SDD/).
