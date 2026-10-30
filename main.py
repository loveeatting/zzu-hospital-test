import base64
import datetime
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
import urllib.request

from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.gzip import GZipMiddleware

import health
import hospital_info
import hospital_kb
import service_bot

from agent import run_agent
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.docs import get_swagger_ui_html
from pydantic import BaseModel, Field

from db import get_conn

app = FastAPI(
    docs_url=None,
    redoc_url=None,
    title="郑州大学校医院预约挂号",
)

# 静态资源压缩（免费隧道带宽有限时提升明显）
app.add_middleware(GZipMiddleware, minimum_size=500)


@app.middleware("http")
async def no_cache_static(request: Request, call_next):
    """网页版静态资源不缓存，避免手机端加载到旧版本。"""
    response = await call_next(request)
    path = request.url.path
    if path == "/" or path.startswith("/app"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


# ---------------- 就诊评价 ----------------

REVIEWS_DDL = """
CREATE TABLE IF NOT EXISTS reviews (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL UNIQUE,
    student_no     TEXT    NOT NULL,
    doctor_id      INTEGER NOT NULL,
    rating         INTEGER NOT NULL,
    attitude       INTEGER,
    wait_time      INTEGER,
    communication  INTEGER,
    environment    INTEGER,
    comment        TEXT,
    anonymous      INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT    NOT NULL
);
"""


def ensure_database():
    """云端首次启动时自动建库 + 灌演示数据（本地已有库则跳过）。"""
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='students'"
        ).fetchone()
    finally:
        conn.close()

    if row is not None:
        return False

    import init_db
    init_db.main()
    try:
        import seed_reviews
        seed_reviews.main()
    except Exception:
        pass
    return True


STAFF_DDL = """
CREATE TABLE IF NOT EXISTS staff (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    name          TEXT    NOT NULL,
    salt          TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_sessions (
    token      TEXT PRIMARY KEY,
    staff_id   INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_threads (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    student_no     TEXT    NOT NULL UNIQUE,
    created_at     TEXT    NOT NULL,
    updated_at     TEXT    NOT NULL,
    unread_staff   INTEGER NOT NULL DEFAULT 0,
    unread_student INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS service_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id  INTEGER NOT NULL,
    role       TEXT    NOT NULL,     -- user / ai / staff
    sender     TEXT,
    content    TEXT    NOT NULL,
    created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_msg_thread ON service_messages (thread_id, id);
"""

DEFAULT_STAFF = [
    ("staff001", "zzu123456", "张老师"),
    ("staff002", "zzu123456", "李护士"),
]


def ensure_extra_tables():
    """补建评价表与客服相关表，避免要求用户重建整个数据库。"""
    conn = get_conn()
    try:
        with conn:
            conn.execute(REVIEWS_DDL)
            conn.executescript(STAFF_DDL)
            for username, password, name in DEFAULT_STAFF:
                row = conn.execute(
                    "SELECT id FROM staff WHERE username = ?", (username,)
                ).fetchone()
                if row is None:
                    salt = secrets.token_hex(8)
                    conn.execute(
                        "INSERT INTO staff (username, name, salt, password_hash, created_at) "
                        "VALUES (?, ?, ?, ?, ?)",
                        (username, name, salt,
                         hashlib.sha256((salt + password).encode("utf-8")).hexdigest(),
                         datetime.datetime.now().isoformat(timespec="seconds")),
                    )
    finally:
        conn.close()


if ensure_database():
    print("[startup] 检测到空数据库，已自动初始化演示数据")

ensure_extra_tables()


# ---------------- 会话 token（HMAC 签名，不依赖数据库） ----------------

SESSION_SECRET = os.environ.get("SESSION_SECRET", "zzu-hospital-demo-secret-2026").encode("utf-8")
TOKEN_TTL = 7 * 24 * 3600     # 7 天


def _sign(raw):
    return hmac.new(SESSION_SECRET, raw.encode("utf-8"), hashlib.sha256).hexdigest()[:32]


def make_token(student_no):
    payload = {"s": student_no, "t": int(time.time()), "n": secrets.token_hex(6)}
    raw = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode().rstrip("=")
    return raw + "." + _sign(raw)


def parse_token(token):
    """校验签名与有效期，返回 payload 或 None。"""
    if not token or "." not in token:
        return None
    raw, sig = token.rsplit(".", 1)
    if not hmac.compare_digest(_sign(raw), sig):
        return None
    try:
        pad = "=" * (-len(raw) % 4)
        data = json.loads(base64.urlsafe_b64decode(raw + pad))
    except Exception:
        return None
    if not data.get("s") or not data.get("t"):
        return None
    if time.time() - int(data["t"]) > TOKEN_TTL:
        return None
    return data


