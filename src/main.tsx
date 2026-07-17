import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import StickyDesktopApp from './components/StickyDesktopApp';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppDialogsProvider } from './context/AppDialogsContext';
import { ToastProvider } from './context/ToastContext';
import './index.css';
import {applyTheme, getStoredTheme} from './lib/theme';
import { defaultLogo } from './assets';
import { isElectronApp } from './lib/platform';

applyTheme(getStoredTheme());

const stickyWindow =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('sticky') === '1';

if (!isElectronApp()) {
  registerSW({ immediate: true });
}

let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
if (!link) {
  link = document.createElement('link');
  link.rel = 'icon';
  document.head.appendChild(link);
}
link.type = 'image/png';
link.href = defaultLogo;
document.title = stickyWindow ? '\u200b' : 'Lumina Notes';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {stickyWindow ? (
        <StickyDesktopApp />
      ) : (
        <ToastProvider>
          <AppDialogsProvider>
            <App />
          </AppDialogsProvider>
        </ToastProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
);
