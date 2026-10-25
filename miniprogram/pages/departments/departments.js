const api = require('../../utils/api');

const PALETTE = ['#1a73e8', '#12a05c', '#e8710a', '#8e44ad', '#d93025', '#0b8ea8'];

Page({
  data: { departments: [], loading: true, error: '', student: null },

  onShow() {
    const student = wx.getStorageSync('student');
    if (!student) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({ student: student });
    if (!this.data.departments.length) {
      this.load();
    }
  },

  onPullDownRefresh() {
    this.load(() => wx.stopPullDownRefresh());
  },

  load(done) {
    this.setData({ loading: true, error: '' });
    api.getDepartments()
      .then((list) => {
        const departments = list.map((d, i) => Object.assign({}, d, {
          initial: (d.name || '?').charAt(0),
          color: PALETTE[i % PALETTE.length]
        }));
        this.setData({ departments: departments, loading: false });
      })
      .catch((e) => this.setData({ loading: false, error: e.message }))
      .then(() => { if (done) done(); });
  },

  goDoctors(e) {
    const ds = e.currentTarget.dataset;
    wx.navigateTo({
      url: '/pages/doctors/doctors?department_id=' + ds.id +
           '&department_name=' + encodeURIComponent(ds.name)
    });
  },

  goTriage() {
    wx.navigateTo({ url: '/pages/triage/triage' });
  },

  goMy() {
    wx.navigateTo({ url: '/pages/my/my' });
  }
});