import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from './Player';
import './play.css';

const root = document.getElementById('root');
if (!root) throw new Error('play: #root not found');
createRoot(root).render(
  <StrictMode>
    <Player />
  </StrictMode>,
);
