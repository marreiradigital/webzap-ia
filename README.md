# WebZap - IA

[![Versão](https://img.shields.io/github/package-json/v/marreiradigital/webzap-ia?label=vers%C3%A3o&color=25D366)](CHANGELOG.md)
[![Stars](https://img.shields.io/github/stars/marreiradigital/webzap-ia?style=flat&logo=github&color=25D366)](https://github.com/marreiradigital/webzap-ia/stargazers)
[![Forks](https://img.shields.io/github/forks/marreiradigital/webzap-ia?style=flat&logo=github&color=25D366)](https://github.com/marreiradigital/webzap-ia/network/members)
[![Último commit](https://img.shields.io/github/last-commit/marreiradigital/webzap-ia?color=25D366)](https://github.com/marreiradigital/webzap-ia/commits/main)

Extensão de navegador (Chrome/Edge, Manifest V3) que coloca **IA dentro do WhatsApp Web**: resumir conversas, **transcrever áudios sem precisar ouvir**, traduzir, explicar mensagens, sugerir respostas com o seu estilo, ditar mensagens por voz e pesquisar online — usando as **suas próprias chaves** de IA (Anthropic, OpenAI, Google Gemini ou OpenRouter), com **failover automático** entre provedores.

<p align="center">
  <a href="https://marreiradigital.github.io/webzap-ia/"><strong>🌐 Site oficial</strong></a> ·
  <a href="https://marreiradigital.github.io/webzap-ia/webzap-ia.zip"><strong>📦 Baixar a extensão</strong></a> ·
  <a href="https://marreiradigital.github.io/webzap-ia/#instalacao"><strong>🧭 Tutorial de instalação</strong></a> ·
  <a href="https://marreiradigital.github.io/webzap-ia/#como-usar"><strong>📖 Tutorial de uso</strong></a> ·
  <a href="https://marreiradigital.github.io/webzap-ia/#novidades"><strong>🆕 Novidades</strong></a>
</p>

> ⚠️ **Aviso de conformidade.** Automatizar o WhatsApp Web pode violar os [Termos de Uso do WhatsApp](https://www.whatsapp.com/legal/terms-of-service) e, no modo auto-enviar, resultar em **bloqueio da conta**. Por padrão a extensão só lê o que está visível e insere sugestões no campo para você revisar; o envio automático é **opt-in por conversa** e exige aceitar um aviso. Use por sua conta e risco.

## ✨ Funcionalidades

**Nas mensagens** (ícone ✦ ao passar o mouse na bolha):

- **Explicar do que se trata** — com o contexto das mensagens anteriores;
- **Transcrever áudio** — a extensão carrega o áudio sozinha, em silêncio; você lê em vez de ouvir;
- **Traduzir** a mensagem (e **Descrever imagem** em modelos com visão);
- **Pesquisar online** sobre aquela mensagem, com fontes.

**Na conversa** (botão flutuante 🤖):

- **Resumir** — curto, médio ou detalhado, com pendências separadas;
- **Sugerir resposta** — 2–3 opções no seu tom; você escolhe, revisa e envia;
- **Pesquisar online** sobre o assunto da conversa;
- **Auto-resposta por conversa** — desligada / sugerir / rascunho / auto-enviar ⚠️;
- **Aprender desta conversa** — alimenta a memória local da IA.

**No campo de digitação** (barra de ferramentas):

- 🎤 **Ditar** (gravar → transcrever → inserir) · 🌐 **Traduzir** o texto digitado · ✨ **Melhorar/revisar** · 🔊 **Ouvir** (TTS).

**Por trás:**

- **Painel-chat** — todo resultado abre num chat lateral com follow-up, busca online opcional e **streaming** com Markdown;
- **Persona & Memória** — entrevista + memórias locais (IndexedDB) com busca semântica opcional (embeddings);
- **Provedor principal + reservas** — se o principal falhar numa chamada, a reserva assume automaticamente;
- **Controles de geração** — temperatura, limite de tokens e regras personalizadas.

## 🚀 Instalação (usuário)

O caminho ilustrado e sempre atualizado está no site: **[tutorial de instalação](https://marreiradigital.github.io/webzap-ia/#instalacao)**. Em resumo:

1. Baixe o [webzap-ia.zip](https://marreiradigital.github.io/webzap-ia/webzap-ia.zip) e extraia numa pasta permanente;
2. `chrome://extensions` → ative o **Modo do desenvolvedor** → **Carregar sem compactação** → escolha a pasta;
3. Ícone da extensão → **Abrir opções** → cole a chave de pelo menos um provedor → **Testar conexão**;
4. Defina o **provedor principal e as reservas** e abra o [WhatsApp Web](https://web.whatsapp.com).

| Provedor   | Chat | Transcrição | Visão | Busca online | Embeddings | TTS |
|------------|:----:|:-----------:|:-----:|:------------:|:----------:|:---:|
| Anthropic  |  ✅  |      —      |  ✅   |      ✅      |     —      |  —  |
| OpenAI     |  ✅  |     ✅      |  ✅   |      —       |     ✅     | ✅  |
| Gemini     |  ✅  |     ✅      |  ✅   |      ✅      |     ✅     |  —  |
| OpenRouter |  ✅  |      —      | depende |    —       |     —      |  —  |

As chaves ficam **apenas no seu navegador** (`chrome.storage.local`); todo `fetch` acontece no service worker — a página do WhatsApp nunca vê a chave.

## 🛠️ Desenvolvimento

Stack: [WXT](https://wxt.dev) (MV3) · React · TypeScript · Tailwind CSS v4 · [Dexie](https://dexie.org) · **pnpm**.

```bash
pnpm install
pnpm dev          # Chrome de dev com HMR e a extensão carregada
pnpm compile      # typecheck
pnpm build        # gera .output/chrome-mv3
pnpm zip          # empacota (o zip do site fica em docs/webzap-ia.zip)
```

## 🗂️ Estrutura

```
webzap-ia/
├─ wxt.config.ts              # manifest MV3, matches, host_permissions (fonte única dos hosts)
├─ entrypoints/
│  ├─ background.ts           # service worker: ÚNICO lugar que faz fetch aos provedores (com failover)
│  ├─ content/                # UI injetada no WhatsApp (shadow root); index.tsx + style.css
│  ├─ options/                # página de configuração (React + Tailwind)
│  ├─ memory/                 # página Persona & Memória
│  └─ popup/                  # popup do ícone (toggle mestre + status)
├─ src/
│  ├─ providers/              # camada de IA: types, anthropic, openai, gemini, openrouter, registry
│  ├─ wa/                     # camada DOM do WhatsApp: selectors (fonte única), chat-reader, audio, composer, inject-buttons, auto-reply
│  ├─ ai/                     # prompts.ts (templates) + resolve.ts (cadeia principal → reservas)
│  ├─ memory/                 # Dexie: memórias, entrevista, recuperação (keyword + embeddings)
│  ├─ ui/                     # componentes React (content, options, memory, popup)
│  ├─ storage.ts              # config tipada e normalizada (chrome.storage.local)
│  └─ messaging.ts            # protocolo tipado content <-> background (mensagens + porta de streaming)
├─ docs/                      # site do GitHub Pages (landing + tutoriais + changelog dinâmico)
├─ CLAUDE.md                  # regras + arquitetura (lido automaticamente pelo Claude Code)
└─ .claude/
   ├─ SDD/                    # Spec Driven Development: 1 spec por feature ("o quê/por quê")
   └─ HARNESS/                # guias operacionais (adicionar provedor, atualizar seletores, guardrails)
```

## 🧭 Arquitetura & fluxo de dados

Camadas isoladas, cada uma com uma responsabilidade e uma **fonte única**:

```
Usuário no WhatsApp Web
   │  content lê o DOM visível  ─────────────►  src/wa/ (chat-reader, selectors)
   │  monta o prompt            ─────────────►  src/ai/prompts.ts
   ▼
content script  ──callBackground()/streamChat() (tipado, src/messaging.ts)──►  background
   ▼
background / service worker (entrypoints/background.ts)
   │  monta a cadeia principal → reservas  ──►  src/ai/resolve.ts  (+ src/storage.ts)
   │  faz o fetch (failover automático)    ──►  src/providers/*  (registry.ts)
   ▼
texto/stream  ──►  volta ao content  ──►  painel lateral (overlay por CSS, sem travar scroll)
```

**Regra de ouro:** as chaves de API só existem no **background**. O content script nunca faz fetch externo nem enxerga a chave.

## 🗺️ Mapa do código (onde mexer)

| Quero… | Arquivo(s) |
|---|---|
| Mudar/adicionar seletor do WhatsApp | [`src/wa/selectors.ts`](./src/wa/selectors.ts) (fonte única) |
| Adicionar um provedor de IA | `src/providers/<id>.ts` + [`registry.ts`](./src/providers/registry.ts) + `host_permissions` |
| Ajustar um prompt | [`src/ai/prompts.ts`](./src/ai/prompts.ts) |
| Ordem de prioridade / failover | [`src/ai/resolve.ts`](./src/ai/resolve.ts) (`resolveChain`, `eligibleProviders`) |
| Config/estado persistido | [`src/storage.ts`](./src/storage.ts) |
| Protocolo content ↔ background | [`src/messaging.ts`](./src/messaging.ts) |
| UI injetada (FAB, painel, botões por bolha) | [`src/ui/content/`](./src/ui/content/) + [`src/wa/inject-buttons.ts`](./src/wa/inject-buttons.ts) + [`entrypoints/content/style.css`](./entrypoints/content/style.css) |
| Página de opções / memória / popup | [`src/ui/options`](./src/ui/options/) · [`src/ui/memory`](./src/ui/memory/) · [`src/ui/popup`](./src/ui/popup/) |
| Site (GitHub Pages) | [`docs/index.html`](./docs/index.html) — changelog é carregado do [`CHANGELOG.md`](./CHANGELOG.md) em tempo real |

## 🤖 Documentação para contribuidores e agentes de IA

Para entender e evoluir o código (humano **ou** IA), comece por aqui — em ordem:

1. [`CLAUDE.md`](./CLAUDE.md) — regras, convenções e arquitetura. O Claude Code lê este arquivo automaticamente ao abrir o repositório.
2. [`.claude/SDD/00-overview.md`](./.claude/SDD/00-overview.md) — visão geral, com índice das specs por feature (o "o quê/por quê").
3. [`.claude/HARNESS/README.md`](./.claude/HARNESS/README.md) — fluxo de tarefa, checklist de PR e guias operacionais.

Princípio central: **reuse-first + fonte única** — antes de criar helper/seletor/URL, procure o existente. Nunca duplique seletor do WhatsApp, host de API ou prompt.

## 🔒 Privacidade

- Chaves de API e configurações: `chrome.storage.local` (só no seu dispositivo).
- Conteúdo das conversas: enviado **apenas** ao provedor de IA que você configurou, no momento em que você aciona uma ação (resumir, explicar, etc.). Nada é enviado a servidores próprios do projeto.
- Persona e memórias: IndexedDB local; você edita, arquiva ou apaga quando quiser.
- Detalhes: [PRIVACY.md](./PRIVACY.md).

## 📄 Licença

Uso pessoal/educacional. Sem garantias.
