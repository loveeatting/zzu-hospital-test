/* 郑州大学校医院 · 门诊预约（网页版）
 * 与后端同源，直接请求 /api/*，无需配置 IP。
 */

const state = {
  token: localStorage.getItem('token') || '',
  student: JSON.parse(localStorage.getItem('student') || 'null'),
  dept: null,
  doctor: null,
  triageResult: null
};

const app = document.getElementById('app');
const userbox = document.getElementById('userbox');
const userName = document.getElementById('userName');

/* ---------------- 基础工具 ---------------- */

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;

  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (res.status === 401) {
    let data401 = null;
    try { data401 = await res.json(); } catch (e) { data401 = null; }
    clearSession();
    const msg = (data401 && typeof data401.detail === 'string')
      ? data401.detail
      : '登录已失效，请重新登录';
    renderLogin(msg);
    toast(msg, 4000);
    throw new Error(msg);
  }

  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }

  if (!res.ok) {
    const detail = data && data.detail;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail || res.status));
  }
  return data;
}

function toast(msg, ms = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, ms);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function show(html) {
  app.innerHTML = html;
  window.scrollTo(0, 0);
}

function saveSession(token, student) {
  state.token = token;
  state.student = student;
  localStorage.setItem('token', token);
  localStorage.setItem('student', JSON.stringify(student));
  renderUser();
}

function clearSession() {
  state.token = '';
  state.student = null;
  localStorage.removeItem('token');
  localStorage.removeItem('student');
  renderUser();
}

function renderUser() {
  if (state.student) {
    userbox.hidden = false;
    userName.innerHTML = '<span class="topbar-avatar">' + qAvatarSVG(state.student.student_no, 26) +
      '</span><span class="topbar-name">' + esc(state.student.name) + '</span>';
  } else {
    userbox.hidden = true;
  }
}

/* ---------------- 登录 ---------------- */

function renderLogin(message) {
  show(`
    <div class="hero">
      <h1>郑州大学校医院</h1>
      <p>门诊预约挂号系统</p>
    </div>
    <div class="card">
      <div class="field">
        <label>学号</label>
        <input id="studentNo" type="text" inputmode="numeric" placeholder="请输入学号" value="2025010001" />
      </div>
      <div class="field">
        <label>密码</label>
        <input id="password" type="password" placeholder="请输入密码" value="zzu123456" />
      </div>
      <button class="btn" data-action="login" id="loginBtn">登 录</button>
      <div class="err" id="loginErr">${esc(message || '')}</div>
      <div class="hint">演示账号已预填：2025010001 / zzu123456</div>
      <div class="hint" style="color:#999;">同一学号只能在一台设备登录，换设备登录会把前一台挤下线</div>
    </div>
  `);
}

async function doLogin() {
  const studentNo = (document.getElementById('studentNo').value || '').trim();
  const password = document.getElementById('password').value || '';
  const btn = document.getElementById('loginBtn');
  const errBox = document.getElementById('loginErr');

  if (!studentNo || !password) {
    errBox.textContent = '请输入学号和密码';
    return;
  }
  btn.disabled = true;
  btn.textContent = '登录中…';
  errBox.textContent = '';

  try {
    const res = await api('/api/login', {
      method: 'POST',
      body: { student_no: studentNo, password }
    });
    saveSession(res.token, res.student);
    renderDepartments();
  } catch (e) {
    errBox.textContent = e.message;
    btn.disabled = false;
    btn.textContent = '登 录';
  }
}

/* ---------------- 科室 ---------------- */

const PALETTE = ['#1a73e8', '#12a05c', '#e8710a', '#8e44ad', '#d93025', '#0b8ea8'];




/* 医生头像（中性，白大褂 + 听诊器） */
function doctorAvatarSVG(size) {
  const s = size || 52;
  return '<svg viewBox="0 0 64 64" width="' + s + '" height="' + s + '" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="64" height="64" rx="32" fill="#e8f3ff"/>' +
    '<path d="M10 62c1-10 8-16 22-16s21 6 22 16z" fill="#ffffff"/>' +
    '<path d="M32 46l-4-3 4-3 4 3z" fill="#dbe9f7"/>' +
    '<circle cx="32" cy="27" r="12.6" fill="#ffddc8"/>' +
    '<path d="M19.6 24c0-7.6 5.4-12 12.4-12s12.4 4.4 12.4 12c0 1.4-.6 2.2-1.4 2.4-1.2-5-4-8-9-8.6-5 .6-8 3.6-9.6 8.6-1-.2-1.8-1-1.8-2.4z" fill="#3b3034"/>' +
    '<circle cx="27.4" cy="28" r="1.7" fill="#2b2b33"/><circle cx="36.6" cy="28" r="1.7" fill="#2b2b33"/>' +
    '<path d="M29 33.4q3 2.4 6 0" stroke="#c96450" stroke-width="1.21" fill="none" stroke-linecap="round"/>' +
    '<path d="M46 44c0 6-4 10-9 10" stroke="#2b87e0" stroke-width="2" fill="none" stroke-linecap="round"/>' +
    '<circle cx="49" cy="55" r="3.4" fill="none" stroke="#2b87e0" stroke-width="2"/>' +
    '</svg>';
}

/* ---------------- 科室图标 ---------------- */

const DEPT_ICONS = {
  '内科': '<path d="M20.5 5.6a5 5 0 0 0-7.1 0L12 7l-1.4-1.4a5 5 0 1 0-7.1 7.1L12 21l8.5-8.3a5 5 0 0 0 0-7.1z"/><path d="M6.5 12h3l1.3-2.2 1.6 4 1.3-2.2h3"/>',
  '外科': '<path d="M4.5 19.5l6-6"/><path d="M14.5 4.5l5 5-2.4 2.4-5-5z"/><circle cx="6" cy="18" r="2.2"/><path d="M15.5 14.5l4 4"/>',
  '口腔科': '<path d="M12 3.6c-3.4 0-5.6 2.2-5.6 5.4 0 2 .7 3.3 1.1 5 .4 1.6.3 6.4 1.9 6.4 1.5 0 1.2-3.6 2.6-3.6s1.1 3.6 2.6 3.6c1.6 0 1.5-4.8 1.9-6.4.4-1.7 1.1-3 1.1-5 0-3.2-2.2-5.4-5.6-5.4z"/>',
  '皮肤科': '<path d="M12 3.2c3.4 3.6 6.2 7 6.2 10.4A6.2 6.2 0 0 1 12 19.8a6.2 6.2 0 0 1-6.2-6.2C5.8 10.2 8.6 6.8 12 3.2z"/>',
  '眼科': '<path d="M2.4 12S6 6.4 12 6.4 21.6 12 21.6 12 18 17.6 12 17.6 2.4 12 2.4 12z"/><circle cx="12" cy="12" r="3"/>',
  '耳鼻咽喉科': '<path d="M8 8.4a4.6 4.6 0 1 1 8.2 2.8c-1 1.4-2.6 1.8-2.6 3.6a2.4 2.4 0 0 1-4.8 0"/><path d="M17.6 15.4c1 1 1.4 2 1.2 3.2"/>',
  '康复理疗科（疼痛科）': '<circle cx="12" cy="5.2" r="2.2"/><path d="M12 8v5.2M12 13.2l-3 4M12 13.2l3 4"/><circle cx="6.4" cy="20" r="2"/><circle cx="17.6" cy="20" r="2"/>',
  '成人预防接种门诊': '<path d="M12 3l7 3v5.4c0 4.4-3 8-7 9.4-4-1.4-7-5-7-9.4V6z"/><path d="M12 8.6v5M9.6 11.1h4.8"/>',
  '体检科': '<rect x="5.4" y="4" width="13.2" height="16.4" rx="2.6"/><path d="M9 4V2.8h6V4"/><path d="M9 12l1.8 1.8L14.6 10"/>',
  '超声科': '<path d="M3 12c2.4-3.4 4.8-3.4 7.2 0s4.8 3.4 7.2 0"/><path d="M3 16.6c2.4-3.4 4.8-3.4 7.2 0s4.8 3.4 7.2 0"/><path d="M3 7.4c2.4-3.4 4.8-3.4 7.2 0s4.8 3.4 7.2 0"/>',
  '检验科': '<path d="M9.4 3.4h5.2M10.6 3.4v6.2L6.6 17a3 3 0 0 0 2.6 4.4h5.6a3 3 0 0 0 2.6-4.4l-4-7.4V3.4"/><path d="M8 14.6h8"/>',
  '放射科': '<circle cx="12" cy="12" r="2.2"/><path d="M12 3.2v3.4M12 17.4v3.4M3.2 12h3.4M17.4 12h3.4M6 6l2.4 2.4M15.6 15.6L18 18M18 6l-2.4 2.4M8.4 15.6L6 18"/>',
  '妇科': '<circle cx="12" cy="8.4" r="5"/><path d="M12 13.4V21M9 18h6"/>',
  '中医科': '<path d="M20 4c0 8-4 12-9 12a4 4 0 0 1 0-8c3.4 0 6-2 9-4z"/><path d="M4 20c2-5 5-8 9-10"/>',
  'default': '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.4v7.2M8.4 12h7.2"/>'
};

function deptIconKey(name) {
  const n = String(name || '').replace(/（疼痛科）/, '');
  if (DEPT_ICONS[name]) return name;
  if (DEPT_ICONS[n]) return n;
  const keys = Object.keys(DEPT_ICONS);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] !== 'default' && (n.indexOf(keys[i]) >= 0 || keys[i].indexOf(n) >= 0)) return keys[i];
  }
  return 'default';
}

function deptIconSVG(name, size, color) {
  const key = deptIconKey(name);
  return '<svg viewBox="0 0 24 24" width="' + (size || 26) + '" height="' + (size || 26) + '" fill="none" ' +
    'stroke="' + (color || '#2b87e0') + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    DEPT_ICONS[key] + '</svg>';
}

/* ---------------- 头像（Q 版 / 机器人） ---------------- */

/* 演示学号 → 头像性别（其余按学号哈希稳定分配） */
const DEMO_GENDER = {
  '2025010001': 'boy',   // 张三
  '2025010002': 'girl',  // 李四
  '2025010003': 'boy',   // 王五
  '2025020001': 'girl',  // 赵六
  '2025030001': 'boy'    // 孙七
};

