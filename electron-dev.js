const { app, BrowserWindow, ipcMain } = require('electron');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const BASE_PORT = Number(process.env.PORT || 5173);

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: __dirname + '/preload.js' // preloadスクリプトが必要
    }
  });

  win.loadURL(url);

  // 開発ツールを開く（開発時のみ）
  // win.webContents.openDevTools();
}

ipcMain.handle('restart-app', () => {
  app.relaunch();
  app.exit();
});

app.whenReady().then(async () => {
  // 既存のサーバー起動コード
  const baseRunning = await isPortOpen(BASE_PORT);
  if (baseRunning) {
    const ready = await endpointExists(BASE_PORT, '/api/spots');
    if (ready) {
      const url = `http://localhost:${BASE_PORT}`;
      console.log(`Dev server already running: ${url}`);
      createWindow(url);
      return;
    }
  }

  const launchPort = baseRunning ? await findAvailablePort(BASE_PORT + 1) : BASE_PORT;
  const url = `http://localhost:${launchPort}`;
  const server = spawn(process.execPath, ['dev-server.js'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(launchPort) }
  });

  setTimeout(() => createWindow(url), 1200);

  const shutdown = (code = 0) => {
    if (!server.killed) {
      server.kill();
    }
    app.quit();
  };

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
  server.on('exit', (code) => app.quit());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // 再作成が必要なら
  }
});

// 既存の関数はそのまま
function isPortOpen(port, host = '127.0.0.1', timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const done = (value) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(value);
      }
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

function endpointExists(port, endpoint = '/api/spots', timeoutMs = 800) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: endpoint,
        method: 'GET',
        timeout: timeoutMs
      },
      (res) => {
        resolve((res.statusCode || 0) < 500 && (res.statusCode || 0) !== 404);
        res.resume();
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function findAvailablePort(startPort, maxProbe = 30) {
  for (let i = 0; i < maxProbe; i += 1) {
    const port = startPort + i;
    // eslint-disable-next-line no-await-in-loop
    const busy = await isPortOpen(port);
    if (!busy) {
      return port;
    }
  }
  return startPort + maxProbe;
}
