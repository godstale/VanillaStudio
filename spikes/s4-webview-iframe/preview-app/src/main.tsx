import { createRoot } from 'react-dom/client';
import { App } from './App';

// App-owned bootstrap; scene modules below it are Fast Refresh boundaries.
createRoot(document.getElementById('root')!).render(<App />);
