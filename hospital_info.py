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

HOSPITAL_INTRO = """郑州大学医院作为学校直属单位，是一所集医疗、疾病预防、康复、健康教育、健康管理为一体的二级综合性医院。是省市医疗保险定点单位，省直公务员健康体检定点单位，中国高等教育学会保健医学分会常务理事单位，河南省学校卫生学会理事长单位，教育部首批全国健康学校建设单位和首批急救教育试点单位。医院以主校区为中心，设有北校区、南校区和东校区三个门诊部，形成“一院四区”的发展格局，本着“护佑师生健康，共筑健康校园”的办院理念，承担校内近8万名师生、家属及校外周边社区居民的医疗保健工作。

医院现有床位102张，医疗专业技术人员106人，其中正高职称6人，副高级职称19人。设有急诊医学科、内科（呼吸内科；消化内科；神经内科；心血管内科）、外科（普通外科；骨科）、口腔科、皮肤科、妇产科、耳鼻咽喉科、眼科、康复理疗科、中西医结合科、疼痛科、成人预防接种门诊、体检科、疾病预防控制科等15个临床科室，设有药剂科、检验科、医学影像科（X线诊断专业；CT诊断专业；超声诊断专业；心电诊断专业）、综合病房、消毒供应中心、门诊输液中心等6个医技科室。

医疗设备先进，助力师生健康。近年来，医院先后引进西门子64排螺旋CT、西门子数字化X线成像诊断系统（DR)、数字化胃肠机、PCR方舱实验室、移动（床旁）DR、法国声科超声诊断仪、西门子超声诊断仪、GE超声诊断仪、迈瑞全自动血球分析仪、法国ABX全自动血球分析仪、全自动生化分析仪、安图全自动化学发光检测仪、经颅多普勒血流分析仪（TCD）、碳13呼气检测仪（幽门螺旋杆菌检测）、双能骨密度检测仪、裂隙灯、口腔手术显微镜、口腔锥体束CT、数字化牙片系统、电子喉镜、中耳功能分析仪（声导抗）、速效鼓膜治疗仪、半导体激光治疗仪，微波高频两用治疗仪、强脉冲光治疗仪、体外反搏仪、脊柱无创减压理疗仪、红蓝光治疗仪、移动体检车等先进医疗仪器设备，为患者就医提供便捷、高效的医疗服务。

加强临床专科建设，诊疗服务水平持续提升。结合服务人群的健康特点和疾病谱，医院梳理明确医院基本医疗服务重点内容、发展方向和目标，持续推进内科、外科和妇科等综合科室建设，重点加强医院口腔科、耳鼻咽喉科、皮肤科、眼科、中医理疗科等临床专科建设，鼓励和引导开展新业务、新技术和新项目，持续提升诊疗水平和能力。目前，医院“强专科、小综合”发展模式初显成效，社会效益、经济效益和品牌效应均大幅度提升。

创新实践，学校健康教育工作成效突出。围绕艾滋病、肺结核、乙肝、HPV感染、急救教育等校园常见的传染病防控内容为重点，多渠道开展健康教育、多形式开展健康实践活动、多途径加强健康教育教学能力建设。牢固树立健康第一的教育理念，积极开展校园应急救护知识与技能培训，为社会培养乐于施救、敢于施救、善于施救的人员，提高师生自救互救知识和技能，保障师生生命健康。近年来，我院积极创新校园艾滋病防控工作新路径，以强化宣传教育和重点人群综合干预服务为重点，逐步建立了具有河南特色的学生艾滋病健康教育和精准干预的“郑大模式”，取得了良好效果。诸多有效工作模式、如新生入学HIV抗体自愿检测、“互联网+”重点人群综合干预服务、校园无接触免费检测等在省内外高校推广，我校艾滋病防控工作得到了教育部和省市教育卫生行政部门的肯定和认可，多次在全国高校会议上做典型经验交流与分享，为全国高校艾滋病防控工作提供“郑大经验”。"""

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
        "线上预约成功后，请在就诊时段前 15 分钟到一楼挂号/收费窗口取号",
    ],
}