function avatarGender(seed) {
  const saved = localStorage.getItem('avatar_gender');
  if (saved === 'boy' || saved === 'girl') return saved;
  const key = String(seed || '');
  if (DEMO_GENDER[key]) return DEMO_GENDER[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 997;
  return h % 2 === 0 ? 'boy' : 'girl';
}

let _avUid = 0;

/* 背景渐变（每个实例唯一 id，避免冲突） */
function _avBg(uid, c1, c2) {
  return 'url(#bg' + uid + ')' ;
}

/* 可选头像（AI 生成，男生默认 5，女生默认 2） */
const AVATAR_IDS = [1, 2, 3, 4, 5, 6];
const GIRL_DEFAULT_AV = 2;
const BOY_DEFAULT_AV = 5;
const AVATAR_WORDS = {
  1: '女生·双马尾', 2: '女生·短发', 3: '女生·长卷发',
  4: '男生·眼镜', 5: '男生·连帽衫', 6: '男生·鸭舌帽'
};

function defaultAvatarId(seed) {
  return avatarGender(seed) === 'girl' ? GIRL_DEFAULT_AV : BOY_DEFAULT_AV;
}

function avatarIdOf(seed) {
  const key = String(seed || '');
  if (key.indexOf('staff-') === 0) {
    const sv = parseInt(localStorage.getItem('avatar_' + key) || '', 10);
    return AVATAR_IDS.indexOf(sv) >= 0 ? sv : GIRL_DEFAULT_AV;
  }
  const saved = parseInt(localStorage.getItem('avatar_' + key) || '', 10);
  if (AVATAR_IDS.indexOf(saved) >= 0) return saved;
  return defaultAvatarId(seed);
}

function avatarImgTag(seed, size) {
  const s = size || 34;
  return '<img class="av-img" src="avatars/av' + avatarIdOf(seed) + '.png" width="' + s +
    '" height="' + s + '" alt="" draggable="false">';
}

function qAvatarSVG(seed, size) {
  return avatarImgTag(seed, size);
}

function aiAvatarSVG(size) {
  const s = size || 34;
  const uid = ++_avUid;
  return '<svg viewBox="0 0 64 64" width="' + s + '" height="' + s + '" xmlns="http://www.w3.org/2000/svg">' +
    '<defs>' +
    '<linearGradient id="ab' + uid + '" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#e8f5ff"/><stop offset="1" stop-color="#cbe6ff"/></linearGradient>' +
    '<linearGradient id="ah' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#6cc6f8"/><stop offset="1" stop-color="#2b87e0"/></linearGradient>' +
    '</defs>' +
    '<rect width="64" height="64" fill="url(#ab' + uid + ')"/>' +
    // 天线
    '<rect x="30.6" y="10" width="2.8" height="7" rx="1.4" fill="#8fd0f6"/>' +
    '<circle cx="32" cy="9.4" r="3.2" fill="#7fe0ff"/>' +
    '<circle cx="32" cy="9.4" r="1.4" fill="#fff"/>' +
    // 耳侧灯
    '<rect x="6.4" y="30" width="6" height="12" rx="3" fill="#9ad4f8"/>' +
    '<rect x="51.6" y="30" width="6" height="12" rx="3" fill="#9ad4f8"/>' +
    // 头部
    '<rect x="12" y="17" width="40" height="32" rx="14" fill="url(#ah' + uid + ')"/>' +
    '<rect x="12" y="17" width="40" height="32" rx="14" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="1.6"/>' +
    // 面罩
    '<rect x="19" y="26" width="26" height="16" rx="8" fill="#0d2b4a"/>' +
    // 眼睛（发光）
    '<circle cx="27" cy="34" r="3.1" fill="#7fe0ff"/>' +
    '<circle cx="37" cy="34" r="3.1" fill="#7fe0ff"/>' +
    '<circle cx="27.8" cy="33.2" r="1" fill="#fff"/>' +
    '<circle cx="37.8" cy="33.2" r="1" fill="#fff"/>' +
    // 微笑
    '<path d="M28 39.4q4 2.6 8 0" stroke="#7fe0ff" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".9"/>' +
    // 感应点
    '<circle cx="16.6" cy="23.6" r="1.6" fill="#fff" opacity=".85"/>' +
    '<circle cx="47.4" cy="23.6" r="1.6" fill="#fff" opacity=".85"/>' +
    '</svg>';
}

function avatarOf(role, seed, size) {
  return role === 'user' ? qAvatarSVG(seed, size) : aiAvatarSVG(size);
}

/* ---------------- 底部三 tab ---------------- */

function tabBar(active) {
  const items = [
    { key: 'home', action: 'depts', label: '首页', icon: '<path d="M12 3.6 3.4 10.8V21h5.6v-5.6h6V21h5.6V10.8z"/>' },
    { key: 'my', action: 'my', label: '我的预约', icon: '<rect x="3.4" y="5" width="17.2" height="16" rx="3.4"/><path d="M8 2.8v4M16 2.8v4M3.4 10h17.2"/>' },
    { key: 'profile', action: 'profile', label: '个人中心', icon: '<circle cx="12" cy="8" r="3.8"/><path d="M4.6 21a7.4 7.4 0 0 1 14.8 0"/>' }
  ];
  return '<nav class="tabbar">' + items.map(function (it) {
    const on = it.key === active;
    return '<button class="tab ' + (on ? 'on' : '') + '" data-action="' + it.action + '">' +
      '<svg viewBox="0 0 24 24" fill="' + (on ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">' +
      it.icon + '</svg><span>' + it.label + '</span></button>';
  }).join('') + '</nav>';
}

/* ---------------- 首页 ---------------- */

const HOME_BLUE = '#1a73e8';
const HOME_ORANGE = '#f4703a';

const HOME_MODULES = [
  { action: 'appoint', icon: 'cal', title: '预约挂号', desc: '快速预约<br/>省时省心' },
  { action: 'dept-list', icon: 'dept', title: '科室介绍', desc: '14 个科室<br/>都能看什么' },
  { action: 'intro', icon: 'hosp', title: '医院简介', desc: '二级综合<br/>一院四区' },
  { action: 'guide', icon: 'guide', title: '就医指南', desc: '就诊须知<br/>轻松就医' },
  { action: 'health', icon: 'book', title: '健康科普', desc: '科学健康<br/>从这里开始' },
  { action: 'service', icon: 'svc', title: '服务咨询', desc: '医保值班<br/>人工客服' }
];

const HOME_ICONS = {
  spark: '<path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><circle cx="18" cy="16" r="2"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><circle cx="16" cy="16" r="3.6"/><path d="M16 14.6V16l1 1"/>',
  hosp: '<path d="M4 21V8l8-4.5L20 8v13"/><path d="M9 21v-5.5h6V21"/><path d="M12 7.5v3.2M10.4 9.1h3.2"/>',
  dept: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  doc: '<path d="M7 3v6a3.5 3.5 0 0 0 7 0V3"/><path d="M7 3h1.6M13.4 3H15"/><path d="M10.5 12.5V16a4 4 0 0 0 8 0v-1.6"/><circle cx="18.5" cy="12.4" r="1.9"/>',
  guide: '<path d="M12 21s6.6-5.6 6.6-10.4A6.6 6.6 0 1 0 5.4 10.6C5.4 15.4 12 21 12 21z"/><circle cx="12" cy="10.3" r="2.4"/>',
  route: '<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8.2 16.4c4.4-1.4 3.6-6.2 7.6-8.2"/>',
  book: '<path d="M4 5.4A2.4 2.4 0 0 1 6.4 3H11v17H6.4A2.4 2.4 0 0 0 4 22z"/><path d="M20 5.4A2.4 2.4 0 0 0 17.6 3H13v17h4.6A2.4 2.4 0 0 1 20 22z"/><path d="M15.5 8.6v3M14 10.1h3"/>',
  svc: '<path d="M21 11.6a8 8 0 0 1-8 8H7.4L3.4 22v-9.4a8 8 0 0 1 8-8h1.6a8 8 0 0 1 8 7z"/><path d="M9 10.5h6M9 14h4"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  shield: '<path d="M12 3l7.5 3v5.2c0 4.6-3.1 8.3-7.5 9.8-4.4-1.5-7.5-5.2-7.5-9.8V6z"/><path d="M9 12l2.2 2.2L15.4 10"/>',
  card: '<rect x="2.8" y="5.4" width="18.4" height="13.2" rx="3"/><path d="M2.8 10h18.4"/><path d="M6.4 14.6h3.6"/>',
  bell: '<path d="M18 15.6V10a6 6 0 1 0-12 0v5.6l-1.6 2.2h15.2z"/><path d="M10 20.4a2.2 2.2 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 21a7.2 7.2 0 0 1 14.4 0"/>',
  clipboard: '<rect x="5" y="4.4" width="14" height="16" rx="2.6"/><path d="M9 4.4V3.2h6v1.2"/><path d="M8.6 10h6.8M8.6 13.6h6.8M8.6 17.2h4"/>'
};

function homeIcon(key, color, size) {
  return '<svg viewBox="0 0 24 24" width="' + (size || 26) + '" height="' + (size || 26) + '" fill="none" ' +
    'stroke="' + color + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    (HOME_ICONS[key] || '') + '</svg>';
}

async function renderDepartments() {
  const tiles = HOME_MODULES.map(function (m) {
    const hot = !!m.badge;
    const color = hot ? HOME_ORANGE : HOME_BLUE;
    return '<div class="tile tap" data-action="' + m.action + '">' +
      '<div class="tile-icon"' + (hot ? ' style="background:linear-gradient(150deg,#ffe9dd,#ffd3bd)"' : '') + '>' +
      homeIcon(m.icon, color, 26) + '</div>' +
      '<div class="tile-head"><span class="tile-title">' + esc(m.title) + '</span>' +
      (hot ? '<span class="tile-badge">' + esc(m.badge) + '</span>' : '') + '</div>' +
      '<div class="tile-desc">' + m.desc + '</div>' +
      '<div class="tile-go">›</div>' +
      '</div>';
  }).join('');

  show(`
    <div class="home-hero">
      <div class="hero-photo"></div>
      <div class="slogan">校医随行，健康无忧</div>
      <div class="slogan-bar"></div>
    </div>

    <div class="ai-card tap" data-action="agent">
      <div class="ai-glow"></div>
      <div class="ai-title">AI 智能导诊</div>
      <div class="ai-sub">一句话描述症状，智能推荐科室</div>
      <div class="ai-input">
        <span class="ai-spark">✦</span>
        <span class="ai-ph">比如：我头晕，应该挂哪个科？</span>
        <span class="ai-go">›</span>
      </div>
      <div class="ai-robot">
        <svg viewBox="0 0 120 120" fill="none">
          <ellipse cx="60" cy="110" rx="30" ry="6" fill="#1c6fc4" opacity=".18"/>
          <rect x="26" y="34" width="68" height="56" rx="24" fill="#fff"/>
          <rect x="34" y="46" width="52" height="30" rx="15" fill="#0f2f52"/>
          <circle cx="50" cy="61" r="5" fill="#7fe0ff"/><circle cx="70" cy="61" r="5" fill="#7fe0ff"/>
          <path d="M52 70q8 6 16 0" stroke="#7fe0ff" stroke-width="3" stroke-linecap="round"/>
          <rect x="56" y="22" width="8" height="12" rx="4" fill="#cfe8fd"/>
          <circle cx="60" cy="18" r="5" fill="#7fe0ff"/>
          <rect x="16" y="52" width="10" height="22" rx="5" fill="#cfe8fd"/>
          <rect x="94" y="52" width="10" height="22" rx="5" fill="#cfe8fd"/>
        </svg>
      </div>
    </div>

    <div class="route-card tap" data-action="nav">
      <span class="route-pin">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="#1a73e8">
          <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
        </svg>
      </span>
      <span class="route-name">来院导航</span>
      <span class="route-div"></span>
      <span class="route-sub">郑州大学校医院 · 就医路线</span>
      <span class="route-chev">›</span>
    </div>

    <div class="notice-bar tap" data-action="guide">
      <span class="notice-ico">🕘</span>
      <span class="notice-text">今日号源充足 · 门诊 08:00–12:00 / 14:00–17:30</span>
      <span class="notice-more">查看详情 ›</span>
    </div>

    <div class="mod-grid">${tiles}</div>

    <div class="ask-bar tap" data-action="agent">
      <span class="ask-avatar">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
          <rect x="4" y="7" width="16" height="12" rx="5" fill="#7fc4f2"/>
          <rect x="7" y="10" width="10" height="6" rx="3" fill="#0f2f52"/>
          <circle cx="10" cy="13" r="1.2" fill="#7fe0ff"/><circle cx="14" cy="13" r="1.2" fill="#7fe0ff"/>
          <circle cx="12" cy="4.6" r="1.6" fill="#7fc4f2"/><path d="M12 6.2v1.4" stroke="#7fc4f2" stroke-width="1.4"/>
        </svg>
      </span>
      <span class="ask-ph">有问题？快来问我吧~</span>
      <span class="ask-go">›</span>
    </div>

    ${tabBar('home')}
  `);
}

/* ---------------- 个人中心 ---------------- */

async function renderProfile() {
  show('<div class="loading">加载中…</div>');
  let appts = [];
  let reviews = 0;
  try {
    const list = await api('/api/appointments');
    appts = list || [];
  } catch (e) { appts = []; }
  try {
    const mine = await api('/api/reviews/mine');
    reviews = (mine.reviews || mine || []).length;
  } catch (e) { reviews = 0; }

  const st = state.student || {};
  const booked = appts.filter(function (a) { return a.status === 'BOOKED'; }).length;
  const today = new Date().toISOString().slice(0, 10);
  const visited = appts.filter(function (a) { return a.date && a.date < today; }).length;

  show(`
    <div class="me-hero">
      <div class="me-photo"></div>
      <div class="me-row">
        <div class="me-avatar">${qAvatarSVG(st.student_no, 62)}</div>
        <div class="me-info">
          <div class="me-name">${esc(st.name || '同学')}<span class="me-tag">在校生</span></div>
          <div class="me-sub">${esc(st.major || '郑州大学')} · ${esc(st.student_no || '')}</div>
        </div>
        <div class="me-chev">›</div>
      </div>
    </div>

    <div class="me-stats">
      <div class="me-stat tap" data-action="my">
        <div class="me-ico">${homeIcon('cal', '#2b87e0', 22)}</div>
        <div class="me-num">${booked}</div>
        <div class="me-label">我的预约</div>
      </div>
      <div class="me-stat tap" data-action="my">
        <div class="me-ico">${homeIcon('doc', '#2b87e0', 22)}</div>
        <div class="me-num">${visited}</div>
        <div class="me-label">就诊记录</div>
      </div>
      <div class="me-stat tap" data-action="all-reviews">
        <div class="me-ico">${homeIcon('svc', '#2b87e0', 22)}</div>
        <div class="me-num">${reviews}</div>
        <div class="me-label">我的评价</div>
      </div>
      <div class="me-stat tap" data-action="guide">
        <div class="me-ico">${homeIcon('hosp', '#2b87e0', 22)}</div>
        <div class="me-num" style="font-size:14px;line-height:34px;">医保凭证</div>
        <div class="me-label">政策查询</div>
      </div>
    </div>

    <div class="me-guard tap" data-action="service">
      <div class="me-guard-left">
        <div class="me-guard-title">就医保障</div>
        <div class="me-guard-sub">医保政策、值班医生、人工客服</div>
      </div>
      <span class="me-guard-ico">${homeIcon('shield', '#2b87e0', 24)}</span>
      <span class="route-chev">›</span>
    </div>

    <div class="me-menu">
      <div class="me-item tap" data-action="profile-info">
        <span class="me-item-ico">${homeIcon('user', '#2b87e0', 19)}</span><span class="me-item-text">个人信息</span><span class="me-item-extra">${esc(st.student_no || '')}</span><span class="me-chev">›</span>
      </div>
      <div class="me-item tap" data-action="profile-card">
        <span class="me-item-ico">${homeIcon('card', '#2b87e0', 19)}</span><span class="me-item-text">我的就诊卡</span><span class="me-item-extra">${esc(st.student_no || '')}</span><span class="me-chev">›</span>
      </div>
      <div class="me-item tap" data-action="profile-record">
        <span class="me-item-ico">${homeIcon('clipboard', '#2b87e0', 19)}</span><span class="me-item-text">健康档案</span><span class="me-item-extra">${appts.length} 条</span><span class="me-chev">›</span>
      </div>
      <div class="me-item tap" data-action="service">
        <span class="me-item-ico">${homeIcon('bell', '#2b87e0', 19)}</span><span class="me-item-text">消息通知</span><span class="me-item-extra">客服会话</span><span class="me-chev">›</span>
      </div>
      <div class="me-item tap" data-action="profile-setting">
        <span class="me-item-ico">${homeIcon('gear', '#2b87e0', 19)}</span><span class="me-item-text">设置</span><span class="me-item-extra"></span><span class="me-chev">›</span>
      </div>
    </div>

    <div class="me-ai tap" data-action="agent">
      <div class="me-ai-robot"><svg viewBox="0 0 24 24" width="30" height="30" fill="none"><rect x="4" y="7" width="16" height="12" rx="5" fill="#7fc4f2"/><rect x="7" y="10" width="10" height="6" rx="3" fill="#0f2f52"/><circle cx="10" cy="13" r="1.2" fill="#7fe0ff"/><circle cx="14" cy="13" r="1.2" fill="#7fe0ff"/><circle cx="12" cy="4.6" r="1.6" fill="#7fc4f2"/><path d="M12 6.2v1.4" stroke="#7fc4f2" stroke-width="1.4"/></svg></div>
      <div class="me-ai-text">
        <div class="me-ai-sub">有任何问题？</div>
        <div class="me-ai-title">联系 AI 智能助手</div>
        <div class="me-ai-sub">7×24 小时为您服务</div>
      </div>
      <button class="me-ai-btn" data-action="agent">立即咨询 ›</button>
    </div>

    <button class="me-logout" data-action="logout">退出登录</button>

    ${tabBar('profile')}
  `);
}

/* 个人中心的二级说明页 */
function renderProfileDetail(kind) {
  const st = state.student || {};
  const data = {
    info: {
      title: '个人信息',
      rows: [['姓名', st.name || ''], ['学号', st.student_no || ''], ['学院/专业', st.major || '未填写'],
             ['手机号', st.phone || '未填写'], ['身份', '在校生（学生账号）']],
      avatar: true
    },
    card: {
      title: '我的就诊卡',
      rows: [['就诊卡号', st.student_no || ''], ['绑定状态', '已绑定（学生账号自动生成）'],
             ['使用范围', '郑州大学校医院门诊'], ['提示', '到院就诊请携带校园卡/身份证']]
    },
    record: {
      title: '健康档案',
      rows: [['说明', '毕业前可在此查看历次就诊与评价记录'],
             ['当前状态', '原型阶段仅统计预约与评价条数'],
             ['完整就诊档案', '由医院 HIS 系统保存，本平台不存储病历']]
    },
    setting: {
      title: '设置',
      rows: [['消息通知', '原型未开启推送'], ['隐私说明', '仅保存预约与评价所需信息'],
             ['数据存储', '云端 SQLite，演示数据定期重置'], ['退出登录', '底部按钮可退出']]
    }
  }[kind] || { title: '说明', rows: [] };

  show(`
    <div class="row" style="margin-bottom:12px;">
      <div class="title">${esc(data.title)}</div>
      <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="profile">返回</button>
    </div>
    ${data.avatar ? `
    <div class="card">
      <div class="date-title">我的头像</div>
      <div class="avatar-picker">
        <span class="avatar-preview">${qAvatarSVG(st.student_no, 64)}</span>
        <div class="sub" style="margin:0;">
          当前：${AVATAR_WORDS[avatarIdOf(st.student_no)] || ''}
          ${localStorage.getItem('avatar_' + st.student_no) ? '' : '（默认）'}
        </div>
      </div>
      <div class="av-grid">
        ${AVATAR_IDS.map(function (id) {
          const on = avatarIdOf(st.student_no) === id;
          return '<button class="av-opt ' + (on ? 'on' : '') + '" data-action="avatar-pick" data-id="' + id + '">' +
            '<img src="avatars/av' + id + '.png" alt="" draggable="false"></button>';
        }).join('')}
      </div>
      <div class="av-foot">
        <span class="sub">男生默认第 5 张，女生默认第 2 张</span>
        <button class="linkbtn" data-action="avatar-default">恢复默认</button>
      </div>
    </div>` : ''}
    <div class="card">
      ${data.rows.map(function (r) {
        return '<div class="kv"><span class="kv-k">' + esc(r[0]) + '</span><span class="kv-v">' + esc(r[1]) + '</span></div>';
      }).join('')}
    </div>
    <div class="disclaimer">原型演示页面，正式版将以医院实际规定为准。</div>
  `);
}

/* ---------------- 科室列表 / 预约挂号 ---------------- */

/* ---------------- 科室介绍（图二样式） ---------------- */

async function renderDeptList() {
  show('<div class="loading">加载中…</div>');
  try {
    const list = await api('/api/departments');
    const rows = list.map(function (d) {
      return '<div class="dept-row tap" data-action="dept" data-id="' + d.id + '" data-name="' + esc(d.name) + '">' +
        '<div class="dept-ico">' + deptIconSVG(d.name, 26) + '</div>' +
        '<div class="dept-main">' +
          '<div class="dept-head"><span class="dept-name">' + esc(d.name) + '</span>' +
          '<span class="tag ' + (d.source === 'real' ? 'green' : 'gray') + '">' + (d.source === 'real' ? '真实' : '模拟') + '</span></div>' +
          '<div class="dept-meta">' + esc(d.location || '门诊楼') +
            '<span class="dept-go" data-action="nav-dept" data-name="' + esc(d.name) + '">📍 怎么去</span>' +
          '</div>' +
        '</div>' +
        '<div class="arrow">›</div>' +
      '</div>';
    }).join('');

    show(`
      <div class="page-head">
        <div class="page-head-t">科室介绍</div>
        <button class="linkbtn" data-action="depts">返回首页</button>
      </div>
      <div class="dept-list">${rows}</div>
      <div class="tip-bar">先进科室，再选医生与时段，预约成功后可在「我的预约」中查看或取消。</div>
    `);
  } catch (e) {
    show('<div class="card"><div class="err">' + esc(e.message) + '</div><button class="btn" data-action="depts">返回首页</button></div>');
  }
}

/* ---------------- 预约挂号（图一样式） ---------------- */

async function renderAppoint(deptId, date) {
  show('<div class="loading">加载中…</div>');
  try {
    let q = [];
    if (deptId) q.push('department_id=' + deptId);
    if (date) q.push('date=' + date);
    const d = await api('/api/appoint/board' + (q.length ? '?' + q.join('&') : ''));
    state.appoint = { deptId: d.department_id, date: d.date };

    const dates = (d.dates || []).slice(0, 5).map(function (x) {
      const on = x.date === d.date;
      return '<div class="date-chip ' + (on ? 'on' : '') + '" data-action="appoint-date" data-date="' + esc(x.date) +
        '" data-dept="' + d.department_id + '">' +
        '<div class="dc-week">' + esc(x.week) + '</div>' +
        '<div class="dc-day">' + esc(x.label) + '</div>' +
        '<div class="dc-tag">' + (on ? '今天' : (x.free > 0 ? '余 ' + x.free : '无号')) + '</div></div>';
    }).join('');

    const depts = (d.departments || []).map(function (dp) {
      const on = dp.id === d.department_id;
      return '<div class="dept-cell ' + (on ? 'on' : '') + '" data-action="appoint-dept" data-id="' + dp.id +
        '" data-date="' + esc(d.date) + '">' +
        '<span class="dept-cell-ico">' + deptIconSVG(dp.name, 24) + '</span>' +
        '<span class="dept-cell-name">' + esc(dp.name.replace(/（疼痛科）/, '')) + '</span></div>';
    }).join('') +
      '<div class="dept-cell" data-action="dept-list"><span class="dept-cell-ico">' +
      deptIconSVG('default', 24) + '</span><span class="dept-cell-name">全部科室</span></div>';

    const docs = (d.doctors || []).length ? d.doctors.map(function (doc) {
      const free = doc.free > 0;
      return '<div class="doc-row ' + (free ? 'tap' : 'off') + '" ' +
        (free ? 'data-action="appoint-doc" data-id="' + doc.id + '" data-name="' + esc(doc.name) + '"' : '') + '>' +
        '<span class="doc-av">' + doctorAvatarSVG(52) + '</span>' +
        '<div class="doc-main">' +
          '<div class="doc-head"><span class="doc-name">' + esc(doc.name) + '</span>' +
          (doc.title ? '<span class="tag">' + esc(doc.title) + '</span>' : '') + '</div>' +
          '<div class="doc-sub">' + esc((d.departments.filter(function (x) { return x.id === doc.department_id; })[0] || {}).name || '') +
            ' · 郑州大学校医院</div>' +
          '<div class="doc-spec">擅长：' + esc(doc.specialty || '常见病诊治') + '</div>' +
        '</div>' +
        '<span class="doc-flag ' + (free ? 'ok' : 'no') + '">' + (free ? '有号' : '约满') + '</span>' +
        '</div>';
    }).join('') : '<div class="empty">该科室当天暂无排班</div>';

    const firstFree = (d.doctors || []).filter(function (x) { return x.free > 0; })[0];

    show(`
      <div class="appoint-hero">
        <div class="appoint-hero-t">预约挂号</div>
        <div class="appoint-hero-s">线上预约 · 快速就医</div>
      </div>

      <div class="card">
        <div class="date-title">就诊日期</div>
        <div class="date-row">${dates}<div class="date-more" data-action="appoint-more">更多日期 ›</div></div>
      </div>

      <div class="card">
        <div class="date-title">选择科室 <span class="head-link" data-action="dept-list">科室简介 ›</span></div>
        <div class="dept-grid">${depts}</div>
      </div>

      <div class="card">
        <div class="date-title">选择医生</div>
        ${docs}
      </div>

      <div class="appoint-foot">
        <div class="foot-tip">ⓘ 温馨提示<br/><span>请按实际情况选择科室与医生，预约成功后请按时就诊</span></div>
        <button class="btn foot-btn" data-action="${firstFree ? 'appoint-doc' : 'dept-list'}"
          data-id="${firstFree ? firstFree.id : ''}" data-name="${firstFree ? esc(firstFree.name) : ''}">
          立即预约 →</button>
      </div>
      ${tabBar('home')}
    `);
  } catch (e) {
    show('<div class="card"><div class="err">' + esc(e.message) + '</div><button class="btn" data-action="depts">返回首页</button></div>');
  }
}


async function renderHospitalIntro() {
  show('<div class="loading">加载中…</div>');
  try {
    const info = await api('/api/hospital/info');
    const hours = (info.hours || []).map((h) => `<div class="sub">· ${esc(h)}</div>`).join('');
    const notes = (info.notes || []).map((h) => `<div class="sub">· ${esc(h)}</div>`).join('');
    show(`
      <div class="row" style="margin-bottom:10px;">
        <div class="title">医院简介</div>
        <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="depts">返回首页</button>
      </div>
      <div class="card">
        <div class="date-title">${esc(info.name || '')}</div>
        <div class="sub">${esc(info.address || '')}</div>
        <div class="sub">${esc(info.phone || '')}</div>
      </div>
      <div class="card"><div class="date-title">门诊时间</div>${hours}</div>
      <div class="card"><div class="date-title">就诊须知</div>${notes}</div>
      <div class="card">
        <div class="date-title">更多信息</div>
        <button class="btn ghost" data-action="guide">就医指南</button>
        <button class="btn ghost" data-action="access">来院指引</button>
        <button class="btn ghost" data-action="all-reviews" data-doctor="" data-name="">就诊口碑</button>
      </div>
      <div class="disclaimer">${esc(info.disclaimer || '')}</div>
    `);
  } catch (e) {
    show(`<div class="card"><div class="err">${esc(e.message)}</div>
      <button class="btn" data-action="depts">返回首页</button></div>`);
  }
}

/* ---------------- 专家介绍 ---------------- */

async function renderExperts() {
  show('<div class="loading">加载中…</div>');
  try {
    const depts = await api('/api/departments');
    const doctors = await api('/api/doctors');
    const deptName = {};
    depts.forEach((d) => { deptName[d.id] = d.name; });

    const cards = doctors.map((x) => `
      <div class="card tap" data-action="doctor" data-id="${x.id}" data-name="${esc(x.name)}">
        <div class="row">
          <div class="title">${esc(x.name)}</div>
          <div class="tag ${x.source === 'real' ? '' : 'gray'}">${esc(x.title || '')}</div>
        </div>
        <div class="sub">${esc(deptName[x.department_id] || '')}</div>
        <div class="sub">擅长：${esc(x.specialty || '')}</div>
        <div class="sub" style="color:#e8a33d;">${x.review_count > 0 ? '★ ' + x.rating + '（' + x.review_count + ' 条评价）' : '暂无评价'}</div>
      </div>`).join('');

    show(`
      <div class="row" style="margin-bottom:10px;">
        <div class="title">专家介绍</div>
        <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="depts">返回首页</button>
      </div>
      <div class="card">
        <div class="row">
          <div class="sub" style="margin:0;">共 ${doctors.length} 位医生</div>
          <button class="linkbtn" style="background:#fff7e6;color:#e8a33d;" data-action="all-reviews" data-doctor="" data-name="">全部评价</button>
        </div>
      </div>
      ${cards}
      <div class="disclaimer">标注「模拟」的医生为官网未公布、为演示补全的信息。</div>
    `);
  } catch (e) {
    show(`<div class="card"><div class="err">${esc(e.message)}</div>
      <button class="btn" data-action="depts">返回首页</button></div>`);
  }
}

/* ---------------- 就医指南 ---------------- */

async function renderGuide() {
  show('<div class="loading">加载中…</div>');
  try {
    const data = await api('/api/hospital/flow');
    const steps = (data.flow || []).map((s, i) =>
      `<div class="sub"><b>${i + 1}. ${esc(s.step)}</b>：${esc(s.detail)}</div>`).join('');
    const refund = (data.refund || []).map((r) => `<div class="sub">· ${esc(r)}</div>`).join('');
    show(`
      <div class="row" style="margin-bottom:10px;">
        <div class="title">就医指南</div>
        <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="depts">返回首页</button>
      </div>
      <div class="card"><div class="date-title">就诊流程</div>${steps}</div>
      <div class="card"><div class="date-title">退号与爽约规则</div>${refund}</div>
      <div class="card">
        <div class="date-title">开始挂号</div>
        <button class="btn" data-action="appoint">预约挂号</button>
        <button class="btn ghost" data-action="agent">不确定挂哪个科？问问 AI 导诊</button>
      </div>
      <div class="disclaimer">${esc(data.disclaimer || '')}</div>
    `);
  } catch (e) {
    show(`<div class="card"><div class="err">${esc(e.message)}</div>
      <button class="btn" data-action="depts">返回首页</button></div>`);
  }
}

/* ---------------- 来院指引（交通 + 楼层分布） ---------------- */

async function renderAccess() {
  show('<div class="loading">加载中…</div>');
  try {
    const data = await api('/api/hospital/access');
    const floors = (data.floors || []).map(function (fl) {
      return '<div class="card"><div class="date-title">' + esc(fl.floor) + '</div>' +
        (fl.items || []).map(function (it) { return '<div class="sub">· ' + esc(it) + '</div>'; }).join('') +
        '</div>';
    }).join('');
    const tips = (data.tips || []).map(function (t) { return '<div class="sub">· ' + esc(t) + '</div>'; }).join('');

    show(`
      <div class="row" style="margin-bottom:10px;">
        <div class="title">来院指引</div>
        <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="depts">返回首页</button>
      </div>

      <div class="card tap" data-action="nav">
        <div class="row">
          <div>
            <div class="title">院内导航</div>
            <div class="sub">选择科室或房间号，看平面图与步行路线</div>
          </div>
          <div class="arrow">›</div>
        </div>
      </div>

      <div class="card"><div class="date-title">${esc(data.name || '')}</div>
        <div class="sub">${esc(data.address || '')}</div></div>

      <div class="date-title" style="margin:14px 0 8px;">楼层与科室分布</div>
      ${floors}

      <div class="card"><div class="date-title">就诊提示</div>${tips}</div>
      <div class="disclaimer">${esc(data.note || '')}</div>
    `);
  } catch (e) {
    show('<div class="card"><div class="err">' + esc(e.message) + '</div>' +
      '<button class="btn" data-action="depts">返回首页</button></div>');
  }
}

/* ---------------- 医生 ---------------- */

async function renderDoctors(dept) {
  state.dept = dept;
  show('<div class="loading">加载中…</div>');
  try {
    const list = await api('/api/doctors?department_id=' + encodeURIComponent(dept.id));
    const cards = list.length ? list.map((d) => `
      <div class="card tap" data-action="doctor" data-id="${d.id}" data-name="${esc(d.name)}">
        <div class="row">
          <div class="title">${esc(d.name)}</div>
          <div class="tag">${esc(d.title || '')}</div>
        </div>
        <div class="sub">擅长：${esc(d.specialty || '')}</div>
        <div class="sub" style="color:${d.source === 'real' ? '#12a05c' : '#999'};">${d.source === 'real' ? '✓ 官网数据' : '模拟数据'}</div>
        <div class="sub" style="color:#e8a33d;">${d.review_count > 0 ? '★ ' + d.rating + '（' + d.review_count + ' 条评价）' : '暂无评价'}</div>
      </div>`).join('') : '<div class="empty">该科室暂无医生</div>';

    show(`
      <div class="row" style="margin-bottom:12px;">
        <div class="title">${esc(dept.name)}</div>
        <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="depts">返回科室</button>
      </div>
      ${cards}
    `);
  } catch (e) {
    show(`<div class="card"><div class="err">${esc(e.message)}</div>
      <button class="btn" data-action="depts">返回科室</button></div>`);
  }
}

/* ---------------- 排班 ---------------- */

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function dateLabel(iso) {
  const p = iso.split('-');
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  let prefix = '';
  if (diff === 0) prefix = '今天 · ';
  else if (diff === 1) prefix = '明天 · ';
  else if (diff === 2) prefix = '后天 · ';
  return prefix + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK[d.getDay()];
}


/* 预约页点医生 → 打开该医生排班 */
async function renderDocumentsFallback(id, name) {
  try {
    const list = await api('/api/doctors');
    const hit = (list || []).filter(function (x) { return String(x.id) === String(id); })[0];
    if (hit) { renderSchedules(hit); return; }
    toast('未找到该医生，请重试');
  } catch (e) {
    toast(e.message);
  }
}

async function renderSchedules(doctor) {
  state.doctor = doctor;
  // 从「专家介绍」直接进入时没有 state.dept，这里按 department_id 回填科室名
  if (!state.dept && doctor && doctor.department_id) { // deptFallbackDone
    try {
      const ds = await api('/api/departments');
      const hit = ds.filter((d) => d.id === doctor.department_id)[0];
      if (hit) state.dept = { id: hit.id, name: hit.name };
    } catch (e) { /* ignore */ }
  }
  show('<div class="loading">加载中…</div>');
  try {
    const list = await api('/api/schedules?doctor_id=' + encodeURIComponent(doctor.id));
    let reviewData = null;
    try {
      reviewData = await api('/api/doctors/' + encodeURIComponent(doctor.id) + '/reviews');
    } catch (e) { reviewData = null; }
    const dates = [];
    list.forEach((s) => { if (dates.indexOf(s.date) === -1) dates.push(s.date); });

    const groups = dates.map((d) => {
      const items = list.filter((s) => s.date === d).map((s) => {
        const pct = s.capacity > 0 ? Math.round((s.remain * 100) / s.capacity) : 0;
        const full = s.remain <= 0;
        return `
          <div class="slot ${full ? 'full' : ''}" data-action="${full ? 'noop' : 'slot'}"
               data-id="${s.id}" data-date="${s.date}" data-period="${esc(s.period)}"
               data-time="${s.start_time}-${s.end_time}" data-room="${esc(s.room || '')}"
               data-remain="${s.remain}">
            <div class="row">
              <div>${esc(s.period)} ${s.start_time}-${s.end_time}</div>
              <div class="tag ${full ? 'gray' : ''}">${full ? '已满' : '剩余 ' + s.remain + '/' + s.capacity}</div>
            </div>
            <div class="bar"><i class="${pct <= 20 ? 'low' : ''}" style="width:${pct}%"></i></div>
            <div class="sub">${esc(s.room || '')}</div>
          </div>`;
      }).join('');
      return `<div class="card"><div class="date-title">${dateLabel(d)}</div>${items}</div>`;
    }).join('');

    show(`
      <div class="row" style="margin-bottom:12px;">
        <div>
          <div class="title">${esc(doctor.name)}</div>
          <div class="sub">${esc((state.dept && state.dept.name) || '')} · 未来 7 天</div>
        </div>
        <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="doctors">返回医生</button>
      </div>
      ${groups || '<div class="empty">暂无排班</div>'}
      ${reviewSection(reviewData, doctor)}
    `);
  } catch (e) {
    show(`<div class="card"><div class="err">${esc(e.message)}</div>
      <button class="btn" data-action="depts">返回科室</button></div>`);
  }
}

/* ---------------- 确认预约 ---------------- */

function renderConfirm(slot) {
  state.slot = slot;
  show(`
    <div class="card">
      <div class="row">
        <div class="title">${esc(state.doctor ? state.doctor.name : '')}</div>
        <div class="tag">预约</div>
      </div>
      <div class="sub">${esc(slot.date)}　${esc(slot.period)}　${esc(slot.time)}</div>
      <div class="sub">${esc(slot.room)}</div>
    </div>

    <div class="card">
      <div class="row">
        <div class="title">就诊人</div>
        <div class="tag green">已实名</div>
      </div>
      <div class="detail-list">
        <div class="sub">姓名：${esc(state.student.name)}</div>
        <div class="sub">学号：${esc(state.student.student_no)}</div>
        <div class="sub">手机：${esc(state.student.phone || '未填写')}</div>
        <div class="sub">院系：${esc(state.student.major || '')}</div>
      </div>
      <button class="btn" data-action="book" id="bookBtn">确认预约</button>
      <div class="err" id="bookErr"></div>
    </div>

    <div class="notice">就诊提示：请于就诊时段前 15 分钟到达诊室，出示预约号；如需取消请在「我的预约」中操作，号源会立即释放给其他同学。</div>
  `);
}

async function doBook() {
  const btn = document.getElementById('bookBtn');
  const errBox = document.getElementById('bookErr');
  btn.disabled = true;
  btn.textContent = '提交中…';
  errBox.textContent = '';

  try {
    const res = await api('/api/appointments', {
      method: 'POST',
      body: { schedule_id: Number(state.slot.id) }
    });
    show(`
      <div class="card">
        <div class="row"><div class="title">预约成功</div><div class="tag green">已完成</div></div>
        <div class="detail-list">
          <div class="sub">预约号：${res.appointment_id}</div>
          <div class="sub">就诊人：${esc(res.patient_name)}</div>
          <div class="sub">${esc(state.doctor ? state.doctor.name : '')}　${esc(state.slot.date)}　${esc(state.slot.period)}</div>
          <div class="sub">该时段剩余：${res.remain}</div>
        </div>
        <button class="btn" data-action="my">查看我的预约</button>
        <button class="btn ghost" data-action="depts">返回首页</button>
      </div>
    `);
    toast('预约成功');
  } catch (e) {
    errBox.textContent = e.message;
    btn.disabled = false;
    btn.textContent = '确认预约';
  }
}

/* ---------------- 我的预约 ---------------- */

async function renderMy() {
  show('<div class="loading">加载中…</div>');
  try {
    const list = await api('/api/appointments');
    const cards = list.length ? list.map((a) => {
      const booked = a.status === 'BOOKED';
      return `
        <div class="card">
          <div class="row">
            <div class="title">${esc(a.doctor_name)} · ${esc(a.department_name)}</div>
            <div class="tag ${booked ? '' : 'gray'}">${booked ? '已预约' : '已取消'}</div>
          </div>
          <div class="sub">${esc(a.date)}　${esc(a.period)}　${a.start_time}-${a.end_time}</div>
          <div class="sub">${esc(a.room || '')} · 预约号 ${a.id}</div>
          ${a.reviewed ? '<div class="sub" style="color:#12a05c;">✓ 已评价</div>' : ''}
          ${!a.reviewed ? `<button class="btn ghost" data-action="review-open" data-id="${a.id}" data-doctor="${esc(a.doctor_name)}" data-date="${esc(a.date)}" data-period="${esc(a.period)}">评价这次就诊</button>` : ''}
          ${booked ? `<button class="btn danger" data-action="cancel" data-id="${a.id}">取消预约</button>` : ''}
        </div>`;
    }).join('') : '<div class="empty">还没有预约记录，去首页挑个科室吧</div>';

    show(`
      <div class="row" style="margin-bottom:12px;">
        <div class="title">我的预约</div>
        <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="depts">返回首页</button>
      </div>
      ${tabBar('my')}
      <div class="card">
        <div class="sub">${esc(state.student.name)} · ${esc(state.student.student_no)} · ${esc(state.student.major || '')}</div>
      </div>
      ${cards}
    `);
  } catch (e) {
    show(`<div class="card"><div class="err">${esc(e.message)}</div>
      <button class="btn" data-action="my">重试</button></div>`);
  }
}

async function doCancel(id) {
  if (!confirm('确定要取消这个预约吗？号源会退回到该时段。')) return;
  try {
    const r = await api('/api/appointments/' + id, { method: 'DELETE' });
    toast('已取消，该时段剩余 ' + r.remain);
    renderMy();
  } catch (e) {
    toast(e.message);
  }
}

/* ---------------- 智能分诊 ---------------- */

const EXAMPLES = [
  '发烧咳嗽三天，嗓子疼，还有点乏力',
  '牙疼，牙龈出血，吃冷的更疼',
  '腰疼，久坐以后更明显',
  '眼睛干涩，看东西有点模糊'
];

function renderTriage() {
  show(`
    <div class="row" style="margin-bottom:12px;">
      <div class="title">智能分诊</div>
      <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="depts">返回首页</button>
    </div>

    <div class="card">
      <div class="sub">说说哪里不舒服，越具体越准（症状、持续多久、什么时候加重）</div>
      <div class="field" style="margin-top:10px;">
        <textarea id="triageText" placeholder="例如：发烧两天，咳嗽有痰，嗓子疼，晚上更明显"></textarea>
      </div>
      <div class="chips">
        ${EXAMPLES.map((t) => `<div class="chip" data-action="triage-example" data-text="${esc(t)}">${esc(t)}</div>`).join('')}
      </div>
      <button class="btn" data-action="triage-submit" id="triageBtn">帮我推荐科室</button>
      <div class="err" id="triageErr"></div>
    </div>

    <div id="triageResult"></div>

    <div class="disclaimer">提示：智能分诊仅作参考，不能替代医生诊断。出现剧烈胸痛、呼吸困难、昏迷、大出血等情况请立即前往急诊或拨打 120。</div>
  `);
}

async function doTriage() {
  const text = (document.getElementById('triageText').value || '').trim();
  const btn = document.getElementById('triageBtn');
  const errBox = document.getElementById('triageErr');
  const box = document.getElementById('triageResult');

  if (text.length < 2) {
    errBox.textContent = '请先描述一下症状';
    return;
  }
  btn.disabled = true;
  btn.textContent = '分析中…';
  errBox.textContent = '';
  box.innerHTML = '';

  try {
    const r = await api('/api/triage', { method: 'POST', body: { description: text } });
    state.triageResult = r;
    const urgent = r.urgency === '紧急';
    box.innerHTML = `
      <div class="card">
        <div class="row">
          <div class="title">推荐科室</div>
          <div class="tag ${urgent ? 'red' : ''}">${esc(r.urgency)}</div>
        </div>
        <div class="result-dept">${esc(r.department_name || '建议咨询导诊台')}</div>
        <div class="sub">把握程度：${esc(r.confidence)}${(r.matched && r.matched.length) ? ' · 识别到：' + esc(r.matched.join('、')) : ''}</div>
        <div class="advice">${esc(r.advice)}</div>
        <div class="sub">${r.source === 'ai' ? 'AI 分析' : '规则匹配'}</div>
        ${r.department_id ? `<button class="btn" data-action="triage-go" data-id="${r.department_id}" data-name="${esc(r.department_name)}">去挂 ${esc(r.department_name)}</button>` : ''}
        <button class="btn ghost" data-action="triage">重新描述</button>
      </div>`;
  } catch (e) {
    errBox.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '帮我推荐科室';
  }
}

/* ---------------- 事件分发 ---------------- */

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  switch (action) {
    case 'login': doLogin(); break;
    case 'logout':
      if (!confirm('确定退出登录吗？')) return;
      api('/api/logout', { method: 'POST' }).catch(() => {}).then(() => {
        clearSession();
        renderLogin();
      });
      break;
    case 'depts': renderDepartments(); break;
    case 'dept-list': renderDeptList(false); break;
    case 'appoint': renderAppoint(); break;
    case 'appoint-date': renderAppoint(Number(el.dataset.dept) || 0, el.dataset.date); break;
    case 'appoint-dept': renderAppoint(Number(el.dataset.id) || 0, el.dataset.date); break;
    case 'appoint-doc': renderDocumentsFallback(el.dataset.id, el.dataset.name); break;
    case 'appoint-more': renderAppoint((state.appoint && state.appoint.deptId) || 0, ''); break;
    case 'intro': renderHospitalIntro(); break;
    case 'experts': renderExperts(); break;
    case 'guide': renderGuide(); break;
    case 'access': renderAccess(); break;
    case 'nav': renderNavPage('', 1, '', 'lift'); break;
    case 'profile': renderProfile(); break;
    case 'profile-info': renderProfileDetail('info'); break;
    case 'avatar-pick': {
      const sid = (state.student && state.student.student_no) || '';
      localStorage.setItem('avatar_' + sid, el.dataset.id);
      renderUser();
      renderProfileDetail('info');
      break;
    }
    case 'avatar-default': {
      const sid2 = (state.student && state.student.student_no) || '';
      localStorage.removeItem('avatar_' + sid2);
      renderUser();
      renderProfileDetail('info');
      break;
    }
    case 'profile-card': renderProfileDetail('card'); break;
    case 'profile-record': renderProfileDetail('record'); break;
    case 'profile-setting': renderProfileDetail('setting'); break;
    case 'nav-dept': renderNavPage(el.dataset.name || '', 1, '', 'lift'); break;
    case 'nav-floor': renderNavPage(el.dataset.name || '', Number(el.dataset.floor) || 1, '', el.dataset.start || 'lift'); break;
    case 'access-floor': renderNavPage(el.dataset.name || '', Number(el.dataset.floor) || 1, el.dataset.room || '', el.dataset.start || 'lift'); break;
    case 'access-start': renderNavPage(el.dataset.name || '', Number(el.dataset.floor) || 1, el.dataset.room || '', el.dataset.start || 'lift'); break;
    case 'nav-start': renderNav(el.dataset.name || '', Number(el.dataset.floor) || 1, el.dataset.room || '', el.dataset.start || 'lift'); break;
    case 'dept':
      renderDoctors({ id: el.dataset.id, name: el.dataset.name });
      break;
    case 'doctors':
      if (state.dept) renderDoctors(state.dept); else renderDepartments();
      break;
    case 'doctor':
      renderSchedules({ id: el.dataset.id, name: el.dataset.name });
      break;
    case 'slot':
      renderConfirm({
        id: el.dataset.id,
        date: el.dataset.date,
        period: el.dataset.period,
        time: el.dataset.time,
        room: el.dataset.room
      });
      break;
    case 'book': doBook(); break;
    case 'my': renderMy(); break;
    case 'cancel': doCancel(el.dataset.id); break;
    case 'agent': renderAgent(); break;
    case 'agent-send': sendAgent(); break;
    case 'agent-suggest':
      document.getElementById('chatInput').value = el.dataset.text;
      sendAgent();
      break;
    case 'agent-reset':
      state.chat = [];
      renderAgent();
      break;
    case 'triage': renderTriage(); break;
    case 'health': renderHealth(); break;
    case 'review-open':
      state.reviewForm = {
        appointmentId: Number(el.dataset.id),
        doctorName: el.dataset.doctor || '',
        date: el.dataset.date || '',
        period: el.dataset.period || '',
        rating: 0, attitude: 0, wait_time: 0, communication: 0, environment: 0,
        comment: '', anonymous: false
      };
      renderReviewForm();
      break;
    case 'rate':
      if (state.reviewForm) {
        state.reviewForm[el.dataset.field] = Number(el.dataset.val);
        const box = document.getElementById('reviewStars');
        if (box) box.innerHTML = starRowsHtml();
      }
      break;
    case 'review-submit': submitReview(); break;
    case 'health-search': doHealthSearch(); break;
    case 'health-cat':
      healthState.category = el.dataset.text || '';
      loadHealthList().catch(function (e) { toast(e.message); });
      break;
    case 'health-open': renderHealthTopic(el.dataset.id); break;
    case 'health-dept': goHealthDept(el.dataset.name); break;
    case 'service': renderService(); break;
    case 'service-send': sendService(); break;
    case 'service-suggest': {
      const t = el.dataset.text || '';
      const inp = document.getElementById('serviceInput');
      if (inp) inp.value = t;
      sendService();
      break;
    }
    case 'service-reset': state.serviceChat = []; renderService(); break;
    case 'kb': renderKb(''); break;
    case 'kb-cat': renderKb(el.dataset.text || ''); break;
    case 'kb-open': renderKbItem(el.dataset.id); break;
    case 'all-reviews': renderAllReviews(el.dataset.doctor || '', el.dataset.name || ''); break;
    case 'triage-example':
      document.getElementById('triageText').value = el.dataset.text;
      break;
    case 'triage-submit': doTriage(); break;
    case 'triage-go':
      renderDoctors({ id: el.dataset.id, name: el.dataset.name });
      break;
    case 'noop': toast('该时段已约满'); break;
    default: break;
  }
});

