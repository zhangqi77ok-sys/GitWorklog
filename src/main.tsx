import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initTauriBridge } from './services/tauriBridge';

// Initialize universal IPC bridge before mounting UI
initTauriBridge();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
