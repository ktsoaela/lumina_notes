/**
 * "Connect phone": ask the API for a short-lived pairing code and a
 * `lumina://pair?u=<server>&c=<code>` deep link to show as a QR.
 *
 * The link embeds the sync URL saved in Devices & sync. When none is saved
 * (bundled local API), the server substitutes its LAN address and sets `lan`.
 */
import { apiUrl, getSyncServerUrl } from './syncServer';
import { readApiError } from './validation';

export type PairStart = {
  code: string;
  expiresAt: string;
  serverUrl: string;
  deepLink: string;
  lan: boolean;
};

export async function startPairing(): Promise<PairStart> {
  const token = localStorage.getItem('lumina_token');
  const serverUrl = getSyncServerUrl();
  const res = await fetch(apiUrl('/api/pair/start'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(serverUrl ? { serverUrl } : {}),
  });
  if (!res.ok) throw new Error(await readApiError(res, 'Could not create a pairing code'));
  return res.json();
}

/** Whole seconds until `expiresAt`, never negative. */
export function secondsLeft(expiresAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000));
}