/* ---------------- 启动 ---------------- */

// 单设备登录：定时心跳，被其他设备挤掉时能较快发现
const singleDevice = { timer: null };

function startHeartbeat() {
  stopHeartbeat();
  singleDevice.timer = setInterval(function () {
    if (!state.token) return;
    if (document.hidden) return;      // 切到后台时不做无谓请求
    api('/api/me').catch(function () { /* 401 由 api() 统一处理 */ });
  }, 30000);
}

// 页面重新回到前台时立即校验一次（手机切回浏览器、电脑切回标签页）
document.addEventListener('visibilitychange', function () {
  if (!document.hidden && state.token) {
    api('/api/me').catch(function () { });
  }
});

function stopHeartbeat() {
  if (singleDevice.timer) {
    clearInterval(singleDevice.timer);
    singleDevice.timer = null;
  }
}

function applyDeepLink() {
  const h = (location.hash || '').replace('#', '');
  const routes = {
    home: function () { renderDepartments(); },
    dept: function () { renderDeptList(); },
    appoint: function () { renderAppoint(); },
    intro: function () { renderHospitalIntro(); },
    experts: function () { renderExperts(); },
    guide: function () { renderGuide(); },
    access: function () { renderAccess(); },
    agent: function () { renderAgent(); },
    health: function () { renderHealth(); },
    service: function () { renderService(); },
    reviews: function () { renderAllReviews(); },
    my: function () { renderMy(); },
    profile: function () { renderProfile(); },
    'me-info': function () { renderProfileDetail('info'); }
  };
  if (routes[h]) { routes[h](); return true; }
  return false;
}

