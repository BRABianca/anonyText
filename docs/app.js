const phoneEl = document.getElementById('phone');
const messageEl = document.getElementById('message');
const dryRunEl = document.getElementById('dryRun');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const resultEl = document.getElementById('result');
const repliesEl = document.getElementById('replies');
const refreshRepliesBtn = document.getElementById('refreshRepliesBtn');
const repliesStatusEl = document.getElementById('repliesStatus');
const apiBaseValueEl = document.getElementById('apiBaseValue');
const envValueEl = document.getElementById('envValue');
const quotaValueEl = document.getElementById('quotaValue');
const authValueEl = document.getElementById('authValue');
const loginPanelEl = document.getElementById('loginPanel');
const loginPasswordEl = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginResultEl = document.getElementById('loginResult');

const API_BASE_URL = (window.API_BASE_URL || '').toString().replace(/\/+$/, '');

function apiUrl(path) {
  if (!API_BASE_URL) return path;
  return API_BASE_URL + path;
}

const AUTO_REFRESH_MS = Number(window.AUTO_REFRESH_MS) || 5000;
const QUOTA_REFRESH_MS = 15000;

if (apiBaseValueEl) {
  apiBaseValueEl.textContent = API_BASE_URL || window.location.origin;
}

function getToken() {
  return localStorage.getItem('authToken') || '';
}

function setToken(token) {
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
  renderAuthState();
}

function setLoginResult(obj, ok) {
  if (!loginResultEl) return;
  loginResultEl.className = ok ? 'ok' : 'error';
  loginResultEl.textContent = JSON.stringify(obj, null, 2);
}

function renderAuthState() {
  const authed = Boolean(getToken());
  if (authValueEl) authValueEl.textContent = authed ? 'on' : 'off';
  if (logoutBtn) logoutBtn.disabled = !authed;
  if (loginPasswordEl) loginPasswordEl.disabled = authed;
  if (loginBtn) loginBtn.disabled = authed;
}

function setResult(obj, ok) {
  resultEl.className = ok ? 'ok' : 'error';
  resultEl.textContent = JSON.stringify(obj, null, 2);
}

function setReplies(obj, ok) {
  repliesEl.className = ok ? 'ok' : 'error';
  repliesEl.textContent = JSON.stringify(obj, null, 2);
}

async function send() {
  const phone = (phoneEl.value || '').trim();
  const message = (messageEl.value || '').trim();
  const dryRun = dryRunEl.checked;
  const token = getToken();

  if (!dryRun && !token) {
    setResult({ success: false, error: 'Faça login para enviar SMS real' }, false);
    return;
  }

  sendBtn.disabled = true;
  resultEl.className = '';
  resultEl.textContent = 'Enviando...';

  try {
    const url = dryRun ? apiUrl('/sms?dryRun=1') : apiUrl('/sms');
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(dryRun ? {} : { Authorization: 'Bearer ' + token })
      },
      body: JSON.stringify({ phone, message })
    });

    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { success: false, error: 'Resposta não-JSON do servidor', raw: text };
    }

    setResult({ httpStatus: resp.status, ...data }, resp.ok && data && data.success);
  } catch (err) {
    setResult({ success: false, error: String(err) }, false);
  } finally {
    sendBtn.disabled = false;
  }
}

async function loadQuota() {
  try {
    const token = getToken();
    if (!token) {
      if (envValueEl) envValueEl.textContent = '-';
      if (quotaValueEl) quotaValueEl.textContent = '-';
      return;
    }

    const resp = await fetch(apiUrl('/sms/quota'), { method: 'GET', headers: { Authorization: 'Bearer ' + token } });
    const text = await resp.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { success: false };
    }

    if (envValueEl) {
      envValueEl.textContent = data?.environment || '-';
    }

    if (quotaValueEl) {
      quotaValueEl.textContent =
        typeof data?.quotaRemaining === 'number' ? String(data.quotaRemaining) : data?.quotaRemaining ?? '-';
    }
  } catch {
    if (quotaValueEl) quotaValueEl.textContent = '-';
  }
}

async function loadReplies() {
  refreshRepliesBtn.disabled = true;
  repliesStatusEl.textContent = 'Carregando...';

  try {
    const token = getToken();
    if (!token) {
      setReplies({ success: false, error: 'Faça login para ver replies' }, false);
      repliesStatusEl.textContent = 'Login necessário';
      return;
    }

    const resp = await fetch(apiUrl('/sms/replies'), { method: 'GET', headers: { Authorization: 'Bearer ' + token } });
    const text = await resp.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { success: false, error: 'Resposta não-JSON do servidor', raw: text };
    }

    if (!resp.ok) {
      setReplies({ httpStatus: resp.status, ...data }, false);
      repliesStatusEl.textContent = 'Falha ao carregar';
      return;
    }

    const count = Array.isArray(data?.replies) ? data.replies.length : 0;
    setReplies({ httpStatus: resp.status, ...data }, Boolean(data?.success));
    repliesStatusEl.textContent = 'OK (' + count + ')';
  } catch (err) {
    setReplies({ success: false, error: String(err) }, false);
    repliesStatusEl.textContent = 'Erro';
  } finally {
    refreshRepliesBtn.disabled = false;
  }
}

sendBtn.addEventListener('click', () => send());
refreshRepliesBtn.addEventListener('click', () => loadReplies());
clearBtn.addEventListener('click', () => {
  phoneEl.value = '';
  messageEl.value = '';
  dryRunEl.checked = false;
  resultEl.className = '';
  resultEl.textContent = '';
});

async function login() {
  try {
    const password = (loginPasswordEl?.value || '').trim();
    if (!password) {
      setLoginResult({ success: false, error: 'Informe a senha' }, false);
      return;
    }

    const resp = await fetch(apiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { success: false, error: 'Resposta não-JSON do servidor', raw: text };
    }

    if (!resp.ok || !data?.success || !data?.token) {
      setLoginResult({ httpStatus: resp.status, ...data }, false);
      return;
    }

    setToken(String(data.token));
    if (loginPasswordEl) loginPasswordEl.value = '';
    setLoginResult({ httpStatus: resp.status, success: true }, true);
    loadQuota();
    loadReplies();
  } catch (err) {
    setLoginResult({ success: false, error: String(err) }, false);
  }
}

function logout() {
  setToken('');
  setLoginResult({ success: true }, true);
  loadQuota();
  loadReplies();
}

if (loginBtn) loginBtn.addEventListener('click', () => login());
if (logoutBtn) logoutBtn.addEventListener('click', () => logout());

renderAuthState();
loadQuota();
setInterval(() => loadQuota(), QUOTA_REFRESH_MS);
loadReplies();
setInterval(() => loadReplies(), AUTO_REFRESH_MS);
