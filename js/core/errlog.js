// ============================================================
// ERROR COLLECTOR (debug / headless testing)
// Imported first by main.js so uncaught failures anywhere in module
// initialisation still land in the on-page #errlog buffer.
// ============================================================
const errlog = document.getElementById('errlog');
window.addEventListener('error', (e) => { errlog.textContent += `ERR: ${e.message} @ ${e.filename}:${e.lineno}\n`; });
window.addEventListener('unhandledrejection', (e) => { errlog.textContent += `REJ: ${e.reason}\n`; });
