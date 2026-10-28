"""校医院知识库（AI 客服的信息来源）。

设计原则（对应需求文档）：
1. 每条知识都带 **来源** 和 **是否已核实**，回答时一并展示
2. 检索不到就明确说"知识库暂未收录"，引导官方渠道，**绝不编造**
3. 按类别组织：门诊信息 / 科室信息 / 就诊指南 / 医保服务 / 检查与体检 / 常见问题

⚠️ verified=False 表示该条目为原型演示内容，尚未与医院官方公告核对，
   回答时必须提示"未核实，请以官方通知为准"。
"""

CATEGORIES = ["门诊信息", "科室信息", "就诊指南", "医保服务", "检查与体检", "常见问题"]

SOURCE_OFFICIAL = "郑州大学医院官网 ai.xhis.com.cn"
SOURCE_DEMO = "原型演示知识库"
SOURCE_POLICY = "医保政策示例（以当年政策与医院结算为准）"

KB = [
    # ---------------- 门诊信息 ----------------
    {
        "id": "hours",
        "category": "门诊信息",
        "title": "门诊时间",
        "tags": ["门诊时间", "几点", "上班", "下班", "营业", "开门", "坐诊时间", "什么时候"],
        "content": [
            "普通门诊：周一至周五 上午 08:00–12:00，下午 14:00–17:30",
            "挂号截止：上午 11:30、下午 17:00 停止挂当日号",
        ],
        "source": SOURCE_DEMO,
        "verified": False,
    },
    {
        "id": "weekend",
        "category": "门诊信息",
        "title": "周末与节假日安排",
        "tags": ["周末", "周六", "周日", "节假日", "放假", "假期", "能不能看病"],
        "content": [
            "周六上午 08:00–12:00 部分科室开诊，具体以当日排班为准",
            "周日及法定节假日门诊停诊，仅保留急诊",
        ],
        "source": SOURCE_DEMO,
        "verified": False,
        "hint": "节假日调整通常另行通知，建议以医院公告为准",
    },
    {
        "id": "emergency-hours",
        "category": "门诊信息",
        "title": "急诊安排",
        "tags": ["急诊", "夜间", "晚上", "半夜", "24小时", "急救"],
        "content": [
            "急诊 24 小时开放，节假日不休",
            "出现剧烈胸痛、呼吸困难、意识不清、抽搐、大出血、严重外伤，请直接到急诊或拨打 120",
        ],
        "source": SOURCE_DEMO,
        "verified": False,
    },
    # ---------------- 科室信息 ----------------
    {
        "id": "dept-overview",
        "category": "科室信息",
        "title": "开设科室一览",
        "tags": ["科室", "有哪些科", "开什么科", "科室列表", "能看什么病"],
        "content": [
            "医院开设 14 个科室：内科、外科、口腔科、皮肤科、眼科、耳鼻咽喉科、"
            "康复理疗科（疼痛科）、成人预防接种门诊、体检科、超声科、检验科、放射科、妇科、中医科",
        ],
        "source": SOURCE_OFFICIAL + " 科室介绍 / 专家介绍",
        "verified": True,
    },
    {
        "id": "dept-location",
        "category": "科室信息",
        "title": "楼层与位置",
        "tags": ["在哪", "几楼", "楼层", "位置", "地址", "怎么走", "口腔科在哪"],
        "content": [
            "门诊科室集中在门诊楼，医技科室（超声科、检验科、放射科）在医技楼，体检科在体检中心",
            "各诊室具体门牌在挂号单与楼层指示牌上标明",
        ],
        "source": SOURCE_DEMO,
        "verified": False,
        "hint": "官网楼层分布为图片，具体房间号请以院内指示牌为准",
    },
    # ---------------- 就诊指南 ----------------
    {
        "id": "booking-flow",
        "category": "就诊指南",
        "title": "挂号与就诊流程",
        "tags": ["挂号", "怎么预约", "流程", "怎么看医生", "预约流程", "看病的步骤"],
        "content": [
            "1. 线上预约：首页「科室」→ 选科室 → 选医生 → 选时段 → 确认",
            "2. 到院取号：就诊时段前 15 分钟到一楼挂号/收费窗口凭预约号取号（无自助取号机）",
            "3. 候诊就诊：按叫号进入对应诊室",
            "4. 结算取药：校医院为医保定点，可刷校园卡或医保电子凭证",
        ],
        "source": SOURCE_DEMO,
        "verified": False,
    },
    {
        "id": "what-to-bring",
        "category": "就诊指南",
        "title": "就诊需要带什么",
        "tags": ["带什么", "学生证", "校园卡", "身份证", "证件", "材料"],
        "content": [
            "校园卡或身份证（学生就诊必备）",
            "医保电子凭证（需要医保结算时出示）",
            "既往病历、检查报告、正在服用的药物清单",
        ],
        "source": SOURCE_DEMO,
        "verified": False,
    },
    {
        "id": "refund",
        "category": "就诊指南",
        "title": "退号与爽约规则",
        "tags": ["退号", "取消预约", "爽约", "不想去了", "临时有事", "改时间"],
        "content": [
            "就诊日前一天 23:00 前，可在「我的预约」中直接取消，号源立即释放",
            "就诊当天退号请到一楼导诊台办理，线上不再支持取消",
            "爽约（预约未到且未退号）累计 3 次，将限制 30 天内线上预约",
        ],
        "source": SOURCE_DEMO,
        "verified": False,
    },
    {
        "id": "no-dept",
        "category": "就诊指南",
        "title": "校医院没有相关科室怎么办",
        "tags": ["没有相关科室", "看不了", "转诊", "大医院", "外院", "进一步就医"],
        "content": [
            "校医院无法处理的疾病，可由医生开具转诊单，转到上级医院就诊",
            "转诊后再回校报销，材料要求见「医保服务 · 报销流程」",
            "急重症不必等转诊，直接前往上级医院急诊或拨打 120",
        ],
        "source": SOURCE_DEMO,
        "verified": False,
    },
    # ---------------- 医保服务 ----------------
    {
        "id": "insurance-join",
        "category": "医保服务",
        "title": "大学生医保怎么参加",
        "tags": ["参保", "大学生医保", "缴费", "怎么交", "医保怎么办"],
        "content": [
            "全日制学生按学年参加郑州市城乡居民基本医疗保险（大学生档），由学校统一组织参保",
            "个人缴费部分按当年标准缴纳（近年为每年数百元，具体以当年通知为准）",
            "参保后在定点医疗机构（含校医院）就医可享受医保待遇",
        ],
        "source": SOURCE_POLICY,
        "verified": False,
    },
    {
        "id": "insurance-outpatient",
        "category": "医保服务",
        "title": "门诊能报多少",
        "tags": ["医保", "报销", "能报多少", "比例", "省钱", "多少钱", "门诊统筹", "门诊报销"],
        "content": [
            "校医院是医保定点机构，普通门诊费用在政策范围内按比例报销（门诊统筹）",
            "示例：政策范围内费用 100 元，按 60% 比例报销，个人自付约 40 元",
            "报销有起付线（每年先自付一定金额）和年度封顶线",
            "挂号费、诊察费、药品、检查是否纳入报销，按医保目录执行",
        ],
        "source": SOURCE_POLICY,
        "verified": False,
        "hint": "具体比例与金额必须到窗口结算时确认",
    },
    {
        "id": "insurance-deductible",
        "category": "医保服务",
        "title": "起付线与封顶线",
        "tags": ["起付线", "封顶线", "门槛", "自付", "限额"],
        "content": [
            "起付线：一年内门诊费用累计超过该金额后，超出部分才按比例报销",
            "封顶线：一年内医保基金最高支付限额，超出部分自付",
            "校医院属于基层定点机构，报销比例通常优于上级医院",
        ],
        "source": SOURCE_POLICY,
        "verified": False,
    },
    {
        "id": "insurance-flow",
        "category": "医保服务",
        "title": "报销流程与所需材料",
        "tags": ["报销流程", "怎么报销", "结算", "刷医保", "电子凭证", "材料"],
        "content": [
            "校医院就诊：结算时出示医保电子凭证或校园卡，系统直接结算，只付自付部分",
            "校外就诊：保留发票、费用明细、病历/处方，按学校医保办要求提交材料",
            "转诊需校医院开具转诊单，否则报销比例可能降低",
        ],
        "source": SOURCE_POLICY,
        "verified": False,
    },
    {
        "id": "insurance-selfpay",
        "category": "医保服务",
        "title": "哪些项目不报销",
        "tags": ["自费", "不报", "体检", "疫苗", "美容", "自付项目"],
        "content": [
            "健康体检、入职体检通常为自费",
            "疫苗接种（免疫规划疫苗除外）、整形美容、配镜、非医保目录药品需自费",
            "超出医保目录范围的治疗项目自费",
        ],
        "source": SOURCE_POLICY,
        "verified": False,
    },
    {
        "id": "insurance-remote",
        "category": "医保服务",
        "title": "异地就医（寒暑假在家看病）",
        "tags": ["异地", "备案", "外地就医", "寒暑假", "回家看病"],
        "content": [
            "建议提前在「国家医保服务平台」APP 办理异地就医备案",
            "备案后在就医地定点医院可直接结算；未备案需回校手工报销，比例可能下降",
        ],
        "source": SOURCE_POLICY,
        "verified": False,
    },
    # ---------------- 检查与体检 ----------------
    {
        "id": "checkup-flow",
        "category": "检查与体检",
        "title": "体检怎么预约",
        "tags": ["体检", "体检预约", "体检流程", "体检科", "提前预约"],
        "content": [
            "体检科在体检中心，团体/个人体检建议提前预约，约体检科号后到院确认项目",
            "部分项目要求空腹（如抽血、腹部超声），具体以体检通知为准",
        ],
        "source": SOURCE_DEMO,
        "verified": False,
    },
    {
        "id": "exam-prep",
        "category": "检查与体检",
        "title": "检查注意事项（B超/检验/放射）",
        "tags": ["B超", "超声", "抽血", "检验", "放射", "X线", "CT", "检查", "空腹", "能不能做检查"],
        "content": [
            "腹部超声、抽血化验一般需空腹 8 小时以上",
            "放射检查（X 线/CT）需去除金属物品，孕妇请提前告知医生",
            "检查报告领取时间以科室告知为准",
        ],
        "source": SOURCE_DEMO,
        "verified": False,
    },
    {
        "id": "vaccine",
        "category": "检查与体检",
        "title": "成人预防接种",
        "tags": ["疫苗", "接种", "流感疫苗", "乙肝", "预防接种"],
        "content": [
            "成人预防接种门诊提供流感、乙肝等疫苗接种咨询与评估",
            "接种前需告知过敏史与近期用药情况；部分疫苗为自费项目",
        ],
        "source": SOURCE_DEMO,
        "verified": False,
    },
    # ---------------- 常见问题 ----------------
    {
        "id": "contact",
        "category": "常见问题",
        "title": "联系方式与地址",
        "tags": ["电话", "联系方式", "地址", "在哪", "咨询电话", "找不到"],
        "content": [
            "医院位于郑州大学主校区，门诊楼一楼设导诊台",
            "门诊咨询与退号等事务到一楼导诊台办理；急救请拨打 120",
        ],
        "source": SOURCE_DEMO,
        "verified": False,
    },
    {
        "id": "on-duty-faq",
        "category": "常见问题",
        "title": "现在谁在上班（值班医生）",
        "tags": ["值班", "谁在", "现在有医生", "今天有谁", "在诊", "有医生吗", "坐诊"],
        "content": ["值班医生为实时排班数据，由系统按当前时间查询，见下方排班结果"],
        "source": "排班系统实时数据",
        "verified": True,
        "tool": "on_duty",
    },
]


