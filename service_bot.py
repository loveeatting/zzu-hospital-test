"""AI 前台客服：基于知识库的信息问答（带来源标注，缺料不编造）。

与导诊智能体的分工：
- agent.py：说症状 → 判断科室 → 推荐医生 → 预约
- 本模块：医院的"怎么运作"类问题 —— 时间 / 值班 / 医保 / 流程 / 检查体检

核心原则（对应需求）：
1. 每条回答都标注来源；
2. 检索不到就明确说"知识库暂未收录"，引导官方渠道；
3. 不臆造营业时间、政策比例等事实。
"""

import json
import os
import urllib.request

import hospital_kb

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
MODEL = "deepseek-chat"
MAX_ROUNDS = 3

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_kb",
            "description": "在校医院知识库中检索（门诊时间、科室、就诊指南、医保、检查体检、常见问题）。",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "用户问题的关键词"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_on_duty_doctors",
            "description": "查询此刻值班（或最近一次门诊）的医生、科室、诊室与余号。",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]

SYSTEM_PROMPT = """你是郑州大学校医院的智能客服，回答同学关于医院服务的问题。

可用工具：
- search_kb(query)：检索知识库（门诊时间、科室信息、就诊指南、医保服务、检查与体检、常见问题）
- get_on_duty_doctors()：查询此刻值班医生与余号

必须遵守：
1. **先调工具再回答**，不要凭记忆回答事实（时间、比例、流程、楼层）。
2. 每条回答末尾标注来源，格式：`来源：<工具返回的 source>`。
3. 如果知识库没有返回相关条目，就明确说"我的知识库里暂时没有收录这个问题"，并建议到一楼导诊台或医院官网（ai.xhis.com.cn）确认，**绝不能编造**。
4. 如果条目标注 verified=false，要提醒"该信息为演示数据，请以医院公告为准"。
5. 你不做症状判断、不推荐科室、不诊断。同学描述身体不适时，请引导他到首页「AI 导诊」。
6. 急重症（剧烈胸痛、呼吸困难、昏迷、大出血等）直接提示去急诊或拨打 120。
7. 回答 3-5 句，可用简短列表。
"""