function boot() {
  renderUser();
  if (applyDeepLink()) return;
  if (state.token && state.student) {
    renderDepartments();
    startHeartbeat();
  } else {
    renderLogin();
  }
}

// 延迟启动，确保后续 const 声明已完成初始化
setTimeout(boot, 0);

/* ---------------- AI 导诊助手（聊天） ---------------- */

if (!state.chat) state.chat = [];
if (!state.chatBusy) state.chatBusy = false;

const AGENT_GREETING = '你好，我是校医院导诊助手。哪里不舒服？可以直接说，比如“发烧咳嗽两天了”或者“牙疼得厉害”。';

function renderAgent() {
  if (!state.chat.length) {
    state.chat = [{ role: 'assistant', content: AGENT_GREETING }];
  }
  show(`
    <div class="row" style="margin-bottom:12px;">
      <div class="title">AI 导诊助手</div>
      <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="depts">返回首页</button>
    </div>
    <div class="chat" id="chatBox"></div>
    <div class="chat-bar">
      <input id="chatInput" type="text" placeholder="描述症状，或说“帮我约明天上午”" />
      <button class="btn" style="width:auto;margin:0;padding:0 18px;" data-action="agent-send" id="sendBtn">发送</button>
    </div>
    <div class="chips" id="chatChips"></div>
    <div class="disclaimer">AI 建议仅供参考，不能替代医生诊断。急重症请直接前往急诊或拨打 120。</div>
  `);
  paintChat();

  const input = document.getElementById('chatInput');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendAgent();
  });
}

