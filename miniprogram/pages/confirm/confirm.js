const api = require('../../utils/api');

Page({
  data: {
    scheduleId: 0,
    doctorName: '',
    date: '',
    period: '',
    time: '',
    room: '',
    student: null,
    submitting: false,
    result: null,
    error: ''
  },

  onLoad(options) {
    const student = wx.getStorageSync('student') || null;
    if (!student) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({
      scheduleId: Number(options.schedule_id),
      doctorName: options.doctor_name ? decodeURIComponent(options.doctor_name) : '',
      date: options.date || '',
      period: options.period ? decodeURIComponent(options.period) : '',
      time: options.time ? decodeURIComponent(options.time) : '',
      room: options.room ? decodeURIComponent(options.room) : '',
      student: student
    });
  },

  submit() {
    if (this.data.submitting || this.data.result) {
      return;
    }
    this.setData({ submitting: true, error: '', result: null });
    api.book(this.data.scheduleId)
      .then((res) => {
        this.setData({ submitting: false, result: res });
        wx.showToast({ title: '预约成功', icon: 'success' });
      })
      .catch((e) => this.setData({ submitting: false, error: e.message }));
  },

  goMy() {
    wx.redirectTo({ url: '/pages/my/my' });
  },

  goBack() {
    wx.navigateBack();
  }
});