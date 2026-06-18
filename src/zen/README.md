# Cent Zen Mode 产品 PRD 与技术方向草案

## 1. 功能概述

Zen Mode 是 Cent 中面向「财务正念复盘」的沉浸式 AI 功能。

它不是传统记账 App 中的统计页、预算页或账单列表，而是一段由 AI 主导的自由画布体验。用户进入 Zen Mode 后，AI 会基于最近一段时间的账单、收入、预算、分类、标签和历史行为，动态生成一段个性化的复盘旅程。

用户可以在其中回顾消费与收入，理解自己的行为动机，表达情绪，总结原因，并最终设定一个温和、可执行的下一阶段意图或预算计划。

Zen Mode 的核心不是“告诉用户哪里花多了”，而是帮助用户以更低焦虑、更高觉察的方式理解自己的财务生活。

---

## 2. 产品理念

### 2.1 核心定位

Zen Mode 是一个「AI 财务禅师」体验。

它扮演的不是审计员、预算警察或冷冰冰的报表工具，而是一个温和、克制、善于提问的财务镜像。它通过数据发现异常，通过提问引导反思，通过交互式组件承载用户的表达。

### 2.2 核心原则

1. **不制造焦虑**
   避免使用“你超支了”“你浪费了”“你应该减少消费”等审判式语言。

2. **关注行为，而不是只关注数字**
   重点不是“花了多少钱”，而是“这笔钱换来了什么”“当时为什么会这样选择”。

3. **AI 主导，但用户掌控方向**
   AI 负责分析、选择主题、生成卡牌和引导问题；用户可以选择主题、表达感受、跳过不想回答的问题。

4. **每次体验都不一样**
   Zen Mode 不应是固定问卷，而应通过数据特征、用户心情、周期类型、历史卡牌冷却机制来动态生成流程。

5. **以行动结束，而不是以总结结束**
   每次 Zen Mode 最终应产出一个轻量结果，例如：一句财务箴言、一个下周意图、一个预算微调、一个想避免的触发场景、一个值得保留的消费习惯。

---

## 3. 目标用户与使用场景

### 3.1 目标用户

Zen Mode 面向以下几类用户：

* 已经有一定记账习惯，但对账单复盘感到焦虑的用户。
* 想理解自己消费习惯，而不只是看分类统计的用户。
* 使用 Cent 进行多人协作记账，希望定期复盘家庭、情侣、朋友共同消费的用户。
* 已经设置预算，但预算经常失效，希望找到背后原因的用户。
* 对 AI 辅助个人财务分析感兴趣的用户。

### 3.2 典型场景

#### 场景 A：周末复盘

用户在周日晚进入 Zen Mode。AI 分析最近 7 天账单后发现外卖和打车频次较高，于是生成几个主题：

* 胃与钱包的拉锯战
* 用钱购买时间
* 疲惫后的补偿消费

用户选择“用钱购买时间”。AI 通过滑块、账单卡片和自由输入，引导用户思考这些支出是否真的帮自己换来了休息时间。最后用户设定下周意图：“至少两天提前准备晚餐，减少疲惫时的外卖决策”。

#### 场景 B：月末复盘

用户月末进入 Zen Mode。AI 发现本月收入稳定，但订阅服务和小额支出持续增加。AI 引导用户进行一次“断舍离”主题复盘，展示若干订阅和低感知消费，让用户选择“保留 / 暂停 / 观察”。

最后 AI 生成一张总结卡：“这个月真正带来满足感的不是更多选择，而是更少的自动流失。”

#### 场景 C：大额支出复盘

用户本周有一笔远高于日常平均水平的大额支出。AI 不直接判断它是否合理，而是生成主题：

* 这是一笔投资，还是一次安慰？
* 计划外支出背后的生活变化
* 钱离开时，你得到了什么？

用户选择后，AI 引导用户判断这笔钱是否提升了长期价值、短期情绪或生活质量。

#### 场景 D：收入复盘

用户最近有奖金、副业收入或报销到账。AI 生成“收入流入”主题，引导用户思考：

