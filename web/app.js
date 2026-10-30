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
    clearSession();
    const msg = '登录已失效：你的账号可能已在其他设备登录，请重新登录';
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
    userName.textContent = state.student.name + ' · ' + state.student.student_no;
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

const HOME_MODULES = [
  { action: 'intro', icon: '院', color: '#1a73e8', title: '医院简介', desc: '医院概况·就诊须知' },
  { action: 'dept-list', icon: '科', color: '#12a05c', title: '科室介绍', desc: '14 个科室' },
  { action: 'experts', icon: '医', color: '#e8710a', title: '专家介绍', desc: '职称·擅长' },
  { action: 'guide', icon: '指', color: '#8e44ad', title: '就医指南', desc: '挂号·退号' },
  { action: 'access', icon: '楼', color: '#0b8ea8', title: '来院指引', desc: '导航·楼层' },
  { action: 'appoint', icon: '约', color: '#d93025', title: '预约挂号', desc: '挂号·我的预约' },
  { action: 'agent', icon: 'AI', color: '#087f8c', title: 'AI 导诊', desc: '问诊·判断科室' },
  { action: 'health', icon: '康', color: '#00a3a3', title: '健康知识', desc: '症状·预防' },
  { action: 'service', icon: '服', color: '#7b61ff', title: '服务咨询', desc: '时间·值班·医保' }
];

async function renderDepartments() {
  const tiles = HOME_MODULES.map((m) => `
    <div class="tile tap" data-action="${m.action}">
      <div class="tile-icon" style="background:${m.color}">${esc(m.icon)}</div>
      <div class="tile-title">${esc(m.title)}</div>
      <div class="tile-desc">${esc(m.desc)}</div>
    </div>`).join('');

  show(`
    <div class="home-hero">
      <div class="home-title">郑州大学医院</div>
      <div class="home-sub">门诊预约 · 智能导诊 · 健康科普</div>
      <div class="home-links">
        <span class="home-link" data-action="guide">就医指南</span>
        <span class="home-link" data-action="access">来院指引</span>
        <span class="home-link" data-action="nav">院内导航</span>
        <span class="home-link" data-action="all-reviews" data-doctor="" data-name="">就诊口碑</span>
      </div>
    </div>
    <div class="notice-bar">门诊时间：周一至周五 08:00–12:00 / 14:00–17:30，急诊 24 小时开放</div>
    <div class="mod-grid">${tiles}</div>
    <div class="disclaimer">页面信息为原型演示数据，具体以医院公告为准。</div>
  `);
}

/* ---------------- 科室列表 / 预约挂号 ---------------- */

async function renderDeptList(appointMode) {
  show('<div class="loading">加载中…</div>');
  try {
    const list = await api('/api/departments');
    const cards = list.map((d, i) => `
      <div class="card tap dept" data-action="dept" data-id="${d.id}" data-name="${esc(d.name)}">
        <div class="avatar" style="background:${PALETTE[i % PALETTE.length]}">${esc(d.name.slice(0, 1))}</div>
        <div class="dept-body">
          <div class="title">${esc(d.name)}<span class="tag ${d.source === 'real' ? 'green' : 'gray'}" style="font-size:11px;vertical-align:middle;margin-left:6px;">${d.source === 'real' ? '真实' : '模拟'}</span></div>
          <div class="sub">${esc(d.location || '')}
            <button class="linkbtn" style="background:#f0f6ff;color:#1a73e8;font-size:11px;padding:2px 8px;margin-left:6px;"
              data-action="nav-dept" data-name="${esc(d.name)}">怎么走</button>
          </div>
        </div>
        <div class="arrow">›</div>
      </div>`).join('');

    const chips = appointMode
      ? '<div class="chips"><div class="chip" data-action="my">我的预约</div><div class="chip" data-action="guide">就诊流程</div></div>'
      : '';

    show(`
      <div class="row" style="margin-bottom:10px;">
        <div class="title">${appointMode ? '预约挂号' : '科室介绍'}</div>
        <button class="linkbtn" style="background:#eef3fd;color:#1a73e8;" data-action="depts">返回首页</button>
      </div>
      ${chips}
      ${cards}
      <div class="notice">先选科室，再选医生与时段；预约成功后可在「我的预约」中查看或取消。</div>
    `);
  } catch (e) {
    show(`<div class="card"><div class="err">${esc(e.message)}</div>
      <button class="btn" data-action="depts">返回首页</button></div>`);
  }
}

