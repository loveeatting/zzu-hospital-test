# 郑州大学校医院智能就医服务平台（原型）

> 面向校园场景的智能就医服务平台原型：**AI 导诊（症状→科室→医生→预约）+ AI 客服（知识库问答，带来源标注）+ 健康科普 + 就诊评价**。
>
> 本项目为**课程/竞赛原型**，不含真实患者数据，所有医疗与医保内容均为演示用途，**不构成医疗建议**。

---

## 1. 功能一览

| 模块 | 能力 |
|---|---|
| **AI 导诊** | 多轮口语化问诊 → 判断科室 → 推荐医生 → 查询排班 → 直接预约（Function Call） |
| **AI 客服** | 营业时间 / 值班医生 / 医保政策 / 就诊流程问答，**每条回答带来源与"是否核实"标注**，检索不到就明确说不知道 |
| **校园健康知识库** | 24 条科普主题（症状、预防、自我照护、就医时机），分类检索，附"相关科室"弱提示 |
| **预约挂号** | 号源余量、防超卖（原子扣减 + 唯一索引）、防重复预约、幂等取消、权限隔离 |
| **就诊评价** | 星级 + 四维评分 + 文字 + 匿名，一人一评，公开可见，医生评分聚合 |
| **账号体系** | 加盐哈希密码、Bearer 会话、**单设备登录（会话互斥）** |
| **安全兜底** | 急重症关键词前置拦截（不依赖模型）+ 风险提示 |

## 2. 技术栈

- **后端**：Python 3.13 · FastAPI · Uvicorn · Pydantic 2 · SQLite
- **前端**：原生 JavaScript 单页（无框架、无构建），移动端优先
- **AI**：DeepSeek `chat/completions` + Function Calling，**RAG 检索 + 规则兜底**（无 key 也能演示）
- **部署**：本机/局域网 + Cloudflare Tunnel（固定域名 + 自动 HTTPS）

## 3. 架构

```
        ┌──────────────── 浏览器 / 手机 ────────────────┐
        │            web/ (原生 JS 单页)                │
        └───────────────────┬──────────────────────────┘
                            │ 相对路径 /api/...
        ┌───────────────────▼──────────────────────────┐
        │                FastAPI (main.py)             │
        │  ┌──────────┬──────────┬──────────┬────────┐ │
        │  │ 认证会话 │ 号源预约 │ 评价     │ 知识库 │ │
        │  └──────────┴──────────┴──────────┴────────┘ │
        │  ┌────────────────┬─────────────────────────┐│
        │  │ agent.py 导诊  │ service_bot.py 客服     ││
        │  │ 症状→科室→预约 │ 知识库检索→来源标注     ││
        │  └───────┬────────┴──────────┬──────────────┘│
        │          │  LLM Function Call│ RAG           │
        │  ┌───────▼───────────────────▼──────────────┐│
        │  │ 规则兜底（无 API Key 也可完整演示）      ││
        │  └──────────────────────────────────────────┘│
        └───────────────────┬──────────────────────────┘
                            │
                    SQLite (mock.db)
```

**设计要点**：AI 只做"理解与编排"，事实性数据（号源、排班、医生）全部走工具查询数据库，避免模型幻觉污染业务数据。

## 4. 快速开始

```bash
# 1. 创建虚拟环境
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# 2. 安装依赖
pip install fastapi uvicorn pydantic

# 3. 初始化演示数据库（14 个科室 / 17 位医生 / 238 条排班 / 5 个学生账号）
python init_db.py

# 4. 启动
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

打开 <http://127.0.0.1:8000/app/>

**演示账号**（密码统一 `zzu123456`）：

| 学号 | 姓名 |
|---|---|
| 2025010001 | 张三 |
| 2025010002 | 李四 |
| 2025010003 | 王五 |
| 2025020001 | 赵六 |
| 2025030001 | 孙七 |

**启用大模型（可选）**

```bash
# Windows PowerShell
$env:DEEPSEEK_API_KEY="sk-xxxx"
# macOS / Linux
export DEEPSEEK_API_KEY="sk-xxxx"
```

未设置 Key 时自动使用规则引擎，功能完整可演示。

## 5. 目录结构

```
main.py            FastAPI 应用：认证、科室、医生、排班、预约、评价、健康知识、客服/导诊接口
agent.py           AI 导诊智能体：RAG + Function Call + 急重症拦截 + 规则兜底
service_bot.py     AI 前台客服：知识库检索 + 来源标注 + 缺料不编造
hospital_kb.py     客服知识库（20 条 / 6 类，带来源与核实标记）
hospital_info.py   医院基础信息 + 值班医生实时查询
health.py          校园健康知识库（24 条科普）
db.py              SQLite 连接
init_db.py         建表与演示数据
seed_reviews.py    演示评价数据（可选）
smoke_test.py      端到端自检（28 项）
test_concurrent.py 并发抢号压测（防超卖验证）
web/               前端单页（index.html / style.css / app.js）
docs/              答辩与设计文档
```

## 6. 主要接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/login` | 登录（单设备：新登录踢掉旧会话） |
| GET | `/api/departments` | 科室列表（含 `source`: real/mock） |
| GET | `/api/doctors?department_id=` | 医生列表（含评分与评价数） |
| GET | `/api/schedules?doctor_id=` | 未来 7 天排班与余号 |
| POST | `/api/appointments` | 预约（原子扣减，防超卖） |
| GET | `/api/appointments` | 我的预约（含 `reviewed`） |
| DELETE | `/api/appointments/{id}` | 取消（幂等） |
| POST | `/api/agent/chat` | AI 导诊对话 |
| POST | `/api/service/chat` | AI 客服对话（返回 `sources`） |
| GET | `/api/hospital/kb` | 知识库列表 / 检索 |
| GET | `/api/hospital/on-duty` | 当前值班医生 |
| GET | `/api/health/topics?q=` | 健康知识检索 |
| POST | `/api/reviews` | 提交评价 |
| GET | `/api/reviews?doctor_id=` | 公开评价列表 |
| GET | `/api/doctors/{id}/reviews` | 医生评价汇总 |

