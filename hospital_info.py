"""医院服务信息：营业时间、医保政策、值班查询、就诊流程。

⚠️ 说明：以下政策与时间为原型演示数据（依据公开的校园医保惯例整理），
   实际以郑州大学医院公告及当年医保政策为准，界面与回答中均带提示。
"""

import datetime

DISCLAIMER = "以上信息以医院当日公告和当年医保政策为准，具体以实际结算为准。"

PERIODS = [
    ("上午", "08:00", "12:00"),
    ("下午", "14:00", "17:30"),
]

HOSPITAL = {
    "name": "郑州大学医院（校医院）",
    "address": "郑州大学主校区（具体门诊楼位置见院内楼层分布图）",
    "hours": [
        "普通门诊：周一至周五 上午 08:00–12:00，下午 14:00–17:30",
        "周六上午：08:00–12:00（部分科室开诊，以当日排班为准）",
        "周日及法定节假日：门诊停诊，仅保留急诊",
        "急诊：24 小时开放",
        "挂号截止：上午 11:30、下午 17:00 停止挂当日号",
    ],
    "phone": "门诊咨询请到一楼导诊台；急救请拨 120",
    "notes": [
        "就诊请携带校园卡或身份证，医保结算需出示医保电子凭证",
        "线上预约成功后，请在就诊时段前 15 分钟到院取号",
    ],
}

FLOW = [
    ("线上预约", "在「科室」中选择科室 → 医生 → 时段，确认后生成预约号"),
    ("到院取号", "就诊时段前 15 分钟到一楼自助机或人工窗口取号"),
    ("候诊就诊", "按叫号进入对应诊室，携带既往检查资料"),
    ("结算取药", "校医院为医保定点，可直接刷校园卡/医保电子凭证结算"),
]

REFUND_RULES = [
    "就诊日前一天 23:00 前，可在「我的预约」中直接取消，号源立即释放",
    "就诊当天如需退号，请到一楼导诊台办理，线上不再支持取消",
    "爽约（预约未到且未退号）累计 3 次，将限制 30 天内线上预约",
]

# ---------------- 医保政策 ----------------

INSURANCE = [
    {
        "id": "student-insurance",
        "title": "大学生医保怎么参加",
        "tags": ["参保", "大学生医保", "缴费", "怎么交"],
        "content": [
            "全日制学生按学年参加郑州市城乡居民基本医疗保险（大学生档），由学校统一组织参保",
            "个人缴费部分按当年标准缴纳（近年为每年数百元，具体金额以当年通知为准）",
            "参保后在定点医疗机构（含校医院）就医可享受医保待遇",
        ],
    },
    {
        "id": "outpatient-reimburse",
        "title": "门诊能报多少（校医院门诊统筹）",
        "tags": ["门诊", "报销", "比例", "能报多少", "省钱", "多少钱"],
        "content": [
            "校医院是医保定点机构，普通门诊费用在政策范围内可按比例报销（门诊统筹）",
            "示例：政策范围内费用 100 元，按 60% 比例报销，个人自付约 40 元；实际比例以当年政策为准",
            "报销有起付线（每年需先自付一定金额）和年度封顶线",
            "挂号费、诊察费、药品、检查等是否纳入报销范围，按医保目录执行",
        ],
    },
    {
        "id": "deductible",
        "title": "起付线和封顶线是什么",
        "tags": ["起付线", "封顶线", "门槛", "自付"],
        "content": [
            "起付线：一年内门诊费用累计超过该金额后，超出部分才按比例报销（门诊起付线通常较低）",
            "封顶线：一年内医保基金最高支付限额，超出部分自付",
            "不同级别医院起付线和报销比例不同，校医院作为基层定点机构比例通常更优惠",
        ],
    },
    {
        "id": "reimburse-flow",
        "title": "报销流程（怎么结算）",
        "tags": ["报销流程", "结算", "怎么报", "刷医保", "电子凭证"],
        "content": [
            "校医院就诊：结算时出示医保电子凭证或校园卡，系统直接结算，只需支付自付部分",
            "校外就诊：需先在定点医院就医，保留发票、费用清单、病历，按学校医保办要求提交材料",
            "转诊：需校医院开具转诊单，否则报销比例可能降低",
            "报销材料一般包括：发票原件、费用明细、病历/处方、银行卡信息",
        ],
    },
    {
        "id": "self-pay",
        "title": "哪些项目医保不报（自费项目）",
        "tags": ["自费", "不报", "体检", "疫苗", "美容"],
        "content": [
            "健康体检、入职体检、疫苗接种（部分免疫规划疫苗除外）通常为自费",
            "整形美容、配镜、部分进口耗材、非医保目录药品需自费",
            "超出医保目录范围的治疗项目自费",
        ],
    },
    {
        "id": "hospital-reimburse",
        "title": "住院怎么报",
        "tags": ["住院", "住院报销", "大病"],
        "content": [
            "住院需在定点医院办理医保登记，出院时直接结算",
            "住院起付线按医院级别设定，级别越高起付线越高、报销比例相对低",
            "年度内有最高支付限额；大病保险对高额费用有二次报销",
        ],
    },
    {
        "id": "remote-medical",
        "title": "异地就医怎么办",
        "tags": ["异地", "备案", "外地就医", "寒暑假"],
        "content": [
            "寒暑假在家就医，建议提前在「国家医保服务平台」APP 办理异地就医备案",
            "备案后在就医地定点医院可直接结算；未备案则需回校手工报销，比例可能下降",
        ],
    },
]