function paintChat() {
  const box = document.getElementById('chatBox');
  if (!box) return;
  box.innerHTML = state.chat.map((m) => {
    const me = m.role === 'user';
    let extra = '';
    if (m.card && m.card.type === 'department' && m.card.department_id) {
      extra = `<button class="btn" data-action="dept" data-id="${m.card.department_id}" data-name="${esc(m.card.department_name || '')}">去挂 ${esc(m.card.department_name || '该科室')}</button>`;
    } else if (m.card && m.card.type === 'booked') {
      extra = `<button class="btn" data-action="my">查看我的预约（预约号 ${m.card.appointment_id}）</button>`;
    } else if (m.card && m.card.type === 'schedules' && m.card.doctor_id) {
      extra = `<button class="btn ghost" data-action="doctor" data-id="${m.card.doctor_id}" data-name="">查看全部排班</button>`;
    }
    return `<div class="msg-row ${me ? 'me' : ''}">
      <span class="${me ? 'q-avatar' : 'ai-avatar'}">${me ? qAvatarSVG(state.student && state.student.student_no, 34) : aiAvatarSVG(34)}</span>
      <div class="bubble ${me ? 'me' : ''}">${esc(m.content).replace(/\n/g, '<br/>')}${extra}</div></div>`;
  }).join('');

  const chips = document.getElementById('chatChips');
  const last = state.chat.filter((m) => m.role === 'assistant').slice(-1)[0];
  const sugg = (last && last.suggestions) || [];
  chips.innerHTML = sugg.length
    ? sugg.map((s) => `<div class="chip" data-action="agent-suggest" data-text="${esc(s)}">${esc(s)}</div>`).join('')
      + '<div class="chip" data-action="agent-reset" data-text="">重开对话</div>'
    : '<div class="chip" data-action="agent-reset" data-text="">重开对话</div>';

  if (state.chatBusy) {
    chips.innerHTML = '<div class="chip">助手正在思考…</div>' + chips.innerHTML;
  }
  box.scrollTop = box.scrollHeight;
}

async function sendAgent() {
  if (state.chatBusy) return;
  const input = document.getElementById('chatInput');
  const text = (input.value || '').trim();
  if (!text) return;

  state.chat.push({ role: 'user', content: text });
  input.value = '';
  state.chatBusy = true;
  paintChat();

  try {
    const history = state.chat
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await api('/api/agent/chat', { method: 'POST', body: { messages: history } });
    state.chat.push({
      role: 'assistant',
      content: res.reply || '（没有返回内容）',
      card: res.card || null,
      suggestions: res.suggestions || []
    });
  } catch (e) {
    state.chat.push({ role: 'assistant', content: '出错了：' + e.message });
  } finally {
    state.chatBusy = false;
    paintChat();
    const box = document.getElementById('chatBox');
    if (box) box.scrollTop = box.scrollHeight;
  }
}

/* ---------------- 校园健康知识库 ---------------- */

const healthState = { q: '', category: '', list: [], categories: [] };

async function renderHealth() {
  show('<div class="loading">加载中…</div>');
  try {
    if (!healthState.categories.length) {
      healthState.categories = await api('/api/health/categories');
    }
    await loadHealthList();
  } catch (e) {
    show('<div class="card"><div class="err">' + esc(e.message) +
         '</div><button class="btn" data-action="depts">返回首页</button></div>');
  }
}

