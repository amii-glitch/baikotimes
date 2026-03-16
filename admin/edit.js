(function () {
  let spotsCache = [];

  function setMessage(text, type) {
    const node = document.getElementById('articleFormMessage');
    node.textContent = text || '';
    node.className = type ? `admin-message ${type}` : 'admin-message';
  }

  function splitTags(value) {
    return String(value || '')
      .split(',')
      .map(function (item) { return item.trim(); })
      .filter(Boolean);
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        resolve({ fileName: '', fileData: '' });
        return;
      }

      const reader = new FileReader();
      reader.onload = function () {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve({ fileName: file.name, fileData: base64 });
      };
      reader.onerror = function () {
        reject(new Error('ファイルの読み込みに失敗しました。'));
      };
      reader.readAsDataURL(file);
    });
  }

  function fillForm(spot) {
    document.getElementById('articleId').value = spot ? spot.id : '';
    document.getElementById('issueYear').value = spot ? spot.issueYear : '';
    document.getElementById('issueMonth').value = spot ? spot.issueMonth : '';
    document.getElementById('title').value = spot ? spot.title : '';
    document.getElementById('summary').value = spot ? (spot.summary || '') : '';
    document.getElementById('tags').value = spot ? (spot.tags || []).join(', ') : '';
    document.getElementById('fileInput').value = '';
    document.getElementById('coverInput').value = '';
  }

  function renderList() {
    const container = document.getElementById('articleList');
    if (!spotsCache.length) {
      container.innerHTML = '<p class="admin-empty">まだ記事がありません。新規作成から追加してください。</p>';
      return;
    }

    container.innerHTML = spotsCache.map(function (spot) {
      return `
        <article class="admin-article-item">
          <strong>${spot.title}</strong>
          <p class="admin-meta">${spot.issueYear}年${spot.issueMonth}月</p>
          <button class="admin-button admin-button-secondary admin-small" type="button" data-spot-id="${spot.id}">この内容を編集</button>
        </article>
      `;
    }).join('');

    container.querySelectorAll('[data-spot-id]').forEach(function (button) {
      button.addEventListener('click', function () {
        const target = spotsCache.find(function (spot) {
          return spot.id === button.getAttribute('data-spot-id');
        });
        fillForm(target);
        setMessage('既存記事を読み込みました。', 'is-success');
      });
    });
  }

  async function fetchSpots() {
    const response = await fetch('/api/admin/spots', {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '記事一覧の取得に失敗しました。');
    }
    spotsCache = Array.isArray(data.spots) ? data.spots : [];
    renderList();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('保存中です...', '');

    try {
      const id = document.getElementById('articleId').value.trim();
      const articleFile = document.getElementById('fileInput').files[0];
      const coverFile = document.getElementById('coverInput').files[0];
      const articlePayload = await fileToBase64(articleFile);
      const coverPayload = await fileToBase64(coverFile);

      const payload = {
        issueYear: Number(document.getElementById('issueYear').value),
        issueMonth: Number(document.getElementById('issueMonth').value),
        title: document.getElementById('title').value.trim(),
        summary: document.getElementById('summary').value.trim(),
        tags: splitTags(document.getElementById('tags').value),
        fileName: articlePayload.fileName,
        fileData: articlePayload.fileData,
        coverFileName: coverPayload.fileName,
        coverData: coverPayload.fileData
      };

      const isNew = !id;
      const endpoint = isNew ? '/api/spots' : `/api/admin/spots/${encodeURIComponent(id)}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        throw new Error(data.error || '保存に失敗しました。');
      }

      setMessage(isNew ? '新しい記事を追加しました。' : '記事を更新しました。', 'is-success');
      fillForm(null);
      await fetchSpots();
    } catch (error) {
      setMessage(error.message || '保存に失敗しました。', 'is-error');
    }
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (document.body.getAttribute('data-admin-page') !== 'edit') {
      return;
    }

    document.getElementById('articleForm').addEventListener('submit', handleSubmit);
    document.getElementById('newArticleButton').addEventListener('click', function () {
      fillForm(null);
      setMessage('新規記事モードに切り替えました。', 'is-success');
    });
    document.getElementById('resetFormButton').addEventListener('click', function () {
      fillForm(null);
      setMessage('', '');
    });

    try {
      await fetchSpots();
      fillForm(null);
    } catch (error) {
      setMessage(error.message || '記事一覧の取得に失敗しました。', 'is-error');
    }
  });
})();