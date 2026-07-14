/** True when running inside the Electron desktop shell (not a normal browser). */
export function isElectronApp(): boolean {
  if (typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)) {
    return true;
  }
  // Fallback from Electron loadURL (?desktop=1)
  if (typeof window !== 'undefined') {
    try {
      return new URLSearchParams(window.location.search).get('desktop') === '1';
    } catch {
      return false;
    }
  }
  return false;
}