async function loadHealthList() {
  const qs = [];
  if (healthState.q) qs.push('q=' + encodeURIComponent(healthState.q));
  if (healthState.category) qs.push('category=' + encodeURIComponent(healthState.category));
  healthState.list = await api('/api/health/topics' + (qs.length ? '?' + qs.join('&') : ''));
  paintHealth();
}

function paintHealth() {
  const cats = healthState.categories.map(function (c) {
    const on = healthState.category === c.name ? ' on' : '';
    return '<div class="chip' + on + '" data-action="health-cat" data-text="' + esc(c.name) + '">' +
           esc(c.name) + ' · ' + c.count + '</div>';
  }).join('');

  const items = healthState.list.length ? healthState.list.map(function (t) {
    const badge = t.alert
      ? '<div class="tag red">需警惕</div>'
      : '<div class="tag">' + esc(t.category) + '</div>';
    return '<div class="card tap" data-action="health-open" data-id="' + t.id + '">' +
             '<div class="row"><div class="title">' + esc(t.title) + '</div>' + badge + '</div>' +
             '<div class="sub">' + esc(t.summary) + '</div>' +
             '<div class="sub" style="color:#1a73e8;">相关科室：' + esc(t.department) + '（仅供参考）</div>' +
           '</div>';
  }).join('') : '<div class="empty">没有找到相关条目，换个关键词试试，比如「发烧」「牙疼」「失眠」</div>';

  show(`
    <div class="row" style="margin-bottom:10px;">
      <div class="title">校园健康知识</div>
      <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="depts">返回首页</button>
    </div>
    <div class="card">
      <div class="chat-bar" style="margin-top:0;">
        <input id="healthInput" type="text" placeholder="搜索症状或疾病，如：发烧、牙疼、失眠" value="${esc(healthState.q)}" />
        <button class="btn" style="width:auto;margin:0;padding:0 18px;" data-action="health-search">搜索</button>
      </div>
      <div class="chips">${cats}
        <div class="chip${healthState.category ? '' : ' on'}" data-action="health-cat" data-text="">全部</div>
      </div>
    </div>
    ${items}
    <div class="disclaimer">以上内容为健康科普，仅供参考，不能替代医生的诊断与治疗；症状持续或加重请及时就医。</div>
  `);

  const input = document.getElementById('healthInput');
  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doHealthSearch();
    });
  }
}

function doHealthSearch() {
  const el = document.getElementById('healthInput');
  healthState.q = ((el && el.value) || '').trim();
  loadHealthList().catch(function (e) { toast(e.message); });
}

async function renderHealthTopic(id) {
  show('<div class="loading">加载中…</div>');
  try {
    const t = await api('/api/health/topics/' + encodeURIComponent(id));
    const ul = function (arr) {
      return arr.map(function (x) { return '<div class="sub">· ' + esc(x) + '</div>'; }).join('');
    };
    show(`
      <div class="row" style="margin-bottom:10px;">
        <div class="title">${esc(t.title)}</div>
        <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="health">返回列表</button>
      </div>
      ${t.alert ? '<div class="notice">该主题包含需要警惕的情况，若出现「什么时候该看医生」中的描述，请尽快就诊。</div>' : ''}
      <div class="card"><div class="date-title">常见表现</div>${ul(t.symptoms)}</div>
      <div class="card"><div class="date-title">预防措施</div>${ul(t.prevention)}</div>
      <div class="card"><div class="date-title">自我照护 / 处理原则</div>${ul(t.care)}</div>
      <div class="card">
        <div class="date-title">什么时候该看医生</div>
        <div class="sub">${esc(t.see_doctor)}</div>
        <div class="sub" style="color:#1a73e8;">可能相关科室：${esc(t.department)}</div>
        <button class="btn ghost" data-action="health-dept" data-name="${esc(t.department)}">如症状持续，去挂 ${esc(t.department)}</button>
      </div>
      <div class="disclaimer">以上内容为健康科普，仅供参考，不能替代医生的诊断与治疗。</div>
    `);
  } catch (e) {
    show('<div class="card"><div class="err">' + esc(e.message) +
         '</div><button class="btn" data-action="health">返回列表</button></div>');
  }
}

async function goHealthDept(name) {
  if (!name) return;
  try {
    const list = await api('/api/departments');
    const matched = list.filter(function (d) { return d.name === name; });
    const target = matched.filter(function (d) { return d.source === 'real'; })[0] || matched[0];
    if (!target) { toast('没有找到该科室'); return; }
    renderDoctors({ id: target.id, name: target.name });
  } catch (e) {
    toast(e.message);
  }
}

/* ---------------- 就诊评价 ---------------- */

const REVIEW_DIMS = [
  ['rating', '整体评分', true],
  ['attitude', '服务态度', false],
  ['wait_time', '候诊时间', false],
  ['communication', '沟通解释', false],
  ['environment', '就诊环境', false]
];

function starRowsHtml() {
  const f = state.reviewForm || {};
  return REVIEW_DIMS.map(function (d) {
    const field = d[0], label = d[1], required = d[2];
    const val = f[field] || 0;
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      stars += '<span class="star' + (i <= val ? ' on' : '') +
               '" data-action="rate" data-field="' + field + '" data-val="' + i + '">★</span>';
    }
    return '<div class="row" style="margin-bottom:10px;">' +
             '<div class="sub" style="margin:0;">' + label +
             (required ? ' <span class="tag red" style="font-size:11px;">必填</span>' : '') +
             '</div>' +
             '<div class="stars">' + stars + '</div>' +
           '</div>';
  }).join('');
}

function renderReviewForm() {
  const f = state.reviewForm;
  show(`
    <div class="row" style="margin-bottom:10px;">
      <div class="title">评价就诊体验</div>
      <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="my">返回</button>
    </div>
    <div class="card">
      <div class="sub">${esc(f.doctorName)}　${esc(f.date)} ${esc(f.period)}</div>
      <div id="reviewStars" style="margin-top:16px;">${starRowsHtml()}</div>
    </div>
    <div class="card">
      <div class="sub">文字评价（选填，最多 300 字）</div>
      <textarea id="reviewComment" maxlength="300" placeholder="说说这次就诊的感受，帮助医院改进～">${esc(f.comment)}</textarea>
      <div class="row" style="margin-top:14px;">
        <div class="sub" style="margin:0;">匿名评价</div>
        <input type="checkbox" id="reviewAnon" ${f.anonymous ? 'checked' : ''} style="width:22px;height:22px;" />
      </div>
      <button class="btn" data-action="review-submit">提交评价</button>
      <div class="err" id="reviewErr"></div>
    </div>
    <div class="disclaimer">评价仅用于改进校医院服务，请客观真实填写；选择匿名后其他同学看不到你的姓名。</div>
  `);
}

async function submitReview() {
  const f = state.reviewForm;
  const err = document.getElementById('reviewErr');
  const commentEl = document.getElementById('reviewComment');
  const anonEl = document.getElementById('reviewAnon');

  if (!f) return;
  if (!f.rating) {
    if (err) err.textContent = '请先给整体评分（点星星，1 分最低、5 分最高）';
    return;
  }

  const body = {
    appointment_id: f.appointmentId,
    rating: f.rating,
    comment: ((commentEl && commentEl.value) || '').trim(),
    anonymous: !!(anonEl && anonEl.checked)
  };
  ['attitude', 'wait_time', 'communication', 'environment'].forEach(function (k) {
    if (f[k]) body[k] = f[k];
  });

  try {
    const res = await api('/api/reviews', { method: 'POST', body: body });
    toast('评价已提交，感谢反馈');
    state.reviewForm = null;
    renderMy();
  } catch (e) {
    if (err) err.textContent = e.message;
  }
}

/* ---------------- 评价公开展示 ---------------- */

function starStr(n) {
  const v = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  return '★'.repeat(v) + '☆'.repeat(5 - v);
}

function reviewSection(data, doctor) {
  if (!data || !data.summary || !data.summary.total) {
    return '<div class="card"><div class="date-title">同学评价</div><div class="sub">这位医生还没有评价</div></div>';
  }
  const s = data.summary;
  const items = (data.items || []).slice(0, 3).map((r) => `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid #f0f0f0;">
        <div class="row">
          <div class="sub" style="margin:0;"><b>${esc(r.author)}</b></div>
          <div class="sub" style="margin:0;color:#f5b301;">${starStr(r.rating)}</div>
        </div>
        <div class="sub">${esc(r.comment || '（未填写文字评价）')}</div>
      </div>`).join('');
  const more = `<button class="btn ghost" data-action="all-reviews" data-doctor="${doctor.id}" data-name="${esc(doctor.name)}">查看全部 ${s.total} 条评价</button>`;

  return `
    <div class="card">
      <div class="row">
        <div class="date-title" style="margin:0;">同学评价</div>
        <div class="sub" style="margin:0;color:#f5b301;">${starStr(s.avg_rating)} ${s.avg_rating || '-'}</div>
      </div>
      <div class="sub">共 ${s.total} 条 · 服务态度 ${s.attitude || '-'} · 候诊 ${s.wait_time || '-'} · 沟通 ${s.communication || '-'} · 环境 ${s.environment || '-'}</div>
      ${items}
      ${more}
    </div>`;
}

async function renderAllReviews(doctorId, doctorName) {
  show('<div class="loading">加载中…</div>');
  try {
    const qs = doctorId ? ('?doctor_id=' + encodeURIComponent(doctorId)) : '';
    const data = await api('/api/reviews' + qs);
    const items = (data.items || []).map((r) => `
      <div class="card">
        <div class="row">
          <div>
            <div class="title">${esc(r.doctor_name)} <span class="tag">${esc(r.department_name)}</span></div>
            <div class="sub">${esc(r.author)} · ${esc((r.date || '') + ' ' + (r.period || ''))}</div>
          </div>
          <div class="sub" style="margin:0;color:#f5b301;">${starStr(r.rating)}</div>
        </div>
        <div class="sub" style="margin-top:6px;">${esc(r.comment || '（未填写文字评价）')}</div>
      </div>`).join('');

    show(`
      <div class="row" style="margin-bottom:10px;">
        <div class="title">${doctorId ? esc(doctorName) + ' 的全部评价' : '就诊口碑'}</div>
        <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="${doctorId ? 'doctors' : 'depts'}">返回</button>
      </div>
      <div class="card">
        <div class="row">
          <div class="sub" style="margin:0;">全部评价</div>
          <div class="sub" style="margin:0;color:#f5b301;">${starStr(data.avg_rating)} ${data.avg_rating || '-'} · ${data.total} 条</div>
        </div>
      </div>
      ${items || '<div class="empty">还没有评价</div>'}
      <div class="disclaimer">评价内容由同学自愿填写，仅代表个人感受。</div>
    `);
  } catch (e) {
    show(`<div class="card"><div class="err">${esc(e.message)}</div>
      <button class="btn" data-action="depts">返回首页</button></div>`);
  }
}

/* ---------------- AI 前台客服（AI + 真人） ---------------- */

const SERVICE_GREETING = '你好，我是校医院咨询助手。可以帮你查门诊时间、值班医生、医保政策、就诊流程。有哪些我能帮上忙的？';

function renderService() {
  show(`
    <div class="row" style="margin-bottom:12px;">
      <div>
        <div class="title">服务咨询</div>
        <div class="sub">AI 即时回答 · 需要人工可留言给客服老师</div>
      </div>
      <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="depts">返回首页</button>
    </div>
    <div class="chat" id="serviceBox"><div class="loading">加载中…</div></div>
    <div class="chat-bar">
      <input id="serviceInput" type="text" placeholder="例如：今天谁值班 / 医保能报多少 / 我要人工客服" />
      <button class="btn" style="width:auto;margin:0;padding:0 18px;" data-action="service-send">发送</button>
    </div>
    <div class="chips" id="serviceChips"></div>
    <div class="disclaimer">带「AI 生成」的是智能助手回复；带「真人回复」的是校医院客服老师的回复。</div>
  `);

  const input = document.getElementById('serviceInput');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendService();
    });
  }

  loadServiceThread(true);
  startServicePoll();
}

async function loadServiceThread(scroll) {
  try {
    const data = await api('/api/service/thread');
    state.threadMsgs = data.messages || [];
    paintServiceThread(scroll);
  } catch (e) {
    const box = document.getElementById('serviceBox');
    if (box) box.innerHTML = '<div class="err">' + esc(e.message) + '</div>';
  }
}

function paintServiceThread(scroll) {
  const box = document.getElementById('serviceBox');
  if (!box) return;
  const msgs = state.threadMsgs || [];

  box.innerHTML = msgs.length ? msgs.map((m) => {
    const me = m.role === 'user';
    const badge = m.role === 'ai'
      ? '<span class="badge-ai">AI 生成</span>'
      : (m.role === 'staff' ? '<span class="badge-staff">真人回复</span>' : '');
    const av = me ? qAvatarSVG(state.student && state.student.student_no, 34)
      : (m.role === 'staff' ? qAvatarSVG('staff-' + (m.sender || ''), 34) : aiAvatarSVG(34));
    return '<div class="msg-row ' + (me ? 'me' : '') + '">' +
      '<span class="' + (me || m.role === 'staff' ? 'q-avatar' : 'ai-avatar') + '">' + av + '</span>' +
      '<div class="bubble ' + (me ? 'me' : '') + '">' +
      '<div class="who">' + esc(m.sender || '') + (badge ? ' ' + badge : '') + '</div>' +
      esc(m.content).replace(/\n/g, '<br/>') + '</div></div>';
  }).join('') : '<div class="bubble">' + esc(SERVICE_GREETING) + '</div>';

  const chips = document.getElementById('serviceChips');
  if (chips) {
    chips.innerHTML = ['今天谁值班？', '门诊时间？', '医保能报多少？', '我要人工客服']
      .map((t) => '<div class="chip" data-action="service-suggest" data-text="' + esc(t) + '">' + esc(t) + '</div>')
      .join('');
  }

  if (scroll !== false) box.scrollTop = box.scrollHeight;
}

