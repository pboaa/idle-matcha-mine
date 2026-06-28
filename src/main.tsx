import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { MiningApp } from '@ui/mining/MiningApp';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root element not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <MiningApp />
  </StrictMode>,
);