* 这笔收入是否改变了安全感？
* 是否要将其中一部分分配给储蓄、愿望、投资或偿债？
* 这笔收入背后对应了怎样的努力？

---

## 4. 功能边界

### 4.1 Zen Mode 应该做什么

Zen Mode 可以做：

* 分析最近一段时间的账单、收入、预算和分类变化。
* 根据数据特征生成多个复盘主题。
* 通过交互式卡牌引导用户反思。
* 支持选择题、滑块、账单情绪标记、自由文本、语音输入等组件。
* 总结用户输入，生成一次 Zen Session 记录。
* 帮用户设定下一阶段意图、目标或预算建议。
* 将结果沉淀为可回顾的“禅意日志”。
* 在用户确认后更新预算、标签、账单备注或目标。

### 4.2 Zen Mode 不应该做什么

Zen Mode 不应该：

* 自动修改用户预算或账单，除非用户明确确认。
* 直接给出强硬财务建议，例如“你必须减少 XX 支出”。
* 伪装成心理治疗、投资顾问或医疗建议。
* 一次性分析过多数据导致体验沉重。
* 让用户在每次进入时面对完全相同的问题。
* 无限对话，导致用户无法自然结束。

---

## 5. 核心体验流程

Zen Mode 的流程不固定，但可以抽象为 5 个阶段。

### 5.1 进入阶段：Ritual

用户点击进入 Zen Mode 后，界面进入一个轻量过渡状态。

设计目标：

* 从普通账本界面切换到低刺激、低焦虑的沉浸界面。
* 隐藏复杂图表、总资产、赤字等容易引发焦虑的信息。
* 让用户知道接下来不是“检查错误”，而是“理解自己”。

可能交互：

* 呼吸动画。
* 一句简短引导语。
* 选择当下心境：平静、疲惫、焦虑、迷茫、满足、想改变。
* 选择复盘周期：本周、本月、自定义时间段。

### 5.2 主题选择阶段：Theme Selection

AI 分析最近账单后，生成 2 到 4 个候选主题。

主题不是固定枚举，而是由 AI 根据数据动态生成，但需要落在系统可控的主题标签中。

示例：

* 胃与钱包的拉锯战
* 用钱购买时间
* 情绪的解药
* 悄悄流走的订阅
* 计划外的风暴
* 值得庆祝的克制
* 收入带来的安全感
* 人际关系中的支出
* 为未来的自己花钱

用户选择一个主题后，AI 根据主题继续生成下一页内容。

### 5.3 反思阶段：Interactive Reflection

这是 Zen Mode 的核心。AI 通过自由画布调用不同交互组件。

可用组件包括：

* 文本引导卡
* 主题选择卡
* 单选卡
* 多选卡
* 情绪滑块卡
* 账单聚焦卡
* 账单左右滑动卡
* 自由文本输入卡
* 语音输入卡
* 预算微调卡
* 目标设定卡
* 断舍离卡
* 愿望清单卡
* 结语卡

AI 每次根据上下文选择一个合适组件，并填充标题、描述、选项和绑定账单数据。

示例：

当 AI 发现外卖频次较高时，可以生成一个滑块卡：

标题：
“那些点外卖的时刻，更像是为了填饱肚子，还是为了安慰疲惫的自己？”

滑块左侧：
“只是方便”

滑块右侧：
“需要一点安慰”

用户滑动后，AI 继续生成下一张卡。

### 5.4 总结阶段：Insight Summary

在经历 2 到 5 个交互回合后，AI 需要收束体验。

总结内容包括：

* 本次用户选择的主题。
* 被关注的消费或收入行为。
* 用户表达出的主要原因。
* 一个温和的洞察。
* 一个可以行动的小建议。

示例：

“这周你的外卖并不只是食物支出，它更像是工作疲惫后的缓冲垫。真正值得关注的也许不是少点几顿外卖，而是让自己在最累的时候少做一点临时决定。”

### 5.5 意图设定阶段：Intention

Zen Mode 不以“你该怎么做”结束，而以“你愿意尝试什么”结束。

用户可以选择或输入下一阶段意图。

示例：

