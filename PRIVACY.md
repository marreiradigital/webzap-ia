# Política de Privacidade — WebZap - IA

_Última atualização: 2026-07-04_

O **WebZap - IA** é uma extensão de navegador que adiciona funcionalidades de IA ao WhatsApp Web. Esta política explica quais dados a extensão processa e para onde eles vão.

## Resumo

- **A extensão não tem servidores próprios.** Nenhum dado é enviado para o autor da extensão.
- Suas **chaves de API** e **configurações** ficam **apenas no seu navegador** (`chrome.storage.local`).
- As **memórias** (Persona & Memória) ficam **apenas no seu navegador** (IndexedDB).
- O **conteúdo das conversas** só sai do seu dispositivo quando **você aciona uma ação** (resumir, explicar, transcrever, sugerir, pesquisar, auto-resposta), e vai **exclusivamente para o provedor de IA que você configurou** (Anthropic, OpenAI, Google Gemini ou OpenRouter).

## Dados processados

| Dado | Onde fica | Quando é enviado, e para quem |
|------|-----------|-------------------------------|
| Chaves de API | `chrome.storage.local` (local) | Usadas para autenticar as chamadas ao provedor escolhido. Nunca expostas na página do WhatsApp. |
| Configurações (modelos, limites, regras, modos) | `chrome.storage.local` (local) | Não são enviadas a lugar nenhum além de compor as chamadas ao provedor. |
| Memórias / persona | IndexedDB (local) | Trechos podem compor o prompt enviado ao provedor em sugestões/auto-resposta. |
| Conteúdo das mensagens visíveis | Lido do DOM sob demanda | Enviado ao provedor de IA configurado **apenas** quando você aciona uma ação. |
| Áudios (notas de voz) | Lidos do blob local sob demanda | Enviados ao provedor de transcrição (OpenAI/Gemini) quando você pede transcrição. |

## O que a extensão NÃO faz

- Não coleta analytics, telemetria ou identificadores.
- Não envia dados para servidores do autor.
- Não compartilha dados com terceiros além do provedor de IA que **você** configura.
- Não envia mensagens automaticamente, exceto se **você** ativar explicitamente o modo "auto-enviar" (que exibe um aviso de risco antes de ativar).

## Provedores de IA (terceiros)

Ao usar uma funcionalidade, os dados necessários são enviados ao provedor escolhido por você. O tratamento desses dados segue a política de privacidade do provedor:

- Anthropic — https://www.anthropic.com/legal/privacy
- OpenAI — https://openai.com/policies/privacy-policy
- Google Gemini — https://ai.google.dev/gemini-api/terms
- OpenRouter — https://openrouter.ai/privacy

## Controle e exclusão

- Remova chaves e configurações nas Opções da extensão.
- Gerencie/apague memórias na página **Persona & Memória**.
- Desinstalar a extensão remove todos os dados locais.

## Contato

Dúvidas: abra uma issue no repositório do projeto.