def hash_password(password, salt):
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def current_student(authorization: str | None = Header(default=None)):
    """从 Authorization: Bearer <token> 解析当前登录学生。

    token 为 HMAC 签名串，验签即可，不依赖 sessions 表；
    sessions 表仅用于"单设备登录"判定，数据库被重置时自动补登记。
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="请先登录")
    token = authorization.split(" ", 1)[1].strip()

    payload = parse_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    sno = payload["s"]

    conn = get_conn()
    try:
        student = conn.execute(
            "SELECT student_no, name, phone, major FROM students WHERE student_no = ?", (sno,)
        ).fetchone()
        if student is None:
            raise HTTPException(status_code=401, detail="账号不存在，请重新登录")

        row = conn.execute(
            "SELECT token FROM sessions WHERE student_no = ?", (sno,)
        ).fetchone()
        if row is None:
            # 数据库被重置（云端重新部署/重启）→ 自动补登记，不把用户踢下线
            with conn:
                conn.execute(
                    "INSERT OR REPLACE INTO sessions (token, student_no, created_at) VALUES (?, ?, ?)",
                    (token, sno, datetime.datetime.now().isoformat(timespec="seconds")),
                )
        elif row["token"] != token:
            raise HTTPException(status_code=401, detail="你的账号已在其他设备登录，请重新登录")
    finally:
        conn.close()

    return dict(student)


class LoginRequest(BaseModel):
    student_no: str = Field(min_length=1, max_length=20)
    password: str = Field(min_length=1, max_length=64)


class AppointmentRequest(BaseModel):
    schedule_id: int


@app.post("/api/login", tags=["登录"])
def login(req: LoginRequest):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT student_no, name, phone, major, salt, password_hash "
            "FROM students WHERE student_no = ?",
            (req.student_no.strip(),),
        ).fetchone()
    finally:
        conn.close()

    if row is None or hash_password(req.password, row["salt"]) != row["password_hash"]:
        raise HTTPException(status_code=401, detail="学号或密码错误")

    token = make_token(row["student_no"])
    conn = get_conn()
    try:
        with conn:
            # 单设备登录：同一学号只允许存在一个有效会话，新登录即踢掉旧设备
            conn.execute("DELETE FROM sessions WHERE student_no = ?", (row["student_no"],))
            conn.execute(
                "INSERT INTO sessions (token, student_no, created_at) VALUES (?, ?, ?)",
                (token, row["student_no"],
                 datetime.datetime.now().isoformat(timespec="seconds")),
            )
    finally:
        conn.close()

    return {
        "token": token,
        "student": {
            "student_no": row["student_no"],
            "name": row["name"],
            "phone": row["phone"],
            "major": row["major"],
        },
    }


@app.post("/api/logout", tags=["登录"])
def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        conn = get_conn()
        try:
            with conn:
                conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        finally:
            conn.close()
    return {"success": True}


@app.get("/api/me", tags=["登录"])
def me(student=Depends(current_student)):
    return student


@app.get("/api/departments")
def list_departments():
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT id, name, location, source FROM departments "
            "ORDER BY CASE source WHEN 'real' THEN 0 ELSE 1 END, id"
        ).fetchall()
    finally:
        conn.close()
    return [dict(row) for row in rows]


@app.get("/api/doctors")
def list_doctors(department_id: int | None = None):
    sql = (
        "SELECT d.id, d.department_id, d.name, d.title, d.specialty, d.source, "
        "ROUND(AVG(r.rating), 1) AS rating, COUNT(r.id) AS review_count "
        "FROM doctors AS d LEFT JOIN reviews AS r ON r.doctor_id = d.id"
    )
    params = []
    if department_id is not None:
        sql += " WHERE d.department_id = ?"
        params.append(department_id)
    sql += " GROUP BY d.id ORDER BY d.id"

    conn = get_conn()
    try:
        rows = conn.execute(sql, params).fetchall()
    finally:
        conn.close()
    return [dict(row) for row in rows]


@app.get("/api/doctors/{doctor_id}")
def get_doctor(doctor_id: int):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT d.id, d.department_id, d.name, d.title, d.specialty, d.source, "
            "ROUND(AVG(r.rating), 1) AS rating, COUNT(r.id) AS review_count "
            "FROM doctors AS d LEFT JOIN reviews AS r ON r.doctor_id = d.id "
            "WHERE d.id = ? GROUP BY d.id",
            (doctor_id,),
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="医生不存在")
    return dict(row)


@app.get("/api/schedules")
def list_schedules(doctor_id: int, date: datetime.date | None = None):
    sql = "SELECT * FROM schedules WHERE doctor_id = ?"
    params = [doctor_id]
    if date is not None:
        sql += " AND date = ?"
        params.append(date.isoformat())
    sql += " ORDER BY date, start_time"

    conn = get_conn()
    try:
        rows = conn.execute(sql, params).fetchall()
    finally:
        conn.close()
    return [dict(row) for row in rows]


@app.post("/api/appointments", tags=["预约"])
def create_appointment(req: AppointmentRequest, student=Depends(current_student)):
    conn = get_conn()
    try:
        try:
            with conn:
                cur = conn.execute(
                    "UPDATE schedules SET remain = remain - 1 "
                    "WHERE id = ? AND remain > 0",
                    (req.schedule_id,),
                )
                if cur.rowcount == 0:
                    raise HTTPException(
                        status_code=409, detail="号源已满或排班不存在"
                    )

                created_at = datetime.datetime.now().isoformat(timespec="seconds")
                cur = conn.execute(
                    "INSERT INTO appointments (schedule_id, student_no, status, created_at) "
                    "VALUES (?, ?, 'BOOKED', ?)",
                    (req.schedule_id, student["student_no"], created_at),
                )
                appointment_id = cur.lastrowid
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="你已经预约过这个号了")

        remain = conn.execute(
            "SELECT remain FROM schedules WHERE id = ?", (req.schedule_id,)
        ).fetchone()[0]
    finally:
        conn.close()

    return {
        "success": True,
        "appointment_id": appointment_id,
        "schedule_id": req.schedule_id,
        "remain": remain,
        "patient_name": student["name"],
    }


@app.get("/api/appointments", tags=["预约"])
def list_appointments(student=Depends(current_student)):
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT a.id, a.schedule_id, a.status, a.created_at,
                   EXISTS(SELECT 1 FROM reviews rv WHERE rv.appointment_id = a.id) AS reviewed,
                   st.name AS patient_name, st.phone AS patient_phone,
                   s.date, s.period, s.start_time, s.end_time, s.room,
                   d.name AS doctor_name,
                   dep.name AS department_name
            FROM appointments AS a
            JOIN students    AS st  ON st.student_no = a.student_no
            JOIN schedules   AS s   ON s.id = a.schedule_id
            JOIN doctors     AS d   ON d.id = s.doctor_id
            JOIN departments AS dep ON dep.id = d.department_id
            WHERE a.student_no = ?
            ORDER BY a.id DESC
            """,
            (student["student_no"],),
        ).fetchall()
    finally:
        conn.close()
    return [dict(row) for row in rows]


