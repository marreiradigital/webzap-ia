import '@/assets/tailwind.css';
import ReactDOM from 'react-dom/client';
import MemoryApp from '@/src/ui/memory/MemoryApp';

// Sem React.StrictMode de proposito: evita efeitos duplicados que semeariam a
// entrevista duas vezes em desenvolvimento.
ReactDOM.createRoot(document.getElementById('root')!).render(<MemoryApp />);
