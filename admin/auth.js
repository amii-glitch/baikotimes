(function () {
  async function fetchSession() {
    const response = await fetch('/api/admin/session', {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    return response.json();
  }

  async function requireAuth() {
    const data = await fetchSession();
    if (!data.authenticated) {
      window.location.replace('/admin/login.html');
      return false;
    }
    return true;
  }

  async function logout() {
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'same-origin'
    });
    window.location.replace('/admin/login.html');
  }

  document.addEventListener('DOMContentLoaded', async function () {
    const page = document.body.getAttribute('data-admin-page');

    if (page === 'login') {
      const current = await fetchSession();
      if (current.authenticated) {
        window.location.replace('/admin/dashboard.html');
        return;
      }

      const form = document.getElementById('adminLoginForm');
      const message = document.getElementById('adminLoginMessage');
      if (!form || !message) {
        return;
      }

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        message.textContent = 'ログイン中です...';
        message.className = 'admin-message';

        const formData = new FormData(form);
        const payload = {
          username: String(formData.get('username') || '').trim(),
          password: String(formData.get('password') || '').trim()
        };

        try {
          const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
          });
          const data = await response.json().catch(function () { return {}; });
          if (!response.ok) {
            throw new Error(data.error || 'ログインに失敗しました。');
          }
          window.location.replace('/admin/dashboard.html');
        } catch (error) {
          message.textContent = error.message || 'ログインに失敗しました。';
          message.className = 'admin-message is-error';
        }
      });
      return;
    }

    const ok = await requireAuth();
    if (!ok) {
      return;
    }

    document.querySelectorAll('[data-admin-logout="1"]').forEach(function (button) {
      button.addEventListener('click', function () {
        logout();
      });
    });
  });

  window.AdminAuth = {
    requireAuth: requireAuth,
    logout: logout
  };
})();