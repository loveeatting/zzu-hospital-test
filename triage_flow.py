"""多轮鉴别问诊引擎（规则版）。

思路：
1. 用户先描述症状 → 先做"初步判断"，落到某个症状群（如呼吸道 / 消化 / 骨骼肌肉）
2. 追问 1-3 个**鉴别性问题**（每个问题都有区分度，能把候选科室分开）
3. 综合初始描述 + 所有回答打分，分数差距足够大才给结论
4. 分数不够或问题问完仍接近 → 给最可能的科室 + 提示"到导诊台确认"

设计要点：
- 无状态：每次从完整对话历史重算，不依赖会话存储（可水平扩展）
- 选项用短标签（前端可作为快捷按钮点选），点选后文本与选项标签精确对应
- 急重症由 agent.py 前置拦截，本模块不处理
"""

DEPARTMENTS = ["内科", "外科", "口腔科", "皮肤科", "眼科", "耳鼻咽喉科",
               "康复理疗科（疼痛科）", "妇科", "中医科"]

# 症状群：关键词命中即进入该群，primary 为该群的候选科室
GROUPS = [
    {
        "id": "respiratory",
        "name": "呼吸道/咽喉问题",
        "keywords": ["发烧", "发热", "咳嗽", "咳痰", "感冒", "流涕", "鼻涕", "鼻塞",
                     "咽痛", "嗓子", "喉咙", "头痛", "头疼", "头晕", "眩晕", "乏力", "酸痛", "打喷嚏"],
        "primary": {"内科": 4, "耳鼻咽喉科": 2},
        "questions": [
            {
                "id": "fever",
                "text": "现在有发烧吗？大概多少度？",
                "options": [
                    {"label": "38.5度以上", "weights": {"内科": 3}},
                    {"label": "37.3到38.5度", "weights": {"内科": 2}},
                    {"label": "不发烧", "weights": {"耳鼻咽喉科": 1}},
                ],
            },
            {
                "id": "cough",
                "text": "咳嗽有痰吗？",
                "options": [
                    {"label": "干咳没有痰", "weights": {"内科": 1, "耳鼻咽喉科": 1}},
                    {"label": "有黄痰", "weights": {"内科": 2}},
                    {"label": "基本不咳嗽", "weights": {"耳鼻咽喉科": 2}},
                ],
            },
            {
                "id": "focus",
                "text": "主要是嗓子疼，还是鼻子不舒服？",
                "options": [
                    {"label": "嗓子疼明显", "weights": {"耳鼻咽喉科": 3}},
                    {"label": "鼻塞流涕明显", "weights": {"耳鼻咽喉科": 2, "内科": 1}},
                    {"label": "两者都有", "weights": {"内科": 1}},
                ],
            },
        ],
        "advice": "多喝水、注意休息；若持续高热超过 3 天或出现呼吸费力，请尽快就诊。",
        "likely": "上呼吸道感染、咽炎或过敏性鼻炎",
    },
    {
        "id": "digestive",
        "name": "腹痛/消化问题",
        "keywords": ["腹痛", "肚子疼", "肚子痛", "胃痛", "胃疼", "腹泻", "拉肚子",
                     "恶心", "呕吐", "便秘", "反酸", "烧心", "胃胀", "消化不良"],
        "primary": {"内科": 4, "外科": 1},
        "questions": [
            {
                "id": "location",
                "text": "疼痛主要在哪个位置？",
                "options": [
                    {"label": "上腹部（胃的位置）", "weights": {"内科": 3}},
                    {"label": "右下腹", "weights": {"外科": 3, "内科": -1}},
                    {"label": "肚脐周围", "weights": {"内科": 2}},
                ],
            },
            {
                "id": "stool",
                "text": "有没有腹泻或呕吐？",
                "options": [
                    {"label": "有腹泻", "weights": {"内科": 2}},
                    {"label": "有呕吐", "weights": {"内科": 2}},
                    {"label": "都没有", "weights": {"内科": 1}},
                ],
            },
            {
                "id": "rebound",
                "text": "按压腹部会更疼吗？",
                "options": [
                    {"label": "按下去很疼，松手更疼", "weights": {"外科": 3}},
                    {"label": "按压只是不太舒服", "weights": {"内科": 1}},
                    {"label": "没试过", "weights": {}},
                ],
            },
        ],
        "advice": "腹泻注意补充水分和电解质；若出现剧烈腹痛、便血或持续呕吐，请尽快就诊。",
        "likely": "急性胃肠炎、胃炎或腹部其他问题",
    },
    {
        "id": "musculoskeletal",
        "name": "颈肩腰腿/关节问题",
        "keywords": ["腰疼", "腰痛", "颈椎", "脖子", "肩", "肩膀", "关节", "膝盖",
                     "扭伤", "崴脚", "拉伤", "骨折", "腿疼", "背痛", "落枕", "疼痛"],
        "primary": {"外科": 3, "康复理疗科（疼痛科）": 3},
        "questions": [
            {
                "id": "cause",
                "text": "是最近受伤（扭到、摔倒）还是慢慢疼起来的？",
                "options": [
                    {"label": "有明确受伤", "weights": {"外科": 3}},
                    {"label": "慢慢加重的酸痛", "weights": {"康复理疗科（疼痛科）": 3}},
                ],
            },
            {
                "id": "activity",
                "text": "活动时疼，还是休息时也疼？",
                "options": [
                    {"label": "动的时候疼，休息好些", "weights": {"康复理疗科（疼痛科）": 2, "外科": 1}},
                    {"label": "不动也疼，夜间明显", "weights": {"外科": 2}},
                ],
            },
            {
                "id": "swelling",
                "text": "有没有肿胀或淤青？",
                "options": [
                    {"label": "有肿胀或淤青", "weights": {"外科": 2}},
                    {"label": "没有肿胀", "weights": {"康复理疗科（疼痛科）": 1}},
                ],
            },
        ],
        "advice": "急性扭伤 48 小时内冷敷、减少活动；如无法负重行走或明显畸形，请尽快就诊。",
        "likely": "软组织损伤、腰肌劳损或关节问题",
    },
    {
        "id": "skin",
        "name": "皮肤问题",
        "keywords": ["皮疹", "疹子", "痒", "湿疹", "痘痘", "痤疮", "过敏", "脱发",
                     "红斑", "风团", "荨麻疹", "皮炎", "癣"],
        "primary": {"皮肤科": 5},
        "questions": [
            {
                "id": "onset",
                "text": "皮疹是突然出现的，还是反复很久了？",
                "options": [
                    {"label": "突然出现", "weights": {"皮肤科": 2}},
                    {"label": "反复很久", "weights": {"皮肤科": 2}},
                ],
            },
            {
                "id": "itch",
                "text": "痒得厉害吗？",
                "options": [
                    {"label": "很痒，影响睡觉", "weights": {"皮肤科": 2}},
                    {"label": "有点痒", "weights": {"皮肤科": 1}},
                    {"label": "基本不痒", "weights": {"皮肤科": 1}},
                ],
            },
            {
                "id": "trigger",
                "text": "最近有没有接触新的食物、药物或化妆品？",
                "options": [
                    {"label": "有接触", "weights": {"皮肤科": 2}},
                    {"label": "没有", "weights": {"皮肤科": 1}},
                ],
            },
        ],
        "advice": "避免搔抓和热水烫洗；如出现面唇肿胀、呼吸困难，请立即急诊。",
        "likely": "荨麻疹、湿疹或过敏性皮炎",
    },
    {
        "id": "eye",
        "name": "眼部问题",
        "keywords": ["眼", "视力", "看不清", "模糊", "干眼", "眼屎", "红眼", "流泪",
                     "眼睛干", "眼涩"],
        "primary": {"眼科": 5},
        "questions": [
            {
                "id": "vision",
                "text": "视力和以前比有明显变化吗？",
                "options": [
                    {"label": "视力明显下降", "weights": {"眼科": 3}},
                    {"label": "只是干涩、异物感", "weights": {"眼科": 2}},
                    {"label": "只是发红有分泌物", "weights": {"眼科": 2}},
                ],
            },
            {
                "id": "pain",
                "text": "眼睛疼吗？有没有畏光？",
                "options": [
                    {"label": "疼，怕光", "weights": {"眼科": 3}},
                    {"label": "不疼，就是不舒服", "weights": {"眼科": 1}},
                ],
            },
        ],
        "advice": "停戴隐形眼镜、减少用眼；如视力突然下降或剧烈眼痛，请尽快就诊。",
        "likely": "结膜炎、干眼或视疲劳",
    },
    {
        "id": "ent",
        "name": "耳鼻喉问题",
        "keywords": ["鼻", "咽", "喉", "耳", "耳鸣", "听力", "鼻血", "扁桃体", "打鼾"],
        "primary": {"耳鼻咽喉科": 5},
        "questions": [
            {
                "id": "part",
                "text": "主要是鼻子、嗓子还是耳朵不舒服？",
                "options": [
                    {"label": "鼻子", "weights": {"耳鼻咽喉科": 2}},
                    {"label": "嗓子", "weights": {"耳鼻咽喉科": 2}},
                    {"label": "耳朵", "weights": {"耳鼻咽喉科": 3}},
                ],
            },
            {
                "id": "duration",
                "text": "这种情况持续多久了？",
                "options": [
                    {"label": "几天以内", "weights": {"耳鼻咽喉科": 2}},
                    {"label": "超过两周", "weights": {"耳鼻咽喉科": 3}},
                ],
            },
        ],
        "advice": "避免用力擤鼻和掏耳；如单侧持续鼻塞伴血性分泌物，请尽快就诊。",
        "likely": "鼻炎、咽炎或中耳问题",
    },
    {
        "id": "dental",
        "name": "口腔问题",
        "keywords": ["牙", "牙龈", "口腔", "溃疡", "智齿", "蛀牙", "龋齿", "口气"],
        "primary": {"口腔科": 6},
        "questions": [
            {
                "id": "kind",
                "text": "主要是牙痛，还是口腔溃疡、牙龈出血？",
                "options": [
                    {"label": "牙疼", "weights": {"口腔科": 3}},
                    {"label": "口腔溃疡", "weights": {"口腔科": 3}},
                    {"label": "牙龈出血", "weights": {"口腔科": 3}},
                ],
            },
            {
                "id": "swelling",
                "text": "有没有脸肿、张口受限或发烧？",
                "options": [
                    {"label": "有肿或发烧", "weights": {"口腔科": 3}},
                    {"label": "都没有", "weights": {"口腔科": 1}},
                ],
            },
        ],
        "advice": "避免过冷过热和辛辣刺激；如面部肿胀、张口受限，请尽快就诊。",
        "likely": "龋齿、牙髓炎或牙周问题",
    },
    {
        "id": "gyn",
        "name": "月经/妇科问题",
        "keywords": ["月经", "痛经", "白带", "妇科", "经期", "停经", "经量"],
        "primary": {"妇科": 6},
        "questions": [
            {
                "id": "bleeding",
                "text": "有没有非经期出血或异常分泌物？",
                "options": [
                    {"label": "有", "weights": {"妇科": 3}},
                    {"label": "没有", "weights": {"妇科": 2}},
                ],
            },
            {
                "id": "pain_level",
                "text": "痛经的程度是？",
                "options": [
                    {"label": "疼到影响上课", "weights": {"妇科": 3}},
                    {"label": "轻微可以忍受", "weights": {"妇科": 1}},
                ],
            },
        ],
        "advice": "经期注意保暖、避免剧烈运动；如停经超过 3 个月或疼痛剧烈，请尽快就诊。",
        "likely": "痛经、月经不调或妇科炎症",
    },
    {
        "id": "tcm",
        "name": "亚健康/调理问题",
        "keywords": ["失眠", "睡不着", "乏力", "调理", "体质", "气血", "湿气",
                     "没精神", "亚健康", "焦虑"],
        "primary": {"中医科": 4, "内科": 1},
        "questions": [
            {
                "id": "main",
                "text": "主要是睡眠不好，还是长期容易累？",
                "options": [
                    {"label": "睡不好", "weights": {"中医科": 2}},
                    {"label": "容易累、没精神", "weights": {"中医科": 2}},
                    {"label": "想调理体质", "weights": {"中医科": 3}},
                ],
            },
            {
                "id": "duration2",
                "text": "这种情况持续多久了？",
                "options": [
                    {"label": "一两周", "weights": {"中医科": 1}},
                    {"label": "一个月以上", "weights": {"中医科": 3}},
                ],
            },
        ],
        "advice": "规律作息、适度运动；若情绪持续低落影响生活，建议到心理健康中心咨询。",
        "likely": "睡眠障碍、慢性疲劳或体质失调",
    },
]

