import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Loader2, Smartphone } from 'lucide-react';
import { secondsLeft, startPairing, type PairStart } from '../lib/pairing';
import { cn } from '../lib/utils';

const mutedText = 'text-sm text-[var(--app-muted)]';
const secondaryBtn =
  'inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] px-4 py-2 text-xs font-medium text-[var(--app-muted)] hover:bg-[var(--gutter)] hover:text-[var(--app-fg)]';

function formatLeft(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Devices & sync → Connect phone: pairing QR + copyable `lumina://pair` link. */
export function ConnectPhonePanel() {
  const [pair, setPair] = useState<PairStart | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pair) return;
    const tick = () => setLeft(secondsLeft(pair.expiresAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [pair]);

  const create = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const next = await startPairing();
      setQr(await QRCode.toDataURL(next.deepLink, { margin: 1, width: 220 }));
      setPair(next);
    } catch (e) {
      setPair(null);
      setQr(null);
      setError(e instanceof Error ? e.message : 'Could not create a pairing code');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!pair) return;
    try {
      await navigator.clipboard.writeText(pair.deepLink);
      setCopied(true);
    } catch {
      setError('Copy failed — select the link and copy it manually.');
    }
  };

  const expired = pair != null && left <= 0;

  return (
    <div className="mt-8 border-t border-[var(--app-border)] pt-6">
      <h3 className="mb-1 flex items-center gap-2 font-display text-sm font-medium text-[var(--app-fg)]">
        <Smartphone className="h-4 w-4" />
        Connect phone
      </h3>
      <p className={cn(mutedText, 'mb-4')}>
        Open Lumina Notes on your phone and tap <strong>Scan to connect</strong>. No server URL to
        type — the code signs the phone in to this account once and expires after 5 minutes.
      </p>

      {pair && qr && !expired ? (
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <img
            src={qr}
            alt="Pairing QR code"
            width={220}
            height={220}
            className="rounded-lg bg-white p-2"
          />
          <div className="min-w-0 space-y-2">
            <p className={mutedText}>
              Server: <span className="font-mono text-[var(--app-fg)]">{pair.serverUrl}</span>
            </p>
            <p className={mutedText}>
              Code: <span className="font-mono text-[var(--app-fg)]">{pair.code}</span> · expires in{' '}
              <span className="font-mono">{formatLeft(left)}</span>
            </p>
            <p className="break-all font-mono text-xs text-[var(--app-muted)]">{pair.deepLink}</p>
            <button type="button" className={secondaryBtn} onClick={copy}>
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copied' : 'Copy link'}
            </button>
            {pair.lan ? (
              <p className={cn(mutedText, 'text-xs')}>
                Using this PC&apos;s Wi‑Fi address. The phone must be on the same Wi‑Fi, and the
                local API must accept LAN connections (start it with{' '}
                <span className="font-mono">LUMINA_HOST=0.0.0.0</span>).
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {expired ? <p className={cn(mutedText, 'mb-3')}>Code expired. Create a new one.</p> : null}

      <button
        type="button"
        disabled={busy}
        className="studio-btn-primary inline-flex items-center gap-2 !px-4 !py-2 !text-xs"
        onClick={create}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />}
        {pair ? 'New code' : 'Create pairing code'}
      </button>

      {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
