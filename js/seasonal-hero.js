// 動画と季節ごとの色設定
// 動画ファイルは TIMES トップ画面動画 フォルダに配置されている前提
// サイトの色合いは body に季節クラスを付与してCSSで切り替え

(function() {
  // 月ごとの動画と季節名のマッピング
  const monthSettings = [
    { months: [3,4,5], upper: '桜.mp4', lower: '春.mp4', season: 'spring' },
    { months: [6,7,8], upper: '光.mp4', lower: '夏.mp4', season: 'summer' },
    { months: [9,10,11], upper: '紅葉.mp4', lower: '秋.mp4', season: 'autumn' },
    { months: [12,1,2], upper: '雪.mp4', lower: '冬.mp4', season: 'winter' },
  ];

  // 現在の月
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12

  // 設定を決定
  let setting = monthSettings.find(s => s.months.includes(month));
  if (!setting) setting = monthSettings[0];

  // 指定コミットと同じくサイト配下のuploadsを参照
  const videoBasePath = './uploads/';
  const upperVideo = videoBasePath + encodeURIComponent(setting.upper);
  const lowerVideo = videoBasePath + encodeURIComponent(setting.lower);

  // 動画要素を取得
  const upperSource = document.querySelector('.hero-video-base source');
  const lowerSource = document.querySelector('.hero-video-overlay source');
  const upperVideoTag = document.querySelector('.hero-video-base');
  const lowerVideoTag = document.querySelector('.hero-video-overlay');
  const tryPlay = (video) => {
    if (!video) {
      return;
    }
    video.muted = true;
    video.playsInline = true;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Autoplay may be blocked until user interaction on some devices.
      });
    }
  };
  if (upperSource && upperVideoTag) {
    upperSource.setAttribute('src', upperVideo);
    upperSource.setAttribute('type', 'video/mp4');
    upperVideoTag.load();
    upperVideoTag.addEventListener('canplay', () => tryPlay(upperVideoTag), { once: true });
  }
  if (lowerSource && lowerVideoTag) {
    lowerSource.setAttribute('src', lowerVideo);
    lowerSource.setAttribute('type', 'video/mp4');
    lowerVideoTag.load();
    lowerVideoTag.addEventListener('canplay', () => tryPlay(lowerVideoTag), { once: true });
  }

  // 背景色は白を維持しつつ、季節クラスで配色のみ切り替える
  document.body.classList.remove('season-spring', 'season-summer', 'season-autumn', 'season-winter');
  document.body.classList.add('season-' + setting.season);
})();