FLOW = [
    ("线上预约", "在「科室」中选择科室 → 医生 → 时段，确认后生成预约号"),
    ("到院取号", "就诊时段前 15 分钟到一楼挂号/收费窗口凭预约号取号（无自助取号机）"),
    ("候诊就诊", "按叫号进入对应诊室，携带既往检查资料"),
    ("结算取药", "校医院为医保定点，可直接刷校园卡/医保电子凭证结算"),
]

REFUND_RULES = [
    "就诊日前一天 23:00 前，可在「我的预约」中直接取消，号源立即释放",
    "就诊当天如需退号，请到一楼导诊台办理，线上不再支持取消",
    "爽约（预约未到且未退号）累计 3 次，将限制 30 天内线上预约",
]

# ---------------- 来院指引（交通 + 楼层分布，合并原"楼层分布"与"导航指引"） ----------------

# ---------------- 楼层与科室分布（依据院内一楼平面图整理） ----------------
# 一层科室名称取自门诊楼一楼平面图；二至四层仅有消防疏散图（房间编号），不臆造科室对应。

FLOORS = [
    {"floor": "一楼 · 口腔诊疗区", "items": ["口腔科", "口腔颌面外科", "口腔正畸科", "口腔修复", "医疗美容科"]},
    {"floor": "一楼 · 门诊诊疗区", "items": ["皮肤科", "内科", "外科 1", "外科 2", "骨科", "换药室", "输液室"]},
    {"floor": "一楼 · 医技检查区", "items": ["医学影像科", "CT 机房", "C 臂机房", "数字胃肠机房", "模拟机房"]},
    {"floor": "一楼 · 急诊与药房", "items": ["急诊室", "药房", "中医科", "康复理疗科", "体检中心", "计划免疫", "中控室"]},
    {"floor": "一楼 · 公共设施", "items": ["大门", "中心花园", "电梯", "楼梯", "卫生间", "安全出口"]},
    {"floor": "二层", "items": ["房间编号 201–226", "具体科室以院内指示牌为准"]},
    {"floor": "三层", "items": ["房间编号 301–324", "具体科室以院内指示牌为准"]},
    {"floor": "四层", "items": ["房间编号 401–426", "具体科室以院内指示牌为准"]},
]

ACCESS = {
    "transport": [],
    "floors": FLOORS,
    "tips": [
        "就诊请携带校园卡或身份证，医保结算需出示医保电子凭证",
        "门急诊药房、急诊室、体检中心均在一楼",
        "科室分布依据院内一楼平面图整理，二至四层请以院内指示牌为准",
    ],
    "note": "一楼科室名称取自门诊楼一楼平面图；二至四层为消防疏散图中的房间编号，未标注科室。",
}


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
        "intro": HOSPITAL_INTRO,
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


def hospital_access():
    return {
        "name": HOSPITAL["name"],
        "address": HOSPITAL["address"],
        "intro": HOSPITAL_INTRO,
        "transport": ACCESS["transport"],
        "floors": ACCESS["floors"],
        "tips": ACCESS["tips"],
        "note": ACCESS["note"],
        "disclaimer": DISCLAIMER,
    }


# ---------------- 院内导航（依据一楼平面图的相对位置） ----------------

