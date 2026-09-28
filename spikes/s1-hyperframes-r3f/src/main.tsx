import { createRoot } from 'react-dom/client';
import { Scene } from './Scene';
import { installClock } from './clock';

createRoot(document.getElementById('root')!).render(<Scene />);
installClock();
