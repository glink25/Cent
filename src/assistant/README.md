# Assistant Core 文档

### core

可以基于Assistant Core搭建一个完全自定义的AI聊天功能:

```javascript
import { create } from "chaty/core"

// 创建一个新的对话
const context = createSession({
    provider: CustomAIRequestProvider,
    tools: ChatyTools, // 内置的必需工具
    systemPrompt: ChatySystemPrompt,
    // history 为空代表这是一次全新对话，也可以通过传入持久化的history来追加对话
    history:[]
})
// 处理用户输入
const promisify = context.next({
    message: 'Hello',
    assets: []
})
promisify.then(async(
    stream // 流式返回值，并且已经被 chaty 内部解析为合法类型
    )=>{
    // promisify.abort
    // 处理AI返回值
    for await (const chunk of stream) {
        // 每个chunk是全量的TurnResult，不需要手动追加，可以直接用于jsx渲染
        console.log("收到内容:", chunk);
        // render to React component
    }
})
```

### 自定义request provider

Core 本身不提供任何AI服务，所有AI API请求必须由调用方提供，可以通过如下方式创建一个完全自定义的Provider：

```javascript
createSession({
    provider: {
        request: async({
            message, // string 本条消息用户输入的文本
            assets, // File[] 本条消息用户上传的附件列表
            history, // {message:string,assets?:File[], thought?:string, role:'assistant'|'user'|'tool'}[] 完整的聊天记录列表
        })=>{
            return new ReadableStream(); // 用于流式显示消息回复
            // 或者只简单返回文本
        }
    }
})
```
或者也可以直接使用预先提供的包装方法，直接使用 OpenAI - Compatible 的接口：
```javascript
import { createOpenAIProvider } from "chaty"
createSession({
    provider: createOpenAIProvider({
        baseURL: 'https://your-api.com',
        apiKey: 'you api key',
        model: 'gpt-5'
    })
})
```

## 自定义工具

自定义工具给AI调用非常简单，基于zod完全简化工具流程：
```javascript
import { createTool } from "chaty"
import z from "zod"

const queryTool = createTool({
    name: 'queryLedger',
    describe: '用于查询某个时间内的包含特定文本的账单',
    argSchema: z.object({
        time: z.date().describe("指定查询时间"),
        query: z.string().describe("指定包含的文本内容")
    }),
    returnSchema: z.array(z.object({
        text: z.string().describe("账目备注"),
        money: z.number().describe("账目金额"),
    })),
    handler: (params/** {time:Date,query:string} */,ctx:{history:History})=>{
      // ctx: 可以获取整个对话的上下文信息
        return db.query({time: params.time, includes:params.query}) // {text:string,money:number}[]
    }
})
createSession({
    tools:[queryTool]
})
```
> 所有的工具都会被自动转换为AI友好的提示词），返回结果会被自动解析为标准类型。这些逻辑都被提前预设进默认prompt中了。
> core的api调用策略是“token友好”，所有工具调用都是按需调用，其提供一个内置tool - listTools，允许AI主动获取有哪些工具可供使用。


## Skills（技能/知识库）

除了 `tools`（可执行能力）以外，Core 还支持注入一组 `skills`（可被模型按需读取的知识/流程/规范）。

- **传入方式**：和 `tools` 一样，通过 `createSession({ skills: [...] })` 注入
- **token 友好**：默认不把 skill 内容塞进 system prompt，只提供内置工具让模型按需查询/加载
- **内置工具**：
  - **`listSkills`**：只返回技能元数据（`{id,name,description}`）
  - **`loadSkill`**：按 `id` 读取技能全文（markdown）

示例（内联内容或懒加载二选一）：

```ts
import { createSession, type SkillInput } from "chaty/core"

const skills: SkillInput[] = [
  {
    id: "sql-style",
    name: "SQL 风格指南",
    description: "团队 SQL 规范与常见坑",
    loader: async () => (await fetch("/skills/sql-style.md")).text(),
  },
  {
    id: "oncall-runbook",
    name: "Oncall Runbook",
    description: "告警排查流程与回滚手册",
    content: "# Runbook\n\n...",
  },
]

createSession({
  provider,
  tools,
  skills,
})
```

## 目标

