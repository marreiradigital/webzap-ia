import './style.css';
import ReactDOM from 'react-dom/client';
import { defineContentScript, createShadowRootUi } from '#imports';
import App from '@/src/ui/content/App';
import { HOST_TAG } from '@/src/ui/content/constants';

// Injeta a UI da extensao no WhatsApp Web dentro de um shadow root isolado.
export default defineContentScript({
  matches: ['https://web.whatsapp.com/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: HOST_TAG,
      position: 'inline',
      anchor: 'body',
      onMount(container) {
        const app = document.createElement('div');
        container.append(app);
        const root = ReactDOM.createRoot(app);
        root.render(<App />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
  },
});