* 下周提前准备两顿晚餐。
* 给打车设置一个温和上限。
* 保留真正带来幸福感的消费。
* 取消一个不再使用的订阅。
* 每周给自己留一笔无负罪感小额预算。
* 观察一下情绪性消费出现的时间点。

最终 AI 生成一张“禅意期许卡”。

---

## 6. 交互式组件库设计

### 6.1 ThemeSelectorCard：主题选择卡

用途：进入 Zen Mode 后，让用户从 AI 生成的几个主题中选择方向。

适合场景：

* 初始路由。
* 多个数据异常并存时。
* 用户没有明确目标时。

字段：

* title
* subtitle
* options
* recommendedOptionId
* reason

### 6.2 InsightTextCard：洞察文本卡

用途：展示 AI 对某个现象的温和观察。

适合场景：

* 进入主题后的第一张卡。
* 总结某个账单趋势。
* 衔接两个交互之间的过渡。

字段：

* title
* body
* tone
* relatedBillIds
* relatedCategoryIds

### 6.3 SliderCard：情绪滑块卡

用途：让用户表达程度，而不是二选一判断。

适合场景：

* 后悔程度
* 值得程度
* 疲惫程度
* 冲动程度
* 安全感变化
* 掌控感变化

字段：

* title
* description
* minLabel
* maxLabel
* minValue
* maxValue
* defaultValue

### 6.4 BillFocusCard：账单聚焦卡

用途：展示一笔或一组账单，引导用户回忆当时情境。

适合场景：

* 大额支出
* 高频小额支出
* 订阅扣费
* 收入到账
* 特殊分类变化

字段：

* title
* description
* billIds
* displayMode
* question

### 6.5 ChoiceCard：选择题卡

用途：快速收集用户判断。

适合场景：

* 选择消费动机。
* 选择下一步主题。
* 选择预算策略。
* 选择是否行动。

字段：

* title
* description
* options
* allowMultiple
* allowSkip

### 6.6 FreeInputCard：自由输入卡

用途：承接更开放的反思。

适合场景：

* 用户需要解释原因。
* 用户需要表达情绪。
* 用户需要写下下周计划。

字段：

* title
* placeholder
* inputMode: text | voice | both
* maxLength
* helperText

### 6.7 ShredderCard：断舍离卡

用途：让用户选择想暂停、删除、观察或减少的支出。

适合场景：

* 订阅服务
* 后悔消费
* 低幸福感支出
* 重复购买

字段：

* title
* items
* actions: keep | pause | observe | reduce

### 6.8 BudgetAdjustCard：预算微调卡

用途：在用户确认后，生成预算建议。

适合场景：

* 某分类持续超预算。
* 用户明确想控制某项支出。
* 用户已经设定意图，需要转成预算。

字段：

* title
* categoryId
* currentBudget
* suggestedBudget
* reason
* confirmAction

### 6.9 IntentionCard：意图设定卡

用途：让用户选择一个下一阶段可以实践的小目标。

字段：

* title
* suggestions
* customInputEnabled
* duration
* reminderEnabled

### 6.10 ZenEpilogueCard：结语卡

用途：结束 Zen Mode，生成可保存的禅意总结。

字段：

* title
* quote
* summary
* intention
* actions
* shareable

---

## 7. 正念反思卡牌标签体系

为了让 AI 能精准匹配用户数据与卡牌，需要建立一套双向标签体系。

### 7.1 数据端标签

系统根据账单自动生成数据标签。

#### Trigger Type：触发类型

* high_frequency_micro_spending：高频小额支出
* large_unusual_expense：异常大额支出
* subscription_leak：订阅滴漏
* income_spike：收入突增
* category_over_budget：分类超预算
* category_drop：某类消费明显下降
* healthy_balance：整体状态健康
* social_spending：社交型支出
* self_improvement_spending：自我提升支出
* time_saving_spending：时间置换支出
* emotional_spending：情绪补偿支出
* planned_purchase：计划内消费
* unplanned_purchase：计划外消费

#### Deviation Level：偏离程度

* normal
* mild
* medium
* high
* extreme

#### Period Type：周期类型

* weekly
* monthly
* quarterly
* yearly
* custom

#### User Mood：入场心境

