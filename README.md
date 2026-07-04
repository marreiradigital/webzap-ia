# WebZap - IA

[![Versão](https://img.shields.io/badge/vers%C3%A3o-0.6.2-25D366)](CHANGELOG.md)
[![Stars](https://img.shields.io/github/stars/marreiradigital/webzap-ia?style=flat&logo=github&color=25D366)](https://github.com/marreiradigital/webzap-ia/stargazers)
[![Forks](https://img.shields.io/github/forks/marreiradigital/webzap-ia?style=flat&logo=github&color=25D366)](https://github.com/marreiradigital/webzap-ia/network/members)
[![Último commit](https://img.shields.io/github/last-commit/marreiradigital/webzap-ia?color=25D366)](https://github.com/marreiradigital/webzap-ia/commits/main)

Extensão de navegador (Chrome/Edge, Manifest V3) que injeta funcionalidades de **IA direto no WhatsApp Web**: resumir conversas, transcrever áudios, explicar mensagens e sugerir respostas — usando o provedor de IA que você preferir (Anthropic, OpenAI, Google Gemini ou OpenRouter).

🌐 **Site:** https://marreiradigital.github.io/webzap-ia/ · 📦 **Download:** [webzap-ia.zip](https://marreiradigital.github.io/webzap-ia/webzap-ia.zip)

> ⚠️ **Aviso de conformidade.** Automatizar o WhatsApp Web pode violar os [Termos de Uso do WhatsApp](https://www.whatsapp.com/legal/terms-of-service) e, no modo auto-enviar, resultar em **bloqueio da conta**. Por padrão a extensão só lê o que está visível e insere sugestões no campo para você revisar; o envio automático é **opt-in por conversa** e exige aceitar um aviso. Use por sua conta e risco.

## ✨ Funcionalidades (v1)

- **Resumir a conversa visível** — resumo curto, médio ou detalhado (grupo ou conversa privada).
- **Ações por mensagem** — cada mensagem ganha um botão de IA colado a ela: **Explicar**, **Transcrever áudio**, **Descrever imagem** e **Pesquisar online**.
- **Painel-chat** — os resultados abrem num chat: dá para **continuar perguntando** (mais contexto, detalhar) e ligar a **busca online** na resposta. Cada conversa tem o seu painel.
- **Pesquisar online** — respostas atualizadas com fontes (Anthropic web search ou Gemini grounding).
- **Sugerir resposta** — 2–3 sugestões; clique para inserir no campo (você revisa e envia).
- **Controles de geração** — limite de tokens, temperatura e **regras/instruções personalizadas**, no painel ou nas Opções.
- **Multi-provedor** — Anthropic, OpenAI, Gemini e/ou OpenRouter, com escolha por tarefa.

### Também inclui (Fase 2)

- **Persona & Memória** — página de "entrevista" onde a IA aprende seu estilo/contexto e guarda como memória local (para respostas mais suas), com auto-treino opcional.
- **Resposta automática** com 3 modos por conversa (sugestão / rascunho para revisar / auto-envio), sempre opt-in e com aviso de banimento.
- **Streaming** (escrita ao vivo) e **Markdown** renderizado nas respostas.

## 🧱 Stack

- [WXT](https://wxt.dev) (framework para extensões, Manifest V3)
- React + TypeScript + Tailwind CSS v4
- [Dexie](https://dexie.org) (IndexedDB, usado na Fase 2 de memória)
- Gerenciador de pacotes: **pnpm**

## 🚀 Rodando em desenvolvimento

```bash
pnpm install
pnpm dev          # abre o Chrome com a extensão em modo dev (HMR)
```

O WXT abre um Chrome de desenvolvimento com a extensão já carregada. Acesse `https://web.whatsapp.com` (logado) e o botão flutuante **"Zap"** aparece no canto inferior direito.

## 📦 Build de produção

```bash
pnpm build        # gera .output/chrome-mv3
pnpm zip          # empacota para publicar
```

Para carregar manualmente: abra `chrome://extensions`, ative o **Modo do desenvolvedor**, clique em **Carregar sem compactação** e selecione a pasta `.output/chrome-mv3`.

## ⚙️ Configuração

1. Clique no ícone da extensão → **Abrir opções** (ou o botão flutuante "Zap" → "Opções / provedores").
2. Adicione a **chave de API** de pelo menos um provedor e clique em **Testar conexão**.
3. (Opcional) Defina qual provedor/modelo usar por tarefa.

As chaves de API ficam **apenas no seu navegador** (armazenamento local da extensão). Todo o `fetch` aos provedores acontece no service worker da extensão — as chaves nunca são expostas na página do WhatsApp.

| Provedor   | Chat | Transcrição | Imagem (visão) | Busca online |
|------------|:----:|:-----------:|:--------------:|:------------:|
| Anthropic  |  ✅  |     —       |       ✅       |      ✅      |
| OpenAI     |  ✅  |     ✅      |       ✅       |      —       |
| Gemini     |  ✅  |     ✅      |       ✅       |      ✅      |
| OpenRouter |  ✅  |     —       |     depende    |      —       |

## 🗂️ Estrutura

```
webzap-ia/
├─ wxt.config.ts              # manifest MV3, matches, host_permissions (fonte única dos hosts)
├─ entrypoints/
│  ├─ background.ts           # service worker: ÚNICO lugar que faz fetch aos provedores
│  ├─ content/               # UI injetada no WhatsApp (shadow root); index.tsx + style.css
│  ├─ options/                # página de configuração (React + Tailwind)
│  └─ popup/                  # popup do ícone (toggle mestre + status)
├─ src/
│  ├─ providers/              # camada de IA: types, anthropic, openai, gemini, openrouter, registry
│  ├─ wa/                     # camada DOM do WhatsApp: selectors (fonte única), chat-reader, audio, composer
│  ├─ ai/                     # prompts.ts (templates) + resolve.ts (provedor por tarefa)
│  ├─ ui/                     # componentes React (content, options, popup)
│  ├─ storage.ts              # config tipada (chrome.storage.local)
│  └─ messaging.ts            # protocolo tipado content <-> background
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
content script  ──callBackground() (mensagem tipada, src/messaging.ts)──►  background
   ▼
background / service worker (entrypoints/background.ts)
   │  resolve provedor + modelo da tarefa  ──►  src/ai/resolve.ts  (+ src/storage.ts)
   │  faz o fetch ao provedor              ──►  src/providers/*  (registry.ts)
   ▼
texto  ──►  volta ao content  ──►  painel lateral (overlay por CSS, sem travar scroll)
```

**Regra de ouro:** as chaves de API só existem no **background**. O content script nunca faz fetch externo nem enxerga a chave.

## 🗺️ Mapa do código (onde mexer)

| Quero… | Arquivo(s) |
|---|---|
| Mudar/adicionar seletor do WhatsApp | [`src/wa/selectors.ts`](./src/wa/selectors.ts) (fonte única) |
| Adicionar um provedor de IA | `src/providers/<id>.ts` + [`registry.ts`](./src/providers/registry.ts) + `host_permissions` |
| Ajustar um prompt | [`src/ai/prompts.ts`](./src/ai/prompts.ts) |
| Escolher provedor por tarefa | [`src/ai/resolve.ts`](./src/ai/resolve.ts) |
| Config/estado persistido | [`src/storage.ts`](./src/storage.ts) |
| Protocolo content ↔ background | [`src/messaging.ts`](./src/messaging.ts) |
| UI injetada (FAB, painel, hover) | [`src/ui/content/`](./src/ui/content/) + [`entrypoints/content/style.css`](./entrypoints/content/style.css) |
| Página de opções / popup | [`src/ui/options`](./src/ui/options/) · [`src/ui/popup`](./src/ui/popup/) |

## 🤖 Documentação para contribuidores e agentes de IA

Para entender e evoluir o código (humano **ou** IA), comece por aqui — em ordem:

1. [`CLAUDE.md`](./CLAUDE.md) — regras, convenções e arquitetura. O Claude Code lê este arquivo automaticamente ao abrir o repositório.
2. [`.claude/SDD/00-overview.md`](./.claude/SDD/00-overview.md) — visão geral, com índice das specs por feature (o "o quê/por quê").
3. [`.claude/HARNESS/README.md`](./.claude/HARNESS/README.md) — fluxo de tarefa, checklist de PR e guias operacionais.

Princípio central: **reuse-first + fonte única** — antes de criar helper/seletor/URL, procure o existente. Nunca duplique seletor do WhatsApp, host de API ou prompt.

## 🔒 Privacidade

- Chaves de API e configurações: `chrome.storage.local` (só no seu dispositivo).
- Conteúdo das conversas: enviado **apenas** ao provedor de IA que você configurou, no momento em que você aciona uma ação (resumir, explicar, etc.). Nada é enviado a servidores próprios do projeto.

## 📄 Licença

Uso pessoal/educacional. Sem garantias.