`core` 的职责不是简单包装 provider，而是实现一个纯 headless 的对话执行器（turn runner）：

- 维护对话上下文 `history`
- 接收用户输入并触发一轮对话
- 消费 provider 返回的原始文本流
- 按约定的 XML 标签协议增量解析文本
- 在需要时执行工具，并将工具结果写回上下文
- 继续驱动后续轮次，直到本轮结束
- 以 `ReadableStream<TurnResult>` 的形式持续输出“当前完整快照”

## 边界划分

### createSession

- `createSession` 只需要返回 `next` 函数
- 不需要返回 context 对象
- `next` 是本轮对话的唯一入口

目标使用方式：

```ts
const next = createSession({
  history,
  provider,
  tools,
  systemPrompt,
})

const pending = next({
  message: "Hello",
  assets: [],
})

const stream = await pending

for await (const turn of stream) {
  console.log(turn)
}
```

### provider

- `provider` 是给上层使用的接入层，不应该感知 `core` 内部协议
- `provider.request()` 只负责返回原始文本流
- 这个原始文本流的意义只是让消息展示过程可以流式展开，例如一个字一个字出现
- `provider` 不负责解析 `thought` / `answer` / `tool` 等结构
- `provider` 不负责工具编排
- `provider` 不暴露事件机制，不需要 `onError` / `onChunk` / `status`

### core

`core` 负责所有内部逻辑：

- 协议约束
- 流式解析
- 工具调用编排
- 工具错误回灌
- 最终 `TurnResult` 输出

## 核心接口约束

### createSession

建议形态：

```ts
createSession({
  history,
  provider,
  tools,
  systemPrompt,
  maxToolRounds,
}) => next
```

输入参数说明：

- `history`: 当前对话历史，可为空
- `provider`: 上层提供的 AI 请求器
- `tools`: 当前允许使用的工具列表
- `skills`: 当前可用的技能（知识/流程/规范）列表，供模型按需 `listSkills` / `loadSkill`
- `systemPrompt`: core 的系统提示词，同时承担协议约束职责
- `maxToolRounds`: 单轮内允许的最大工具调用轮数，用于防止死循环

### next

建议形态：

```ts
type Next = (input: {
  message: string
  assets?: File[]
}) => AbortablePromise<ReadableStream<TurnResult>>
```

语义说明：

- `next` 发起一轮新的用户输入
- 返回 `AbortablePromise<ReadableStream<TurnResult>>`
- 外部先 `await`，再通过 `for await` 消费结果流
- 正常完成通过 `stream.close()` 表达
- 致命错误通过 `stream.error(error)` 表达
- 不再引入 `status`、`onError`、事件监听器等额外机制

### provider.request

建议形态：

```ts
type Provider = {
  request: (params: {
    message: string
    assets?: File[]
    history: History
    systemPrompt: string
  }) => AbortablePromise<ReadableStream>
}
```

约束：

- 返回值是原始文本的 `ReadableStream`
- 不要求 provider 返回结构化数据
- 不要求 provider 参与工具调用协议
- 不要求 provider 维护历史状态，它只消费 `core` 提供的输入

## 输出模型

`core` 的输出不是事件流，而是“完整状态快照流”。

### TurnResult

建议最小形态：

```ts
type TurnResult = {
  history: History
  messages: (AssistantMessage | ToolMessage)[]
}
```

说明：

- `history` 是当前 turn 视角下的完整上下文快照
- `messages` 是本轮新增消息的完整快照
- 每次输出的都是全量结果，不是增量 delta
- UI 只需要使用最新一次输出，不需要自己拼接文本

## 消息模型

### UserMessage

```ts
type UserMessage = {
  role: "user"
  raw: string
  assets?: File[]
}
```

### AssistantMessage

```ts
type AssistantMessage = {
  role: "assistant"
  raw: string
  formatted: {
    thought?: string
    answer?: string
    overview?: string
  }
}
```

说明：

- `raw` 表示 assistant 当前原始输出文本
- `formatted` 表示被 XML 协议解析后的结构化内容
- 在流式过程中，`formatted.answer` 可以不断增长

### ToolMessage

```ts
type ToolMessage = {
  role: "tool"
  raw: string
  formatted: {
    name: string
    params: unknown
    returns?: unknown
    errors?: unknown
  }
}
```

