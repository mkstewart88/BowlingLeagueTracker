import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CURRENT_APP_VERSION } from './utils/bowlingLogic';
import { maybeBootUpdatedRuntime } from './utils/runtimeUpdater';

async function bootstrapApp() {
  const tookOver = await maybeBootUpdatedRuntime(CURRENT_APP_VERSION);
  if (tookOver) return;

  const rootEl = document.getElementById('root');
  if (rootEl) {
    createRoot(rootEl).render(<App />);
  }
}

bootstrapApp();
