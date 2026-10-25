const api = require('../../utils/api');

Page({
  data: {
    text: '',
    loading: false,
    result: null,
    error: '',
    examples: [
      '发烧咳嗽三天，嗓子疼，还有点乏力',
      '牙疼，牙龈出血，吃冷的更疼',
      '腰疼，久坐以后更明显',
      '眼睛干涩，看东西有点模糊'
    ]
  },

  onText(e) {
    this.setData({ text: e.detail.value });
  },

  useExample(e) {
    this.setData({ text: e.currentTarget.dataset.t });
  },

  submit() {
    const text = (this.data.text || '').trim();
    if (text.length < 2) {
      wx.showToast({ title: '请先描述一下症状', icon: 'none' });
      return;
    }
    this.setData({ loading: true, error: '', result: null });
    api.triage(text)
      .then((r) => this.setData({ loading: false, result: r }))
      .catch((e) => this.setData({ loading: false, error: e.message }));
  },

  goDept() {
    const r = this.data.result;
    if (!r || !r.department_id) {
      return;
    }
    wx.navigateTo({
      url: '/pages/doctors/doctors?department_id=' + r.department_id +
           '&department_name=' + encodeURIComponent(r.department_name)
    });
  },

  reset() {
    this.setData({ text: '', result: null, error: '' });
  }
});