/* ---------------- 医院简介 ---------------- */

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
    case 'appoint': renderDeptList(true); break;
    case 'intro': renderHospitalIntro(); break;
    case 'experts': renderExperts(); break;
    case 'guide': renderGuide(); break;
    case 'access': renderAccess(); break;
    case 'nav': renderNavPage('', 1, '', 'lift'); break;
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
    api('/api/me').catch(function () { stopHeartbeat(); });
  }, 15000);
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

function boot() {
  renderUser();
  if (state.token && state.student) {
    renderDepartments();
    startHeartbeat();
  } else {
    renderLogin();
  }
}

boot();

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
    return `<div class="bubble ${me ? 'me' : ''}">${esc(m.content).replace(/\n/g, '<br/>')}${extra}</div>`;
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
    return '<div class="bubble ' + (me ? 'me' : '') + '">' +
      '<div class="who">' + esc(m.sender || '') + (badge ? ' ' + badge : '') + '</div>' +
      esc(m.content).replace(/\n/g, '<br/>') + '</div>';
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
  { id: 'cbc', label: 'CBC牙片室', x: 56, y: 44, w: 20, h: 26, depts: ['口腔科'] }
  { id: 'dental2', label: '口腔科2', x: 78, y: 44, w: 20, h: 26, depts: ['口腔科'] }
  { id: 'derm_t', label: '皮肤科治疗室', x: 100, y: 44, w: 20, h: 26, depts: ['皮肤科'] }
  { id: 'derm', label: '皮肤科', x: 122, y: 44, w: 20, h: 26, depts: ['皮肤科'] }
  { id: 'eye', label: '眼科', x: 144, y: 44, w: 20, h: 26, depts: ['眼科'] }
  { id: 'eye_c', label: '眼科检查室', x: 166, y: 44, w: 20, h: 26, depts: ['眼科'] }
  { id: 'surg1', label: '外科1', x: 188, y: 44, w: 20, h: 26, depts: ['外科'] }
  { id: 'surg2', label: '外科2', x: 210, y: 44, w: 20, h: 26, depts: ['外科'] }
  { id: 'dressing', label: '换药室', x: 232, y: 44, w: 20, h: 26, depts: ['外科'] }
  { id: 'equip', label: '设备间', x: 254, y: 44, w: 20, h: 26, depts: [] }
  { id: 'gyn', label: '妇科', x: 276, y: 44, w: 20, h: 26, depts: ['妇科'] }
  { id: 'stairs_n', label: '楼梯', x: 298, y: 44, w: 20, h: 26, depts: [] }
  { id: 'dental',   label: '口腔科',      x: 16,  y: 44,  w: 36,  h: 96, depts: ['口腔科'] },
  { id: 'tcm_t',    label: '中医治疗室',   x: 36,  y: 146, w: 34,  h: 26, depts: ['康复理疗科（疼痛科）'] },
  { id: 'elev1',    label: '电梯',        x: 72,  y: 146, w: 20,  h: 26, depts: [] },
  { id: 'cashier',  label: '收费室',      x: 94,  y: 146, w: 26,  h: 26, depts: [] },
  { id: 'garden',   label: '中心花园',     x: 124, y: 96,  w: 76,  h: 44, depts: [] },
  { id: 'wc_f',     label: '女卫生间',     x: 16,  y: 178, w: 24,  h: 26, depts: [] },
  { id: 'wc_m',     label: '男卫生间',     x: 42,  y: 178, w: 24,  h: 26, depts: [] },
  { id: 'pharmacy', label: '药房',        x: 122, y: 178, w: 44,  h: 26, depts: [] },
  { id: 'med1',     label: '内科1',       x: 176, y: 178, w: 22,  h: 26, depts: ['内科'] },
  { id: 'emerg',    label: '急诊室',      x: 200, y: 178, w: 22,  h: 26, depts: [] },
  { id: 'tcm',      label: '中医科',      x: 224, y: 178, w: 22,  h: 26, depts: ['中医科'] },
  { id: 'infusion', label: '输液室',      x: 248, y: 178, w: 24,  h: 26, depts: [] },
  { id: 'ct',       label: 'CT机房',      x: 248, y: 100, w: 30,  h: 22, depts: ['放射科'] },
  { id: 'ct_d',     label: 'CT诊断室',    x: 248, y: 124, w: 30,  h: 22, depts: ['放射科'] },
  { id: 'dr',       label: 'DR机房',      x: 280, y: 100, w: 30,  h: 22, depts: ['放射科'] },
  { id: 'dr_d',     label: 'DR诊断室',    x: 280, y: 124, w: 30,  h: 22, depts: [] },
  { id: 'gi',       label: '胃肠机房',     x: 280, y: 148, w: 30,  h: 22, depts: [] },
  { id: 'imaging',  label: '医学影像科',   x: 248, y: 148, w: 30,  h: 22, depts: ['超声科'] }
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

