// 后端地址（只改这一行）：
//   开发者工具/同网段：http://电脑IP:8000
//   cpolar 隧道：     http://xxxx.cpolar.cn
const BASE_URL = 'http://4b8bfc55.r8.cpolar.cn';

function getToken() {
  return wx.getStorageSync('token') || '';
}

function request(path, options) {
  options = options || {};
  var header = { 'content-type': 'application/json' };
  var token = getToken();
  if (token) {
    header.Authorization = 'Bearer ' + token;
  }

  return new Promise(function (resolve, reject) {
    wx.request({
      url: BASE_URL + path,
      method: options.method || 'GET',
      data: options.data || {},
      header: header,
      success: function (res) {
        if (res.statusCode === 401) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('student');
          wx.reLaunch({ url: '/pages/login/login' });
          reject(new Error('登录已失效，请重新登录'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        var detail = res.data && res.data.detail;
        if (typeof detail !== 'string') {
          detail = JSON.stringify(detail || res.data);
        }
        reject(new Error(detail || ('HTTP ' + res.statusCode)));
      },
      fail: function (err) {
        reject(new Error('网络请求失败：' + (err.errMsg || '未知错误')));
      }
    });
  });
}

module.exports = {
  BASE_URL: BASE_URL,
  request: request,
  getToken: getToken,
  login: function (studentNo, password) {
    return request('/api/login', {
      method: 'POST',
      data: { student_no: studentNo, password: password }
    });
  },
  logout: function () {
    return request('/api/logout', { method: 'POST' });
  },
  getMe: function () {
    return request('/api/me');
  },
  getDepartments: function () {
    return request('/api/departments');
  },
  getDoctors: function (departmentId) {
    return request('/api/doctors?department_id=' + departmentId);
  },
  getSchedules: function (doctorId) {
    return request('/api/schedules?doctor_id=' + doctorId);
  },
  book: function (scheduleId) {
    return request('/api/appointments', { method: 'POST', data: { schedule_id: scheduleId } });
  },
  cancelAppointment: function (id) {
    return request('/api/appointments/' + id, { method: 'DELETE' });
  },
  myAppointments: function () {
    return request('/api/appointments');
  },
  triage: function (description) {
    return request('/api/triage', { method: 'POST', data: { description: description } });
  }
};