@app.delete("/api/appointments/{appointment_id}", tags=["预约"])
def cancel_appointment(appointment_id: int, student=Depends(current_student)):
    conn = get_conn()
    try:
        with conn:
            row = conn.execute(
                "SELECT schedule_id, student_no, status FROM appointments WHERE id = ?",
                (appointment_id,),
            ).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="预约不存在")
            if row["student_no"] != student["student_no"]:
                raise HTTPException(status_code=403, detail="只能取消自己的预约")

            cur = conn.execute(
                "UPDATE appointments SET status = 'CANCELLED' "
                "WHERE id = ? AND status = 'BOOKED'",
                (appointment_id,),
            )
            if cur.rowcount == 0:
                raise HTTPException(
                    status_code=409, detail="该预约已取消，无需重复操作"
                )

            conn.execute(
                "UPDATE schedules SET remain = remain + 1 "
                "WHERE id = ? AND remain < capacity",
                (row["schedule_id"],),
            )

            remain = conn.execute(
                "SELECT remain FROM schedules WHERE id = ?", (row["schedule_id"],)
            ).fetchone()[0]
    finally:
        conn.close()

    return {
        "success": True,
        "appointment_id": appointment_id,
        "schedule_id": row["schedule_id"],
        "status": "CANCELLED",
        "remain": remain,
    }


# ---------------- 智能分诊 ----------------

# 键为真实科室 id（见 init_db.py 的 REAL_DEPARTMENTS）
TRIAGE_RULES = {
    1: ["发烧", "发热", "咳嗽", "咳痰", "感冒", "流涕", "头痛", "头疼", "头晕",
        "血压", "血糖", "心悸", "胸闷", "胃痛", "腹痛", "腹泻", "恶心", "呕吐",
        "乏力", "失眠", "咽痛", "嗓子", "便秘", "上火"],
    2: ["腰", "颈", "肩", "膝盖", "关节", "扭伤", "骨折", "颈椎", "腰椎",
        "落枕", "骨头", "腿疼", "脚踝", "外伤", "缝合", "疝气", "泌尿"],
    3: ["牙", "牙龈", "口腔", "蛀牙", "龋齿", "智齿", "口气", "牙齿", "拔牙", "义齿", "嘴"],
    4: ["皮疹", "瘙痒", "湿疹", "痘痘", "痤疮", "过敏", "皮炎", "癣", "脱发", "荨麻疹", "红肿", "风团", "起疹"],
    5: ["眼", "视力", "近视", "干眼", "流泪", "眼屎", "看不清", "红眼", "结膜", "模糊"],
    6: ["鼻", "咽", "喉", "耳", "耳鸣", "扁桃体", "鼻塞", "流鼻血", "听力", "打鼾"],
    7: ["疼痛", "理疗", "按摩", "针灸", "肩周炎", "网球肘", "腱鞘炎", "面瘫", "偏头痛"],
    13: ["月经", "痛经", "白带", "妇科", "产检", "孕期"],
    14: ["调理", "体质", "中药", "气血", "湿气", "亚健康"],
}

EMERGENCY_WORDS = ["剧烈胸痛", "呼吸困难", "昏迷", "大出血", "意识不清", "抽搐", "休克", "说不出话"]

DEPARTMENT_FALLBACK_ADVICE = {
    1: "建议挂内科，若伴随高热不退或持续胸痛请尽快到急诊。",
    2: "建议挂外科，外伤出血请先压迫止血并及时就诊。",
    3: "建议挂口腔科，注意近期少吃辛辣、过硬食物。",
    4: "建议挂皮肤科，就诊前避免搔抓和使用刺激性护肤品。",
    5: "建议挂眼科，就诊前减少用眼，避免长时间看屏幕。",
    6: "建议挂耳鼻咽喉科，避免自行掏耳或用力擤鼻。",
    7: "建议挂康复理疗科（疼痛科），就诊前避免剧烈活动。",
    13: "建议挂妇科，就诊前避免自行用药。",
    14: "建议挂中医科，可带上既往检查资料便于辨证。",
}


class TriageRequest(BaseModel):
    description: str = Field(min_length=2, max_length=500)


