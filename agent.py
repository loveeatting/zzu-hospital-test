"""AI 导诊智能体：RAG 检索增强 + 大模型 Function Call + 规则兜底。

设计要点
--------
1. 有 DEEPSEEK_API_KEY  → 走大模型多轮 + 工具调用（AI 模式）
2. 无 key / 调用失败    → 自动回退规则引擎（离线可用，保证演示不挂）
3. 急重症拦截          → 在调用模型之前先做规则判定，命中即中断流程
4. RAG              → 从本地知识库检索相关条目，注入 prompt（AI）或直接作答（规则）
"""

import json
import os
import urllib.request

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
MODEL = "deepseek-chat"
MAX_ROUNDS = 4

EMERGENCY_WORDS = [
    # 书面描述
    "剧烈胸痛", "呼吸困难", "昏迷", "大出血", "意识不清",
    "抽搐", "休克", "说不出话", "心跳骤停", "窒息", "咯血", "吐血",
    # 口语/患者原话（很容易被漏掉，必须覆盖）
    "喘不上气", "喘不过气", "透不过气", "上不来气", "胸口压", "胸口被压",
    "压得慌", "胸口像被压", "晕倒", "昏倒", "不省人事", "叫不醒",
    "半边身子", "说话不清", "嘴歪", "抽风", "大量出血", "血流不止",
]

# 需要提高警惕但不必立刻中断流程的措辞：会在回复里追加风险提示
SOFT_WARN_WORDS = [
    "胸闷", "心慌", "心悸", "心跳很快", "高热", "39度", "40度",
    "持续不退", "越来越重", "反复呕吐", "剧烈头痛",
]


def match_words(text, words):
    return [w for w in words if w in text]



EMERGENCY_REPLY = (
    "⚠️ 你描述的情况可能是急重症信号，请不要等待门诊号。\n"
    "请立即前往急诊科，或拨打 120 急救电话。\n"
    "如果是身边的人出现上述情况，请立刻呼救并保持其呼吸道通畅。"
)

# ---------------- 知识库（RAG 检索源） ----------------

KB = [
    {
        "id": "cancel",
        "tags": ["取消", "退号", "改约", "撤销", "退掉", "退了"],
        "text": "取消预约：进入「我的预约」，找到状态为已预约的记录，点「取消预约」。号源会立即退回该时段，可以马上重新预约其他时段。",
    },
    {
        "id": "booking-flow",
        "tags": ["怎么预约", "怎么挂号", "预约流程", "挂号流程", "步骤", "操作"],
        "text": "预约流程：选择科室 → 选择医生 → 选择就诊时段 → 确认就诊人（自动带出学号实名信息）→ 提交预约。预约成功后可在「我的预约」查看预约号和诊室。",
    },
    {
        "id": "arrive",
        "tags": ["提前", "几点", "到院", "取号", "迟到", "晚到"],
        "text": "就诊提示：请提前 15 分钟到达诊室取号，携带校园卡或身份证；迟到可能导致号源作废。",
    },
    {
        "id": "insurance",
        "tags": ["医保", "报销", "费用", "多少钱", "自费", "价格"],
        "text": "费用与报销：校医院就诊按校内规定执行，普通门诊挂号费较低；医保报销比例和范围以校医保办与医院结算窗口的说明为准。",
    },
    {
        "id": "weekend",
        "tags": ["周末", "周六", "周日", "节假日", "晚上", "夜班", "急诊"],
        "text": "门诊时间：普通门诊为工作日上午 08:00-12:00、下午 14:00-17:30；周末与节假日门诊排班以医院公告为准，急诊 24 小时开放。",
    },
    {
        "id": "departments",
        "tags": ["科室", "有哪些", "什么科", "科室介绍"],
        "text": "目前开放科室：内科（高血压、糖尿病、呼吸系统疾病等）、口腔科（牙周、拔牙、修复）、骨科（关节、运动损伤）、眼科（近视、干眼等）。",
    },
    {
        "id": "limit",
        "tags": ["一个人", "几个号", "限号", "重复", "能不能多约"],
        "text": "预约规则：同一就诊人对同一排班只能有一条有效预约；取消后可以重新预约。",
    },
]

STOPWORDS = set("的了吗呢吧啊是有没有我你他她它这那请问一下怎么怎么样可以能否需要帮我")


def retrieve(text, k=2):
    """极简检索：按标签命中打分，返回最相关的 k 条知识。"""
    if not text:
        return []
    scored = []
    for item in KB:
        score = sum(1 for tag in item["tags"] if tag in text)
        if score:
            scored.append((score, item))
    scored.sort(key=lambda x: -x[0])
    return [item for _, item in scored[:k]]


