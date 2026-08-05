// ============================================================
// TELEGRAM IN-APP BROWSER / MINI APP
// Vertical/side swipes can dismiss Telegram's webview. Mini Apps can call
// disableVerticalSwipes(); plain in-app browser only gets best-effort touch
// claiming. Importing this module installs the guards.
// ============================================================
export function isTelegramEnvironment() {
  const tg = window.Telegram?.WebApp;
  if (tg && (typeof tg.initData === 'string' || tg.platform)) return true;
  // Mini App launch params ride in the hash; iOS Telegram's UA is anonymous.
  if (/[#&]tgWebApp(Data|Version|Platform)=/.test(location.hash || '')) return true;
  try { if (sessionStorage.getItem('__inTelegramWebApp') === '1') return true; } catch (_) {}
  return /Telegram/i.test(navigator.userAgent || '');
}

function applyTelegramCloseGuards(tg) {
  try {
    tg.ready?.();
    if (!tg.isExpanded) tg.expand?.();
    if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
  } catch (_) { /* older Telegram clients */ }
}

let telegramGuardEventsBound = false;
function initTelegramEnvironment() {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    applyTelegramCloseGuards(tg);
    // Telegram can collapse the viewport / shed the swipe lock after keyboard
    // opens, backgrounding, or shell re-activation — re-assert every time.
    if (!telegramGuardEventsBound && typeof tg.onEvent === 'function') {
      telegramGuardEventsBound = true;
      const reassert = () => applyTelegramCloseGuards(tg);
      try {
        tg.onEvent('viewportChanged', reassert);
        tg.onEvent('activated', reassert);
      } catch (_) { /* older Telegram clients */ }
    }
  }
  if (isTelegramEnvironment()) {
    document.documentElement.classList.add('telegram-webview');
  }
}
initTelegramEnvironment();
window.__telegramReady?.then(initTelegramEnvironment);
