import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import '@fontsource/comic-neue/400.css';
import '@fontsource/comic-neue/700.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
