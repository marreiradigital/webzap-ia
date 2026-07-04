# SDD — Resposta automática (Fase 2)

> Status: **planejado** (não implementado na v1). Este documento é o design.

## Objetivo

Deixar a IA responder por você em grupo/PV quando fizer sentido, com controle total do usuário e mínimo risco de banimento.

## Modos (o usuário escolhe por chat; padrão desligado)

1. **Sugestão em painel** — mostra a resposta proposta; você copia/usa.
2. **Rascunho + revisar** — escreve no campo (`composer.ts`) mas **não envia**; você revisa e aperta enviar.
3. **Auto-envio** — escreve e envia sozinho. Exige confirmação com **aviso de banimento** ao ativar; indicador visível de que está ligado.

## Gatilhos

- **Grupo**: só quando **mencionado/direcionado** — @menção ao usuário, reply à sua mensagem, ou um classificador leve via IA ("isto pede resposta minha?").
- **PV**: toda mensagem recebida, com throttle.

## Componentes

- `src/wa/observer.ts` (novo): `MutationObserver` em `#main` detecta novas mensagens recebidas.
- Usa **memória** (`persona-memory.md`) via `retriever.ts` para a resposta soar como o usuário.
- Estado por chat em `chrome.storage.local` (id derivado do header/DOM).

## Guardrails (obrigatórios)

- Nunca responder às próprias mensagens; cooldown entre respostas; limite por minuto.
- **Kill-switch global** no popup (o interruptor mestre já desliga tudo).
- Nada de auto-envio sem o modal de aviso aceito.

## Critérios de aceite

- Ativar "rascunho" num PV de teste gera rascunho no campo sem enviar.
- Auto-envio exige aceite do aviso e mostra indicador; kill-switch interrompe na hora.