交互式文档：<http://127.0.0.1:8000/docs>

## 7. 并发与一致性

防止"超卖"的核心写法：

```sql
UPDATE schedules SET remain = remain - 1
WHERE id = ? AND remain > 0;          -- 原子条件扣减
-- 检查 cur.rowcount，为 0 说明已抢完
```

再配合部分唯一索引，保证同一学生对同一号源只有一条有效预约：

```sql
CREATE UNIQUE INDEX ux_appt_active
    ON appointments (schedule_id, student_no)
    WHERE status = 'BOOKED';
```

**实测**：20 线程抢 1 个号 → 1 成功 / 19 个 409；50 线程抢 3 个号 → 3 成功 / 47 个 409。

## 8. 测试

```bash
# 端到端自检（28 项）
python smoke_test.py
python smoke_test.py https://your-domain.com   # 指定域名

# 并发压测
python test_concurrent.py
```

## 9. 数据说明（重要）

本项目数据分两类，接口与界面均标注 `source` 字段：

| 内容 | 真实性 | 说明 |
|---|---|---|
| 14 个科室名称 | ✅ 真实 | 取自郑州大学医院官网科室介绍 |
| 9 位医生（姓名/职称/擅长） | ✅ 真实 | 取自官网专家介绍页 |
| 8 位补全医生 | ⚠️ 模拟 | 官网未公布，为补全空科室设置，界面标注"模拟数据" |
| 所有排班时间 | ⚠️ 模拟 | 官网不公布出诊表 |
| 医保政策与比例 | ⚠️ 示例 | 仅用于演示，**以当年政策与医院实际结算为准** |
| 门诊时间、楼层、流程 | ⚠️ 待核实 | 原型知识库，未与官方公告核对 |
| 学生账号 | ⚠️ 虚构 | 非真实学号 |

> **医保与门诊信息为演示内容，不可作为就医依据。**

## 10. 部署（Cloudflare Tunnel 固定域名）

```bash
# 1. 安装并登录
cloudflared tunnel login

# 2. 创建隧道并绑定域名
cloudflared tunnel create my-hospital
cloudflared tunnel route dns my-hospital your.domain.com
```

`config.yml`：

```yaml
tunnel: <TUNNEL_ID>
credentials-file: <PATH>/<TUNNEL_ID>.json
protocol: http2          # 校园网常封 UDP 7844，用 HTTP/2 更稳
edge-ip-version: "4"     # 跳过 IPv6，连接更快

ingress:
  - hostname: your.domain.com
    service: http://localhost:8000
  - service: http_status:404
```

> ⚠️ `cert.pem`、`*.json` 凭据、`config.yml` 含密钥信息，**已在 .gitignore 中排除，切勿提交**。

## 11. 已知限制

- 排班与医保数据为模拟/示例，未接入医院真实系统
- 无管理端（号源维护、核销、统计看板待开发）
- AI 回答依赖模型能力，已用规则兜底但无法覆盖全部问题
- 单进程 SQLite 适合原型，生产需换 PostgreSQL 并加连接池

## 12. 免责声明

本项目仅用于教学与竞赛演示，**不提供医疗诊断建议**。任何健康问题请咨询执业医师；紧急情况请拨打 120。

## 13. License

[MIT](LICENSE)