* calm
* tired
* anxious
* confused
* satisfied
* motivated
* avoidant

### 7.2 卡牌端标签

每张卡牌或组件模板也需要标签。

#### Psychological Domain：心理领域

* time_exchange：时间置换
* emotional_compensation：情绪补偿
* social_identity：社交认同
* self_care：自我关怀
* self_investment：长期投资
* security：安全感
* control：掌控感
* abundance：丰盛感
* minimalism：断舍离
* gratitude：感恩与庆祝

#### Tone：语气强度

* gentle：温柔
* reflective：沉思
* direct：直接
* celebratory：庆祝
* grounding：安定
* playful：轻盈

#### Interaction Depth：交互深度

* light：轻量选择
* medium：需要思考
* deep：需要自由表达

#### Actionability：行动强度

* observe_only：只观察
* mark_bill：标记账单
* create_intention：创建意图
* adjust_budget：调整预算
* cancel_or_reduce：减少或取消
* save_reflection：保存反思

---

## 8. 卡牌匹配逻辑

Zen Mode 不应完全随机。推荐使用「数据驱动 + AI 路由 + 冷却机制」混合策略。

### 8.1 匹配输入

匹配引擎输入：

* 最近账单数据
* 分类统计
* 收入统计
* 预算执行情况
* 用户入场心境
* 用户选择的复盘周期
* 历史 Zen Session
* 最近使用过的卡牌
* 用户跳过或反感过的主题

### 8.2 匹配过程

第一步：系统先进行本地数据分析，生成结构化摘要。

第二步：AI 基于摘要生成候选主题。

第三步：用户选择主题。

第四步：AI 根据主题、用户输入和当前 session 状态，选择下一张组件卡。

第五步：每一轮结束后，系统更新 session state，并限制最大回合数。

### 8.3 去重与新鲜感机制

为了避免重复体验，需要加入：

* 卡牌冷却时间：同一张核心卡牌 3 到 4 周内不重复出现。
* 主题冷却时间：连续两次 Zen Mode 不优先展示同一主题。
* 问题变体：同一心理领域下准备多个不同提问模板。
* 组件多样性：连续两张卡不使用同一交互形式。
* 数据优先级：当出现新的异常数据时，优先围绕新数据生成体验。
* 平淡周兜底：当没有明显异常时，进入“感谢 / 丰盛 / 未来愿景 / 财务价值观”主题。

---

# 技术方向大纲

## 9. 整体架构

Zen Mode 可以采用以下结构：

```txt
Bill Data
  ↓
Local Analyzer
  ↓
Zen Context Builder
  ↓
AI Director
  ↓
Structured UI JSON
  ↓
Zen Canvas Renderer
  ↓
User Interaction
  ↓
Session State Update
  ↓
AI Director Next Step
```

### 9.1 Local Analyzer

本地分析模块负责从 Cent 的账单数据中提炼结构化摘要，尽量减少直接发送原始账单给 AI。

输出内容包括：

* 时间范围
* 总收入
* 总支出
* 分类占比
* 分类变化
* 高频分类
* 异常大额账单
* 订阅类账单
* 预算偏离
* 值得关注的账单组
* 数据标签

### 9.2 Zen Context Builder

负责构造 AI 可理解的上下文。

它不应该把所有账单都塞给 AI，而是生成精简、脱敏、结构化的信息。

示例：

```json
{
  "period": {
    "type": "weekly",
    "start": "2026-06-10",
    "end": "2026-06-17"
  },
  "summary": {
    "expenseTotal": 128000,
    "incomeTotal": 300000,
    "currency": "CNY"
  },
  "signals": [
    {
      "type": "high_frequency_micro_spending",
      "categoryName": "Food",
      "count": 12,
      "amount": 42000,
      "deviationLevel": "high"
    },
    {
      "type": "time_saving_spending",
      "categoryName": "Transport",
      "count": 6,
      "amount": 26000,
      "deviationLevel": "medium"
    }
  ],
  "candidateBills": [
    {
      "id": "bill_1",
      "categoryName": "Food",
      "amount": 3800,
      "time": "2026-06-15T21:30:00",
      "comment": "外卖"
    }
  ]
}
```