def kb_categories():
    from collections import Counter
    c = Counter(item["category"] for item in KB)
    return [{"name": name, "count": c[name]} for name in CATEGORIES if c[name]]


GENERIC_TAGS = {
    "几点", "什么时候", "上班", "下班", "开门", "营业", "能不能看病",
    "多少钱", "材料", "地址", "在哪", "什么", "有医生吗", "谁上班",
    "能不能", "怎么办", "怎么", "可以吗",
}

SCORE_THRESHOLD = 4


def kb_search(query="", category="", limit=3):
    """按关键词检索知识库；只认足够具体的关键词，避免无关问题被误匹配。"""
    query = (query or "").strip()
    pool = [item for item in KB if not category or item["category"] == category]
    if not query:
        return []

    TIME_INTENT_WORDS = ["几点", "下班", "上班", "开门", "关门", "营业", "门诊时间", "时间"]
    OUT_OF_SCOPE_WORDS = ["食堂", "图书馆", "超市", "宿舍", "快递", "教室", "澡堂"]
    out_of_scope = any(w in query for w in OUT_OF_SCOPE_WORDS)
    time_intent = any(w in query for w in TIME_INTENT_WORDS) and not out_of_scope

    scored = []
    for item in pool:
        score = 0
        for tag in item["tags"]:
            if tag in query and tag not in GENERIC_TAGS:
                score += 3 + len(tag)
        # 时间意图：即使只说了"几点/下班"这种泛化词，也优先命中门诊时间
        if time_intent and item["id"] in ("hours", "weekend", "emergency-hours"):
            score += 6
        if out_of_scope:
            score = 0
        if item["title"] in query:
            score += 8
        if score >= SCORE_THRESHOLD:
            scored.append((score, item))

    scored.sort(key=lambda x: -x[0])
    return [item for _, item in scored[:limit]]


