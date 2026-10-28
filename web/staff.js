/* 客服工作台 · 郑州大学医院
 * 功能：登录 → 会话列表 → 打开会话 → 回复学生
 * 认证：Bearer token 存 localStorage（staff_token）
 */

const app = document.getElementById('app');
const staffWho = document.getElementById('staffWho');
const logoutBtn = document.getElementById('logoutBtn');
const toastEl = document.getElementById('toast');

const S = {
  token: localStorage.getItem('staff_token') || '',
  staff: JSON.parse(localStorage.getItem('staff_info') || 'null'),
  threads: [],
  current: null,      // 当前会话 id
  messages: [],
  timer: null
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function toast(msg, ms = 2200) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toastEl.hidden = true; }, ms);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (res.status === 401) {
    clearSession();
    renderLogin('登录已失效，请重新登录');
    throw new Error('请重新登录');
  }
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) throw new Error((data && data.detail) || ('请求失败 ' + res.status));
  return data;
}

function saveSession(token, staff) {
  S.token = token;
  S.staff = staff;
  localStorage.setItem('staff_token', token);
  localStorage.setItem('staff_info', JSON.stringify(staff));
}

function clearSession() {
  S.token = '';
  S.staff = null;
  localStorage.removeItem('staff_token');
  localStorage.removeItem('staff_info');
  if (S.timer) { clearInterval(S.timer); S.timer = null; }
}