async function sendService() {
  if (state.serviceBusy) return;
  const input = document.getElementById('serviceInput');
  const text = ((input && input.value) || '').trim();
  if (!text) return;

  if (input) input.value = '';
  state.serviceBusy = true;

  // 先本地插入用户消息，交互更跟手
  state.threadMsgs = (state.threadMsgs || []).concat([{ role: 'user', sender: state.student ? state.student.name : '我', content: text }]);
  paintServiceThread();

  try {
    const res = await api('/api/service/thread/messages', { method: 'POST', body: { content: text } });
    state.threadMsgs = res.messages || state.threadMsgs;
    paintServiceThread();
  } catch (e) {
    toast(e.message);
    loadServiceThread();
  } finally {
    state.serviceBusy = false;
  }
}

function startServicePoll() {
  stopServicePoll();
  state.serviceTimer = setInterval(async () => {
    if (!document.getElementById('serviceBox')) { stopServicePoll(); return; }
    try {
      const data = await api('/api/service/thread');
      const now = data.messages || [];
      if (now.length !== (state.threadMsgs || []).length) {
        state.threadMsgs = now;
        paintServiceThread();
      }
    } catch (e) { /* ignore */ }
  }, 5000);
}

function stopServicePoll() {
  if (state.serviceTimer) {
    clearInterval(state.serviceTimer);
    state.serviceTimer = null;
  }
}

/* ---------------- 知识库浏览 ---------------- */

async function renderKb(category) {
  show('<div class="loading">加载中…</div>');
  try {
    const cats = await api('/api/hospital/kb/categories');
    const qs = category ? ('?category=' + encodeURIComponent(category)) : '';
    const data = await api('/api/hospital/kb' + qs);

    const catChips = cats.map((c) => {
      const on = c.name === category ? ' on' : '';
      return '<div class="chip' + on + '" data-action="kb-cat" data-text="' + esc(c.name) + '">' +
             esc(c.name) + ' · ' + c.count + '</div>';
    }).join('') + '<div class="chip' + (category ? '' : ' on') + '" data-action="kb" data-text="">全部</div>';

    const items = (data.items || []).map((it) => `
      <div class="card" data-action="kb-open" data-id="${it.id}">
        <div class="row">
          <div class="title">${esc(it.title)}</div>
          <div class="tag ${it.verified ? '' : 'gray'}" style="font-size:11px;">${it.verified ? '已核实' : '未核实'}</div>
        </div>
        <div class="sub">${esc(it.category)} · 来源：${esc(it.source)}</div>
      </div>`).join('');

    show(`
      <div class="row" style="margin-bottom:10px;">
        <div class="title">知识库</div>
        <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="service">返回咨询</button>
      </div>
      <div class="card">
        <div class="sub" style="margin:0;">共 ${data.total || data.items.length} 条知识，每条都标注来源与核实状态</div>
        <div class="chips" style="margin-top:10px;">${catChips}</div>
      </div>
      ${items}
      <div class="disclaimer">「未核实」表示该条为原型演示内容，尚未与医院官方公告核对。</div>
    `);
  } catch (e) {
    show(`<div class="card"><div class="err">${esc(e.message)}</div>
      <button class="btn" data-action="service">返回咨询</button></div>`);
  }
}

async function renderKbItem(id) {
  show('<div class="loading">加载中…</div>');
  try {
    const it = await api('/api/hospital/kb/' + encodeURIComponent(id));
    const body = (it.content || []).map((c) => '<div class="sub">· ' + esc(c) + '</div>').join('');
    show(`
      <div class="row" style="margin-bottom:10px;">
        <div class="title">${esc(it.title)}</div>
        <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="kb">返回知识库</button>
      </div>
      <div class="card">
        <div class="sub">${esc(it.category)}</div>
        ${body}
        ${it.hint ? '<div class="sub" style="color:#e8710a;">⚠️ ' + esc(it.hint) + '</div>' : ''}
        <div class="sub" style="margin-top:10px;color:#666;">来源：${esc(it.source)}</div>
        <div class="sub" style="color:${it.verified ? '#12a05c' : '#999'};">${it.verified ? '✓ 已核实' : '未核实（演示数据）'}</div>
      </div>
      <div class="disclaimer">如与医院公告不一致，请以医院公告为准。</div>
    `);
  } catch (e) {
    show(`<div class="card"><div class="err">${esc(e.message)}</div>
      <button class="btn" data-action="kb">返回知识库</button></div>`);
  }
}

/* ---------------- 院内导航（按平面图绘制） ---------------- */

/* 一楼房间布局：依据门诊楼一楼平面图（画布 340 x 250） */
const NAV_F1 = [
  { id: 'cbc', label: 'CBC牙片室', x: 56, y: 44, w: 20, h: 26, depts: ['口腔科'] },
  { id: 'dental2', label: '口腔科2', x: 78, y: 44, w: 20, h: 26, depts: ['口腔科'] },
  { id: 'derm_t', label: '皮肤科治疗室', x: 100, y: 44, w: 20, h: 26, depts: ['皮肤科'] },
  { id: 'derm', label: '皮肤科', x: 122, y: 44, w: 20, h: 26, depts: ['皮肤科'] },
  { id: 'eye', label: '眼科', x: 144, y: 44, w: 20, h: 26, depts: ['眼科'] },
  { id: 'eye_c', label: '眼科检查室', x: 166, y: 44, w: 20, h: 26, depts: ['眼科'] },
  { id: 'surg1', label: '外科1', x: 188, y: 44, w: 20, h: 26, depts: ['外科'] },
  { id: 'surg2', label: '外科2', x: 210, y: 44, w: 20, h: 26, depts: ['外科'] },
  { id: 'dressing', label: '换药室', x: 232, y: 44, w: 20, h: 26, depts: ['外科'] },
  { id: 'equip', label: '设备间', x: 254, y: 44, w: 20, h: 26, depts: [] },
  { id: 'gyn', label: '妇科', x: 276, y: 44, w: 20, h: 26, depts: ['妇科'] },
  { id: 'stairs_n', label: '楼梯', x: 298, y: 44, w: 20, h: 26, depts: [] },
  { id: 'dental',   label: '口腔科',      x: 16,  y: 44,  w: 36,  h: 96, depts: ['口腔科'] },
  { id: 'tcm_t',    label: '中医治疗室',   x: 36,  y: 146, w: 34,  h: 26, depts: ['康复理疗科（疼痛科）'] },
  { id: 'elev1',    label: '电梯',        x: 72,  y: 146, w: 20,  h: 26, depts: [] },
  { id: 'cashier',  label: '收费室',      x: 94,  y: 146, w: 26,  h: 26, depts: [] },
  { id: 'garden',   label: '中心花园',     x: 124, y: 96,  w: 76,  h: 44, depts: [] },
  { id: 'wc_f',     label: '女卫生间',     x: 16,  y: 178, w: 24,  h: 26, depts: [] },
  { id: 'wc_m',     label: '男卫生间',     x: 42,  y: 178, w: 24,  h: 26, depts: [] },
  { id: 'pharmacy', label: '药房',        x: 122, y: 178, w: 44,  h: 26, depts: [] },
  { id: 'med1',     label: '内科',        x: 176, y: 178, w: 22,  h: 26, depts: ['内科'] },
  { id: 'emerg',    label: '急诊室',      x: 200, y: 178, w: 22,  h: 26, depts: [] },
  { id: 'tcm',      label: '中医科',      x: 224, y: 178, w: 22,  h: 26, depts: ['中医科'] },
  { id: 'infusion', label: '输液室',      x: 248, y: 178, w: 24,  h: 26, depts: [] },
  { id: 'ct',       label: 'CT机房',      x: 248, y: 100, w: 30,  h: 22, depts: ['放射科'] },
  { id: 'ct_d',     label: 'CT诊断室',    x: 248, y: 124, w: 30,  h: 22, depts: ['放射科'] },
  { id: 'dr',       label: 'DR机房',      x: 280, y: 100, w: 30,  h: 22, depts: ['放射科'] },
  { id: 'dr_d',     label: 'DR诊断室',    x: 280, y: 124, w: 30,  h: 22, depts: [] },
  { id: 'gi',       label: '胃肠机房',     x: 280, y: 148, w: 30,  h: 22, depts: [] },
  { id: 'imaging',  label: '医学影像科',   x: 248, y: 148, w: 30,  h: 22, depts: ['超声科'] },
];

const NAV_F1_GROUPS = [
  { area: '口腔诊疗区', ids: ['dental', 'cbc', 'dental2'] },
  { area: '门诊诊疗区', ids: ['derm_t', 'derm', 'eye', 'eye_c', 'surg1', 'surg2', 'dressing', 'med1'] },
  { area: '医技检查区', ids: ['ct', 'ct_d', 'dr', 'dr_d', 'gi', 'imaging'] },
  { area: '急诊与药房', ids: ['tcm', 'tcm_t', 'infusion', 'pharmacy', 'emerg'] },
  { area: '其他', ids: ['equip', 'gyn', 'stairs_n', 'elev1', 'cashier', 'garden', 'wc_f', 'wc_m'] }
];

const NAV_GATE = { id: 'gate', label: '大门', x: 150, y: 212, w: 46, h: 20 };

/* 上层楼层：照 2F/3F/4F 消防疏散图（北排 + 西侧 + 南排 + 东侧 + 中部） */
const NAV_UPPER = {
  2: {
    north: ['213', '214', '215', '216', '217', '218', '219', '220', '211', '电梯', '222', '223', '224'],
    west: ['212', '212', '114'],
    south: ['211', '210', '209', '208', '207', '206', '205', '204', '203'],
    east: ['210', '210', '202'],
    small: ['225', '226']
  },
  3: {
    north: ['313', '314', '315', '316', '317', '318', '319', '电梯', '320', '321', '322'],
    west: ['312', '311', '311'],
    south: ['310', '309', '308', '307', '306', '305', '304', '303', '302'],
    east: ['301', '301'],
    small: ['323', '324']
  },
  4: {
    north: ['415', '416', '417', '418', '419', '420', '421', '电梯', '422', '423', '424'],
    west: ['414', '413', '413'],
    south: ['412', '411', '410', '409', '408', '407', '406', '405', '404', '403', '402'],
    east: ['401', '401'],
    small: ['425', '426']
  }
};

function navFindRoom(label) {
  if (!label) return null;
  return NAV_F1.filter(function (r) { return r.label === String(label); })[0] || null;
}

function navRoomForDept(name) {
  if (!name) return null;
  for (const r of NAV_F1) {
    if ((r.depts || []).indexOf(name) >= 0) return r;
  }
  for (const r of NAV_F1) {
    for (const d of (r.depts || [])) {
      if (name.indexOf(d) >= 0 || d.indexOf(name) >= 0) return r;
    }
  }
  return null;
}

function navUpperRooms(floor) {
  const cfg = NAV_UPPER[floor];
  if (!cfg) return [];
  const rooms = [];

  // 北排（电梯也在这一排）
  const nW = 22, nH = 26, nGap = 3, nY = 26;
  const nTotal = cfg.north.length;
  const nX0 = Math.max(46, Math.round((340 - nTotal * (nW + nGap)) / 2) + 12);
  cfg.north.forEach(function (label, idx) {
    rooms.push({
      id: 'n' + idx, label: label, x: nX0 + idx * (nW + nGap), y: nY, w: nW, h: nH,
      kind: label === '电梯' ? 'lift' : 'room', side: 'north'
    });
  });

  // 西侧列
  const wW = 24, wH = 34, wGap = 2;
  cfg.west.forEach(function (label, idx) {
    rooms.push({
      id: 'w' + idx, label: label, x: 14, y: 62 + idx * (wH + wGap), w: wW, h: wH,
      kind: 'room', side: 'west'
    });
  });

  // 南排
  const sW = 22, sH = 26, sGap = 3, sY = 196;
  const sTotal = cfg.south.length;
  const sX0 = Math.max(46, Math.round((340 - sTotal * (sW + sGap)) / 2) + 12);
  cfg.south.forEach(function (label, idx) {
    rooms.push({
      id: 's' + idx, label: label, x: sX0 + idx * (sW + sGap), y: sY, w: sW, h: sH,
      kind: 'room', side: 'south'
    });
  });

  // 东侧列
  const eW = 24, eH = 52, eGap = 4;
  cfg.east.forEach(function (label, idx) {
    rooms.push({
      id: 'e' + idx, label: label, x: 302, y: 62 + idx * (eH + eGap), w: eW, h: eH,
      kind: 'room', side: 'east'
    });
  });

  // 中部：步梯2 + 两个小房间
  rooms.push({ id: 'st2', label: '步梯2', x: 152, y: 96, w: 34, h: 40, kind: 'stair2', side: 'center' });
  cfg.small.forEach(function (label, idx) {
    rooms.push({
      id: 'c' + idx, label: label, x: 194, y: 100 + idx * 24, w: 32, h: 20,
      kind: 'room', side: 'center'
    });
  });

  // 左下角：步梯1
  rooms.push({ id: 'st1', label: '步梯1', x: 8, y: 196, w: 26, h: 26, kind: 'stair1', side: 'stairs1' });

  return rooms;
}