NAV_AREAS = [
    {
        "key": "dental",
        "name": "口腔诊疗区",
        "floor": "一楼",
        "rect": [16, 36, 86, 64],
        "depts": ["口腔科", "口腔颌面外科", "口腔正畸科", "口腔修复", "医疗美容科"],
        "steps": ["从大门进入门诊楼", "沿通道向左（西侧）走", "经过中心花园左侧连廊",
                  "到达口腔诊疗区（西北侧）"],
    },
    {
        "key": "clinic",
        "name": "门诊诊疗区",
        "floor": "一楼",
        "rect": [110, 18, 150, 52],
        "depts": ["内科", "外科", "骨科", "皮肤科", "换药室", "输液室"],
        "steps": ["从大门进入门诊楼", "沿主通道直行，穿过中心花园", "到北侧走廊后向东",
                  "到达门诊诊疗区（内科、外科、皮肤科、骨科）"],
    },
    {
        "key": "imaging",
        "name": "医技检查区",
        "floor": "一楼",
        "rect": [246, 84, 62, 70],
        "depts": ["医学影像科", "超声科", "检验科", "放射科", "CT 机房", "C 臂机房"],
        "steps": ["从大门进入门诊楼", "沿通道向右（东侧）走", "经中心花园东侧连廊",
                  "到达医技检查区（影像、检验、超声）"],
    },
    {
        "key": "emergency",
        "name": "急诊与药房区",
        "floor": "一楼",
        "rect": [196, 166, 112, 40],
        "depts": ["急诊室", "药房", "中医科", "康复理疗科（疼痛科）", "体检科"],
        "steps": ["从大门进入门诊楼", "沿通道向右（东侧）前行至南侧走廊",
                  "到达急诊与药房区（急诊室、药房、中医科、康复理疗科、体检中心）"],
    },
    {
        "key": "vaccine",
        "name": "计划免疫区",
        "floor": "一楼",
        "rect": [28, 166, 86, 40],
        "depts": ["成人预防接种门诊"],
        "steps": ["从大门进入门诊楼", "沿通道向左（西侧）走到西南角",
                  "到达计划免疫 / 成人预防接种门诊"],
    },
]

NAV_LANDMARKS = {
    "gate": {"label": "大门", "rect": [140, 212, 64, 18]},
    "garden": {"label": "中心花园", "rect": [112, 96, 76, 54]},
    "elevator": {"label": "电梯", "rect": [196, 96, 16, 54]},
}

NAV_UNKNOWN = {
    "floor": "未标注",
    "area": None,
    "steps": [
        "该科室在一楼平面图上没有标注具体区域",
        "请先到一楼导诊台确认所在楼层与位置",
        "或乘电梯后按院内指示牌前往",
    ],
}


def nav_areas():
    return [
        {"key": a["key"], "name": a["name"], "floor": a["floor"],
         "rect": a["rect"], "depts": a["depts"]}
        for a in NAV_AREAS
    ]


def nav_for(dept_name):
    """按科室名返回导航信息。"""
    dept_name = (dept_name or "").strip()
    for area in NAV_AREAS:
        if dept_name in area["depts"]:
            return {
                "dept": dept_name,
                "found": True,
                "floor": area["floor"],
                "area": {"key": area["key"], "name": area["name"], "rect": area["rect"]},
                "steps": area["steps"],
                "landmarks": NAV_LANDMARKS,
                "note": "路线依据一楼平面图的相对位置整理，具体诊室号请以院内指示牌为准。",
            }

    # 同科室名不完全匹配时的兜底（如"康复理疗科"对应"康复理疗科（疼痛科）"）
    for area in NAV_AREAS:
        for d in area["depts"]:
            if dept_name and (dept_name in d or d in dept_name):
                return {
                    "dept": dept_name,
                    "found": True,
                    "floor": area["floor"],
                    "area": {"key": area["key"], "name": area["name"], "rect": area["rect"]},
                    "steps": area["steps"],
                    "landmarks": NAV_LANDMARKS,
                    "note": "路线依据一楼平面图的相对位置整理，具体诊室号请以院内指示牌为准。",
                }

    return {
        "dept": dept_name,
        "found": False,
        "floor": NAV_UNKNOWN["floor"],
        "area": None,
        "steps": NAV_UNKNOWN["steps"],
        "landmarks": NAV_LANDMARKS,
        "note": "该科室未在一楼平面图标注，请以院内指示牌为准。",
    }
