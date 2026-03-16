const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 5174;
const ROOT = process.cwd();
const MAIL_TO = 'manapaioniajapan@gmail.com';
const SPOTS_PATH = path.join(ROOT, 'spots.json');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const VIEW_STATS_PATH = path.join(ROOT, 'view-stats.json');
const ADMIN_CODE = 'MPJ3';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'editor';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'MPJ3';
const ADMIN_SESSION_COOKIE = 'baiko_admin_session';
const ADMIN_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const adminSessions = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function sendRedirect(res, location) {
  res.writeHead(302, {
    Location: location,
    'Cache-Control': 'no-store'
  });
  res.end();
}

function send404(res) {
  res.writeHead(404, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end('404 Not Found');
}

function ensureViewStatsFile() {
  if (!fs.existsSync(VIEW_STATS_PATH)) {
    fs.writeFileSync(
      VIEW_STATS_PATH,
      `${JSON.stringify({ totalViews: 0, pages: {}, updatedAt: null }, null, 2)}\n`,
      'utf8'
    );
  }
}

function readViewStats() {
  ensureViewStatsFile();
  let raw = fs.readFileSync(VIEW_STATS_PATH, 'utf8');
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }
  try {
    const parsed = JSON.parse(raw || '{}');
    const totalViews = Number.isInteger(parsed.totalViews) ? parsed.totalViews : 0;
    const pages = parsed && typeof parsed.pages === 'object' && parsed.pages ? parsed.pages : {};
    const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null;
    return { totalViews, pages, updatedAt };
  } catch {
    const fallback = { totalViews: 0, pages: {}, updatedAt: null };
    fs.writeFileSync(VIEW_STATS_PATH, `${JSON.stringify(fallback, null, 2)}\n`, 'utf8');
    return fallback;
  }
}

function writeViewStats(stats) {
  fs.writeFileSync(VIEW_STATS_PATH, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  const out = {};
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (!name) {
      continue;
    }
    out[name] = decodeURIComponent(rest.join('='));
  }
  return out;
}

function createAdminSession() {
  const token = crypto.randomBytes(24).toString('hex');
  adminSessions.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + ADMIN_SESSION_MAX_AGE_MS
  });
  return token;
}

function purgeExpiredAdminSessions() {
  const now = Date.now();
  for (const [token, session] of adminSessions.entries()) {
    if (!session || session.expiresAt <= now) {
      adminSessions.delete(token);
    }
  }
}

function getAdminSession(req) {
  purgeExpiredAdminSessions();
  const cookies = parseCookies(req);
  const token = cookies[ADMIN_SESSION_COOKIE];
  if (!token) {
    return null;
  }
  const session = adminSessions.get(token);
  if (!session) {
    return null;
  }
  return { token, session };
}

function isAdminAuthenticated(req) {
  return Boolean(getAdminSession(req));
}