def kb_get(item_id):
    for item in KB:
        if item["id"] == item_id:
            return item
    return None


def kb_list(category=""):
    return [
        {
            "id": i["id"],
            "category": i["category"],
            "title": i["title"],
            "source": i["source"],
            "verified": i["verified"],
        }
        for i in KB
        if not category or i["category"] == category
    ]


def format_answer(items, max_items=2):
    """把知识条目格式化为回答文本（含来源标注）。"""
    parts = []
    sources = []
    for item in items[:max_items]:
        parts.append("【" + item["title"] + "】")
        parts.extend("· " + line for line in item["content"])
        if item.get("hint"):
            parts.append("⚠️ " + item["hint"])
        note = "已核实" if item["verified"] else "提示：该条为演示数据，未与官方公告核对"
        parts.append("来源：" + item["source"] + "（" + note + "）")
        sources.append({"title": item["title"], "source": item["source"], "verified": item["verified"]})
    return "\n".join(parts), sources


NO_ANSWER = (
    "这个问题我的知识库里暂时没有收录，我不能凭空给你一个答案。\n"
    "建议通过以下方式确认：\n"
    "· 一楼导诊台当面咨询（最准确）\n"
    "· 医院官网 ai.xhis.com.cn 查看公告\n"
    "· 紧急情况直接到急诊或拨打 120\n\n"
    "你也可以换个说法再问我，我看看能不能匹配到相关条目。"
)