def triage_by_rules(text):
    scores = {}
    matched = {}
    for dept_id, words in TRIAGE_RULES.items():
        hits = [w for w in words if w in text]
        if hits:
            scores[dept_id] = len(hits)
            matched[dept_id] = hits

    emergency = [w for w in EMERGENCY_WORDS if w in text]

    if not scores:
        if emergency:
            return {
                "department_id": None,
                "department_name": None,
                "confidence": "中",
                "matched": emergency,
                "urgency": "紧急",
                "advice": "出现" + "、".join(emergency) + "等危险信号，请立即前往急诊科或拨打 120，不要等待普通门诊号。",
                "emergency": True,
                "source": "rule",
            }
        return {
            "department_id": None,
            "department_name": None,
            "confidence": "低",
            "matched": [],
            "urgency": "需人工判断",
            "advice": "没有识别到明确的症状关键词。建议到门诊导诊台咨询，或补充描述（例如：发烧几天、哪里疼、持续多久）。",
            "emergency": False,
            "source": "rule",
        }

    dept_id = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
    best_hits = matched[dept_id]
    return {
        "department_id": dept_id,
        "department_name": None,
        "confidence": "高" if len(best_hits) >= 2 else "中",
        "matched": best_hits,
        "urgency": "紧急" if emergency else "普通",
        "advice": ("出现" + "、".join(emergency) + "等危险信号，请立即前往急诊或拨打 120。")
                  if emergency else DEPARTMENT_FALLBACK_ADVICE.get(dept_id, "建议按推荐科室就诊。"),
        "emergency": bool(emergency),
        "source": "rule",
    }