说明：

- `raw` 保存工具调用或工具结果的原始文本表达
- `formatted.name` 是工具名
- `formatted.params` 是本次调用的解析参数
- `formatted.returns` 是执行成功后的结果
- `formatted.errors` 是执行失败后的错误信息

## XML 标签协议

既然 `provider` 只返回原始文本，`core` 必须通过强约束协议来可靠解析模型输出。

协议选择：使用 XML-like 标签。

允许的核心标签：

- `<thought>...</thought>`
- `<answer>...</answer>`
- `<overview>...</overview>`
- `<tool>...</tool>`

### 基本约束

- assistant 输出必须遵守 XML 标签协议
- `core` 负责通过 `systemPrompt` 将这一协议注入给模型
- `tool` 标签中的内容必须是可解析的 JSON 对象
- 单次 provider 响应只允许一个终态动作

终态动作含义：

- 要么以 `<answer>` 结束，代表本轮直接回答完成
- 要么以 `<tool>` 结束，代表需要执行一次工具调用

### 示例：直接回答

```xml
<thought>我已经理解用户的问题</thought>
<answer>这是最终回答内容</answer>
<overview>一句简要总结</overview>
```

### 示例：工具调用

```xml
<thought>需要查询账单数据后再回答</thought>
<tool>{"name":"queryLedger","params":{"time":"2026-04-07","query":"午饭"}}</tool>
```

### 协议限制

- 暂不支持同一轮 provider 输出多个 `<tool>`
- 暂不支持同一轮并行多工具
- 多工具链路通过多轮递归实现
- `core` 先保证单工具单步协议稳定，再考虑扩展

## 核心执行流程

下述流程是 `core` 的主施工路径。

### 1. 初始化

`createSession` 接收：

- `history`
- `provider`
- `tools`
- `systemPrompt`
- `maxToolRounds`

返回 `next`

### 2. 发起一轮用户输入

执行 `next({ message, assets })` 时：

- 创建当前 turn 的 working history
- 将 user message 追加到 working history
- 创建当前 turn 的 `ReadableStream<TurnResult>`
- 在后台启动异步执行器

### 3. 请求 provider

调用 `provider.request()`，传入：

- 当前用户 message
- 当前 assets
- 当前 history
- 最终 system prompt

provider 返回原始文本流。

### 4. 流式解析 assistant 输出

`core` 持续读取 provider 原始文本流，并将文本交给增量解析器。

解析器职责：

- 维护当前解析状态
- 识别 XML 标签边界
- 按标签将内容写入 `AssistantMessage.formatted`
- 当 `answer` 增长时，立刻产出新的 `TurnResult`

### 5. 如遇 tool 调用则执行工具

当解析器完整得到 `<tool>...</tool>` 后：

- 解析其中的 JSON
- 得到 `name` 与 `params`
- 查找工具定义
- 校验参数
- 执行对应 handler
- 生成 `ToolMessage`
- 将 `ToolMessage` 追加到 working history
- 产出新的 `TurnResult`

### 6. 工具返回后继续下一轮 provider

工具消息进入 history 后：

- 再次调用 `provider.request()`
- 让模型看到工具返回内容
- 继续解析新的 assistant 输出

### 7. 结束条件

当满足以下任一条件时结束本轮：

- assistant 成功输出最终 `<answer>`
- 达到 `maxToolRounds`
- provider 发生不可恢复错误
- XML 协议解析失败且无法恢复
- 调用方主动 abort

结束时：

- 若正常完成，则关闭输出流
- 若发生致命错误，则让输出流抛错

## 流式解析器设计

解析器必须支持真正的增量消费，不能依赖“先读完整文本再整体正则解析”。

建议实现为状态机。

### 建议状态

```ts
type ParserMode =
  | "outside"
  | "thought"
  | "answer"
  | "overview"
  | "tool"
```

### 建议内部数据

- `buffer`: 尚未消费完的原始文本缓冲区
- `mode`: 当前标签上下文
- `assistantRaw`: 当前 assistant 原始输出累计
- `thoughtBuffer`: thought 内容
- `answerBuffer`: answer 内容
- `overviewBuffer`: overview 内容
- `toolBuffer`: tool JSON 文本缓冲

### 解析原则