### 9.3 AI Director

AI Director 是 Zen Mode 的核心。它不直接渲染 UI，而是输出一个严格受控的 UI 指令 JSON。

AI 的职责：

* 选择本轮主题。
* 选择组件类型。
* 填充文案。
* 决定是否继续深入。
* 决定是否收束。
* 生成总结和意图建议。

AI 不应该：

* 直接修改用户数据。
* 输出不在协议内的组件。
* 生成投资、医疗、心理治疗类建议。
* 无限延长对话。

---

## 10. 交互式组件协议

### 10.1 顶层协议

AI 每次只返回一个 UI Step。

```ts
type ZenUIStep = {
  stepId: string;
  sessionId: string;
  component: ZenComponent;
  intent: "theme_selection" | "reflection" | "action" | "summary" | "ending";
  progress: {
    current: number;
    max: number;
    shouldEndSoon: boolean;
  };
  dataBindings?: {
    billIds?: string[];
    categoryIds?: string[];
    budgetIds?: string[];
    tagIds?: string[];
  };
  nextPolicy: {
    waitForUserInput: boolean;
    allowedUserActions: string[];
  };
};
```

### 10.2 组件协议

```ts
type ZenComponent =
  | ThemeSelectorCard
  | InsightTextCard
  | SliderCard
  | ChoiceCard
  | BillFocusCard
  | FreeInputCard
  | ShredderCard
  | BudgetAdjustCard
  | IntentionCard
  | ZenEpilogueCard;
```

示例：

```json
{
  "stepId": "step_002",
  "sessionId": "zen_20260617_001",
  "intent": "reflection",
  "progress": {
    "current": 2,
    "max": 5,
    "shouldEndSoon": false
  },
  "component": {
    "type": "SliderCard",
    "title": "这几次外卖，更像是方便，还是安慰？",
    "description": "不用急着判断对错。只需要回想当时的自己，轻轻放在这个刻度上。",
    "minLabel": "只是方便",
    "maxLabel": "需要安慰",
    "minValue": 0,
    "maxValue": 100,
    "defaultValue": 50
  },
  "dataBindings": {
    "categoryIds": ["food"]
  },
  "nextPolicy": {
    "waitForUserInput": true,
    "allowedUserActions": ["submit", "skip"]
  }
}
```

---

## 11. Session State 设计

Zen Mode 需要维护一个 session 状态，而不是每轮只把用户输入直接丢给 AI。

```ts
type ZenSessionState = {
  id: string;
  bookId: string;
  period: {
    start: number;
    end: number;
    type: "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
  };
  mood?: string;
  selectedTheme?: {
    id: string;
    title: string;
    tags: string[];
  };
  steps: ZenSessionStep[];
  extractedInsights: ZenInsight[];
  finalIntention?: ZenIntention;
  journeyPlan: ZenJourneyPlan;
  exploration: ZenExplorationState;
  status: "active" | "completed" | "cancelled";
  createdAt: number;
  updatedAt: number;
};
```

每次用户提交后，系统追加一步：

```ts
type ZenSessionStep = {
  stepId: string;
  componentType: string;
  aiPromptSummary: string;
  userInput?: unknown;
  relatedBillIds?: string[];
  relatedCategoryIds?: string[];
  createdAt: number;
};
```

---

## 12. AI Prompt 方向

### 12.1 System Prompt 核心要求

AI 角色：

你是 Cent Zen Mode 的 AI Director。你的任务不是给用户施压，而是以温和、清醒、克制的方式引导用户理解自己的财务行为。你需要根据结构化账单摘要、用户心境和历史交互，选择一个合适的 UI 组件，并填充内容。

核心规则：

1. 只能输出符合 JSON Schema 的 UI Step。
2. 每次只输出一个组件。
3. 不要输出 Markdown、解释或额外文本。
4. 不要批判用户。
5. 不要制造羞耻感。
6. 不要给投资、医疗、心理治疗建议。
7. 除非用户确认，不要要求修改预算或账单。
8. 旅程长度根据距离上次 Zen 的时间在 4-10 张之间计算；只有达到最低探索深度后才能收束，绝对上限为 12 张。
9. 优先使用用户最近数据中的真实信号。
10. 如果数据平淡，则转向感谢、价值观、愿景或轻量复盘。