# ---------------- 工具定义（Function Call） ----------------

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_departments",
            "description": "查询医院开放的全部科室列表（id 与名称）。",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_doctors",
            "description": "按科室查询该科室的医生列表。",
            "parameters": {
                "type": "object",
                "properties": {
                    "department_id": {"type": "integer", "description": "科室 id"},
                },
                "required": ["department_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_schedules",
            "description": "查询某位医生未来 7 天的排班与剩余号源。",
            "parameters": {
                "type": "object",
                "properties": {
                    "doctor_id": {"type": "integer", "description": "医生 id"},
                    "date": {"type": "string", "description": "可选，YYYY-MM-DD"},
                },
                "required": ["doctor_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "book_appointment",
            "description": "为当前登录学生预约指定排班（schedule_id）。必须在用户明确表示要预约之后才可调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "schedule_id": {"type": "integer", "description": "排班 id"},
                },
                "required": ["schedule_id"],
            },
        },
    },
]

SYSTEM_PROMPT = """你是郑州大学校医院的门诊导诊助手，用简洁、亲切的中文和同学对话。

你可以调用工具查询科室、医生、排班，并在用户明确同意后代为预约。

工作规则：
1. 先判断症状，必要时追问 1-2 个关键问题（多久了、有没有发烧、哪个部位），不要一次问太多。
2. 判断出科室后，调用 list_doctors 查询医生；用户想看时间时调用 list_schedules。
3. 用户明确说"要预约/帮我约"之后，才可以调用 book_appointment，并且要先把医生、时间、诊室说清楚。
4. 出现剧烈胸痛、呼吸困难、昏迷、大出血、意识不清等危险信号时，立即停止推荐，直接建议急诊并提示拨打 120。
5. 不确定挂哪个科时，建议到门诊导诊台咨询，不要硬猜。
6. 回复控制在 3-5 句，不要输出 JSON，不要编造不存在的医生或号源。
"""


# ---------------- 大模型调用 ----------------

def _post_llm(payload, api_key, timeout=30):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        DEEPSEEK_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + api_key,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _clean(text):
    return "".join(ch for ch in (text or "") if ch not in STOPWORDS)


# ---------------- 规则兜底引擎 ----------------

