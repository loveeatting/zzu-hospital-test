"""一键自检：把后端 + 网页版 + AI 导诊的整条链路跑一遍。

用法：
    python smoke_test.py                                   # 默认测公网隧道
    python smoke_test.py http://127.0.0.1:8000             # 测本机
"""

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://39ac5bca.r11.vip.cpolar.cn"
STUDENT = ("2025010001", "zzu123456")
SCHEDULE_ID = 10001

results = []


def call(path, method="GET", body=None, token=None, raw=False, timeout=25):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json", "User-Agent": "smoke-test"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            payload = r.read()
            if raw:
                return r.status, payload
            try:
                return r.status, json.loads(payload.decode("utf-8"))
            except Exception:
                return r.status, payload.decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")[:200]
    except Exception as e:
        return None, "%s: %s" % (type(e).__name__, str(e)[:100])


def check(label, ok, detail=""):
    results.append((label, ok, detail))
    print(("  [PASS] " if ok else "  [FAIL] ") + label + ("  " + str(detail) if detail else ""))
    return ok


def main():
    print("=" * 60)
    print("目标地址:", BASE)
    print("=" * 60)

    # ---------- 1. 网页版静态资源 ----------
    print("\n[1] 网页版静态资源")
    s, b = call("/app/", raw=True)
    html = b.decode("utf-8", "ignore") if isinstance(b, bytes) else str(b)
    check("首页 /app/ 可访问", s == 200, "status=%s" % s)
    check("首页含标题", "郑州大学" in html)

    s, b = call("/app/app.js", raw=True)
    check("app.js 可访问", s == 200, "%s B" % (len(b) if isinstance(b, bytes) else 0))
    js = b.decode("utf-8", "ignore") if isinstance(b, bytes) else ""
    check("前端含 AI 聊天页", "renderAgent" in js)

    # ---------- 2. 登录 ----------
    print("\n[2] 登录鉴权")
    s, d = call("/api/login", "POST", {"student_no": STUDENT[0], "password": STUDENT[1]})
    token = d.get("token") if isinstance(d, dict) else None
    check("正确账号登录", s == 200 and bool(token), "status=%s" % s)
    if not token:
        print("\n登录失败，后续跳过。")
        return summary()

    s, d = call("/api/login", "POST", {"student_no": STUDENT[0], "password": "wrong-pass"})
    check("错误密码被拒 (401)", s == 401, "status=%s" % s)

    s, d = call("/api/appointments")
    check("未登录访问预约被拒 (401)", s == 401, "status=%s" % s)

    # ---------- 3. 基础查询 ----------
    print("\n[3] 科室 / 医生 / 排班")
    s, d = call("/api/departments")
    check("科室列表", s == 200 and isinstance(d, list) and len(d) > 0,
          "%s 个" % (len(d) if isinstance(d, list) else "?"))
    dept_id = d[0]["id"] if isinstance(d, list) and d else 1

    s, d = call("/api/doctors?department_id=%d" % dept_id)
    check("按科室查医生", s == 200 and isinstance(d, list) and len(d) > 0,
          "%s 人" % (len(d) if isinstance(d, list) else "?"))
    doctor_id = d[0]["id"] if isinstance(d, list) and d else 101

    s, d = call("/api/schedules?doctor_id=%d" % doctor_id)
    check("查排班", s == 200 and isinstance(d, list) and len(d) > 0,
          "%s 条" % (len(d) if isinstance(d, list) else "?"))

    # ---------- 4. 预约闭环 ----------
    print("\n[4] 预约闭环（防超卖 / 重复 / 取消 / 幂等）")
    s, d = call("/api/appointments", "POST", {"schedule_id": SCHEDULE_ID}, token=token)
    first_ok = s == 200 and isinstance(d, dict)
    remain1 = d.get("remain") if isinstance(d, dict) else None
    check("首次预约成功", first_ok, "remain=%s" % remain1)
    appointment_id = d.get("appointment_id") if isinstance(d, dict) else None

    s, d = call("/api/appointments", "POST", {"schedule_id": SCHEDULE_ID}, token=token)
    check("重复预约被拦 (409)", s == 409, "status=%s" % s)

    if appointment_id:
        s, d = call("/api/appointments/%d" % appointment_id, "DELETE", token=token)
        remain2 = d.get("remain") if isinstance(d, dict) else None
        check("取消预约成功", s == 200, "remain=%s" % remain2)
        check("取消后号源回滚", remain2 is not None and remain1 is not None and remain2 == remain1 + 1,
              "%s -> %s" % (remain1, remain2))

        s, d = call("/api/appointments/%d" % appointment_id, "DELETE", token=token)
        check("重复取消被拦 (409)", s == 409, "status=%s" % s)

    s, d = call("/api/appointments", token=token)
    check("我的预约可查", s == 200 and isinstance(d, list),
          "%s 条" % (len(d) if isinstance(d, list) else "?"))

    # ---------- 5. 分诊 ----------
    print("\n[5] 智能分诊")
    s, d = call("/api/triage", "POST", {"description": "牙疼，牙龈出血"})
    check("分诊接口可用", s == 200, "status=%s" % s)
    if isinstance(d, dict):
        check("牙疼 -> 口腔科", d.get("department_name") == "口腔科", d.get("department_name"))

    s, d = call("/api/triage", "POST", {"description": "突然剧烈胸痛，呼吸困难"})
    if isinstance(d, dict):
        check("危险信号 -> 紧急", d.get("urgency") == "紧急", d.get("urgency"))

    # ---------- 6. AI 导诊助手 ----------
    print("\n[6] AI 导诊助手（多轮 + 兜底）")
    s, d = call("/api/agent/chat", "POST",
                {"messages": [{"role": "user", "content": "牙疼得厉害"}]}, token=token)
    if s == 404:
        check("agent 接口存在", False, "404 —— 后端可能没重启")
    else:
        check("agent 接口可用", s == 200, "status=%s" % s)
        if isinstance(d, dict):
            check("返回回复文本", bool(d.get("reply")), d.get("source"))
            check("识别出科室", (d.get("card") or {}).get("type") == "department",
                  (d.get("card") or {}).get("department_name"))

    s, d = call("/api/agent/chat", "POST",
                {"messages": [{"role": "user", "content": "突然剧烈胸痛，呼吸困难"}]}, token=token)
    if isinstance(d, dict):
        check("急重症被拦截", "急诊" in (d.get("reply") or "") and not d.get("card"),
              "card=%s" % d.get("card"))

    # ---------- 7. 单设备登录（会话互斥） ----------
    print("\n[7] 单设备登录（同一账号只允许一个有效会话）")
    acc = ("2025010002", "zzu123456")

    s1, d1 = call("/api/login", "POST", {"student_no": acc[0], "password": acc[1]})
    tok1 = d1.get("token") if isinstance(d1, dict) else None
    check("设备1 登录", s1 == 200 and bool(tok1), "status=%s" % s1)

    s2, d2 = call("/api/login", "POST", {"student_no": acc[0], "password": acc[1]})
    tok2 = d2.get("token") if isinstance(d2, dict) else None
    check("设备2 登录同一账号", s2 == 200 and bool(tok2), "status=%s" % s2)

    if tok1:
        s3, _ = call("/api/me", token=tok1)
        check("设备1 被挤下线 (401)", s3 == 401, "status=%s" % s3)
    if tok2:
        s4, _ = call("/api/me", token=tok2)
        check("设备2 保持有效 (200)", s4 == 200, "status=%s" % s4)

    s5, d5 = call("/api/login", "POST", {"student_no": "2025010003", "password": "zzu123456"})
    tok3 = d5.get("token") if isinstance(d5, dict) else None
    if tok3 and tok2:
        s6, _ = call("/api/me", token=tok2)
        s7, _ = call("/api/me", token=tok3)
        check("不同账号互不影响", s6 == 200 and s7 == 200, "张三=%s 王五=%s" % (s6, s7))

    return summary()


def summary():
    total = len(results)
    passed = sum(1 for _, ok, _ in results if ok)
    print("\n" + "=" * 60)
    print("结果: %d/%d 通过" % (passed, total))
    if passed != total:
        print("失败项:")
        for label, ok, detail in results:
            if not ok:
                print("  - %s  (%s)" % (label, detail))
        print("=" * 60)
        sys.exit(1)
    print("全部通过 ✅")
    print("=" * 60)


if __name__ == "__main__":
    main()