### 12.2 Developer Prompt 可包含组件说明

向 AI 描述可用组件：

```txt
你可以使用以下组件：

1. ThemeSelectorCard
用于生成 2-4 个主题选项，让用户选择本次 Zen Mode 的方向。

2. SliderCard
用于让用户表达某种程度，例如值得程度、后悔程度、疲惫程度、掌控感。

3. BillFocusCard
用于聚焦一笔或一组账单，引导用户回想当时的状态。

4. FreeInputCard
用于让用户输入文字或语音反思。

5. IntentionCard
用于设定下一阶段意图。

6. ZenEpilogueCard
用于结束本次 Zen Mode。
```

### 12.3 每轮 User Prompt 输入

每轮输入给 AI 的上下文可以包含：

```json
{
  "zenContext": {},
  "sessionState": {},
  "lastUserInput": {},
  "constraints": {
    "targetSteps": 8,
    "earliestEpilogueStep": 8,
    "hardMaxSteps": 8,
    "currentStep": 5,
    "minimumExploration": {
      "requiredCoveredDimensions": 2,
      "requiredMeaningfulResponses": 2
    },
    "avoidComponentTypes": ["SliderCard"],
    "recentUsedCardTags": ["time_exchange"]
  }
}
```

---

## 13. 数据修改权限设计

Zen Mode 中 AI 可以提出操作建议，但不应该直接执行。

推荐分为三类操作。

### 13.1 只读操作

默认允许：

* 分析账单
* 生成主题
* 生成总结
* 生成意图
* 关联账单和分类

### 13.2 待确认操作

需要用户点击确认：

* 创建预算
* 修改预算
* 添加账单标签
* 给账单添加 Zen 备注
* 保存意图
* 标记订阅为“待处理”
* 创建提醒

### 13.3 禁止操作

不允许 AI 自动执行：

* 删除账单
* 修改账单金额
* 修改收入记录
* 批量修改历史数据
* 自动取消订阅
* 自动进行投资建议

---

## 14. 隐私与 Serverless First 设计

Cent 的核心特点是 Serverless First、纯前端 PWA、账本数据由用户掌控。因此 Zen Mode 需要尽量保持这个原则。

建议策略：

1. **本地优先分析**
   分类聚合、异常检测、预算偏离等尽量在本地完成。

2. **发送摘要，不发送全量账单**
   AI 只需要结构化摘要和少量候选账单，不需要完整账本。

3. **可配置 AI Provider**
   支持用户自带 API Key，或未来接入可选代理服务。

4. **明确提示数据用途**
   Zen Mode 首次使用时说明：AI 将基于账单摘要生成复盘内容。

5. **敏感字段最小化**
   尽量避免发送图片、地理位置、完整备注等高敏感信息。备注可以截断或由用户选择是否提供。

---

## 15. MVP 范围建议

### 15.1 MVP 版本

第一版只需要实现：

* 进入 Zen Mode
* 选择复盘周期
* 本地生成账单摘要
* AI 生成 3 个主题
* 用户选择主题
* AI 生成 2-3 个交互卡
* 用户输入或选择
* AI 生成结语卡
* 保存 Zen Session

组件只需要 5 个：

* ThemeSelectorCard
* InsightTextCard
* SliderCard
* FreeInputCard
* ZenEpilogueCard

### 15.2 V1.1

增加：

* BillFocusCard
* IntentionCard
* 历史 Zen Session
* 卡牌冷却机制
* 主题标签系统

### 15.3 V2

增加：

* BudgetAdjustCard
* ShredderCard
* 订阅识别
* 预算建议确认
* 多人账本复盘

## 16. 成功指标

### 16.1 使用指标

* Zen Mode 入口点击率
* 完整完成率
* 平均交互轮数
* 用户跳过率
* 用户保存意图比例
* 用户再次使用率

### 16.2 质量指标

