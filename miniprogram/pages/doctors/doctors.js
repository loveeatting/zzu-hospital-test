const api = require('../../utils/api');

Page({
  data: { doctors: [], loading: true, error: '', departmentName: '', departmentId: '' },

  onLoad(options) {
    const name = options.department_name ? decodeURIComponent(options.department_name) : '';
    this.setData({ departmentName: name, departmentId: options.department_id });
    this.load(options.department_id);
  },

  onPullDownRefresh() {
    this.load(this.data.departmentId, () => wx.stopPullDownRefresh());
  },

  load(departmentId, done) {
    this.setData({ loading: true, error: '' });
    api.getDoctors(departmentId)
      .then((list) => this.setData({ doctors: list, loading: false }))
      .catch((e) => this.setData({ loading: false, error: e.message }))
      .then(() => { if (done) done(); });
  },

  goSchedules(e) {
    const ds = e.currentTarget.dataset;
    wx.navigateTo({
      url: '/pages/schedules/schedules?doctor_id=' + ds.id +
           '&doctor_name=' + encodeURIComponent(ds.name)
    });
  }
});