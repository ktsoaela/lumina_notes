import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppDialogsProvider } from './context/AppDialogsContext';
import './index.css';
import {applyTheme, getStoredTheme} from './lib/theme';

applyTheme(getStoredTheme());
import { defaultLogo } from './assets';

let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
if (!link) {
  link = document.createElement('link');
  link.rel = 'icon';
  document.head.appendChild(link);
}
link.type = 'image/png';
link.href = defaultLogo;
document.title = 'Lumina Notes';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppDialogsProvider>
      <App />
    </AppDialogsProvider>
  </StrictMode>,
);