def triage_by_ai(text, depts):
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        return None

    options = "；".join("%s（id=%s）" % (name, did) for did, name in depts.items())
    prompt = (
        "你是郑州大学校医院的门诊分诊助手。请根据学生的症状描述，判断应当挂哪个科室。\n"
        "可选科室：" + options + "\n"
        "只输出 JSON，不要任何多余文字，字段如下：\n"
        '{"department_id": 整数或 null, "urgency": "普通" 或 "紧急", '
        '"confidence": "高" 或 "中" 或 "低", "advice": "40 字以内的就诊建议"}\n'
        "如果描述中出现剧烈胸痛、呼吸困难、昏迷、大出血等危险信号，urgency 必须为紧急，并在 advice 里提示立即急诊。\n"
        "学生描述：" + text
    )
    body = json.dumps({
        "model": "deepseek-chat",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 300,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.deepseek.com/chat/completions",
        data=body,
        headers={"Content-Type": "application/json",
                 "Authorization": "Bearer " + api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        content = (data["choices"][0]["message"]["content"] or "").strip()
        content = content.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(content)
        if parsed.get("department_id") not in depts:
            return None
        parsed["department_name"] = depts[parsed["department_id"]]
        parsed.setdefault("matched", [])
        parsed.setdefault("confidence", "中")
        parsed.setdefault("urgency", "普通")
        parsed.setdefault("emergency", parsed.get("urgency") == "紧急")
        parsed["source"] = "ai"
        return parsed
    except Exception:
        return None


@app.post("/api/triage", tags=["智能分诊"])
def triage(req: TriageRequest):
    conn = get_conn()
    try:
        depts = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM departments")}
    finally:
        conn.close()

    result = triage_by_ai(req.description, depts)
    if result is None:
        result = triage_by_rules(req.description)

    dept_id = result.get("department_id")
    if dept_id in depts:
        result["department_id"] = dept_id
        result["department_name"] = depts[dept_id]
    else:
        result["department_id"] = None
        result["department_name"] = None
    return result


# ---------------- AI 导诊智能体 ----------------


class AgentMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=2000)


class AgentChatRequest(BaseModel):
    messages: list[AgentMessage]


def _tool_departments():
    conn = get_conn()
    try:
        return [dict(r) for r in conn.execute(
            "SELECT id, name, location, source FROM departments "
            "ORDER BY CASE source WHEN 'real' THEN 0 ELSE 1 END, id")]
    finally:
        conn.close()


def _tool_doctors(department_id):
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT id, name, title, specialty FROM doctors "
            "WHERE department_id = ? ORDER BY id", (department_id,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def _tool_schedules(doctor_id, date=None):
    conn = get_conn()
    try:
        sql = ("SELECT id, date, period, start_time, end_time, room, capacity, remain "
               "FROM schedules WHERE doctor_id = ?")
        params = [doctor_id]
        if date:
            sql += " AND date = ?"
            params.append(date)
        sql += " ORDER BY date, start_time LIMIT 20"
        return [dict(r) for r in conn.execute(sql, params)]
    finally:
        conn.close()


def _tool_book(schedule_id, student):
    conn = get_conn()
    try:
        try:
            with conn:
                cur = conn.execute(
                    "UPDATE schedules SET remain = remain - 1 WHERE id = ? AND remain > 0",
                    (schedule_id,))
                if cur.rowcount == 0:
                    return {"success": False, "error": "号源已满或排班不存在"}

                created_at = datetime.datetime.now().isoformat(timespec="seconds")
                cur = conn.execute(
                    "INSERT INTO appointments (schedule_id, student_no, status, created_at) "
                    "VALUES (?, ?, 'BOOKED', ?)",
                    (schedule_id, student["student_no"], created_at))
                appointment_id = cur.lastrowid
        except sqlite3.IntegrityError:
            return {"success": False, "error": "你已经预约过这个号了"}

        remain = conn.execute(
            "SELECT remain FROM schedules WHERE id = ?", (schedule_id,)).fetchone()[0]
        return {
            "success": True,
            "appointment_id": appointment_id,
            "schedule_id": schedule_id,
            "remain": remain,
            "patient_name": student["name"],
        }
    finally:
        conn.close()


@app.post("/api/agent/chat", tags=["AI 导诊"])
def agent_chat(req: AgentChatRequest, student=Depends(current_student)):
    tools = {
        "list_departments": _tool_departments,
        "list_doctors": _tool_doctors,
        "list_schedules": _tool_schedules,
        "book_appointment": _tool_book,
    }
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    return run_agent(messages, student, tools)


# ---------------- 校园健康知识库 ----------------

@app.get("/api/health/categories", tags=["健康知识"])
def health_categories():
    return health.categories()


@app.get("/api/health/topics", tags=["健康知识"])
def health_topics(q: str | None = None, category: str | None = None):
    return health.search(q or "", category or "")


@app.get("/api/health/topics/{topic_id}", tags=["健康知识"])
def health_topic_detail(topic_id: str):
    topic = health.get(topic_id)
    if topic is None:
        raise HTTPException(status_code=404, detail="没有找到该知识条目")
    return health.topic_detail(topic)


# ---------------- 就诊评价接口 ----------------


class ReviewRequest(BaseModel):
    appointment_id: int
    rating: int = Field(ge=1, le=5)
    attitude: int | None = Field(default=None, ge=1, le=5)
    wait_time: int | None = Field(default=None, ge=1, le=5)
    communication: int | None = Field(default=None, ge=1, le=5)
    environment: int | None = Field(default=None, ge=1, le=5)
    comment: str = Field(default="", max_length=300)
    anonymous: bool = False


@app.post("/api/reviews", tags=["评价"])
def create_review(req: ReviewRequest, student=Depends(current_student)):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT a.id, a.student_no, s.doctor_id "
            "FROM appointments AS a JOIN schedules AS s ON s.id = a.schedule_id "
            "WHERE a.id = ?",
            (req.appointment_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="预约不存在")
        if row["student_no"] != student["student_no"]:
            raise HTTPException(status_code=403, detail="只能评价自己的就诊记录")

        try:
            with conn:
                cur = conn.execute(
                    "INSERT INTO reviews (appointment_id, student_no, doctor_id, rating, "
                    "attitude, wait_time, communication, environment, comment, anonymous, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        req.appointment_id, student["student_no"], row["doctor_id"],
                        req.rating, req.attitude, req.wait_time, req.communication,
                        req.environment, req.comment.strip(),
                        1 if req.anonymous else 0,
                        datetime.datetime.now().isoformat(timespec="seconds"),
                    ),
                )
                review_id = cur.lastrowid
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="这条就诊记录已经评价过了")

        stat = conn.execute(
            "SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS total "
            "FROM reviews WHERE doctor_id = ?",
            (row["doctor_id"],),
        ).fetchone()
    finally:
        conn.close()

    return {
        "success": True,
        "review_id": review_id,
        "doctor_id": row["doctor_id"],
        "doctor_rating": stat["avg_rating"],
        "doctor_review_count": stat["total"],
    }


@app.get("/api/reviews/mine", tags=["评价"])
def my_reviews(student=Depends(current_student)):
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT r.id, r.appointment_id, r.rating, r.attitude, r.wait_time,
                   r.communication, r.environment, r.comment, r.anonymous, r.created_at,
                   d.name AS doctor_name, dep.name AS department_name,
                   s.date, s.period
            FROM reviews AS r
            JOIN doctors AS d     ON d.id = r.doctor_id
            JOIN departments AS dep ON dep.id = d.department_id
            JOIN appointments AS a ON a.id = r.appointment_id
            JOIN schedules AS s   ON s.id = a.schedule_id
            WHERE r.student_no = ?
            ORDER BY r.id DESC
            """,
            (student["student_no"],),
        ).fetchall()
    finally:
        conn.close()
    return [dict(row) for row in rows]


@app.get("/api/doctors/{doctor_id}/reviews", tags=["评价"])
def doctor_reviews(doctor_id: int):
    conn = get_conn()
    try:
        stat = conn.execute(
            "SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS total, "
            "ROUND(AVG(attitude), 1) AS attitude, "
            "ROUND(AVG(wait_time), 1) AS wait_time, "
            "ROUND(AVG(communication), 1) AS communication, "
            "ROUND(AVG(environment), 1) AS environment "
            "FROM reviews WHERE doctor_id = ?",
            (doctor_id,),
        ).fetchone()

        rows = conn.execute(
            """
            SELECT r.rating, r.comment, r.anonymous, r.created_at, st.name
            FROM reviews AS r
            JOIN students AS st ON st.student_no = r.student_no
            WHERE r.doctor_id = ?
            ORDER BY r.id DESC LIMIT 50
            """,
            (doctor_id,),
        ).fetchall()
    finally:
        conn.close()

    items = []
    for r in rows:
        items.append({
            "rating": r["rating"],
            "comment": r["comment"],
            "author": "匿名同学" if r["anonymous"] else (r["name"][:1] + "同学"),
            "created_at": r["created_at"],
        })
    return {"summary": dict(stat), "items": items}


# ---------------- AI 前台客服 ----------------

def _svc_hospital_info():
    return hospital_info.hospital_brief()


def _svc_on_duty():
    conn = get_conn()
    try:
        return hospital_info.on_duty(conn)
    finally:
        conn.close()


def _svc_insurance(query=""):
    return hospital_info.insurance_brief(query)


def _svc_departments():
    conn = get_conn()
    try:
        return [dict(r) for r in conn.execute(
            "SELECT id, name, location, source FROM departments ORDER BY id")]
    finally:
        conn.close()


def _svc_search_kb(query=""):
    hits = hospital_kb.kb_search(query)
    return {
        "found": bool(hits),
        "items": [
            {
                "title": h["title"],
                "category": h["category"],
                "content": h["content"],
                "source": h["source"],
                "verified": h["verified"],
                "hint": h.get("hint"),
            }
            for h in hits
        ],
    }


SERVICE_TOOLS = {
    "search_kb": _svc_search_kb,
    "get_on_duty_doctors": _svc_on_duty,
    # 兼容早期工具名
    "get_hospital_info": _svc_hospital_info,
    "search_insurance": _svc_insurance,
    "list_departments": _svc_departments,
}


class ServiceChatRequest(BaseModel):
    messages: list[AgentMessage]


@app.get("/api/hospital/info", tags=["服务咨询"])
def hospital_info_api():
    return hospital_info.hospital_brief()


@app.get("/api/hospital/on-duty", tags=["服务咨询"])
def hospital_on_duty():
    return _svc_on_duty()


@app.get("/api/hospital/insurance", tags=["服务咨询"])
def hospital_insurance(q: str | None = None):
    return hospital_info.insurance_brief(q or "")


@app.get("/api/hospital/nav/areas", tags=["来院指引"])
def hospital_nav_areas():
    return {"areas": hospital_info.nav_areas(), "landmarks": hospital_info.NAV_LANDMARKS}


@app.get("/api/hospital/nav", tags=["来院指引"])
def hospital_nav(dept: str | None = None):
    return hospital_info.nav_for(dept or "")


@app.get("/api/hospital/access", tags=["服务咨询"])
def hospital_access_api():
    return hospital_info.hospital_access()


@app.get("/api/hospital/flow", tags=["服务咨询"])
def hospital_flow():
    return {
        "flow": [{"step": s[0], "detail": s[1]} for s in hospital_info.FLOW],
        "refund": hospital_info.REFUND_RULES,
        "disclaimer": hospital_info.DISCLAIMER,
    }


@app.post("/api/service/chat", tags=["服务咨询"])
def service_chat(req: ServiceChatRequest, student=Depends(current_student)):
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    result = service_bot.run(messages, SERVICE_TOOLS)

    # 兼容旧版前端：把这一轮对话也记录到客服会话，避免客服端看不到
    try:
        last_user = ""
        for m in reversed(req.messages):
            if m.role == "user":
                last_user = m.content
                break
        if last_user:
            now = datetime.datetime.now().isoformat(timespec="seconds")
            conn2 = get_conn()
            try:
                with conn2:
                    thread = _thread_for_student(conn2, student["student_no"])
                    exists = conn2.execute(
                        "SELECT id FROM service_messages WHERE thread_id = ? AND role = 'user' "
                        "AND content = ? ORDER BY id DESC LIMIT 1",
                        (thread["id"], last_user),
                    ).fetchone()
                    if exists is None:
                        conn2.execute(
                            "INSERT INTO service_messages (thread_id, role, sender, content, created_at) "
                            "VALUES (?, 'user', ?, ?, ?)",
                            (thread["id"], student["name"], last_user, now),
                        )
                    conn2.execute(
                        "INSERT INTO service_messages (thread_id, role, sender, content, created_at) "
                        "VALUES (?, 'ai', 'AI 助手', ?, ?)",
                        (thread["id"], result.get("reply") or "", now),
                    )
                    conn2.execute(
                        "UPDATE service_threads SET updated_at = ?, unread_staff = unread_staff + 1 "
                        "WHERE id = ?",
                        (now, thread["id"]),
                    )
            finally:
                conn2.close()
    except Exception:
        pass

    return {
        "reply": result.get("reply", ""),
        "card": result.get("card"),
        "source": result.get("source", "rule"),
        "sources": result.get("sources", []),
        "suggestions": result.get("suggestions", []),
        "trace": result.get("trace", []),
    }


# ---------------- 公开评价（所有人可见） ----------------

@app.get("/api/reviews", tags=["评价"])
def public_reviews(doctor_id: int | None = None, limit: int = 50, offset: int = 0):
    sql = (
        "SELECT r.id, r.rating, r.attitude, r.wait_time, r.communication, r.environment, "
        "r.comment, r.anonymous, r.created_at, "
        "d.id AS doctor_id, d.name AS doctor_name, d.title AS doctor_title, "
        "dep.name AS department_name, st.name AS student_name, "
        "s.date, s.period "
        "FROM reviews AS r "
        "JOIN doctors AS d ON d.id = r.doctor_id "
        "JOIN departments AS dep ON dep.id = d.department_id "
        "JOIN students AS st ON st.student_no = r.student_no "
        "LEFT JOIN appointments AS a ON a.id = r.appointment_id "
        "LEFT JOIN schedules AS s ON s.id = a.schedule_id "
    )
    params = []
    if doctor_id is not None:
        sql += " WHERE r.doctor_id = ?"
        params.append(doctor_id)
    sql += " ORDER BY r.id DESC LIMIT ? OFFSET ?"
    params.extend([max(1, min(limit, 100)), max(0, offset)])

    conn = get_conn()
    try:
        rows = conn.execute(sql, params).fetchall()
        total = conn.execute(
            "SELECT COUNT(*) FROM reviews" + (" WHERE doctor_id = ?" if doctor_id else ""),
            ([doctor_id] if doctor_id else []),
        ).fetchone()[0]
        stat = conn.execute(
            "SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS total FROM reviews"
        ).fetchone()
    finally:
        conn.close()

    items = []
    for r in rows:
        items.append({
            "id": r["id"],
            "rating": r["rating"],
            "attitude": r["attitude"],
            "wait_time": r["wait_time"],
            "communication": r["communication"],
            "environment": r["environment"],
            "comment": r["comment"],
            "author": "匿名同学" if r["anonymous"] else (r["student_name"][:1] + "同学"),
            "created_at": r["created_at"],
            "doctor_id": r["doctor_id"],
            "doctor_name": r["doctor_name"],
            "doctor_title": r["doctor_title"],
            "department_name": r["department_name"],
            "date": r["date"],
            "period": r["period"],
        })
    return {
        "total": total,
        "avg_rating": stat["avg_rating"] if stat else None,
        "items": items,
    }


# ---------------- 知识库浏览 ----------------

@app.get("/api/hospital/kb/categories", tags=["服务咨询"])
def kb_categories_api():
    return hospital_kb.kb_categories()


@app.get("/api/hospital/kb", tags=["服务咨询"])
def kb_api(q: str | None = None, category: str | None = None):
    if q:
        hits = hospital_kb.kb_search(q, category or "")
        return {
            "mode": "search",
            "query": q,
            "items": [
                {
                    "id": h["id"],
                    "title": h["title"],
                    "category": h["category"],
                    "content": h["content"],
                    "source": h["source"],
                    "verified": h["verified"],
                    "hint": h.get("hint"),
                }
                for h in hits
            ],
        }
    return {
        "mode": "list",
        "category": category or "",
        "items": hospital_kb.kb_list(category or ""),
        "total": len(hospital_kb.KB),
    }


@app.get("/api/hospital/kb/{item_id}", tags=["服务咨询"])
def kb_item_api(item_id: str):
    item = hospital_kb.kb_get(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="知识库中没有该条目")
    return {
        "id": item["id"],
        "title": item["title"],
        "category": item["category"],
        "content": item["content"],
        "source": item["source"],
        "verified": item["verified"],
        "hint": item.get("hint"),
    }


# ---------------- 真人客服 ----------------

class StaffLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=64)


class MessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


def current_staff(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="请先登录客服账号")
    token = authorization.split(" ", 1)[1].strip()
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT st.id, st.username, st.name FROM staff_sessions AS ss "
            "JOIN staff AS st ON st.id = ss.staff_id WHERE ss.token = ?",
            (token,),
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        raise HTTPException(status_code=401, detail="客服登录已失效，请重新登录")
    return dict(row)


def _thread_for_student(conn, student_no):
    row = conn.execute(
        "SELECT * FROM service_threads WHERE student_no = ?", (student_no,)
    ).fetchone()
    now = datetime.datetime.now().isoformat(timespec="seconds")
    if row is None:
        cur = conn.execute(
            "INSERT INTO service_threads (student_no, created_at, updated_at) VALUES (?, ?, ?)",
            (student_no, now, now),
        )
        row = conn.execute(
            "SELECT * FROM service_threads WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return row


def _messages(conn, thread_id):
    rows = conn.execute(
        "SELECT id, role, sender, content, created_at FROM service_messages "
        "WHERE thread_id = ? ORDER BY id",
        (thread_id,),
    ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/staff/login", tags=["客服端"])
def staff_login(req: StaffLoginRequest):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT id, username, name, salt, password_hash FROM staff WHERE username = ?",
            (req.username.strip(),),
        ).fetchone()
        if row is None or hash_password(req.password, row["salt"]) != row["password_hash"]:
            raise HTTPException(status_code=401, detail="客服账号或密码错误")

        token = secrets.token_hex(16)
        with conn:
            # 客服允许同一账号在多台设备登录（与学生的单设备互斥策略不同）
            conn.execute("DELETE FROM staff_sessions WHERE created_at < ?",
                         ((datetime.datetime.now() - datetime.timedelta(days=7)).isoformat(timespec="seconds"),))
            conn.execute(
                "INSERT INTO staff_sessions (token, staff_id, created_at) VALUES (?, ?, ?)",
                (token, row["id"],
                 datetime.datetime.now().isoformat(timespec="seconds")),
            )
    finally:
        conn.close()
    return {"token": token, "staff": {"id": row["id"], "username": row["username"], "name": row["name"]}}


@app.get("/api/staff/threads", tags=["客服端"])
def staff_threads(staff=Depends(current_staff)):
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT t.id, t.student_no, t.updated_at, t.unread_staff,
                   s.name AS student_name,
                   (SELECT content FROM service_messages m
                     WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                   (SELECT role FROM service_messages m
                     WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_role,
                   (SELECT COUNT(*) FROM service_messages m WHERE m.thread_id = t.id) AS total
            FROM service_threads AS t
            LEFT JOIN students AS s ON s.student_no = t.student_no
            ORDER BY t.updated_at DESC
            """
        ).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


