import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// Configuracao do WXT (Manifest V3). Fonte unica dos host_permissions dos providers
// e do match do WhatsApp Web. Ver .claude/SDD/00-overview.md.
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'WebZap - IA',
    description:
      'Funcionalidades de IA direto no WhatsApp Web: resumir conversas, transcrever áudios, explicar mensagens, sugerir e responder.',
    // Permissoes minimas. "storage" para chaves/config; host_permissions para o WhatsApp
    // e para os endpoints dos providers (o fetch acontece no service worker).
    permissions: ['storage'],
    host_permissions: [
      'https://web.whatsapp.com/*',
      'https://api.anthropic.com/*',
      'https://api.openai.com/*',
      'https://generativelanguage.googleapis.com/*',
      'https://openrouter.ai/*',
    ],
    action: {
      default_title: 'WebZap - IA',
    },
  },
});