function buildSessionCookie(token) {
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(ADMIN_SESSION_MAX_AGE_MS / 1000)}`;
}

function clearSessionCookie() {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function incrementPageView(pagePath) {
  const safePath = String(pagePath || '/index.html');
  const stats = readViewStats();
  stats.totalViews += 1;
  stats.pages[safePath] = (Number(stats.pages[safePath]) || 0) + 1;
  stats.updatedAt = new Date().toISOString();
  writeViewStats(stats);
}

function readJsonBody(req, maxBytes = 20000) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let settled = false;
    let tooLarge = false;
    req.setEncoding('utf8');

    const fail = (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };

    const done = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    req.on('data', (chunk) => {
      if (tooLarge) {
        return;
      }
      raw += chunk;
      if (raw.length > maxBytes) {
        tooLarge = true;
        fail(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (tooLarge) {
        return;
      }
      try {
        done(JSON.parse(raw || '{}'));
      } catch {
        fail(new Error('Invalid JSON'));
      }
    });
    req.on('error', fail);
  });
}

function ensureSpotsFile() {
  if (!fs.existsSync(SPOTS_PATH)) {
    fs.writeFileSync(SPOTS_PATH, '[]\n', 'utf8');
  }
}

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function readSpots() {
  ensureSpotsFile();
  let raw = fs.readFileSync(SPOTS_PATH, 'utf8');
  // PowerShell's UTF-8 with BOM can break JSON.parse in Node.
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const brokenPath = `${SPOTS_PATH}.broken-${Date.now()}.json`;
    fs.writeFileSync(brokenPath, raw, 'utf8');
    fs.writeFileSync(SPOTS_PATH, '[]\n', 'utf8');
    return [];
  }
}

function writeSpots(spots) {
  fs.writeFileSync(SPOTS_PATH, `${JSON.stringify(spots, null, 2)}\n`, 'utf8');
}

function normalizeTags(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  const seen = new Set();
  const out = [];
  for (const tag of input) {
    const value = String(tag || '').trim().toLowerCase();
    if (!value || value.length > 30 || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
    if (out.length >= 12) {
      break;
    }
  }
  return out;
}

function sanitizeFilename(name) {
  const base = String(name || 'article')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return base || 'article';
}

function saveUploadedFile(fileName, fileDataBase64) {
  ensureUploadsDir();
  const safeName = sanitizeFilename(fileName);
  const uniqueName = `${Date.now()}-${safeName}`;
  const outPath = path.join(UPLOADS_DIR, uniqueName);
  const buffer = Buffer.from(String(fileDataBase64 || ''), 'base64');
  if (!buffer.length) {
    throw new Error('ファイルデータの読み込みに失敗しました。');
  }
  fs.writeFileSync(outPath, buffer);
  return `/uploads/${uniqueName}`;
}

function validateSpotInput(body, options = {}) {
  const requireFile = Boolean(options.requireFile);
  const issueYear = Number(body.issueYear);
  const issueMonth = Number(body.issueMonth);
  const title = String(body.title || '').trim();
  const summary = String(body.summary || '').trim();
  const tags = normalizeTags(body.tags);
  const fileName = String(body.fileName || '').trim();
  const fileData = String(body.fileData || '').trim().replace(/\s/g, '');
  const coverFileName = String(body.coverFileName || '').trim();
  const coverData = String(body.coverData || '').trim().replace(/\s/g, '');

  if (!Number.isInteger(issueYear) || issueYear < 1900 || issueYear > 2100) {
    throw new Error('年は1900〜2100の範囲で入力してください。');
  }

  if (!Number.isInteger(issueMonth) || issueMonth < 1 || issueMonth > 12) {
    throw new Error('月は1〜12の範囲で入力してください。');
  }

  if (!title) {
    throw new Error('記事タイトルを入力してください。');
  }

  if (title.length > 120) {
    throw new Error('記事タイトルは120文字以内で入力してください。');
  }

  if (summary.length > 400) {
    throw new Error('説明は400文字以内で入力してください。');
  }

  if (requireFile && (!fileName || !fileData)) {
    throw new Error('掲載するファイルを選択してください。');
  }

  if (fileData) {
    const padding = fileData.endsWith('==') ? 2 : fileData.endsWith('=') ? 1 : 0;
    const fileSizeBytes = Math.floor((fileData.length * 3) / 4) - padding;
    if (fileSizeBytes > 25 * 1024 * 1024) {
      throw new Error('ファイルサイズが大きすぎます。25MB以下にしてください。');
    }
  }

  if (coverData) {
    const coverPadding = coverData.endsWith('==') ? 2 : coverData.endsWith('=') ? 1 : 0;
    const coverSizeBytes = Math.floor((coverData.length * 3) / 4) - coverPadding;
    if (coverSizeBytes > 5 * 1024 * 1024) {
      throw new Error('表紙画像のサイズが大きすぎます。5MB以下にしてください。');
    }
  }

  return {
    issueYear,
    issueMonth,
    title,
    summary,
    tags,
    fileName,
    fileData,
    coverFileName,
    coverData
  };
}

async function sendQuestionEmail({ name, comment }) {
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch {
    throw new Error('サーバー設定エラー: nodemailer が未インストールです。');
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !port || !user || !pass || !from) {
    throw new Error('サーバー設定エラー: SMTP情報が不足しています。');
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  await transport.sendMail({
    from,
    to: MAIL_TO,
    subject: '【質問コーナー】新しいコメント',
    text: `お名前: ${name || '未記入'}\n\nコメント:\n${comment}`
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = req.url || '/';
  const parsedUrl = new URL(requestUrl, `http://${req.headers.host || `localhost:${PORT}`}`);
  const reqPath = decodeURIComponent(parsedUrl.pathname || '/');

  if (req.method === 'GET' && (reqPath === '/public' || reqPath === '/public/')) {
    sendRedirect(res, '/public/index.html');
    return;
  }

  if (req.method === 'GET' && (reqPath === '/admin' || reqPath === '/admin/')) {
    sendRedirect(res, isAdminAuthenticated(req) ? '/admin/dashboard.html' : '/admin/login.html');
    return;
  }

  if (req.method === 'POST' && (reqPath === '/api/admin/login' || reqPath === '/api/admin/login/')) {
    readJsonBody(req)
      .then((body) => {
        const username = String(body.username || '').trim();
        const password = String(body.password || '').trim();
        if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
          sendJson(res, 401, { error: 'ユーザー名またはパスワードが違います。' });
          return;
        }

        const token = createAdminSession();
        sendJson(
          res,
          200,
          { ok: true, user: { username: ADMIN_USERNAME } },
          { 'Set-Cookie': buildSessionCookie(token) }
        );
      })
      .catch(() => {
        sendJson(res, 400, { error: 'リクエスト形式が正しくありません。' });
      });
    return;
  }

  if (req.method === 'POST' && (reqPath === '/api/admin/logout' || reqPath === '/api/admin/logout/')) {
    const current = getAdminSession(req);
    if (current) {
      adminSessions.delete(current.token);
    }
    sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie() });
    return;
  }

  if (req.method === 'GET' && (reqPath === '/api/admin/session' || reqPath === '/api/admin/session/')) {
    sendJson(res, 200, {
      authenticated: isAdminAuthenticated(req),
      user: isAdminAuthenticated(req) ? { username: ADMIN_USERNAME } : null
    });
    return;
  }

  if (req.method === 'GET' && (reqPath === '/api/admin/views' || reqPath === '/api/admin/views/')) {
    const inputCode = String(parsedUrl.searchParams.get('code') || '').replace(/^#/, '').trim().toUpperCase();
    const allowed = isAdminAuthenticated(req) || inputCode === ADMIN_CODE;
    if (!allowed) {
      sendJson(res, 403, { error: 'forbidden' });
      return;
    }
    try {
      const stats = readViewStats();
      sendJson(res, 200, { ok: true, stats });
    } catch {
      sendJson(res, 500, { error: 'view stats read failed' });
    }
    return;
  }

  if (req.method === 'GET' && (reqPath === '/api/admin/spots' || reqPath === '/api/admin/spots/')) {
    if (!isAdminAuthenticated(req)) {
      sendJson(res, 401, { error: 'login required' });
      return;
    }
    try {
      sendJson(res, 200, { ok: true, spots: readSpots() });
    } catch {
      sendJson(res, 500, { error: 'spots.json の読み込みに失敗しました。' });
    }
    return;
  }

  if (req.method === 'GET' && (reqPath === '/api/spots' || reqPath === '/api/spots/')) {
    try {
      const spots = readSpots();
      sendJson(res, 200, { spots });
    } catch {
      sendJson(res, 500, { error: 'spots.json の読み込みに失敗しました。' });
    }
    return;
  }

  if (req.method === 'POST' && (reqPath === '/api/spots' || reqPath === '/api/spots/')) {
    if (!isAdminAuthenticated(req)) {
      sendJson(res, 401, { error: 'ログインが必要です。' });
      return;
    }
    readJsonBody(req, 60 * 1024 * 1024)
      .then((body) => {
        try {
          const spotInput = validateSpotInput(body, { requireFile: true });
          const filePath = saveUploadedFile(spotInput.fileName, spotInput.fileData);

          let coverPath = null;
          if (spotInput.coverFileName && spotInput.coverData) {
            coverPath = saveUploadedFile(spotInput.coverFileName, spotInput.coverData);
          }

          const spots = readSpots();
          const entry = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            issueYear: spotInput.issueYear,
            issueMonth: spotInput.issueMonth,
            title: spotInput.title,
            fileName: spotInput.fileName,
            filePath,
            summary: spotInput.summary,
            tags: spotInput.tags,
            coverPath,
            createdAt: new Date().toISOString()
          };
          spots.unshift(entry);
          writeSpots(spots);
          sendJson(res, 200, { ok: true, spot: entry });
        } catch (err) {
          sendJson(res, 500, { error: err && err.message ? err.message : 'spots.json の保存に失敗しました。' });
        }
      })
      .catch((err) => {
        if (String(err && err.message) === 'Payload too large') {
          sendJson(res, 413, { error: '送信サイズが大きすぎます。25MB以下のファイルで再試行してください。' });
          return;
        }
        sendJson(res, 400, { error: 'リクエスト形式が正しくありません。' });
      });
    return;
  }

  if (req.method === 'PUT' && reqPath.startsWith('/api/admin/spots/')) {
    if (!isAdminAuthenticated(req)) {
      sendJson(res, 401, { error: 'login required' });
      return;
    }

    const spotId = reqPath.split('/').pop();
    readJsonBody(req, 60 * 1024 * 1024)
      .then((body) => {
        try {
          const spotInput = validateSpotInput(body, { requireFile: false });
          const spots = readSpots();
          const index = spots.findIndex((spot) => spot.id === spotId);
          if (index === -1) {
            sendJson(res, 404, { error: '記事が見つかりません。' });
            return;
          }

          const current = spots[index];
          let nextFilePath = current.filePath;
          let nextFileName = current.fileName;
          if (spotInput.fileName && spotInput.fileData) {
            nextFilePath = saveUploadedFile(spotInput.fileName, spotInput.fileData);
            nextFileName = spotInput.fileName;
          }

          let nextCoverPath = current.coverPath || null;
          if (spotInput.coverFileName && spotInput.coverData) {
            nextCoverPath = saveUploadedFile(spotInput.coverFileName, spotInput.coverData);
          }

          spots[index] = {
            ...current,
            issueYear: spotInput.issueYear,
            issueMonth: spotInput.issueMonth,
            title: spotInput.title,
            summary: spotInput.summary,
            tags: spotInput.tags,
            fileName: nextFileName,
            filePath: nextFilePath,
            coverPath: nextCoverPath,
            updatedAt: new Date().toISOString()
          };

          writeSpots(spots);
          sendJson(res, 200, { ok: true, spot: spots[index] });
        } catch (err) {
          sendJson(res, 400, { error: err && err.message ? err.message : '記事の更新に失敗しました。' });
        }
      })
      .catch(() => {
        sendJson(res, 400, { error: 'リクエスト形式が正しくありません。' });
      });
    return;
  }

  if (req.method === 'POST' && (reqPath === '/api/questions' || reqPath === '/api/questions/')) {
    readJsonBody(req)
      .then(async (body) => {
        const name = String(body.name || '').trim().slice(0, 100);
        const comment = String(body.comment || '').trim();

        if (!comment) {
          sendJson(res, 400, { error: 'コメントを入力してください。' });
          return;
        }

        if (comment.length > 2000) {
          sendJson(res, 400, { error: 'コメントは2000文字以内で入力してください。' });
          return;
        }

        try {
          await sendQuestionEmail({ name, comment });
          sendJson(res, 200, { ok: true });
        } catch (err) {
          sendJson(res, 500, { error: err.message || '送信に失敗しました。' });
        }
      })
      .catch(() => {
        sendJson(res, 400, { error: 'リクエスト形式が正しくありません。' });
      });
    return;
  }

  let relPath = reqPath === '/' ? '/index.html' : reqPath;
  relPath = relPath.replace(/^\/+/, '');

  if ((relPath === 'admin/dashboard.html' || relPath === 'admin/edit.html') && !isAdminAuthenticated(req)) {
    sendRedirect(res, '/admin/login.html');
    return;
  }

  const filePath = path.resolve(ROOT, relPath);
  if (!filePath.startsWith(ROOT)) {
    send404(res);
    return;
  }

  fs.stat(filePath, (statErr, stat) => {
    if (statErr) {
      send404(res);
      return;
    }

    let target = filePath;
    if (stat.isDirectory()) {
      target = path.join(filePath, 'index.html');
    }

    fs.readFile(target, (readErr, data) => {
      if (readErr) {
        send404(res);
        return;
      }

      const ext = path.extname(target).toLowerCase();
      if (req.method === 'GET' && ext === '.html' && !relPath.startsWith('admin/')) {
        const pagePath = relPath.startsWith('/') ? relPath : `/${relPath}`;
        try {
          incrementPageView(pagePath);
        } catch {
          // Keep serving pages even if stats write fails.
        }
      }
      const type = MIME_TYPES[ext] || 'application/octet-stream';
      const headers = {
        'Content-Type': type,
        'Cache-Control': 'no-store'
      };
      if (ext === '.pdf') {
        const fileName = path.basename(target);
        headers['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`;
      }
      res.writeHead(200, headers);
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Dev server running: http://localhost:${PORT}`);
});
