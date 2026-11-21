// "Install the game" (Add to Home Screen) and leaving full screen.
//
// • Android Chrome / Edge / Samsung: the browser fires `beforeinstallprompt` once the page qualifies
//   (manifest + service worker). We keep that event and show our own Install button; tapping it opens
//   the browser's install dialog. Installed, the game opens full screen in landscape (manifest.webmanifest).
// • iPhone / iPad: Safari has no install prompt, so the button shows how to use Share → Add to Home Screen.
// • Other Android browsers (Samsung Internet, Edge, Opera, Firefox…) build their own app package with an
//   old Android target, and Play Protect then warns "built for an older version of Android" (2025-26 reports:
//   github.com/SamsungInternet/support/issues/123). Chrome's package is signed via Google Play and installs
//   cleanly, so on those browsers we never fire their install prompt: we offer "Open in Chrome" instead.
// • Where Chrome has the newer Web Install API (navigator.install()), that is used first.
// • Imported from main.ts so the listener is in place before the browser fires the event.

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((f) => f());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // we show our own button instead of the browser's mini bar
  deferred = e as InstallPromptEvent;
  changed();
});
window.addEventListener('appinstalled', () => { deferred = null; changed(); });

/** Running as the installed app (opened from the home screen icon). */
export function isInstalled(): boolean {
  const mm = (q: string) => window.matchMedia?.(q).matches ?? false;
  return mm('(display-mode: fullscreen)') || mm('(display-mode: standalone)') || (navigator as { standalone?: boolean }).standalone === true;
}

const UA = navigator.userAgent;
export const isAndroid = (): boolean => /Android/i.test(UA);
/** Real Google Chrome on Android (not Samsung Internet, Edge, Opera, Firefox, Brave-like UA or an in-app WebView). */
export const isAndroidChrome = (): boolean =>
  isAndroid() && /Chrome\/\d/.test(UA) && !/SamsungBrowser|EdgA|OPR|Opera|Firefox|FxiOS|YaBrowser|UCBrowser|MiuiBrowser|HuaweiBrowser|DuckDuckGo|; wv\)/i.test(UA);

/** An Android intent link that opens this page in Chrome (falls back to the Play Store page for Chrome). */
export function openInChromeUrl(): string {
  const u = new URL(location.href);
  const store = encodeURIComponent('https://play.google.com/store/apps/details?id=com.android.chrome');
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${store};end`;
}

export const isIOS = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Show the Install button? (Other Android browsers get it too, so it can point them to Chrome.) */
export const canInstall = (): boolean =>
  !isInstalled() && (deferred !== null || isIOS() || (isAndroid() && !isAndroidChrome()) || hasWebInstall());

type WebInstallNavigator = Navigator & { install?: (url?: string, id?: string) => Promise<unknown> };
const hasWebInstall = () => isAndroidChrome() && typeof (navigator as WebInstallNavigator).install === 'function';

/** Called when canInstall() may have changed. Returns an unsubscribe function. */
export function onInstallChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

/**
 * Install the game. 'ios' = show the Share → Add to Home Screen steps; 'use-chrome' = this Android browser
 * would trigger the Play Protect warning, so offer "Open in Chrome"; 'unavailable' = use the browser menu.
 */
export async function install(): Promise<'accepted' | 'dismissed' | 'ios' | 'use-chrome' | 'unavailable'> {
  if (isAndroid() && !isAndroidChrome()) return 'use-chrome';
  if (hasWebInstall()) {
    try { await (navigator as WebInstallNavigator).install!(); changed(); return 'accepted'; }
    catch (e) { if ((e as DOMException)?.name === 'AbortError') return 'dismissed'; /* else fall back below */ }
  }
  if (deferred) {
    const e = deferred;
    deferred = null; // a prompt event can only be used once
    await e.prompt();
    const { outcome } = await e.userChoice;
    changed();
    return outcome;
  }
  return isIOS() ? 'ios' : 'unavailable';
}

/** Try to close the installed app. Browsers often refuse; returns false if the game is still open. */
export function tryCloseApp(): Promise<boolean> {
  window.close();
  return new Promise((r) => setTimeout(() => r(window.closed), 300));
}
