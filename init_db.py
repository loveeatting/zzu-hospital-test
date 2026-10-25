"""初始化数据库（v3）

数据构成：
- 科室：全部为郑州大学医院官网「科室介绍 / 专家介绍」中的真实科室（14 个），不再保留模拟科室
- 医生：
    * 真实医生 9 位 —— 姓名/职称/擅长来自官网专家介绍页面
    * 模拟医生 8 位 —— 官网未公布，为补全空科室而设置，标注为 mock
- 排班：真实与模拟医生均生成（官网未公布出诊时间，统一为模拟排班）

数据来源：http://ai.xhis.com.cn/  （郑州大学医院官网）
"""

import datetime
import hashlib
import secrets

from db import DB_PATH, get_conn

# ---------------- 真实科室（官网，14 个） ----------------
REAL_DEPARTMENTS = [
    (1, "内科", "门诊楼", "real"),
    (2, "外科", "门诊楼", "real"),
    (3, "口腔科", "门诊楼", "real"),
    (4, "皮肤科", "门诊楼", "real"),
    (5, "眼科", "门诊楼", "real"),
    (6, "耳鼻咽喉科", "门诊楼", "real"),
    (7, "康复理疗科（疼痛科）", "门诊楼", "real"),
    (8, "成人预防接种门诊", "门诊楼", "real"),
    (9, "体检科", "体检中心", "real"),
    (10, "超声科", "医技楼", "real"),
    (11, "检验科", "医技楼", "real"),
    (12, "放射科", "医技楼", "real"),
    (13, "妇科", "门诊楼", "real"),
    (14, "中医科", "门诊楼", "real"),
]

# ---------------- 真实医生（官网专家介绍，9 位） ----------------
REAL_DOCTORS = [
    (1001, 1, "崔超巍", "主任医师", "神经内科疾病治疗、颅脑影像学诊断", "real"),
    (1002, 2, "鲁照亮", "副主任医师", "普通外科、骨外科、泌尿外科常见病及多发病诊治", "real"),
    (1003, 2, "白慧英", "副主任医师", "骨科及外科常见病；急慢性扭伤、颈椎病、腰椎病、疼痛的中西医治疗", "real"),
    (1004, 13, "李雪峰", "副主任医师", "妇产科各类疾病的诊断及物理、手术治疗", "real"),
    (1005, 4, "张文霞", "副主任医师", "皮肤科常见病、多发病的诊断与治疗", "real"),
    (1006, 3, "李立", "副主任医师", "前牙美学修复、固定义齿/活动义齿/全口义齿修复、复杂牙与阻生牙拔除", "real"),
    (1007, 10, "郭淑香", "副主任医师", "心脏、腹部、血管、小器官常见病超声诊断", "real"),
    (1008, 7, "赵铮", "主治医师", "中西医结合治疗软组织疼痛、颈腰椎病、面瘫、失眠、痛经等", "real"),
    (1009, 14, "冯娜", "主治医师", "胃痛腹胀、慢性腹泻便秘、咳嗽、过敏性鼻炎、失眠、月经不调、痤疮、痛风等", "real"),
]

# ---------------- 模拟医生（补全无医生科室，8 位，标注 mock） ----------------
# 官网未公布这些科室的医生信息，为保证流程可演示而设置，请勿当作真实医师信息
MOCK_DOCTORS = [
    (2001, 5, "王海燕", "副主任医师", "近视防控、干眼、结膜炎及常见眼病诊治", "mock"),
    (2002, 5, "李振宇", "主治医师", "视疲劳、屈光不正、眼底病筛查", "mock"),
    (2003, 6, "陈立新", "主治医师", "过敏性鼻炎、急慢性咽炎、扁桃体炎、耳鸣", "mock"),
    (2004, 8, "张丽华", "主治医师", "成人疫苗接种咨询、流感与乙肝疫苗接种评估", "mock"),
    (2005, 9, "刘建国", "副主任医师", "健康体检方案设计、体检报告解读与随访建议", "mock"),
    (2006, 11, "孙志远", "主管技师", "血常规、生化、免疫等检验项目咨询与结果解释", "mock"),
    (2007, 12, "周明", "主治医师", "X 线、CT 影像诊断与检查注意事项", "mock"),
    (2008, 6, "吴晓丹", "副主任医师", "鼻窦炎、中耳炎、咽喉疾病诊治", "mock"),
]

# ---------------- 演示学生账号 ----------------
STUDENTS = [
    ("2025010001", "zzu123456", "张三", "13800000001", "计算机科学与技术 2025 级"),
    ("2025010002", "zzu123456", "李四", "13800000002", "软件工程 2025 级"),
    ("2025010003", "zzu123456", "王五", "13800000003", "临床医学 2025 级"),
    ("2025020001", "zzu123456", "赵六", "13800000004", "护理学 2025 级"),
    ("2025030001", "zzu123456", "孙七", "13800000005", "药学 2025 级"),
]

