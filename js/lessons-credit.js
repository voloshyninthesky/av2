/* Footer credit for the /uk pages.

   The markup ships with the name visible — that is the credit, and it has to
   survive this script failing to load or run. All this does is fold it behind
   a heart that reveals it on click: an easter egg is a nice thing to have and
   a poor thing to depend on, so the enhancement is what gets added, never the
   credit itself.

   State lives in data-state, which the CSS reads; no attribute at all is the
   plain-name fallback. */

const credit = document.querySelector('.credit-toggle');

if (credit) {
  credit.dataset.state = 'heart';
  credit.addEventListener('click', () => {
    credit.dataset.state = credit.dataset.state === 'heart' ? 'name' : 'heart';
  });
}
