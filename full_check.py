"""改版后全功能回归：本地或线上均可跑。用法: python full_check.py [base_url]"""

import json
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
OK = FAIL = 0
FAILED = []


def check(name, cond, detail=""):
    global OK, FAIL
    if cond:
        OK += 1
        print("  [OK]   %-24s %s" % (name, detail))
    else:
        FAIL += 1
        FAILED.append(name)
        print("  [FAIL] %-24s %s" % (name, detail))


def call(path, method="GET", body=None, token=None):
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read().decode("utf-8", "ignore")
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8", "ignore"))
        except Exception:
            return e.code, ""


def as_list(x):
    return x if isinstance(x, list) else []


print("目标:", BASE)
print("\n=== 1. 页面与静态资源 ===")
for path, must in (
    ("/app/", "校医通"),
    ("/app/app.js", "tabbar"),
    ("/app/style.css", ".tabbar"),
    ("/app/staff.html", "客服工作台"),
    ("/app/staff.js", "staff_token"),
):
    s, body = call(path)
    text = body if isinstance(body, str) else json.dumps(body, ensure_ascii=False)
    check("GET " + path, s == 200 and must in text, "status=%s" % s)

print("\n=== 2. 医院信息 / 来院指引 / 导航 ===")
s, d = call("/api/hospital/info")
check("医院简介", s == 200 and len((d or {}).get("intro", "")) > 1000, "%d 字" % len((d or {}).get("intro", "")))
check("机构名", (d or {}).get("name") == "郑州大学校医院", str((d or {}).get("name")))
s, d = call("/api/hospital/access")
check("楼层分布", s == 200 and len(as_list((d or {}).get("floors"))) == 8, "%d 块" % len(as_list((d or {}).get("floors"))))
check("无交通指引", len(as_list((d or {}).get("transport"))) == 0, "")
s, d = call("/api/hospital/nav?dept=%E5%86%85%E7%A7%91")
check("导航-内科", s == 200 and (d or {}).get("found"), str(((d or {}).get("area") or {}).get("name")))
s, d = call("/api/hospital/nav/areas")
check("导航区域", s == 200 and len(as_list((d or {}).get("areas"))) == 5, "%d 区" % len(as_list((d or {}).get("areas"))))
s, d = call("/api/hospital/on-duty")
check("值班接口", s == 200, "医生 %d 位" % len(as_list((d or {}).get("doctors"))))
s, d = call("/api/hospital/insurance?q=%E9%97%A8%E8%AF%8A")
check("医保问答", s == 200 and len(as_list((d or {}).get("items"))) >= 1, "")
s, _ = call("/api/hospital/flow")
check("就诊流程", s == 200, "")
s, d = call("/api/hospital/kb/categories")
check("知识库分类", s == 200 and len(as_list(d if isinstance(d, list) else (d or {}).get("categories"))) == 6, "")

print("\n=== 3. 科室 / 医生 / 排班 / 预约 ===")
s, depts = call("/api/departments")
check("科室列表", s == 200 and len(as_list(depts)) == 14, "%d 个" % len(as_list(depts)))
s, doctors = call("/api/doctors")
dl = as_list(doctors)
check("医生列表", s == 200 and len(dl) >= 17, "%d 位" % len(dl))

s, d = call("/api/login", "POST", {"student_no": "2025010003", "password": "zzu123456"})
tok = (d or {}).get("token", "")
check("学生登录", s == 200 and "." in tok, "签名 token")

s, mine = call("/api/appointments", token=tok)
booked = {(x.get("date"), x.get("period")) for x in as_list(mine)}
free_sid = None
for doc in dl:
    s, sch = call("/api/schedules?doctor_id=%s" % doc["id"])
    for x in as_list(sch):
        if x["remain"] > 0 and (x["date"], x["period"]) not in booked:
            free_sid = x["id"]
            break
    if free_sid:
        break
check("找到可用号源", free_sid is not None, "schedule=%s" % free_sid)

s, a = call("/api/appointments", "POST", {"schedule_id": free_sid}, token=tok)
aid = (a or {}).get("appointment_id") if isinstance(a, dict) else None
check("预约成功", s == 200 and aid, "id=%s remain=%s" % (aid, (a or {}).get("remain") if isinstance(a, dict) else ""))
s, mine2 = call("/api/appointments", token=tok)
check("我的预约", s == 200 and any(x["id"] == aid for x in as_list(mine2)), "%d 条" % len(as_list(mine2)))
s, _ = call("/api/appointments/%s" % aid, "DELETE", token=tok)
check("取消预约", s == 200, "")

