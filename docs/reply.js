const apiBaseValueEl = document.getElementById('apiBaseValue');
const tokenValueEl = document.getElementById('tokenValue');
const metaLineEl = document.getElementById('metaLine');
const replyTextEl = document.getElementById('replyText');
const sendReplyBtn = document.getElementById('sendReplyBtn');
const clearReplyBtn = document.getElementById('clearReplyBtn');
const replyResultEl = document.getElementById('replyResult');

const API_BASE_URL = (window.API_BASE_URL || '').toString().replace(/\/+$/, '');

function apiUrl(path) {
  if (!API_BASE_URL) return path;
  return API_BASE_URL + path;
}

function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('token') || '').trim();
}

function setReplyResult(obj, ok) {
  replyResultEl.className = ok ? 'ok' : 'error';
  replyResultEl.textContent = JSON.stringify(obj, null, 2);
}

async function loadMeta(token) {
  metaLineEl.textContent = 'Carregando…';
  try {
    const resp = await fetch(apiUrl('/reply/meta?token=' + encodeURIComponent(token)));
    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { success: false, error: 'Resposta não-JSON do servidor', raw: text };
    }

    if (!resp.ok || !data?.success) {
      metaLineEl.textContent = data?.error || 'Falha ao carregar';
      setReplyResult({ httpStatus: resp.status, ...data }, false);
      sendReplyBtn.disabled = true;
      return;
    }

    metaLineEl.textContent = `Você está respondendo para ${data.toNumberMasked}`;
    setReplyResult({ httpStatus: resp.status, ...data }, true);
  } catch (err) {
    metaLineEl.textContent = 'Erro ao carregar';
    setReplyResult({ success: false, error: String(err) }, false);
    sendReplyBtn.disabled = true;
  }
}

async function sendReply(token) {
  const text = (replyTextEl.value || '').trim();
  if (!text) {
    setReplyResult({ success: false, error: 'Digite uma mensagem' }, false);
    return;
  }

  sendReplyBtn.disabled = true;
  replyResultEl.className = '';
  replyResultEl.textContent = 'Enviando...';

  try {
    const resp = await fetch(apiUrl('/reply'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, text })
    });

    const raw = await resp.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { success: false, error: 'Resposta não-JSON do servidor', raw };
    }

    setReplyResult({ httpStatus: resp.status, ...data }, resp.ok && Boolean(data?.success));
    if (resp.ok && data?.success) {
      replyTextEl.value = '';
    }
  } catch (err) {
    setReplyResult({ success: false, error: String(err) }, false);
  } finally {
    sendReplyBtn.disabled = false;
  }
}

clearReplyBtn.addEventListener('click', () => {
  replyTextEl.value = '';
  replyResultEl.className = '';
  replyResultEl.textContent = '';
});

const token = getTokenFromUrl();
if (apiBaseValueEl) apiBaseValueEl.textContent = API_BASE_URL || window.location.origin;
if (tokenValueEl) tokenValueEl.textContent = token ? token.slice(0, 8) + '…' : '-';

if (!token) {
  metaLineEl.textContent = 'Token ausente';
  sendReplyBtn.disabled = true;
} else {
  loadMeta(token);
  sendReplyBtn.addEventListener('click', () => sendReply(token));
}
