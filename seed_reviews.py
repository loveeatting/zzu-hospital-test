"""写入演示评价数据（仅用于原型展示，可用 init_db.py 清空）。

说明：
- appointment_id 使用负数占位，不会与真实预约冲突
- author 通过 anonymous 字段控制，匿名时前端显示"匿名同学"
"""

import datetime
import sqlite3
from pathlib import Path

DB = Path(__file__).parent / "mock.db"

SAMPLES = [
    # doctor_id, rating, attitude, wait, comm, env, comment, anonymous, student_no
    (1001, 5, 5, 4, 5, 4, "问诊很仔细，把我之前做的检查都看了一遍，还提醒我少熬夜。", 0, "2025010002"),
    (1006, 5, 5, 4, 5, 4, "牙疼了两天，医生处理得很快，拔牙几乎没疼，态度也很好。", 0, "2025010003"),
    (1005, 4, 4, 3, 5, 4, "皮肤科排队人有点多，等了四十分钟，不过医生解释得很清楚。", 1, "2025020001"),
    (1004, 5, 5, 5, 5, 4, "妇科医生很耐心，问得很细，还告诉我经期注意事项。", 1, "2025030001"),
    (1007, 4, 4, 4, 4, 5, "B超检查速度挺快，报告当场就出来了。", 0, "2025010001"),
    (1008, 5, 5, 4, 5, 5, "做了一个疗程的理疗，颈椎疼明显缓解，医生还教了锻炼动作。", 0, "2025010002"),
    (1002, 4, 4, 3, 4, 4, "外科换药很利索，就是候诊时间稍长。", 0, "2025010003"),
    (1009, 5, 5, 5, 5, 5, "中医调理效果不错，医生把脉很认真，开的药也不贵。", 1, "2025020001"),
]


def main():
    conn = sqlite3.connect(DB)
    try:
        now = datetime.datetime.now().isoformat(timespec="seconds")
        conn.execute("CREATE TABLE IF NOT EXISTS reviews ("
                     "id INTEGER PRIMARY KEY AUTOINCREMENT,"
                     "appointment_id INTEGER NOT NULL UNIQUE,"
                     "student_no TEXT NOT NULL, doctor_id INTEGER NOT NULL,"
                     "rating INTEGER NOT NULL, attitude INTEGER, wait_time INTEGER,"
                     "communication INTEGER, environment INTEGER, comment TEXT,"
                     "anonymous INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)")

        existing = conn.execute("SELECT COUNT(*) FROM reviews").fetchone()[0]
        if existing >= 8:
            print("评价已有 %d 条，跳过写入" % existing)
            return

        next_id = -(existing + 1)
        inserted = 0
        for row in SAMPLES:
            doctor_id, rating, att, wait, comm, env, comment, anon, sno = row
            next_id -= 1
            try:
                conn.execute(
                    "INSERT INTO reviews (appointment_id, student_no, doctor_id, rating, "
                    "attitude, wait_time, communication, environment, comment, anonymous, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (next_id, sno, doctor_id, rating, att, wait, comm, env, comment, anon, now),
                )
                inserted += 1
            except sqlite3.IntegrityError:
                pass
        conn.commit()

        total = conn.execute("SELECT COUNT(*) FROM reviews").fetchone()[0]
        avg = conn.execute("SELECT ROUND(AVG(rating),1) FROM reviews").fetchone()[0]
        print("已写入 %d 条演示评价，当前共 %d 条，平均 %.1f 星" % (inserted, total, avg))
        for r in conn.execute(
                "SELECT d.name, dep.name, r.rating, r.comment FROM reviews r "
                "JOIN doctors d ON d.id=r.doctor_id JOIN departments dep ON dep.id=d.department_id "
                "ORDER BY r.id DESC LIMIT 5"):
            print("  ·", r[0], "|", r[1], "|", r[2], "星 |", r[3][:24])
    finally:
        conn.close()


if __name__ == "__main__":
    main()