def _post_llm(payload, api_key, timeout=30):
    req = urllib.request.Request(
        DEEPSEEK_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + api_key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _tool_call(name, args, tools):
    fn = tools.get(name)
    if fn is None:
        return {"error": "unknown tool: " + name}
    try:
        return fn(**args) if args else fn()
    except Exception as exc:
        return {"error": type(exc).__name__ + ": " + str(exc)}


# ---------------- 职责判定 ----------------

SYMPTOM_WORDS = ["头疼", "发烧", "咳嗽", "疼", "不舒服", "难受", "恶心", "痒", "拉肚子",
                 "感冒", "过敏", "失眠", "疼得", "肿", "流血"]
DUTY_WORDS = ["值班", "谁在", "现在有医生", "今天有谁", "在诊", "坐诊", "有医生吗", "谁上班"]


def _is_symptom(text):
    return any(w in text for w in SYMPTOM_WORDS)


def _is_duty(text):
    return any(w in text for w in DUTY_WORDS)


def _fmt_duty(duty):
    if not duty["doctors"]:
        return ("现在没有查到排班信息。" + hospital_kb.SOURCE_OFFICIAL +
                " 建议到一楼导诊台确认。")

    head = "现在是 " + duty["now"] + "，" + duty["status"] + "。"
    if not duty["is_today"]:
        head += "（最近一次门诊：" + str(duty["date"]) + " " + str(duty["period"]) + "）"
    lines = []
    for d in duty["doctors"][:8]:
        lines.append("· %s（%s）%s %s-%s %s，余号 %d"
                     % (d["name"], d["department"], d["period"],
                        d["start_time"], d["end_time"], d["room"], d["remain"]))
    if len(duty["doctors"]) > 8:
        lines.append("· 等共 %d 位医生" % len(duty["doctors"]))
    tail = "来源：排班系统实时数据（已核实）"
    if not duty["is_today"]:
        tail += "\n⚠️ 今天门诊已结束，以上为下一次门诊的排班"
    return head + "\n" + "\n".join(lines) + "\n" + tail


def rule_reply(messages, tools):
    """规则兜底：知识库优先，检索不到就说不知道。"""
    user_texts = [m.get("content", "") for m in messages if m.get("role") == "user"]
    text = " ".join(user_texts).strip()
    last = user_texts[-1] if user_texts else text

    # 1) 症状 → 转导诊
    if _is_symptom(last) and not hospital_kb.kb_search(last):
        return {
            "reply": "身体不舒服的话，建议用首页的「AI 导诊」描述症状，它会帮你判断该挂哪个科。\n"
                     "我这边负责医院服务咨询：门诊时间、医生值班、医保政策和就诊流程。",
            "source": "rule",
            "card": None,
            "sources": [],
            "suggestions": ["今天谁值班？", "门诊时间？", "医保能报多少？"],
            "trace": ["命中：症状描述，转交导诊"],
        }

    # 2) 值班 → 实时查排班
    if _is_duty(last):
        duty = tools["get_on_duty_doctors"]()
        return {
            "reply": _fmt_duty(duty),
            "source": "rule",
            "card": {"type": "on_duty", "data": duty},
            "sources": [{"title": "实时排班", "source": "排班系统实时数据", "verified": True}],
            "suggestions": ["门诊几点下班？", "医保能报多少？", "怎么预约？"],
            "trace": ["命中：值班查询（实时数据）"],
        }

    # 3) 知识库检索
    hits = hospital_kb.kb_search(last)
    if hits:
        if hits[0].get("tool") == "on_duty":
            duty = tools["get_on_duty_doctors"]()
            return {
                "reply": _fmt_duty(duty),
                "source": "rule",
                "card": {"type": "on_duty", "data": duty},
                "sources": [{"title": "实时排班", "source": "排班系统实时数据", "verified": True}],
                "suggestions": ["门诊时间？", "医保能报多少？"],
                "trace": ["命中知识：值班（转实时查询）"],
            }
        answer, sources = hospital_kb.format_answer(hits, max_items=2)
        suggest = ["今天谁值班？", "医保能报多少？", "怎么退号？"]
        if hits[0]["category"] == "医保服务":
            suggest = ["哪些项目不报销？", "异地就医怎么办？", "今天谁值班？"]
        return {
            "reply": answer,
            "source": "rule",
            "card": {"type": "kb", "data": {"items": [h["title"] for h in hits[:2]]}},
            "sources": sources,
            "suggestions": suggest,
            "trace": ["知识库命中：" + "、".join(h["title"] for h in hits)],
        }

    # 4) 没查到 → 承认不知道
    return {
        "reply": hospital_kb.NO_ANSWER,
        "source": "rule",
        "card": None,
        "sources": [],
        "suggestions": ["门诊时间？", "今天谁值班？", "医保能报多少？"],
        "trace": ["知识库无匹配，返回未收录说明"],
    }


# ---------------- 大模型 + Function Call ----------------

def _kb_result(query):
    hits = hospital_kb.kb_search(query)
    if not hits:
        return {"found": False, "items": [], "message": "知识库未检索到相关条目"}
    return {
        "found": True,
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


def _ai_chat(messages, tools, api_key):
    convo = [{"role": "system", "content": SYSTEM_PROMPT}]
    convo.extend({"role": m["role"], "content": m["content"]} for m in messages if m.get("content"))

    trace = []
    card = None
    sources = []

    for _ in range(MAX_ROUNDS):
        payload = {
            "model": MODEL,
            "messages": convo,
            "tools": TOOLS,
            "temperature": 0.2,
        }
        data = _post_llm(payload, api_key)
        msg = data["choices"][0]["message"]
        tool_calls = msg.get("tool_calls") or []

        if not tool_calls:
            reply = (msg.get("content") or "").strip() or hospital_kb.NO_ANSWER
            return {
                "reply": reply,
                "source": "ai",
                "card": card,
                "sources": sources,
                "suggestions": ["今天谁值班？", "门诊时间？", "医保能报多少？"],
                "trace": trace,
            }

        convo.append({"role": "assistant", "content": msg.get("content") or "", "tool_calls": tool_calls})
        for call in tool_calls:
            name = call["function"]["name"]
            try:
                args = json.loads(call["function"].get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}

            if name == "search_kb":
                result = _kb_result(args.get("query", ""))
                for item in result.get("items", []):
                    sources.append({"title": item["title"], "source": item["source"],
                                    "verified": item["verified"]})
                card = {"type": "kb", "data": {"items": [i["title"] for i in result.get("items", [])]}}
            elif name == "get_on_duty_doctors":
                result = tools["get_on_duty_doctors"]()
                sources.append({"title": "实时排班", "source": "排班系统实时数据", "verified": True})
                card = {"type": "on_duty", "data": result}
            else:
                result = {"error": "unknown tool"}

            trace.append("调用工具 " + name)
            convo.append({
                "role": "tool",
                "tool_call_id": call["id"],
                "content": json.dumps(result, ensure_ascii=False)[:2500],
            })

    fallback = rule_reply(messages, tools)
    fallback["trace"].append("超过最大轮次，回退规则")
    return fallback


def run(messages, tools):
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        return rule_reply(messages, tools)
    try:
        return _ai_chat(messages, tools, api_key)
    except Exception as exc:
        result = rule_reply(messages, tools)
        result["trace"].append("AI 调用失败，回退规则：" + type(exc).__name__)
        return result
