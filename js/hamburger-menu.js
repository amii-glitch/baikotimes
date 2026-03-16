// ハンバーガーメニュー制御
const hamburgerBtn = document.getElementById('hamburgerMenuBtn');
const hamburgerOverlay = document.getElementById('hamburgerMenuOverlay');
const hamburgerCards = document.querySelectorAll('.hamburger-menu-card');
const hamburgerClose = document.getElementById('hamburgerMenuClose');
const instagramLinks = document.querySelectorAll('.instagram-link');

if (!hamburgerBtn || !hamburgerOverlay || !hamburgerClose) {
  // メニュー要素がないページでは何もしない
} else {

function openHamburgerMenu() {
  hamburgerOverlay.classList.add('open');
  hamburgerOverlay.setAttribute('aria-hidden', 'false');
  hamburgerBtn.setAttribute('aria-expanded', 'true');
  document.body.classList.add('is-modal-open');
  setTimeout(() => {
    hamburgerOverlay.classList.add('fadein');
  }, 10);
}

function closeHamburgerMenu() {
  hamburgerOverlay.classList.remove('fadein');
  hamburgerOverlay.setAttribute('aria-hidden', 'true');
  hamburgerBtn.setAttribute('aria-expanded', 'false');
  setTimeout(() => {
    hamburgerOverlay.classList.remove('open');
    document.body.classList.remove('is-modal-open');
  }, 200);
}

hamburgerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  openHamburgerMenu();
});

hamburgerClose.addEventListener('click', closeHamburgerMenu);
hamburgerOverlay.addEventListener('click', (e) => {
  if (e.target === hamburgerOverlay) closeHamburgerMenu();
});
hamburgerCards.forEach((card) => {
  card.addEventListener('click', () => {
    closeHamburgerMenu();
  });
});

function isMobileDevice() {
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

function openInstagramProfile(event) {
  event.preventDefault();
  const link = event.currentTarget;
  const handle = link.getAttribute('data-instagram-handle') || 'baiko_gakuyu';
  const appUrl = `instagram://user?username=${encodeURIComponent(handle)}`;
  const webUrl = `https://www.instagram.com/${encodeURIComponent(handle)}/`;

  if (!isMobileDevice()) {
    window.open(webUrl, '_blank', 'noopener');
    return;
  }

  const clearFallback = () => {
    window.clearTimeout(fallbackTimer);
  };

  const fallbackTimer = window.setTimeout(() => {
    window.open(webUrl, '_blank', 'noopener');
  }, 700);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      clearFallback();
    }
  }, { once: true });
  window.addEventListener('pagehide', clearFallback, { once: true });

  window.location.href = appUrl;
}

instagramLinks.forEach((link) => {
  link.addEventListener('click', openInstagramProfile);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && hamburgerOverlay.classList.contains('open')) closeHamburgerMenu();
});
// カードのアニメーション
hamburgerOverlay.addEventListener('transitionend', () => {
  if (hamburgerOverlay.classList.contains('fadein')) {
    hamburgerCards.forEach((card, i) => {
      card.style.transitionDelay = (0.08 * i) + 's';
      card.classList.add('slidein');
    });
  } else {
    hamburgerCards.forEach(card => card.classList.remove('slidein'));
  }
});
}