EMERGENCY_HINT = "出现意识改变、呼吸困难、大出血、剧烈胸痛等情况，请不要等待门诊，直接到急诊或拨打 120。"

MIN_QUESTIONS = 2      # 至少追问 2 个鉴别问题才给结论
MAX_QUESTIONS = 3
SEND_THRESHOLD = 6      # 达到该分值且领先第二名足够多才下结论
MARGIN = 3


def _norm(text):
    return (text or "").replace(" ", "").lower()


def detect_group(text):
    """根据文本判断属于哪个症状群，返回 (group, 命中关键词列表)。"""
    t = _norm(text)
    best, best_hits = None, []
    for g in GROUPS:
        hits = [k for k in g["keywords"] if k in t]
        if len(hits) > len(best_hits):
            best, best_hits = g, hits
    return best, best_hits


def _collect(messages):
    """从对话历史里收集：用户说了什么、命中了哪些选项、助手已经问过什么。"""
    user_msgs = [m.get("content", "") for m in messages if m.get("role") == "user"]
    assistant_text = " ".join(m.get("content", "") for m in messages if m.get("role") == "assistant")
    text = " ".join(user_msgs)

    answered = []      # [(group_id, question_id, option_label, weights)]
    for g in GROUPS:
        for q in g["questions"]:
            for opt in q["options"]:
                label = opt["label"]
                if label and label in text:
                    answered.append((g["id"], q["id"], label, opt["weights"]))
                    break
    return user_msgs, text, answered, assistant_text


