# WebZap - IA

Extensão de navegador (Chrome/Edge, Manifest V3) que injeta funcionalidades de **IA direto no WhatsApp Web**: resumir conversas, transcrever áudios, explicar mensagens e sugerir respostas — usando o provedor de IA que você preferir (Anthropic, OpenAI, Google Gemini ou OpenRouter).

> ⚠️ **Aviso de conformidade.** Automatizar o WhatsApp Web pode violar os [Termos de Uso do WhatsApp](https://www.whatsapp.com/legal/terms-of-service) e, em casos de envio automático, resultar em **bloqueio da conta**. Esta extensão lê apenas o que está visível na tela e **nunca envia mensagens sozinha** na versão atual — as sugestões são inseridas no campo para você revisar e enviar. Use por sua conta e risco.

## ✨ Funcionalidades (v1 / MVP)

- **Resumir a conversa visível** — resumo curto, médio ou detalhado do que está na tela (grupo ou conversa privada).
- **Explicar uma mensagem** — passe o mouse sobre qualquer mensagem e clique no ícone **IA** → "Explicar do que se trata".
- **Transcrever áudios** — transcrição de notas de voz (requer OpenAI ou Gemini).
- **Sugerir resposta** — gera 2–3 sugestões com base na conversa; clique para inserir no campo (você revisa e envia).
- **Multi-provedor** — configure Anthropic, OpenAI, Gemini e/ou OpenRouter, e escolha qual usar por tarefa.

### Planejado (Fase 2)

- Pesquisar online a partir de uma mensagem.
- **Persona & Memória** — uma página de "entrevista" onde a IA aprende seu estilo/contexto e guarda como memória local (para respostas mais suas).
- **Resposta automática** com 3 modos (sugestão / rascunho para revisar / auto-envio), sempre opt-in e com aviso de banimento.

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

| Provedor   | Chat | Transcrição de áudio |
|------------|:----:|:--------------------:|
| Anthropic  |  ✅  |          —           |
| OpenAI     |  ✅  |          ✅          |
| Gemini     |  ✅  |          ✅          |
| OpenRouter |  ✅  |          —           |

## 🗂️ Estrutura

```
entrypoints/     # background, content (UI injetada), popup, options
src/providers/   # camada de IA (fonte única; 1 arquivo por provedor + registry)
src/wa/          # camada DOM do WhatsApp (seletores centralizados)
src/ai/          # prompts + resolução de provedor por tarefa
src/ui/          # componentes React (content, options, popup)
.claude/SDD/     # Spec Driven Development (o "o quê/por quê" de cada feature)
.claude/HARNESS/ # convenções para desenvolvimento assistido por IA
```

Detalhes de arquitetura e convenções: veja [`CLAUDE.md`](./CLAUDE.md) e [`.claude/SDD/00-overview.md`](./.claude/SDD/00-overview.md).

## 🔒 Privacidade

- Chaves de API e configurações: `chrome.storage.local` (só no seu dispositivo).
- Conteúdo das conversas: enviado **apenas** ao provedor de IA que você configurou, no momento em que você aciona uma ação (resumir, explicar, etc.). Nada é enviado a servidores próprios do projeto.

## 📄 Licença

Uso pessoal/educacional. Sem garantias.