/* 起点：电梯 / 步梯1 / 步梯2 */
function navStart(rooms, kind) {
  const want = kind || 'lift';
  const map = { lift: 'lift', stair1: 'stair1', stair2: 'stair2' };
  const k = map[want] || 'lift';
  return rooms.filter(function (r) { return r.kind === k; })[0]
    || rooms.filter(function (r) { return r.kind === 'lift'; })[0]
    || rooms.filter(function (r) { return r.kind === 'stair2'; })[0]
    || null;
}

function navSvgFloor(floor, target, roomNo, start) {
  const isF1 = floor === 1;
  const rooms = isF1 ? NAV_F1 : navUpperRooms(floor);
  const gate = isF1 ? NAV_GATE : navStart(rooms, start);

  let targetRect = null;
  if (isF1 && target && target.room) {
    targetRect = target.room;
  } else if (!isF1 && roomNo) {
    targetRect = rooms.filter(function (r) { return r.label === String(roomNo); })[0] || null;
  }

  const cells = rooms.map(function (r) {
    const on = targetRect && r.id === targetRect.id;
    let fill = '#e8eef8', stroke = '#c3d2e8', color = '#5b7bb0';
    if (on) { fill = '#e8710a'; stroke = '#c85f00'; color = '#fff'; }
    else if (r.kind === 'lift') { fill = '#d93025'; stroke = '#b5251b'; color = '#fff'; }
    else if (r.kind === 'stair1' || r.kind === 'stair2') { fill = '#ffd8a8'; stroke = '#e8a33d'; color = '#8a5a00'; }
    return '<g>' +
      '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h +
      '" rx="3" fill="' + fill + '" stroke="' + stroke + '"/>' +
      '<text x="' + (r.x + r.w / 2) + '" y="' + (r.y + r.h / 2 + 3) + '" text-anchor="middle" font-size="' +
      (r.label.length > 3 ? 6 : 7) + '" fill="' + color + '">' + esc(r.label) + '</text>' +
      '</g>';
  }).join('');

  const gateSvg = isF1
    ? '<g><rect x="' + gate.x + '" y="' + gate.y + '" width="' + gate.w + '" height="' + gate.h +
      '" rx="3" fill="#d93025"/>' +
      '<text x="' + (gate.x + gate.w / 2) + '" y="' + (gate.y + gate.h / 2 + 3) +
      '" text-anchor="middle" font-size="7" fill="#fff">' + esc(gate.label) + '</text></g>'
    : '';

  let path = '';
  if (targetRect && gate) {
    const sx = gate.x + gate.w / 2;
    const sy = isF1 ? gate.y : gate.y + gate.h;
    const midY = isF1 ? 168 : 150;
    const tx = targetRect.x + targetRect.w / 2;
    let ty;
    if (targetRect.side === 'north' || targetRect.side === 'center') ty = targetRect.y + targetRect.h;
    else if (targetRect.side === 'south' || targetRect.side === 'stairs1') ty = targetRect.y;
    else ty = targetRect.y + targetRect.h / 2;

    const pts = [[sx, sy], [sx, midY], [tx, midY], [tx, ty]];
    path = '<polyline points="' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') +
      '" fill="none" stroke="#1a73e8" stroke-width="2.4" stroke-dasharray="6 4" stroke-linejoin="round"/>' +
      '<circle cx="' + tx + '" cy="' + ty + '" r="3.2" fill="#1a73e8"/>';
  }

  return '<svg viewBox="0 0 340 244" class="navmap">' +
    '<rect x="0" y="0" width="340" height="244" fill="#f7f9fc" rx="10"/>' +
    cells + gateSvg + path +
    '</svg>';
}

const NAV_START_NAME = { lift: '电梯', stair1: '步梯1', stair2: '步梯2' };

function navSteps(floor, target, roomNo, start) {
  const isF1 = floor === 1;
  const sname = NAV_START_NAME[start || 'lift'] || '电梯';

  if (isF1) {
    if (!target || !target.room) {
      return ['该科室在一楼平面图上没有标注具体房间', '请到一楼导诊台确认位置', '或按院内指示牌前往'];
    }
    return ['从大门进入门诊楼', '沿主通道直行（见图蓝色虚线）',
            '按指示牌前往「' + target.room.label + '」', '到达后到分诊台报到候诊'];
  }

  if (!roomNo) {
    return ['先从上方选择房间号（如 ' + (floor === 2 ? '215' : (floor === 3 ? '315' : '415')) + '）'];
  }
  return [
    '从一楼上到 ' + floor + ' 楼：走「' + sname + '」',
    '出' + sname + '后沿走廊前行（见图蓝色虚线）',
    '按房间号寻找 ' + roomNo + ' 室',
    '具体科室以该层指示牌为准'
  ];
}

function NAV_DEPT_OPTIONS(cur) {
  const names = ['内科', '外科', '口腔科', '皮肤科', '眼科', '耳鼻咽喉科',
    '康复理疗科（疼痛科）', '妇科', '中医科', '超声科', '检验科', '放射科',
    '体检科', '成人预防接种门诊'];
  return names.map(function (n) {
    return '<option value="' + esc(n) + '"' + (n === cur ? ' selected' : '') + '>' + esc(n) + '</option>';
  }).join('');
}

function renderNav(deptName, floor, roomNo, start) {
  const f = floor || 1;
  const name = deptName || '';
  const st = start || 'lift';
  let target = null;
  if (f === 1) {
    const byRoom = room ? navFindRoom(room) : null;
    if (byRoom) target = { room: byRoom };
    else if (name) target = { room: navRoomForDept(name) };
  }
  const foundRoom = target && target.room;

  const tabs = [1, 2, 3, 4].map(function (x) {
    return '<div class="nav-tab ' + (x === f ? 'on' : '') + '" data-action="nav-floor" data-floor="' + x +
      '" data-name="' + esc(name) + '" data-start="' + st + '">' + (x === 1 ? '一楼' : x + ' 楼') + '</div>';
  }).join('');

  const startChips = f === 1 ? '' :
    '<div class="chips" style="margin:6px 0 0;">' +
    ['lift', 'stair1', 'stair2'].map(function (k) {
      return '<div class="chip ' + (k === st ? 'on' : '') + '" data-action="nav-start" data-start="' + k +
        '" data-floor="' + f + '" data-name="' + esc(name) + '" data-room="' + esc(roomNo || '') + '">' +
        NAV_START_NAME[k] + '</div>';
    }).join('') + '</div>';

  const inputArea = f === 1
    ? '<select id="navSelect" class="nav-select"><option value="">选择科室…</option>' + NAV_DEPT_OPTIONS(name) + '</select>'
    : '<input id="navRoom" class="nav-select" placeholder="输入房间号，如 ' +
      (f === 2 ? '215' : (f === 3 ? '315' : '415')) + '" value="' + esc(roomNo || '') + '" />';

  const steps = navSteps(f, target, roomNo, st).map(function (s, i) {
    return '<div class="nav-step"><span class="nav-num">' + (i + 1) + '</span>' + esc(s) + '</div>';
  }).join('');

  show(`
    <div class="row" style="margin-bottom:10px;">
      <div class="title">院内导航</div>
      <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="access">返回来院指引</button>
    </div>
    <div class="nav-tabs">${tabs}</div>
    <div class="card">
      ${inputArea}
      ${f === 1
        ? (name ? '<div class="sub" style="margin-top:8px;color:' + (foundRoom ? '#12a05c' : '#e8710a') + ';">' +
            (foundRoom ? '目标：' + esc(foundRoom.label) + '（橙色高亮）' : '该位置在一楼图上未标注，请到导诊台确认') + '</div>' : '')
        : '<div class="sub" style="margin-top:8px;">起点</div>' + startChips}
    </div>
    <div class="card">
      ${navSvgFloor(f, target, roomNo, st)}
      <div class="nav-legend">
        <span><i style="background:#e8710a"></i>目标</span>
        <span><i style="background:#d93025"></i>大门/电梯</span>
        <span><i style="background:#ffd8a8;border:1px solid #e8a33d"></i>步梯</span>
        <span><i style="background:#1a73e8"></i>路线</span>
      </div>
    </div>
    <div class="card"><div class="sub" style="margin:0 0 8px;">路线指引</div>${steps}</div>
    <div class="disclaimer">楼层图依据一楼平面图与各层疏散图绘制，房间与科室以现场指示牌为准。</div>
  `);

  const sel = document.getElementById('navSelect');
  if (sel) {
    sel.value = name || '';
    sel.addEventListener('change', function () { renderNav(sel.value, 1, '', st); });
  }
  const inp = document.getElementById('navRoom');
  if (inp) {
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') renderNav('', f, (inp.value || '').trim(), st);
    });
    inp.addEventListener('blur', function () {
      if ((inp.value || '').trim()) renderNav('', f, (inp.value || '').trim(), st);
    });
  }
}


/* ---------------- 院内导航页（从「来院指引」进入） ---------------- */

async function renderNavPage(deptName, floor, roomNo, start) {
  const f = floor || 1;
  const name = deptName || '';
  const st = start || 'lift';
  const room = roomNo || '';
  const target = f === 1 ? (name ? { room: navRoomForDept(name) } : null) : null;
  const foundRoom = target && target.room;

  const tabs = [1, 2, 3, 4].map(function (x) {
    return '<div class="nav-tab ' + (x === f ? 'on' : '') + '" data-action="nav-floor" data-floor="' + x +
      '" data-name="' + esc(name) + '" data-room="' + esc(x === f ? room : '') + '" data-start="' + st + '">' +
      (x === 1 ? '一楼' : x + ' 楼') + '</div>';
  }).join('');

  const startChips = f === 1 ? '' :
    '<div class="chips" style="margin:6px 0 0;">' +
    ['lift', 'stair1', 'stair2'].map(function (k) {
      return '<div class="chip ' + (k === st ? ' on' : '') + '" data-action="nav-start" data-start="' + k +
        '" data-floor="' + f + '" data-name="' + esc(name) + '" data-room="' + esc(room) + '">' +
        NAV_START_NAME[k] + '</div>';
    }).join('') + '</div>';

  const picker = f === 1
    ? '<select id="navSelect" class="nav-select"><option value="">选择房间（如 外科1 / 内科1）…</option>' +
      NAV_F1_GROUPS.map(function (g) {
        const opts = g.ids.map(function (id) {
          const r = NAV_F1.filter(function (x) { return x.id === id; })[0];
          if (!r) return '';
          const sel = (room === r.label || (!room && name && navRoomForDept(name) === r)) ? ' selected' : '';
          return '<option value="' + esc(r.label) + '"' + sel + '>' + esc(r.label) + '</option>';
        }).join('');
        return opts ? '<optgroup label="' + esc(g.area) + '">' + opts + '</optgroup>' : '';
      }).join('') + '</select>'
    : '<input id="navRoom" class="nav-select" placeholder="输入房间号，如 ' +
      (f === 2 ? '215' : (f === 3 ? '315' : '415')) + '" value="' + esc(room) + '" />';

  const steps = navSteps(f, target, room, st).map(function (line, i2) {
    return '<div class="nav-step"><span class="nav-num">' + (i2 + 1) + '</span>' + esc(line) + '</div>';
  }).join('');

  show(`
    <div class="row" style="margin-bottom:10px;">
      <div class="title">院内导航</div>
      <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="access">返回来院指引</button>
    </div>
    <div class="card">
      <div class="nav-tabs">${tabs}</div>
      ${picker}
      ${f === 1
        ? (name ? '<div class="sub" style="margin-top:8px;color:' + (foundRoom ? '#12a05c' : '#e8710a') + ';">' +
            (foundRoom ? '目标：' + esc(foundRoom.label) + '（橙色高亮）' : '该科室在一楼图上未标注，请到导诊台确认') + '</div>' : '')
        : '<div class="sub" style="margin-top:8px;">起点</div>' + startChips}
      <div style="margin-top:8px;">${navSvgFloor(f, target, room, st)}</div>
      <div class="nav-legend">
        <span><i style="background:#e8710a"></i>目标</span>
        <span><i style="background:#d93025"></i>大门/电梯</span>
        <span><i style="background:#ffd8a8;border:1px solid #e8a33d"></i>步梯</span>
        <span><i style="background:#1a73e8"></i>路线</span>
      </div>
    </div>
    <div class="card"><div class="sub" style="margin:0 0 8px;">路线指引</div>${steps}</div>
    <div class="disclaimer">楼层图依据一楼平面图与各层疏散图绘制，房间与科室以现场指示牌为准。</div>
  `);

  const sel = document.getElementById('navSelect');
  if (sel) {
    sel.value = name || '';
    sel.addEventListener('change', function () { renderNavPage(sel.value, 1, '', st); });
  }
  const inp = document.getElementById('navRoom');
  if (inp) {
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') renderNavPage('', f, (inp.value || '').trim(), st);
    });
    inp.addEventListener('blur', function () {
      if ((inp.value || '').trim()) renderNavPage('', f, (inp.value || '').trim(), st);
    });
  }
}

