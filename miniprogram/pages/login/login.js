const api = require('../../utils/api');

Page({
  data: {
    studentNo: '',
    password: '',
    loading: false,
    error: ''
  },

  onLoad() {
    if (api.getToken()) {
      wx.reLaunch({ url: '/pages/departments/departments' });
    }
  },

  onStudentNo(e) { this.setData({ studentNo: e.detail.value }); },
  onPassword(e) { this.setData({ password: e.detail.value }); },

  fillDemo() {
    this.setData({ studentNo: '2025010001', password: 'zzu123456' });
  },

  submit() {
    const studentNo = (this.data.studentNo || '').trim();
    const password = this.data.password || '';
    if (!studentNo) {
      wx.showToast({ title: '请输入学号', icon: 'none' });
      return;
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }
    this.setData({ loading: true, error: '' });
    api.login(studentNo, password)
      .then((res) => {
        wx.setStorageSync('token', res.token);
        wx.setStorageSync('student', res.student);
        this.setData({ loading: false });
        wx.reLaunch({ url: '/pages/departments/departments' });
      })
      .catch((e) => this.setData({ loading: false, error: e.message }));
  }
});