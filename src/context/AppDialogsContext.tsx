import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
};

export type PromptOptions = {
  title: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type PendingConfirm = {
  kind: 'confirm';
  options: ConfirmOptions;
  resolve: (v: boolean) => void;
};

type PendingPrompt = {
  kind: 'prompt';
  options: PromptOptions;
  resolve: (v: string | null) => void;
};

type Pending = PendingConfirm | PendingPrompt;

type AppDialogsContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  promptText: (options: PromptOptions) => Promise<string | null>;
};

const AppDialogsContext = createContext<AppDialogsContextValue | null>(null);

export function useAppDialogs(): AppDialogsContextValue {
  const ctx = useContext(AppDialogsContext);
  if (!ctx) {
    throw new Error('useAppDialogs must be used within AppDialogsProvider');
  }
  return ctx;
}

export function AppDialogsProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [promptDraft, setPromptDraft] = useState('');
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pending?.kind === 'prompt') {
      setPromptDraft(pending.options.defaultValue ?? '');
    }
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => {
      if (pending.kind === 'prompt') {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (pending.kind === 'confirm') pending.resolve(false);
        else pending.resolve(null);
        setPending(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ kind: 'confirm', options, resolve });
    });
  }, []);

  const promptText = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPending({ kind: 'prompt', options, resolve });
    });
  }, []);

  const value = useMemo(
    () => ({ confirm, promptText }),
    [confirm, promptText]
  );

  const layer =
    pending &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        role="presentation"
      >
        <button
          type="button"
          aria-label="Dismiss"
          className="absolute inset-0 bg-black/50 backdrop-blur-[1px] transition-opacity dark:bg-black/60"
          onClick={() => {
            if (pending.kind === 'confirm') pending.resolve(false);
            else pending.resolve(null);
            setPending(null);
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cn(
            'relative z-10 w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl',
            'ring-1 ring-black/5 dark:ring-white/10'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id={titleId}
            className="text-lg font-semibold text-[var(--app-fg)]"
          >
            {pending.options.title}
          </h2>
          {pending.kind === 'confirm' ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-[var(--app-muted)]">
                {pending.options.message}
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-2 text-sm font-medium text-[var(--app-fg)] transition-colors hover:bg-gray-50 dark:hover:bg-[var(--app-bg)]"
                  onClick={() => {
                    pending.resolve(false);
                    setPending(null);
                  }}
                >
                  {pending.options.cancelLabel ?? 'Cancel'}
                </button>
                <button
                  type="button"
                  className={cn(
                    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface)]',
                    pending.options.variant === 'danger'
                      ? 'studio-btn-danger-solid !rounded-lg'
                      : 'bg-brand-700 hover:bg-brand-800'
                  )}
                  onClick={() => {
                    pending.resolve(true);
                    setPending(null);
                  }}
                >
                  {pending.options.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </>
          ) : (
            <>
              {pending.options.label ? (
                <label className="mt-4 block text-xs font-medium text-[var(--app-muted)]">
                  {pending.options.label}
                </label>
              ) : null}
              <input
                ref={inputRef}
                value={promptDraft}
                onChange={(e) => setPromptDraft(e.target.value)}
                placeholder={pending.options.placeholder}
                className={cn(
                  'mt-2 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)]',
                  'placeholder:text-[var(--app-muted)] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
                  !pending.options.label && 'mt-4'
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    pending.resolve(promptDraft.trim() || null);
                    setPending(null);
                  }
                }}
              />
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-4 py-2 text-sm font-medium text-[var(--app-fg)] transition-colors hover:bg-gray-50 dark:hover:bg-[var(--app-bg)]"
                  onClick={() => {
                    pending.resolve(null);
                    setPending(null);
                  }}
                >
                  {pending.options.cancelLabel ?? 'Cancel'}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface)]"
                  onClick={() => {
                    pending.resolve(promptDraft.trim() || null);
                    setPending(null);
                  }}
                >
                  {pending.options.confirmLabel ?? 'OK'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>,
      document.body
    );

  return (
    <AppDialogsContext.Provider value={value}>
      {children}
      {layer}
    </AppDialogsContext.Provider>
  );
}
