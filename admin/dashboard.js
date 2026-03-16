(function () {
  function formatDate(value) {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleString('ja-JP');
  }

  function createRecentArticleHtml(spot) {
    const issue = `${spot.issueYear}年${spot.issueMonth}月`;
    return `
      <article class="admin-article-item">
        <strong>${spot.title}</strong>
        <p class="admin-meta">${issue}</p>
        <a class="admin-link-button" href="./edit.html">編集画面へ</a>
      </article>
    `;
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (document.body.getAttribute('data-admin-page') !== 'dashboard') {
      return;
    }

    try {
      const [viewsResponse, spotsResponse] = await Promise.all([
        fetch('/api/admin/views', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/admin/spots', { cache: 'no-store', credentials: 'same-origin' })
      ]);

      const viewsData = await viewsResponse.json();
      const spotsData = await spotsResponse.json();
      if (!viewsResponse.ok) {
        throw new Error(viewsData.error || 'アクセス数の取得に失敗しました。');
      }
      if (!spotsResponse.ok) {
        throw new Error(spotsData.error || '記事一覧の取得に失敗しました。');
      }

      const stats = viewsData.stats || { totalViews: 0, pages: {}, updatedAt: null };
      document.getElementById('totalViews').textContent = String(stats.totalViews || 0);
      document.getElementById('trackedPages').textContent = String(Object.keys(stats.pages || {}).length);
      document.getElementById('updatedAt').textContent = formatDate(stats.updatedAt);

      const entries = Object.entries(stats.pages || {}).sort(function (left, right) {
        return right[1] - left[1];
      });

      const chart = new Chart(document.getElementById('viewsChart'), {
        type: 'bar',
        data: {
          labels: entries.map(function (entry) { return entry[0]; }),
          datasets: [{
            label: 'アクセス数',
            data: entries.map(function (entry) { return entry[1]; }),
            backgroundColor: '#d65986',
            borderRadius: 12
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              ticks: { color: '#707789' },
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              ticks: { color: '#707789' }
            }
          }
        }
      });

      if (!chart) {
        throw new Error('グラフ描画に失敗しました。');
      }

      const recentArticles = (spotsData.spots || []).slice(0, 5);
      document.getElementById('recentArticles').innerHTML = recentArticles.length
        ? recentArticles.map(createRecentArticleHtml).join('')
        : '<p class="admin-empty">まだ記事がありません。</p>';
    } catch (error) {
      document.getElementById('recentArticles').innerHTML = `<p class="admin-message is-error">${error.message || '読み込みに失敗しました。'}</p>`;
    }
  });
})();