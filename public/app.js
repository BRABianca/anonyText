const phoneEl = document.getElementById('phone');
const messageEl = document.getElementById('message');
const dryRunEl = document.getElementById('dryRun');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const resultEl = document.getElementById('result');
const repliesEl = document.getElementById('replies');
const refreshRepliesBtn = document.getElementById('refreshRepliesBtn');
const repliesStatusEl = document.getElementById('repliesStatus');

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
    const url = dryRun ? '/sms?dryRun=1' : '/sms';
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

async function loadReplies() {
  refreshRepliesBtn.disabled = true;
  repliesStatusEl.textContent = 'Carregando...';

  try {
    const resp = await fetch('/sms/replies', { method: 'GET' });
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

loadReplies();
setInterval(() => loadReplies(), 5000);

