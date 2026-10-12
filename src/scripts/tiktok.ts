// Swaps a TikTok facade for the official player iframe when the visitor presses play.
const ID = /^\d{15,21}$/;

const PLAY_ICON =
  '<svg class="tiktok-play" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="rgb(0 0 0 / 0.55)"></circle><path d="M26 20 46 32 26 44Z" fill="#fff"></path></svg>';

/** Turns `.tiktok-embed` placeholders from article Markdown into the same facade button. */
function upgradeEmbeds(root: ParentNode = document) {
  for (const embed of root.querySelectorAll<HTMLElement>('.tiktok-embed[data-tiktok-id]')) {
    const id = embed.dataset.tiktokId ?? '';
    if (!ID.test(id)) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tiktok-facade';
    button.dataset.tiktokId = id;
    button.dataset.title = 'Video TikTok';
    button.setAttribute('aria-label', 'Phát video TikTok');
    button.innerHTML = PLAY_ICON;
    embed.replaceChildren(button);
  }
}

function play(facade: HTMLElement) {
  const id = facade.dataset.tiktokId ?? '';
  if (!ID.test(id)) return;
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.tiktok.com/player/v1/${id}?autoplay=1&rel=0`;
  iframe.title = facade.dataset.title ?? 'Video TikTok';
  iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';
  iframe.className = 'tiktok-frame';
  facade.replaceWith(iframe);
  iframe.focus();
}

document.addEventListener('click', (event) => {
  const facade = (event.target as Element | null)?.closest<HTMLElement>('.tiktok-facade[data-tiktok-id]');
  if (!facade) return;
  event.preventDefault();
  play(facade);
});

upgradeEmbeds();
