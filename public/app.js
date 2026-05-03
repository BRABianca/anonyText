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

  sendBtn.disabled = true;
  resultEl.className = '';
  resultEl.textContent = 'Enviando...';

  try {
    const url = dryRun ? apiUrl('/sms?dryRun=1') : apiUrl('/sms');
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const resp = await fetch(apiUrl('/sms/quota'), { method: 'GET' });
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
    const resp = await fetch(apiUrl('/sms/replies'), { method: 'GET' });
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

loadQuota();
setInterval(() => loadQuota(), QUOTA_REFRESH_MS);
loadReplies();
setInterval(() => loadReplies(), AUTO_REFRESH_MS);
