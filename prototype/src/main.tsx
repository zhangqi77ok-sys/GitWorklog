import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { installHostTokenInterceptor } from './services/hostClient';

installHostTokenInterceptor();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
