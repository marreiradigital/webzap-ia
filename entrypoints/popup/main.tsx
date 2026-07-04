import '@/assets/tailwind.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import PopupApp from '@/src/ui/popup/PopupApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
);
