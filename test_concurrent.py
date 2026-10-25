"""并发抢号压测（需登录版）。

用法（先启动服务）：
    python test_concurrent.py            20 个账号抢 1 个号
    python test_concurrent.py 50 3       50 个账号抢 3 个号
"""

import hashlib
import json
import secrets
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000"
DB = "mock.db"
SCHEDULE_ID = 10001
TEST_PREFIX = "9000"


def hash_password(password, salt):
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def prepare(threads_n, remain_n):
    """创建 threads_n 个压测账号并直接发 token，重置目标排班余号。"""
    conn = sqlite3.connect(DB, timeout=10)
    tokens = []
    try:
        with conn:
            conn.execute("DELETE FROM appointments WHERE student_no LIKE ?", (TEST_PREFIX + "%",))
            conn.execute("DELETE FROM sessions WHERE student_no LIKE ?", (TEST_PREFIX + "%",))
            conn.execute("DELETE FROM students WHERE student_no LIKE ?", (TEST_PREFIX + "%",))
            conn.execute("UPDATE schedules SET remain = ? WHERE id = ?", (remain_n, SCHEDULE_ID))

            for i in range(threads_n):
                student_no = "%s%04d" % (TEST_PREFIX, i + 1)
                salt = secrets.token_hex(8)
                conn.execute(
                    "INSERT INTO students (student_no, name, phone, major, salt, password_hash) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (student_no, "考生%02d" % (i + 1), "", "压测", salt,
                     hash_password("test123456", salt)),
                )
                token = secrets.token_hex(16)
                conn.execute(
                    "INSERT INTO sessions (token, student_no, created_at) VALUES (?, ?, ?)",
                    (token, student_no, "test"),
                )
                tokens.append(token)
    finally:
        conn.close()
    return tokens


def read_remain():
    conn = sqlite3.connect(DB, timeout=10)
    try:
        return conn.execute(
            "SELECT remain FROM schedules WHERE id = ?", (SCHEDULE_ID,)
        ).fetchone()[0]
    finally:
        conn.close()


def book(token, barrier, results, index):
    body = json.dumps({"schedule_id": SCHEDULE_ID}).encode("utf-8")
    req = urllib.request.Request(
        BASE + "/api/appointments",
        data=body,
        headers={"Content-Type": "application/json",
                 "Authorization": "Bearer " + token},
        method="POST",
    )
    barrier.wait()
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            results[index] = (resp.status, resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        results[index] = (e.code, e.read().decode("utf-8"))
    except Exception as e:
        results[index] = (-1, repr(e))


def main():
    threads_n = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    remain_n = int(sys.argv[2]) if len(sys.argv) > 2 else 1

    tokens = prepare(threads_n, remain_n)
    print("排班 {} 重置：remain = {}，并发账号 {} 个".format(SCHEDULE_ID, remain_n, threads_n))

    barrier = threading.Barrier(threads_n)
    results = [None] * threads_n
    workers = [
        threading.Thread(target=book, args=(tokens[i], barrier, results, i))
        for i in range(threads_n)
    ]

    t0 = time.time()
    for w in workers:
        w.start()
    for w in workers:
        w.join()
    elapsed = time.time() - t0

    ok = [r for r in results if r and r[0] == 200]
    full = [r for r in results if r and r[0] == 409]
    other = [r for r in results if r and r[0] not in (200, 409)]

    print("耗时       {:.2f}s".format(elapsed))
    print("成功 200   {} 人".format(len(ok)))
    print("满号 409   {} 人".format(len(full)))
    if other:
        print("其他异常   {} 个".format(len(other)))
        print("           第一个: {}".format(str(other[0][1])[:120]))

    final = read_remain()
    print("最终 remain = {}".format(final))

    problems = []
    if other:
        problems.append("有 {} 个请求没有正常返回（服务没启动？）".format(len(other)))
    if len(ok) + len(full) != threads_n:
        problems.append("成功+满号 = {}，不等于线程数 {}".format(len(ok) + len(full), threads_n))
    if final < 0:
        problems.append("remain 变成负数 {}（超卖！）".format(final))
    if len(ok) > remain_n:
        problems.append("成功 {} 人 > 可用号源 {}（超卖！）".format(len(ok), remain_n))
    if final != remain_n - len(ok):
        problems.append("remain({}) != 初始({}) - 成功({})".format(final, remain_n, len(ok)))

    print()
    if problems:
        print("失败：")
        for p in problems:
            print("   -", p)
        sys.exit(1)
    print("通过：{} 个号，{} 人成功，remain 精确停在 {}".format(remain_n, len(ok), final))
    print("提示：压测账号（9000xxxx）留在库里，演示前可跑 init_db.py 清理")


if __name__ == "__main__":
    main()