# ---------------- 常见问答 ----------------

FAQ = [
    {
        "id": "how-to-book",
        "title": "怎么挂号",
        "tags": ["挂号", "怎么预约", "预约流程", "怎么看医生"],
        "content": [
            "线上：首页「科室」→ 选科室 → 选医生 → 选时段 → 确认预约",
            "线下：一楼人工窗口或自助机挂号",
            "急诊无需挂号，直接到急诊科",
        ],
    },
    {
        "id": "what-to-bring",
        "title": "就诊要带什么",
        "tags": ["带什么", "材料", "证件", "校园卡"],
        "content": [
            "校园卡或身份证",
            "医保电子凭证（想要医保结算时出示）",
            "既往病历、检查报告、正在服用的药物清单",
        ],
    },
    {
        "id": "emergency",
        "title": "什么时候去急诊",
        "tags": ["急诊", "紧急", "救命", "什么时候"],
        "content": [
            "剧烈胸痛、呼吸困难、意识不清、抽搐、大出血、严重外伤",
            "高热不退伴精神差、剧烈腹痛、呕吐不止",
            "出现以上情况不要等门诊号，直接到急诊或拨打 120",
        ],
    },
]


# ---------------- 检索与查询 ----------------

def _match(text, tags, title):
    text = (text or "").lower()
    if not text:
        return 0
    score = 0
    if any(t.lower() in text or text in t.lower() for t in tags):
        score += 3
    for word in tags:
        if word and word.lower() in text:
            score += 2
    if title.lower() in text:
        score += 2
    return score


def search_insurance(query=""):
    query = (query or "").strip()
    if not query:
        return INSURANCE
    scored = [(_match(query, item["tags"], item["title"]), item) for item in INSURANCE]
    hits = [(s, item) for s, item in scored if s > 0]
    hits.sort(key=lambda x: -x[0])
    return [item for _, item in hits] or INSURANCE[:2]


def search_faq(query=""):
    query = (query or "").strip()
    if not query:
        return FAQ
    scored = [(_match(query, item["tags"], item["title"]), item) for item in FAQ]
    hits = [(s, item) for s, item in scored if s > 0]
    hits.sort(key=lambda x: -x[0])
    return [item for _, item in hits]


def hospital_brief():
    return {
        "name": HOSPITAL["name"],
        "address": HOSPITAL["address"],
        "hours": HOSPITAL["hours"],
        "notes": HOSPITAL["notes"],
        "phone": HOSPITAL["phone"],
        "disclaimer": DISCLAIMER,
    }


def insurance_brief(query=""):
    items = search_insurance(query)
    return {
        "items": [{"id": i["id"], "title": i["title"], "content": i["content"]} for i in items],
        "disclaimer": DISCLAIMER,
    }


def current_period(now=None):
    now = now or datetime.datetime.now()
    if 8 <= now.hour < 12:
        return "上午", "门诊进行中"
    if 12 <= now.hour < 14:
        return None, "午间休息，14:00 恢复门诊"
    if 14 <= now.hour < 17:
        return "下午", "门诊进行中"
    if 17 <= now.hour < 18:
        return "下午", "临近下班，17:30 门诊结束"
    return None, "门诊已结束（急诊 24 小时开放）"


def on_duty(conn, now=None):
    """返回当前（或最近一次）值班医生列表。"""
    now = now or datetime.datetime.now()
    today = now.date()
    period, status = current_period(now)

    dates = [(today + datetime.timedelta(days=i)).isoformat() for i in range(0, 8)]
    used_date = None
    used_period = period

    def query(date_str, period_name):
        return conn.execute(
            """
            SELECT d.id AS doctor_id, d.name, d.title, d.specialty,
                   dep.name AS department, s.period, s.start_time, s.end_time,
                   s.room, s.remain, s.date
            FROM schedules AS s
            JOIN doctors AS d ON d.id = s.doctor_id
            JOIN departments AS dep ON dep.id = d.department_id
            WHERE s.date = ? AND s.period = ?
            ORDER BY dep.id, d.id
            """,
            (date_str, period_name),
        ).fetchall()

    rows = []
    if period:
        for date_str in dates:
            found = query(date_str, period)
            if found:
                rows = found
                used_date = date_str
                used_period = period
                break
    if not rows:
        for date_str in dates:
            for pname, _, _ in PERIODS:
                found = query(date_str, pname)
                if found:
                    rows = found
                    used_date = date_str
                    used_period = pname
                    break
            if rows:
                break

    return {
        "status": status,
        "now": now.strftime("%Y-%m-%d %H:%M"),
        "date": used_date,
        "period": used_period,
        "is_today": used_date == today.isoformat(),
        "doctors": [dict(r) for r in rows],
        "disclaimer": DISCLAIMER,
    }
