# HARNESS — Engenharia agêntica do WebZap - IA

Guias e guardrails para trabalhar neste repositório (humano ou IA). Complementa [`../../CLAUDE.md`](../../CLAUDE.md) (regras) e [`../SDD/`](../SDD/) (specs).

## Fluxo de uma tarefa

1. **Ler a spec** relevante em `.claude/SDD/` antes de codar. Se o comportamento muda, atualize a spec na mesma entrega.
2. **Reuse-first**: procure helper/registry/seletor existente antes de criar. Fontes únicas: `src/wa/selectors.ts`, `src/providers/registry.ts`, `src/ai/prompts.ts`, `src/storage.ts`.
3. **Implementar** respeitando as camadas (content lê DOM; background faz fetch; nada de chave no content).
4. **Validar**: `pnpm compile` (typecheck) e, quando tocar em UI/DOM, testar no WhatsApp Web via `pnpm dev`.
5. **Commit** incremental (1 preocupação), header pt-BR sem acento.

## Guias

- [`adicionar-provider.md`](./adicionar-provider.md) — como plugar um provedor de IA novo.
- [`atualizar-seletores.md`](./atualizar-seletores.md) — quando o WhatsApp muda o layout.
- [`guardrails.md`](./guardrails.md) — limites de segurança/conformidade que não se quebram.

## Checklist de PR

- [ ] Spec atualizada (se comportamento mudou).
- [ ] Sem seletor do WhatsApp fora de `selectors.ts`; sem URL/host hardcoded fora da camada de provider/config.
- [ ] Texto visível ao usuário em pt-BR acentuado.
- [ ] Sem scroll-lock em dropdown/menu.
- [ ] `pnpm compile` passa; `pnpm build` passa.
- [ ] Nenhuma chave logada/commitada; envio continua opt-in.
