import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { isElectronApp } from '../lib/platform';

const DISMISS_KEY = 'lumina_pwa_install_dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Banner to install Lumina as an app on phone/tablet (PWA).
 * Shows browser “Add to Home Screen” tip when beforeinstallprompt is unavailable (e.g. iOS Safari).
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isElectronApp()) return;
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      /* ignore */
    }

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      ('standalone' in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true);
    if (standalone) return;

    const isNarrow = window.matchMedia('(max-width: 1023px)').matches;
    if (!isNarrow) return;

    const isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
      setIosHint(false);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    if (isIos) {
      setIosHint(true);
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    dismiss();
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="region"
      aria-label="Install Lumina Notes"
    >
      <div className="pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--paper)] px-3 py-3 shadow-[var(--shadow-soft)]">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--sage)] text-[var(--spine)]">
          <Smartphone className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--app-fg)]">
            Install for reading on the go
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--app-muted)]">
            {iosHint && !deferred
              ? 'On iPhone/iPad: tap Share, then Add to Home Screen — open Lumina like an app and read your Markdown notes anywhere.'
              : 'Add Lumina to your home screen. Sign in once, then open your books and pages on phone or tablet.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {deferred ? (
              <button
                type="button"
                onClick={() => void install()}
                className="studio-btn-primary inline-flex items-center gap-1.5 !px-3 !py-1.5 !text-xs"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Install app
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--app-muted)] hover:bg-[var(--gutter)] hover:text-[var(--app-fg)]"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full p-1 text-[var(--app-muted)] hover:bg-[var(--gutter)] hover:text-[var(--app-fg)]"
          aria-label="Dismiss install tip"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