# 键为真实科室 id（与 init_db.py 的 REAL_DEPARTMENTS 对应）
RULE_DEPT_KEYWORDS = {
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


def rule_chat(messages, tools, knowledge):
    """无大模型时的多轮兜底：累计用户描述 → 分批追问 → 给结论。"""
    user_texts = [m.get("content", "") for m in messages if m.get("role") == "user"]
    all_text = " ".join(user_texts)

    emergency = match_words(all_text, EMERGENCY_WORDS)
    if emergency:
        return {
            "reply": EMERGENCY_REPLY,
            "source": "rule",
            "card": None,
            "suggestions": ["查看科室", "了解预约流程"],
            "trace": ["急重症关键词命中：" + "、".join(emergency)],
        }

    soft = match_words(all_text, SOFT_WARN_WORDS)

    def with_warning(payload):
        if soft:
            payload["reply"] = (
                "⚠️ 你提到「" + "、".join(soft) + "」，"
                "如果持续不缓解或加重（出冷汗、脸色苍白、说话费力），请立即去急诊。\n\n"
                + payload["reply"]
            )
            payload.setdefault("trace", []).append("风险提示：" + "、".join(soft))
        return payload

    # 知识类问题优先回答
    kb_hits = [item for item in knowledge if item["id"] not in ("departments",)]
    if kb_hits and len(user_texts) >= 1:
        text = kb_hits[0]["text"]
        return {
            "reply": text,
            "source": "rule",
            "card": None,
            "suggestions": ["我想预约", "有哪些科室"],
            "trace": ["知识库命中：" + kb_hits[0]["id"]],
        }

    scores = {}
    matched = {}
    for dept_id, words in RULE_DEPT_KEYWORDS.items():
        hits = [w for w in words if w in all_text]
        if hits:
            scores[dept_id] = len(hits)
            matched[dept_id] = hits

    if not scores:
        if len(user_texts) <= 1:
            reply = (
                "好的，我来帮你判断挂哪个科。方便再说两点吗：\n"
                "1）主要哪里不舒服（比如嗓子、牙、腰、眼睛）？\n"
                "2）大概持续多久了，有没有发烧？"
            )
            return {
                "reply": reply,
                "source": "rule",
                "card": None,
                "suggestions": ["嗓子疼，两天了", "牙疼", "腰疼", "眼睛干"],
                "trace": ["未识别到科室，发起追问"],
            }
        return {
            "reply": "我还没能确定该挂哪个科。建议到门诊导诊台咨询，或换个说法再描述一次（症状 + 部位 + 时间）。",
            "source": "rule",
            "card": None,
            "suggestions": ["查看科室"],
            "trace": ["多轮后仍未匹配"],
        }

    dept_id = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
    doctors = tools["list_doctors"](dept_id)
    dept_name = None
    for d in tools["list_departments"]():
        if d["id"] == dept_id:
            dept_name = d["name"]
            break

    lines = ["根据你描述的「" + "、".join(matched[dept_id]) + "」，建议挂 **" + (dept_name or "相应科室") + "**。"]
    if doctors:
        names = "、".join(d["name"] + "（" + (d.get("title") or "") + "）" for d in doctors[:3])
        lines.append("该科室可选医生：" + names + "。")
    lines.append("需要的话我可以直接帮你查排班并预约。")

    return {
        "reply": "\n".join(lines),
        "source": "rule",
        "card": {"type": "department", "department_id": dept_id, "department_name": dept_name},
        "suggestions": ["查 " + (dept_name or "该科室") + " 的排班", "换一个科室"],
        "trace": ["关键词匹配：" + "、".join(matched[dept_id])],
    }


# ---------------- 统一入口 ----------------

def _soft_wrap(payload, soft):
    """对非急重症但需警惕的措辞，追加一条风险提示。"""
    if soft:
        payload["reply"] = (
            "⚠️ 你提到「" + "、".join(soft) + "」，"
            "如果持续不缓解或加重（出冷汗、脸色苍白、说话费力），请立即去急诊。\n\n"
            + payload.get("reply", "")
        )
        payload.setdefault("trace", []).append("风险提示：" + "、".join(soft))
    return payload


def _ai_chat(messages, student, tools, knowledge, kb_context, api_key):
    """大模型 + Function Call 的 agent 循环。"""
    convo = [{"role": "system", "content": SYSTEM_PROMPT}]
    if kb_context:
        convo.append({
            "role": "system",
            "content": "以下是院内知识库检索结果，回答时优先采用：\n" + kb_context,
        })
    convo.extend({"role": m["role"], "content": m["content"]} for m in messages if m.get("content"))

    trace = []
    card = None
    if knowledge:
        trace.append("RAG 命中：" + "、".join(item["id"] for item in knowledge))

    for _ in range(MAX_ROUNDS):
        data = _post_llm(
            {
                "model": MODEL,
                "messages": convo,
                "tools": TOOLS,
                "tool_choice": "auto",
                "temperature": 0.3,
                "max_tokens": 600,
            },
            api_key,
        )
        msg = data["choices"][0]["message"]
        convo.append(msg)

        calls = msg.get("tool_calls") or []
        if not calls:
            return {
                "reply": (msg.get("content") or "").strip(),
                "source": "ai",
                "card": card,
                "suggestions": [],
                "trace": trace,
            }

        for call in calls:
            name = call["function"]["name"]
            try:
                args = json.loads(call["function"].get("arguments") or "{}")
            except Exception:
                args = {}

            try:
                if name == "book_appointment":
                    result = tools["book_appointment"](args.get("schedule_id"), student)
                    if result.get("success"):
                        card = {
                            "type": "booked",
                            "appointment_id": result.get("appointment_id"),
                            "remain": result.get("remain"),
                        }
                elif name == "list_schedules":
                    result = tools["list_schedules"](args.get("doctor_id"), args.get("date"))
                    if card is None:
                        card = {"type": "schedules", "doctor_id": args.get("doctor_id")}
                elif name == "list_doctors":
                    result = tools["list_doctors"](args.get("department_id"))
                    if card is None:
                        card = {"type": "department", "department_id": args.get("department_id")}
                elif name == "list_departments":
                    result = tools["list_departments"]()
                else:
                    result = {"error": "unknown tool " + str(name)}
            except Exception as exc:  # 工具异常也回填给模型，避免整体挂掉
                result = {"error": str(exc)[:200]}

            trace.append(name + "(" + json.dumps(args, ensure_ascii=False) + ")")
            convo.append({
                "role": "tool",
                "tool_call_id": call.get("id"),
                "content": json.dumps(result, ensure_ascii=False)[:2000],
            })

    return {
        "reply": "我这边处理步骤有点多，先给你一个建议：可以直接在首页选择科室，或到导诊台咨询。",
        "source": "ai",
        "card": card,
        "suggestions": ["查看科室"],
        "trace": trace,
    }


def run_agent(messages, student, tools):
    """messages: [{role, content}]；student: 当前登录学生；tools: 工具实现字典。"""
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    user_texts = [m.get("content", "") for m in messages if m.get("role") == "user"]
    all_user_text = " ".join(user_texts)

    # ① 急重症前置拦截（不依赖模型，命中即中断）
    emergency = match_words(all_user_text, EMERGENCY_WORDS)
    if emergency:
        return {
            "reply": EMERGENCY_REPLY,
            "source": "rule",
            "card": None,
            "suggestions": ["查看急诊说明"],
            "trace": ["急重症拦截：" + "、".join(emergency)],
        }

    soft = match_words(all_user_text, SOFT_WARN_WORDS)

    # ② RAG 检索
    knowledge = retrieve(all_user_text)
    kb_context = "\n".join("- " + item["text"] for item in knowledge) if knowledge else ""

    # ③ 无 key → 规则兜底
    if not api_key:
        result = rule_chat(messages, tools, knowledge)
        if kb_context:
            result["trace"].append("RAG 命中 " + str(len(knowledge)) + " 条")
        return _soft_wrap(result, soft)

    # ④ 大模型 + Function Call，任何异常都回退规则引擎
    try:
        return _soft_wrap(_ai_chat(messages, student, tools, knowledge, kb_context, api_key), soft)
    except Exception as exc:
        result = rule_chat(messages, tools, knowledge)
        result["trace"].append("AI 调用失败，已回退规则引擎：" + type(exc).__name__)
        return _soft_wrap(result, soft)

