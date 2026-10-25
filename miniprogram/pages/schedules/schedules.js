const api = require('../../utils/api');

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function labelOf(iso) {
  const parts = iso.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);

  let prefix = '';
  if (diff === 0) prefix = '今天 · ';
  else if (diff === 1) prefix = '明天 · ';
  else if (diff === 2) prefix = '后天 · ';

  return prefix + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK[d.getDay()];
}

Page({
  data: { groups: [], loading: true, error: '', doctorName: '', doctorId: 0 },

  onLoad(options) {
    this.setData({
      doctorId: options.doctor_id,
      doctorName: options.doctor_name ? decodeURIComponent(options.doctor_name) : ''
    });
    this.load();
  },

  onPullDownRefresh() {
    this.load(() => wx.stopPullDownRefresh());
  },

  load(done) {
    this.setData({ loading: true, error: '' });
    api.getSchedules(this.data.doctorId)
      .then((list) => {
        const dates = [];
        list.forEach((s) => {
          if (dates.indexOf(s.date) === -1) dates.push(s.date);
        });
        const groups = dates.map((d) => ({
          date: d,
          label: labelOf(d),
          items: list
            .filter((s) => s.date === d)
            .map((s) => Object.assign({}, s, {
              pct: s.capacity > 0 ? Math.round((s.remain * 100) / s.capacity) : 0
            }))
        }));
        this.setData({ groups, loading: false });
      })
      .catch((e) => this.setData({ loading: false, error: e.message }))
      .then(() => { if (done) done(); });
  },

  choose(e) {
    const ds = e.currentTarget.dataset;
    if (Number(ds.remain) <= 0) {
      wx.showToast({ title: '该时段已满', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/confirm/confirm?schedule_id=' + ds.id +
           '&doctor_name=' + encodeURIComponent(this.data.doctorName) +
           '&date=' + ds.date +
           '&period=' + encodeURIComponent(ds.period) +
           '&time=' + encodeURIComponent(ds.time) +
           '&room=' + encodeURIComponent(ds.room)
    });
  }
});