* 用户是否认为问题“有启发”
* 用户是否认为语气“温和”
* 用户是否觉得每次体验不重复
* AI 输出 JSON 成功率
* 组件渲染失败率
* 平均响应时间

### 16.3 行为指标

* Zen Mode 后预算创建率
* Zen Mode 后预算调整率
* Zen Mode 后特定分类支出变化
* 用户是否持续记录反思
* 用户是否保留或删除某些订阅支出

---

## 17. 风险与解决方案

### 风险 1：AI 输出不稳定

解决方案：

* 使用 JSON Schema / Structured Outputs。
* 前端严格校验。
* 校验失败时使用 fallback card。
* 每个组件设置默认字段。

### 风险 2：等待时间破坏沉浸感

解决方案：

* 本地先展示呼吸动画或过渡卡。
* AI 请求期间展示“正在整理这段时间的财务纹理”。
* 首屏主题可以用本地分析快速生成，再由 AI 润色。

### 风险 3：用户觉得 AI 太说教

解决方案：

* Prompt 中明确禁止羞辱、批判、命令式语言。
* 用户可选择“更温柔 / 更直接 / 更轻松”的风格。
* 提供跳过按钮。
* 用户可以对卡牌反馈“不喜欢这个问题”。

### 风险 4：每次体验重复

解决方案：

* 卡牌冷却机制。
* 主题冷却机制。
* 同一数据标签下多个问题变体。
* 随机但受控的组件组合。
* 历史 Zen Session 参与上下文。

### 风险 5：AI 误解账单

解决方案：

* 不让 AI 直接读取全量账单并自由发挥。
* 先由本地 Analyzer 生成确定性数据摘要。
* AI 只基于摘要做表达和引导。
* 所有数据修改都需要用户确认。

---

## 18. 结论

Zen Mode 可以成为 Cent 区别于传统记账 App 的核心体验。

它将记账从“记录过去”推进到“理解自己”，从“预算控制”推进到“财务正念”，从“图表分析”推进到“AI 生成式复盘”。

产品上，它应该是一段柔和、可重复但不重复的沉浸体验；刚完成过 Zen 时保持轻盈，间隔越久则允许更充分地探索。

技术上，它应该是一个由 AI Director 驱动的 Generative UI 系统：前端提供安全、可控、可组合的交互组件；AI 只负责选择组件、生成文案和推进节奏；本地分析器负责把账单数据转化为稳定、低敏、结构化的上下文。

核心路径是“AI 生成主题 → 用户选择 → 围绕事实、情境与感受逐层探索 → 生成结语与意图”。编排层负责最低探索深度和结束边界，避免 AI 过早追求闭环。

# 与项目结合

Cent项目本地已经存在完整的ai-assistant reAct交互模式(src/assistant/README.md)，Zen Mode 的UI交互和数据处理都可以通过已有的tooling工具无缝接入当前的代码中，只需要单独设计一套UI交互工具即可，以及一份完整的提示词。

需要新增的工具：
1，Zen UI交互工具，AI通过调用该工具来展示对应的Zen页面，是核心工具。
2，Zen Post元数据工具，可以让AI查看之前的Zen模式的Post数据，例如聊天主题、总览、结语等，为本次Zen Session提供更多上下文参考，用于实现“上次的目标实现的如何”这样类似的场景。
3，数据分析等可以复用当前的账单工具，不需要额外提供

## Zen Mode的数据

关于Zen Mode的数据，有以下两个关键概念需要区分：

- Zen Post：禅模式的总结报告，这份报告包含了本次禅模式的核心内容，包括展示给用户的卡片、主题、结语等，不应该包含AI的完整聊天记录，确保内容保持精简，它只用于回顾/保存回放，而不是精确地重构聊天

- Zen Session History：这是单次禅模式的所有聊天记录内容，用于支撑完成一次Zen流程，是绝对完整的聊天记录，用于Zen流程中下一次页面生成，是整个Zen流程的核心记录

两种记录的数据生命周期不同：ZenPost 通过独立的 Zen 数据仓库参与云同步；Zen Session History 只存在于当前弹窗内存中，关闭弹窗或刷新页面后从头开始，不做本地持久化。
