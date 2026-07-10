import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { applyDisplaySettings, getInitialDisplaySettings } from './displaySettings';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/lexend/latin-400.css';
import '@fontsource/lexend/latin-600.css';
import '@fontsource/lexend/latin-700.css';
import '@fontsource/comic-neue/400.css';
import '@fontsource/comic-neue/700.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './styles.css';

const initialDisplaySettings = getInitialDisplaySettings();

applyDisplaySettings(initialDisplaySettings);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App initialDisplaySettings={initialDisplaySettings} />
  </React.StrictMode>,
);
