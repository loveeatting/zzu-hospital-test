const api = require('../../utils/api');

Page({
  data: { list: [], loading: true, error: '', student: null },

  onShow() {
    const student = wx.getStorageSync('student');
    if (!student) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({ student: student });
    this.load();
  },

  onPullDownRefresh() {
    this.load(() => wx.stopPullDownRefresh());
  },

  load(done) {
    this.setData({ loading: true, error: '' });
    api.myAppointments()
      .then((list) => this.setData({ list: list, loading: false }))
      .catch((e) => this.setData({ loading: false, error: e.message }))
      .then(() => { if (done) done(); });
  },

  cancel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消预约',
      content: '确定要取消这个预约吗？号源会退回到该时段。',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中' });
        api.cancelAppointment(id)
          .then((r) => {
            wx.hideLoading();
            wx.showToast({ title: '已取消，剩余 ' + r.remain, icon: 'none' });
            this.load();
          })
          .catch((err) => {
            wx.hideLoading();
            wx.showModal({ title: '取消失败', content: err.message, showCancel: false });
          });
      }
    });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (!res.confirm) return;
        api.logout().catch(() => {}).then(() => {
          wx.removeStorageSync('token');
          wx.removeStorageSync('student');
          wx.reLaunch({ url: '/pages/login/login' });
        });
      }
    });
  }
});