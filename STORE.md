# Publicação na Chrome Web Store — WebZap - IA

Material e checklist para publicar a extensão.

## Gerar o pacote

```bash
pnpm build   # gera .output/chrome-mv3
pnpm zip     # gera .output/webzap-ia-<versao>-chrome.zip para subir na Store
```

Suba o `.zip` no [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (requer conta de desenvolvedor, taxa única).

## Descrição (listing)

**Nome:** WebZap - IA

**Resumo curto:** IA direto no WhatsApp Web: resumir conversas, transcrever áudios, explicar mensagens, sugerir e responder.

**Descrição longa:**
> Adicione inteligência artificial ao WhatsApp Web. Resuma conversas inteiras, transcreva áudios, descreva imagens, explique mensagens, pesquise online e receba sugestões de resposta — tudo com o provedor de IA que você já usa (Anthropic, OpenAI, Google Gemini ou OpenRouter).
>
> • Resumo da conversa (curto/médio/detalhado)
> • Ações por mensagem: explicar, transcrever áudio, descrever imagem, pesquisar online
> • Painel-chat: continue perguntando, com resposta em streaming e Markdown
> • Persona & Memória: ensine seu estilo à IA para respostas mais suas
> • Resposta automática opcional (sugerir / rascunho / auto-enviar)
>
> Suas chaves e dados ficam apenas no seu navegador. Nada é enviado a servidores do autor.
>
> ⚠️ Automatizar o WhatsApp pode violar os Termos de Uso; os recursos de envio são opcionais e desligados por padrão.

## Justificativa de permissões (exigido pela Store)

- **storage** — salvar suas chaves de API e configurações localmente.
- **host: web.whatsapp.com** — injetar a interface e ler as mensagens visíveis do chat aberto.
- **host: api.anthropic.com / api.openai.com / generativelanguage.googleapis.com / openrouter.ai** — enviar as requisições de IA diretamente ao provedor que você configurar.
- **Uso de código remoto:** nenhum. Todo o código é empacotado na extensão.

## Privacidade

- Política: ver [`PRIVACY.md`](./PRIVACY.md) (hospede-a numa URL pública e informe no dashboard).
- Data handling: a extensão processa conteúdo das conversas apenas sob ação do usuário, enviando somente ao provedor configurado. Sem analytics.

## Assets necessários

- [ ] Ícone 128×128 (já em `public/icon/128.png`).
- [ ] Screenshots 1280×800 (mín. 1): resumo, transcrição inline, painel-chat, Persona & Memória.
- [ ] Tile promocional 440×280 (opcional).
- [ ] URL da política de privacidade (pública).

## Observação de conformidade

A extensão automatiza a interface do WhatsApp Web, o que pode conflitar com os Termos de Uso do WhatsApp. Deixe claro na listagem que o uso é por conta e risco e que o envio automático é opcional/opt-in.