function renderLogin(message) {
  staffWho.style.display = 'none';
  logoutBtn.style.display = 'none';
  app.innerHTML = `
    <div class="card" style="margin-top:20px;">
      <div class="title" style="font-size:17px;margin-bottom:12px;">客服登录</div>
      <div class="field">
        <label>账号</label>
        <input id="sUser" type="text" value="staff001" placeholder="客服账号" />
      </div>
      <div class="field">
        <label>密码</label>
        <input id="sPass" type="password" value="zzu123456" placeholder="密码" />
      </div>
      <button class="btn" id="sLogin">登 录</button>
      <div class="err" id="sErr">${esc(message || '')}</div>
      <div class="hint">演示账号：staff001 / zzu123456（张老师）· staff002（李护士）</div>
    </div>`;
  document.getElementById('sLogin').addEventListener('click', doLogin);
  document.getElementById('sPass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
}

async function doLogin() {
  const u = (document.getElementById('sUser').value || '').trim();
  const p = document.getElementById('sPass').value || '';
  const err = document.getElementById('sErr');
  err.textContent = '';
  try {
    const res = await api('/api/staff/login', { method: 'POST', body: { username: u, password: p } });
    saveSession(res.token, res.staff);
    renderThreads();
  } catch (e) {
    err.textContent = e.message;
  }
}

function renderChrome() {
  staffWho.style.display = S.staff ? 'inline' : 'none';
  staffWho.textContent = S.staff ? (S.staff.name + ' · ' + S.staff.username) : '';
  logoutBtn.style.display = S.staff ? 'inline' : 'none';
}

async function renderThreads() {
  renderChrome();
  if (!S.token) { renderLogin(); return; }
  app.innerHTML = '<div class="loading">加载中…</div>';
  try {
    const list = await api('/api/staff/threads');
    S.threads = list;
    const items = list.length ? list.map((t) => `
      <div class="thread-item tap" data-id="${t.id}">
        <div class="row">
          <div class="title">${esc(t.student_name || '同学')} <span class="sub" style="font-weight:400;">${esc(t.student_no)}</span></div>
          ${t.unread_staff > 0 ? '<span class="unread">' + t.unread_staff + ' 新</span>' : ''}
        </div>
        <div class="sub">${esc((t.last_message || '（暂无消息）').slice(0, 40))}</div>
        <div class="sub">${esc(t.updated_at || '')} · 共 ${t.total} 条</div>
      </div>`).join('') : '<div class="empty">还没有学生发起咨询</div>';

    app.innerHTML = `
      <div class="row" style="margin:14px 0 10px;">
        <div class="title">会话列表</div>
        <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" id="refreshBtn">刷新</button>
      </div>
      ${items}
      <div class="disclaimer">学生发消息后这里会出现会话；回复后学生端会看到「真人回复」。</div>`;

    app.querySelectorAll('.thread-item').forEach((el) => {
      el.addEventListener('click', () => openThread(Number(el.dataset.id)));
    });
    document.getElementById('refreshBtn').addEventListener('click', renderThreads);

    if (S.timer) clearInterval(S.timer);
    S.timer = setInterval(() => {
      if (document.getElementById('refreshBtn')) renderThreads();
    }, 8000);
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="err">${esc(e.message)}</div>
      <button class="btn" id="retry">重试</button></div>`;
    document.getElementById('retry').addEventListener('click', renderThreads);
  }
}

async function openThread(id) {
  S.current = id;
  app.innerHTML = '<div class="loading">加载中…</div>';
  try {
    const detail = await api('/api/staff/threads/' + id);
    S.messages = detail.messages || [];
    paintThread(detail.thread);
  } catch (e) {
    toast(e.message);
    renderThreads();
  }
}

function paintThread(thread) {
  const t = thread || {};
  const msgs = S.messages.map((m) => {
    const me = m.role === 'staff';
    const cls = me ? 'msg staff' : (m.role === 'user' ? 'msg' : 'msg');
    const badge = m.role === 'ai' ? '<span class="badge ai">AI 生成</span>'
      : (m.role === 'staff' ? '<span class="badge staff">真人回复</span>'
        : '<span class="badge user">学生</span>');
    return `<div class="${cls}">
      <div class="who">${esc(m.sender || '')}${badge} · ${esc(m.created_at || '')}</div>
      <div class="body">${esc(m.content)}</div>
    </div>`;
  }).join('');

  app.innerHTML = `
    <div class="row" style="margin:14px 0 10px;">
      <div>
        <div class="title">${esc(t.student_name || '同学')} · ${esc(t.student_no || '')}</div>
        <div class="sub">${esc(t.major || '')}</div>
      </div>
      <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" id="backBtn">返回列表</button>
    </div>
    <div class="card" id="chatBox">${msgs || '<div class="empty">暂无消息</div>'}</div>
    <div class="chat-bar">
      <input id="replyInput" type="text" placeholder="输入回复内容…" />
      <button class="btn" style="width:auto;margin:0;padding:0 18px;" id="sendBtn">回复</button>
    </div>
    <div class="disclaimer">你的回复会以「真人回复」标注展示给学生。</div>`;

  document.getElementById('backBtn').addEventListener('click', renderThreads);
  document.getElementById('sendBtn').addEventListener('click', sendReply);
  document.getElementById('replyInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendReply();
  });

  if (S.timer) clearInterval(S.timer);
  S.timer = setInterval(async () => {
    if (!document.getElementById('chatBox') || !S.current) return;
    try {
      const detail = await api('/api/staff/threads/' + S.current);
      if ((detail.messages || []).length !== S.messages.length) {
        S.messages = detail.messages || [];
        paintThread(detail.thread);
      }
    } catch (e) { /* ignore */ }
  }, 5000);
}

async function sendReply() {
  const input = document.getElementById('replyInput');
  const text = ((input && input.value) || '').trim();
  if (!text) return;
  const btn = document.getElementById('sendBtn');
  btn.disabled = true;
  try {
    const res = await api('/api/staff/threads/' + S.current + '/reply', {
      method: 'POST',
      body: { content: text }
    });
    S.messages = res.messages || [];
    const detail = await api('/api/staff/threads/' + S.current);
    paintThread(detail.thread);
    toast('已回复');
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
  }
}

logoutBtn.addEventListener('click', () => {
  clearSession();
  renderLogin('已退出');
});

if (S.token && S.staff) {
  renderThreads();
} else {
  renderLogin();
}
