# Changelog

Todas as mudanças notáveis do **WebZap - IA**. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/); versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [0.6.2] - 2026-07-04

### Corrigido
- **Ícone de ações por mensagem voltou a aparecer.** A tentativa da 0.6.1 (overlay no hover) não renderizava em alguns layouts. Agora o botão é **injetado em cada bolha**, detectando a bolha pelo **estilo real** (fundo colorido + cantos arredondados) — independe de classe/atributo. Sempre visível, colado na mensagem.

### Adicionado
- **Traduzir** no menu de cada mensagem (além de explicar, transcrever, descrever, pesquisar).
- **Barra de ferramentas no campo de mensagem**: ditar (gravar áudio → transcrever → inserir), traduzir o texto digitado, melhorar/revisar o texto e ouvir (gerar áudio/TTS via OpenAI).

## [0.6.1] - 2026-07-04

### Corrigido
- **Direção das mensagens e auto-resposta**: passou a usar o atributo estável `data-id` (`true_…` = enviada, `false_…` = recebida) em vez das classes `.message-in`/`.message-out`. Envio da auto-resposta espera o botão aparecer (polling) com fallback para Enter. _(A tentativa de restaurar o ícone por mensagem via overlay nesta versão não funcionou — corrigido na 0.6.2.)_

## [0.6.0] - 2026-07-04

### Adicionado
- **Site do projeto (GitHub Pages)** em `docs/`: landing page com apresentação, recursos, passos de instalação e botão de download.
- **Busca semântica na memória (embeddings)**: providers OpenAI e Gemini geram embeddings; a recuperação de persona usa similaridade de cosseno quando há vetores, com fallback para keyword.
- **Direcionamento em grupo configurável**: campo de nomes/apelidos nas Opções; em grupo a auto-resposta dispara por `@` ou por esses nomes.
- **Badge no botão flutuante** indicando auto-resposta ativa (amarelo) ou auto-enviar (vermelho).
- **Publicação**: `PRIVACY.md` (política de privacidade) e `STORE.md` (guia da Chrome Web Store); `pnpm zip` gera o pacote.

### Corrigido
- **Ícone de ações por mensagem** voltou a aparecer: era injetado no DOM do WhatsApp e o React dele removia o nó/classe (sumia). Agora é overlay no shadow root, ancorado à bolha e reposicionado na rolagem.
- **Transcrição de áudio** aparece numa caixinha inline abaixo da própria bolha (antes abria no painel lateral).

## [0.5.0] - 2026-07-04

### Adicionado
- **Resposta automática** em 3 modos por conversa: sugerir no painel, rascunho, auto-enviar (com modal de aviso de banimento). Watcher com throttle, rebaseline ao trocar de conversa e kill-switch pelo interruptor mestre.
- **Auto-treinamento**: aprender memórias das conversas (manual pelo FAB e automático opt-in nas Opções).

## [0.4.0] - 2026-07-04

### Adicionado
- **Persona & Memória**: página com chat de entrevista (a IA aprende sobre você) e gestão de memórias (Dexie/IndexedDB, local). Persona injetada nas sugestões de resposta.

## [0.3.0] - 2026-07-03

### Adicionado
- **Pesquisar online** (Anthropic web search / Gemini grounding).
- **Painel-chat**: continuar perguntando (follow-up), **streaming** de escrita ao vivo e **Markdown** renderizado.
- **Descrever imagem** (visão) e discriminação de mídia (áudio/imagem/vídeo/documento).
- **Config de geração**: limite de tokens, temperatura e regras personalizadas (painel + Opções).
- Painel por conversa; ícone de IA por mensagem.

## [0.2.0] - 2026-07-03

### Adicionado
- Multi-provedor (Anthropic, OpenAI, Gemini, OpenRouter) com escolha por tarefa; página de Opções e popup.

## [0.1.0] - 2026-07-03

### Adicionado
- MVP: resumir conversa visível, explicar mensagem, transcrever áudio, sugerir resposta. Estrutura WXT + React + TS + Tailwind.
