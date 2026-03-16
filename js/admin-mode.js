(function () {
  const ADMIN_HASH = '#ADMIN';
  let panel;

  function ensurePanel() {
    if (panel) {
      return panel;
    }

    const style = document.createElement('style');
    style.textContent = `
      .admin-mode-panel {
        position: fixed;
        right: 16px;
        bottom: 16px;
        width: min(380px, calc(100vw - 24px));
        max-height: min(70vh, 520px);
        overflow: auto;
        z-index: 9999;
        background: #ffffff;
        border: 1px solid #d7dde8;
        border-radius: 12px;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
        padding: 14px 14px 10px;
        font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
        color: #22304b;
      }
      .admin-mode-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }
      .admin-mode-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
      }
      .admin-mode-close {
        border: 1px solid #d7dde8;
        background: #fff;
        border-radius: 8px;
        padding: 4px 8px;
        font: inherit;
        cursor: pointer;
      }
      .admin-mode-meta {
        margin: 0 0 8px;
        font-size: 0.9rem;
      }
      .admin-mode-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .admin-mode-list li {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        border-top: 1px solid #eef2f8;
        padding: 8px 0;
        font-size: 0.9rem;
      }
      .admin-mode-path {
        word-break: break-all;
      }
      .admin-mode-count {
        white-space: nowrap;
        font-weight: 700;
      }
      .admin-mode-error {
        color: #b42318;
        margin: 4px 0 0;
        font-size: 0.9rem;
      }
    `;
    document.head.appendChild(style);

    panel = document.createElement('section');
    panel.className = 'admin-mode-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="admin-mode-head">
        <h2 class="admin-mode-title">管理者モード</h2>
        <button type="button" class="admin-mode-close" aria-label="管理者モードを閉じる">閉じる</button>
      </div>
      <p class="admin-mode-meta" id="adminTotalViews">閲覧数を読み込み中...</p>
      <p class="admin-mode-meta" id="adminUpdatedAt"></p>
      <ul class="admin-mode-list" id="adminViewsList"></ul>
      <p class="admin-mode-error" id="adminViewsError" hidden></p>
    `;
    document.body.appendChild(panel);

    const closeButton = panel.querySelector('.admin-mode-close');
    closeButton.addEventListener('click', () => {
      if (window.location.hash.toUpperCase() === ADMIN_HASH) {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
      panel.hidden = true;
    });

    return panel;
  }

  async function loadStats() {
    const root = ensurePanel();
    const totalNode = root.querySelector('#adminTotalViews');
    const updatedAtNode = root.querySelector('#adminUpdatedAt');
    const listNode = root.querySelector('#adminViewsList');
    const errorNode = root.querySelector('#adminViewsError');
    errorNode.hidden = true;
    errorNode.textContent = '';
    totalNode.textContent = '閲覧数を読み込み中...';
    updatedAtNode.textContent = '';
    listNode.innerHTML = '';

    try {
      const response = await fetch('/api/admin/views', {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data || !data.stats) {
        throw new Error('閲覧数の取得に失敗しました。');
      }

      const stats = data.stats;
      const totalViews = Number(stats.totalViews) || 0;
      totalNode.textContent = `総閲覧数: ${totalViews.toLocaleString()}`;

      if (stats.updatedAt) {
        const dt = new Date(stats.updatedAt);
        updatedAtNode.textContent = Number.isNaN(dt.getTime())
          ? ''
          : `最終更新: ${dt.toLocaleString('ja-JP')}`;
      }

      const entries = Object.entries(stats.pages || {})
        .map(([path, count]) => ({ path, count: Number(count) || 0 }))
        .sort((a, b) => b.count - a.count);

      if (!entries.length) {
        listNode.innerHTML = '<li><span class="admin-mode-path">まだデータがありません</span><span class="admin-mode-count">0</span></li>';
      } else {
        listNode.innerHTML = entries
          .map((item) => `<li><span class="admin-mode-path">${escapeHtml(item.path)}</span><span class="admin-mode-count">${item.count.toLocaleString()}</span></li>`)
          .join('');
      }
    } catch (error) {
      totalNode.textContent = '閲覧数を表示できませんでした。';
      errorNode.hidden = false;
      errorNode.textContent = error && error.message ? error.message : 'エラーが発生しました。';
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  async function syncAdminModeByHash() {
    const hash = String(window.location.hash || '').trim().toUpperCase();
    const root = ensurePanel();
    if (hash === ADMIN_HASH) {
      root.hidden = false;
      await loadStats();
      return;
    }
    root.hidden = true;
  }

  window.addEventListener('hashchange', () => {
    syncAdminModeByHash();
  });

  window.addEventListener('DOMContentLoaded', () => {
    syncAdminModeByHash();
  });
})();