@app.get("/api/staff/threads/{thread_id}", tags=["客服端"])
def staff_thread_detail(thread_id: int, staff=Depends(current_staff)):
    conn = get_conn()
    try:
        thread = conn.execute(
            "SELECT t.*, s.name AS student_name, s.major FROM service_threads t "
            "LEFT JOIN students s ON s.student_no = t.student_no WHERE t.id = ?",
            (thread_id,),
        ).fetchone()
        if thread is None:
            raise HTTPException(status_code=404, detail="会话不存在")
        with conn:
            conn.execute("UPDATE service_threads SET unread_staff = 0 WHERE id = ?", (thread_id,))
        msgs = _messages(conn, thread_id)
    finally:
        conn.close()
    return {"thread": dict(thread), "messages": msgs}


@app.post("/api/staff/threads/{thread_id}/reply", tags=["客服端"])
def staff_reply(thread_id: int, req: MessageRequest, staff=Depends(current_staff)):
    conn = get_conn()
    try:
        thread = conn.execute(
            "SELECT id FROM service_threads WHERE id = ?", (thread_id,)
        ).fetchone()
        if thread is None:
            raise HTTPException(status_code=404, detail="会话不存在")
        now = datetime.datetime.now().isoformat(timespec="seconds")
        with conn:
            conn.execute(
                "INSERT INTO service_messages (thread_id, role, sender, content, created_at) "
                "VALUES (?, 'staff', ?, ?, ?)",
                (thread_id, staff["name"], req.content.strip(), now),
            )
            conn.execute(
                "UPDATE service_threads SET updated_at = ?, unread_student = unread_student + 1 "
                "WHERE id = ?",
                (now, thread_id),
            )
        msgs = _messages(conn, thread_id)
    finally:
        conn.close()
    return {"success": True, "messages": msgs}


