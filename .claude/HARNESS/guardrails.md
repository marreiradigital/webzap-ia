# HARNESS — Guardrails (inegociáveis)

Limites de segurança e conformidade que não se quebram sem decisão explícita do dono do projeto.

## Segredos

- Chaves de API só em `chrome.storage.local`. **Nunca** no content script, em logs, ou commitadas.
- `.env` e afins estão no `.gitignore`. Não commitar credenciais de teste reais.

## Rede

- Todo `fetch` a provedores acontece **no background** (service worker). O content nunca chama API externa diretamente.
- Só os domínios em `host_permissions` (`wxt.config.ts`). Adicionar um novo é decisão consciente.

## Envio de mensagens (conformidade WhatsApp)

- A v1 **não envia** nada: só insere sugestão no campo para o usuário revisar.
- Auto-envio (Fase 2) é **opt-in por chat**, desligado por padrão, e exige aceitar um modal com **aviso de banimento**.
- Sempre há **kill-switch** (interruptor mestre no popup) que desliga toda a UI/automação.
- Estratégia é **DOM only** — não injetar hooks nos módulos internos do WhatsApp.

## Privacidade

- Conteúdo de conversa só sai do dispositivo para o **provedor de IA configurado**, no momento de uma ação disparada pelo usuário. Nunca para servidores do projeto.
- Auto-treinamento (Fase 2) é opt-in e avisa que envia trechos ao provedor.

## Qualidade que também é regra

- pt-BR acentuado em texto visível; sem scroll-lock em dropdowns; responsivo.
- `pnpm compile` verde antes de commit.