- `answer` 模式下允许边解析边输出
- 每当 `answerBuffer` 增长，就可以生成新的 `TurnResult`
- `tool` 模式下只累积内容，不提前执行
- 只有遇到 `</tool>` 后，才整体做 JSON.parse
- 标签结构非法时，需要判断是否还能继续等待更多文本
- 确认不可恢复时，才终止本轮

## 工具系统施工原则

### 工具注册

工具由上层通过 `tools` 传入。

建议基础结构：

```ts
type Tool<P = unknown, R = unknown> = {
  name: string
  describe: string
  argSchema: P
  returnSchema: R
  handler: (arg: P) => R | Promise<R>
}
```

说明：

- `handler` 应支持同步和异步两种返回
- `core` 负责在执行前后做标准化包装

### 内置工具

建议内置 `listTools`。

职责：

- 以低 token 成本告诉模型当前有哪些工具可用
- 输出工具名、用途、参数结构、返回结构摘要

其目的不是替代所有工具描述，而是减少默认 prompt 的体积。

### 工具执行错误

工具执行相关错误默认视为可恢复错误，不应直接终止整个输出流。

包括：

- 工具不存在
- 参数不合法
- handler 执行失败

处理方式：

- 生成一条 `ToolMessage`
- 将错误写入 `formatted.errors`
- 把这条消息追加到 working history
- 继续请求 provider，让模型自行修正参数或改用其它方案

## 错误处理原则

### 可恢复错误

以下错误默认视为可恢复：

- 工具不存在
- 工具参数校验失败
- 工具 handler 报错

处理方式：

- 不直接 `stream.error()`
- 转成 `ToolMessage` 写入 history
- 继续模型下一轮推理

### 致命错误

以下错误默认视为致命错误：

- provider 原始流断裂或读取失败
- XML 协议彻底损坏且无法恢复
- 超过 `maxToolRounds`
- 内部实现异常
- 调用方 abort

处理方式：

- 直接让输出流抛错
- 外部通过 `for await` 自然捕获异常

## Abort 语义

`next` 返回的是 `AbortablePromise<ReadableStream<TurnResult>>`。

实现要求：

- 调用 `abort()` 时，应尽量中断当前 provider 请求
- 若工具执行支持中断，也应一并中断
- 最终输出流应以 abort 错误结束

## systemPrompt 的职责

`systemPrompt` 不只是普通文案，而是 `core` 协议的一部分。

至少负责：

- 告诉模型必须使用 XML 标签协议输出
- 告诉模型何时应该返回 `<tool>`
- 告诉模型 `tool` 标签里的 JSON 必须合法
- 指导模型在必要时先调用 `listTools`
- 明确不要输出协议外噪音内容

## 推荐施工顺序

为降低复杂度，推荐按以下顺序实现。

### 第一阶段：收敛类型

优先统一：

- `createSession` 输入参数
- `next` 返回类型
- `Provider` 类型
- `Message` / `History` / `TurnResult` 类型

### 第二阶段：实现基础文本流转发

目标：

- 能从 provider 正常拿到原始文本流
- 能将原始文本累计为 assistant 原始文本
- 能对外输出 `ReadableStream<TurnResult>`

此阶段先不做工具调用。

### 第三阶段：实现 XML 流式解析

目标：

- 能增量解析 `thought` / `answer` / `overview`
- `answer` 可以一边增长一边输出
- 能检测 `<tool>` 片段

### 第四阶段：实现单工具轮转

目标：

- 能解析 `<tool>` JSON
- 能执行工具
- 能把工具结果写回 history
- 能继续下一轮 provider 请求

### 第五阶段：补齐边界处理

包括：

- `maxToolRounds`
- 各类协议错误处理
- abort
- 工具错误回灌
- `listTools`

## 实现阶段的约束

为了保证后续实现稳定，先遵守以下限制：

- 不提前设计复杂 UI 状态
- 不引入事件总线或监听器机制
- 不让 provider 感知 `core` 的 XML 协议
- 不支持同轮多工具并行
- 不在第一版中处理复杂富媒体持久化

## 一句话总结

`core` 的本质是一个基于原始文本流的、使用 XML 协议进行增量解析的、多轮工具可编排的 headless turn runner；它对外只暴露 `next -> promise + readableStream` 这一种使用方式。