SCHEMA = """
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS departments;
DROP TABLE IF EXISTS students;

CREATE TABLE departments (
    id       INTEGER PRIMARY KEY,
    name     TEXT    NOT NULL,
    location TEXT,
    source   TEXT    NOT NULL DEFAULT 'mock'   -- real=官网真实数据 / mock=模拟数据
);

CREATE TABLE doctors (
    id            INTEGER PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(id),
    name          TEXT    NOT NULL,
    title         TEXT,
    specialty     TEXT,
    source        TEXT    NOT NULL DEFAULT 'mock'
);

CREATE TABLE schedules (
    id         INTEGER PRIMARY KEY,
    doctor_id  INTEGER NOT NULL REFERENCES doctors(id),
    date       TEXT    NOT NULL,
    period     TEXT    NOT NULL,
    start_time TEXT,
    end_time   TEXT,
    room       TEXT,
    capacity   INTEGER NOT NULL,
    remain     INTEGER NOT NULL,
    UNIQUE (doctor_id, date, period)
);

CREATE TABLE students (
    student_no    TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    phone         TEXT,
    major         TEXT,
    salt          TEXT NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE sessions (
    token      TEXT PRIMARY KEY,
    student_no TEXT NOT NULL REFERENCES students(student_no),
    created_at TEXT NOT NULL
);

CREATE TABLE appointments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL REFERENCES schedules(id),
    student_no  TEXT    NOT NULL REFERENCES students(student_no),
    status      TEXT    NOT NULL DEFAULT 'BOOKED',
    created_at  TEXT    NOT NULL
);

CREATE UNIQUE INDEX ux_appt_active
    ON appointments (schedule_id, student_no)
    WHERE status = 'BOOKED';

CREATE TABLE reviews (
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


def hash_password(password, salt):
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def main():
    conn = get_conn()
    try:
        conn.executescript(SCHEMA)

        conn.executemany(
            "INSERT INTO departments (id, name, location, source) VALUES (?, ?, ?, ?)",
            REAL_DEPARTMENTS,
        )
        conn.executemany(
            "INSERT INTO doctors (id, department_id, name, title, specialty, source) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            REAL_DOCTORS + MOCK_DOCTORS,
        )

        student_rows = []
        for student_no, password, name, phone, major in STUDENTS:
            salt = secrets.token_hex(8)
            student_rows.append(
                (student_no, name, phone, major, salt, hash_password(password, salt))
            )
        conn.executemany(
            "INSERT INTO students (student_no, name, phone, major, salt, password_hash) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            student_rows,
        )

        rows = []
        next_id = 10001
        today = datetime.date.today()
        for doctor in REAL_DOCTORS + MOCK_DOCTORS:
            doctor_id = doctor[0]
            for offset in range(1, 8):
                day = (today + datetime.timedelta(days=offset)).isoformat()
                for period, start_time, end_time, capacity in (
                    ("上午", "08:00", "12:00", 20),
                    ("下午", "14:00", "17:30", 15),
                ):
                    rows.append((
                        next_id, doctor_id, day, period,
                        start_time, end_time,
                        "诊室 " + str(doctor_id % 100),
                        capacity, capacity,
                    ))
                    next_id += 1

        conn.executemany(
            "INSERT INTO schedules (id, doctor_id, date, period, start_time, "
            "end_time, room, capacity, remain) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
        conn.commit()

        for table in ("departments", "doctors", "schedules", "students",
                      "appointments", "sessions", "reviews"):
            n = conn.execute("SELECT COUNT(*) FROM " + table).fetchone()[0]
            print(f"{table:12s} {n} 行")

        real_m = conn.execute("SELECT COUNT(*) FROM doctors WHERE source='real'").fetchone()[0]
        mock_m = conn.execute("SELECT COUNT(*) FROM doctors WHERE source='mock'").fetchone()[0]
        print("医生：真实 %d 位 / 模拟 %d 位（模拟医生仅用于补全官网未公布的科室）" % (real_m, mock_m))

        empty = conn.execute(
            "SELECT d.name FROM departments d LEFT JOIN doctors doc ON doc.department_id=d.id "
            "GROUP BY d.id HAVING COUNT(doc.id)=0"
        ).fetchall()
        print("没有医生的科室:", [r[0] for r in empty] or "无")
        print("演示账号: 2025010001 / zzu123456 （张三）")
        print("数据库文件:", DB_PATH)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