def _score(group, hits, answered):
    scores = {}
    for dept, w in group["primary"].items():
        scores[dept] = scores.get(dept, 0) + w
    scores_extra = min(len(hits), 3)
    if scores:
        top = max(scores, key=scores.get)
        scores[top] += scores_extra
    for gid, qid, label, weights in answered:
        if gid != group["id"]:
            continue
        for dept, w in weights.items():
            scores[dept] = scores.get(dept, 0) + w
    return {k: v for k, v in scores.items() if v > 0}


def _is_answered(group, answered):
    return {qid for gid, qid, _, _ in answered if gid == group["id"]}


def _dept_id(name, tools):
    try:
        for d in tools["list_departments"]():
            if d["name"] == name:
                return d["id"]
    except Exception:
        pass
    return None


def _confidence(margin):
    if margin >= 5:
        return "高"
    if margin >= 3:
        return "中"
    return "低"


def answer(messages, tools):
    """返回 {reply, card, suggestions, trace}；stage 为 ask / recommend。"""
    user_msgs, text, answered, assistant_text = _collect(messages)

    # 症状群以"首次主诉"为准，后续补充说明不改变大方向（避免"腰疼→补充酸痛"被误判成呼吸道）
    group, hits = detect_group(user_msgs[0]) if user_msgs else (None, [])
    if group is None:
        group, hits = detect_group(text)
    if group is None:
        return None

    scores = _score(group, hits, answered)
    if not scores:
        return None

    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    top_dept, top_score = ranked[0]
    second_score = ranked[1][1] if len(ranked) > 1 else 0
    margin = top_score - second_score

    asked_q = [q for q in group["questions"] if q["text"] and q["text"] in assistant_text]
    pending = [q for q in group["questions"] if q not in asked_q]
    answered_q = _is_answered(group, answered)

    asked_count = len(asked_q)
    symptom_desc = "、".join(hits[:3]) if hits else "你的描述"

    # 条件满足 → 给结论
    confident = (asked_count >= MIN_QUESTIONS and top_score >= SEND_THRESHOLD and margin >= MARGIN)
    done_asking = asked_count >= MAX_QUESTIONS or not pending

    if confident or done_asking:
        dept_id = _dept_id(top_dept, tools)
        conf = _confidence(margin)
        lines = [
            "根据你的描述（%s）%s" % (symptom_desc,
                                "，我已经问得差不多了" if done_asking and not confident else ""),
            "",
            "**建议挂：%s**" % top_dept,
            "可能方向：%s" % group["likely"],
            "判断置信度：%s" % conf,
            "",
            "就诊提示：%s" % group["advice"],
        ]
        if conf == "低":
            lines.append("")
            lines.append("如果不太符合你的情况，可以换个说法重新描述，或直接到一楼导诊台确认。")
        lines.append("")
        lines.append(EMERGENCY_HINT)

        return {
            "stage": "recommend",
            "reply": "\n".join(lines),
            "card": {
                "type": "department",
                "department_id": dept_id,
                "department_name": top_dept,
            },
            "suggestions": ["换一个科室看看", "我的预约", "重新描述症状"],
            "trace": [
                "症状群：" + group["name"],
                "候选：" + "、".join("%s(%d)" % (k, v) for k, v in ranked),
                "已提问 %d 个，置信度 %s" % (asked_count, conf),
            ],
        }

    # 还要继续追问
    q = pending[0]
    options = [o["label"] for o in q["options"]]
    prefix = "你描述的「%s」可能和 **%s** 相关。" % (symptom_desc, group["name"])
    if asked_count > 0:
        prefix = "好的，我再确认一下："
    body = [
        prefix,
        "",
        "第 %d 个问题：%s" % (asked_count + 1, q["text"]),
        "",
        "请选择最接近的一项（也可以直接打字描述）：",
    ]

    return {
        "stage": "ask",
        "reply": "\n".join(body),
        "card": None,
        "suggestions": options + ["都不太符合"],
        "trace": [
            "症状群：" + group["name"],
            "当前打分：" + "、".join("%s(%d)" % (k, v) for k, v in ranked),
            "追问：" + q["id"],
        ],
    }


def is_symptom(messages):
    user_texts = " ".join(m.get("content", "") for m in messages if m.get("role") == "user")
    group, hits = detect_group(user_texts)
    return group is not None and len(hits) > 0