print("\n=== 4. 评价 / 健康科普 ===")
s, rv = call("/api/reviews")
total = rv.get("total") if isinstance(rv, dict) else len(as_list(rv))
check("公开评价", s == 200 and (total or 0) >= 8, "共 %s 条" % total)
s, hc = call("/api/health/categories")
check("健康分类", s == 200 and len(as_list(hc)) == 10, "%d 类" % len(as_list(hc)))
s, ht = call("/api/health/topics")
check("健康条目", s == 200 and len(as_list(ht)) >= 24, "%d 条" % len(as_list(ht)))
s, _ = call("/api/doctors/1006/reviews")
check("医生评价", s == 200, "")

print("\n=== 5. AI 导诊 ===")
s, d = call("/api/agent/chat", "POST", {"messages": [{"role": "user", "content": "我咳嗽两天了"}]}, token=tok)
reply1 = (d or {}).get("reply", "")
check("导诊首轮", s == 200 and bool(reply1), "追问" if "问题" in reply1 else "结论")
convo = [{"role": "user", "content": "我咳嗽两天了"}]
answers = ["有点痰，不发烧", "没有接触过感冒的人", "就是有点累"]
card = {}
asked = 1
for ans in answers:
    convo.append({"role": "assistant", "content": (d or {}).get("reply", "")})
    convo.append({"role": "user", "content": ans})
    s, d = call("/api/agent/chat", "POST", {"messages": convo}, token=tok)
    card = (d or {}).get("card") or {}
    if card:
        break
    asked += 1
check("导诊多轮后给科室", bool(card.get("department_name")),
      "追问 %d 轮 → %s" % (asked, card.get("department_name")))
s, d3 = call("/api/agent/chat", "POST", {"messages": [{"role": "user", "content": "突然剧烈胸痛，呼吸困难"}]}, token=tok)
check("急重症拦截", "急诊" in ((d3 or {}).get("reply") or "") and not (d3 or {}).get("card"), "")

print("\n=== 6. 服务咨询（AI + 真人客服） ===")
s, r = call("/api/service/thread/messages", "POST", {"content": "门诊几点下班？"}, token=tok)
check("AI 即时回复", s == 200 and bool((r or {}).get("ai_reply")), str((r or {}).get("ai_reply"))[:16].replace("\n", " "))
s, st = call("/api/staff/login", "POST", {"username": "staff001", "password": "zzu123456"})
stok = (st or {}).get("token", "")
check("客服登录", s == 200 and bool(stok), str(((st or {}).get("staff") or {}).get("name")))
s, ths = call("/api/staff/threads", token=stok)
tl = as_list(ths)
check("客服会话列表", s == 200 and len(tl) >= 1, "%d 个会话" % len(tl))
if tl:
    tid = tl[0]["id"]
    s, _ = call("/api/staff/threads/%s/reply" % tid, "POST", {"content": "门诊 17:30 下班。"}, token=stok)
    check("客服回复", s == 200, "")
    s, th = call("/api/service/thread", token=tok)
    roles = [m["role"] for m in as_list((th or {}).get("messages"))]
    check("学生端见真人回复", "staff" in roles, str(roles))

print("\n=== 7. 会话与权限 ===")
s, me = call("/api/me", token=tok)
check("/api/me", s == 200, str((me or {}).get("name")))
s, d2 = call("/api/login", "POST", {"student_no": "2025010003", "password": "zzu123456"})
s, _ = call("/api/me", token=tok)
check("旧 token 被顶替", s == 401, "")
s, _ = call("/api/me", token=(d2 or {}).get("token", ""))
check("新 token 有效", s == 200, "")
check("客服接口需登录", call("/api/staff/threads")[0] == 401, "")
check("预约接口需登录", call("/api/appointments")[0] == 401, "")
check("篡改 token 被拒", call("/api/me", token="abc.def")[0] == 401, "")

print("\n" + "=" * 56)
print("结果: %d 通过 / %d 失败" % (OK, FAIL))
if FAILED:
    print("失败项:", "、".join(FAILED))
