# Changelog

Todas as mudanças notáveis do **WebZap - IA**. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/); versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [0.7.0] - 2026-07-04

### Adicionado
- **Provedor principal + reservas (failover automático)**: nova seção "Prioridade e reservas" nas Opções. Você define o provedor principal (um por vez, com "Tornar principal") e a ordem das reservas (↑/↓). Se o principal falhar numa chamada (erro, limite, fora do ar), a Reserva 1 assume **na mesma chamada**; se ela falhar, a Reserva 2 — e assim por diante. Vale para chat, streaming (antes do primeiro token), transcrição, embeddings e TTS.
- Cards de provedor mostram o papel atual (Principal / Reserva N); o popup mostra "Principal: X · Reservas: Y, Z".

### Alterado
- "Modelo por tarefa" continua existindo e tem precedência sobre a ordem; em "Automático", a tarefa segue a cadeia de prioridade.

## [0.6.3] - 2026-07-04

Revisão geral de fluxos, performance e robustez (auditoria completa do código).

### Corrigido
- **Ícone de IA agora aparece também nas mensagens recebidas**: a detecção de bolha olhava só o canto superior esquerdo, e bolha recebida com "rabinho" tem esse canto reto — toda recebida era descartada. Agora considera o maior raio entre os 4 cantos.
- **Clicar no ícone abre o menu de ações**: o botão ficava embaixo do menuzinho nativo do WhatsApp (que roubava o clique). Agora fica fora do canto da bolha, no lado livre, e só aparece ao passar o mouse na mensagem (menos poluição visual).
- **Auto-resposta não vaza mais entre conversas**: se você trocasse de chat enquanto a IA gerava, o rascunho/auto-envio ia parar na conversa errada; o cartão de sugestão também sobrevivia à troca. Agora tudo é amarrado à conversa de origem e re-checado após a geração.
- **Menção em grupo** casa palavra inteira ("chefe" não dispara em "chefeteria").
- **Streaming blindado**: se o service worker cair, o painel avisa em vez de ficar preso em "Gerando…"; fechar o painel aborta a geração no provedor (não gasta tokens à toa); timeout nas chamadas HTTP (120s/300s).
- **OpenAI o-series/gpt-5 (ex.: o4-mini)**: usa `max_completion_tokens` e omite `temperature` nos modelos de raciocínio (dava HTTP 400); teste de conexão com folga de tokens.
- **Config blindada**: config antiga/corrompida não derruba mais a UI; `maxTokens`/`temperature` inválidos voltam ao padrão.

### Desempenho
- WhatsApp não fica mais "travoso": fim do re-render contínuo a cada 700ms; observers com coalescing por frame; watcher de auto-resposta só varre o DOM se a conversa tem modo ligado; linhas já processadas não são re-varridas.
- Painel: Markdown memoizado (só o último turno re-parseia durante o streaming) e autoscroll que não rouba a rolagem de quem voltou para ler.
- Entrevista da memória: extração e próxima pergunta em paralelo (turno ~2x mais rápido); deduplicação de memórias em lote.

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