@app.get("/api/service/thread", tags=["服务咨询"])
def service_thread(student=Depends(current_student)):
    conn = get_conn()
    try:
        with conn:
            thread = _thread_for_student(conn, student["student_no"])
            conn.execute(
                "UPDATE service_threads SET unread_student = 0 WHERE id = ?", (thread["id"],)
            )
        msgs = _messages(conn, thread["id"])
    finally:
        conn.close()
    return {"thread_id": thread["id"], "messages": msgs}


@app.post("/api/service/thread/messages", tags=["服务咨询"])
def service_send(req: MessageRequest, student=Depends(current_student)):
    conn = get_conn()
    try:
        now = datetime.datetime.now().isoformat(timespec="seconds")
        with conn:
            thread = _thread_for_student(conn, student["student_no"])
            conn.execute(
                "INSERT INTO service_messages (thread_id, role, sender, content, created_at) "
                "VALUES (?, 'user', ?, ?, ?)",
                (thread["id"], student["name"], req.content.strip(), now),
            )
            conn.execute(
                "UPDATE service_threads SET updated_at = ?, unread_staff = unread_staff + 1 "
                "WHERE id = ?",
                (now, thread["id"]),
            )
        history_rows = _messages(conn, thread["id"])[-10:]
    finally:
        conn.close()

    # 生成 AI 回复（同一会话内多轮上下文）
    history = []
    for m in history_rows:
        role = "user" if m["role"] == "user" else "assistant"
        history.append({"role": role, "content": m["content"]})
    try:
        result = service_bot.run(history, SERVICE_TOOLS)
        ai_reply = result.get("reply") or ""
        sources = result.get("sources", [])
    except Exception:
        ai_reply = "（AI 暂时无法回答，已转给人工客服，请稍等）"
        sources = []

    conn = get_conn()
    try:
        now = datetime.datetime.now().isoformat(timespec="seconds")
        with conn:
            conn.execute(
                "INSERT INTO service_messages (thread_id, role, sender, content, created_at) "
                "VALUES (?, 'ai', 'AI 助手', ?, ?)",
                (thread["id"], ai_reply, now),
            )
            conn.execute(
                "UPDATE service_threads SET updated_at = ? WHERE id = ?", (now, thread["id"])
            )
        msgs = _messages(conn, thread["id"])
    finally:
        conn.close()

    return {"messages": msgs, "ai_reply": ai_reply, "sources": sources}


@app.get("/docs", include_in_schema=False)
def custom_swagger_ui():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=app.title + " - Swagger UI",
        swagger_js_url="https://cdn.staticfile.net/swagger-ui/5.11.0/swagger-ui-bundle.js",
        swagger_css_url="https://cdn.staticfile.net/swagger-ui/5.11.0/swagger-ui.css",
    )

# ---------------- 网页版（响应式 H5） ----------------

WEB_DIR = Path(__file__).resolve().parent / "web"


@app.get("/", include_in_schema=False)
def index():
    return RedirectResponse(url="/app/")


if WEB_DIR.is_dir():
    app.mount("/app", StaticFiles(directory=str(WEB_DIR), html=True), name="web")
