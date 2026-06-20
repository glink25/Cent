# 高级搜索语法（Filter Query）

在账单筛选器的「备注」输入框里，以 `q:` 开头即可进入高级搜索模式。语法借鉴 Lucene，支持字段查询、范围、布尔组合（AND / OR / NOT）与括号嵌套，让你用一句话表达原本需要多个筛选项才能表达的复杂条件。

如果备注不以 `q:` 开头，行为和过去完全一致——按子串匹配账单备注。

---

## 5 分钟上手

| 想表达的 | 输入 |
| --- | --- |
| 备注里出现 "晚餐" | `晚餐`（普通模式即可，无需 `q:`） |
| 金额大于 100 的账单 | `q:amount:>100` |
| 餐饮分类 **且** 金额 ≥ 100 | `q:category:餐饮 AND amount:>=100` |
| 旅行 **或** 出差标签 | `q:tag:旅行 OR tag:出差` |
| 有图片附件、且 不是 周期账单 | `q:has:assets AND -has:scheduled` |
| 餐饮 **或** 交通，金额都要超过 50 | `q:(category:餐饮 OR category:交通) AND amount:>50` |
| 最近 7 天的支出 | `q:recent:7d AND type:expense` |

> 触发前缀只识别第一个非空白字符开始的 `q:`。`q:` 之后才是真正的查询语句。

---

## 字段速查表

| 字段 | 含义 | 示例 |
| --- | --- | --- |
| `type` | 账单类型，`income` / `expense` | `type:expense` |
| `category` | 分类。可填 ID 或名称 | `category:餐饮` |
| `tag` | 标签。可填 ID 或名称，多个标签用 OR / AND 自行组合 | `tag:旅行` |
| `creator` / `user` | 记账人 | `creator:张三` |
| `currency` | 币种代码 | `currency:USD` |
| `amount` | 金额（数值） | `amount:>100`、`amount:[50 TO 200]` |
| `time` | 账单发生时间，支持 ISO 日期 | `time:>=2025-01-01` |
| `recent` | 相对时间：`d`/`w`/`M`/`y`，`<n><unit>` | `recent:7d`、`recent:1M` |
| `has` | 布尔标志：`assets` / `scheduled` / `comment` / `location` | `has:assets` |
| `comment` | 备注子串匹配。**默认字段**——不写字段名时即此 | `comment:晚餐` 或 直接写 `晚餐` |

---

## 操作符

### 比较与范围（用于 `amount` / `time`）

| 写法 | 含义 |
| --- | --- |
| `amount:100` | 等于 100 |
| `amount:>100` | 严格大于 |
| `amount:>=100` | 大于等于 |
| `amount:<50` / `amount:<=50` | 小于 / 小于等于 |
| `amount:[50 TO 200]` | 闭区间，左右都包含 |
| `time:[2025-01-01 TO 2025-03-31]` | 时间区间 |

> `time` 在等号场景按「同一天」匹配（忽略时分秒）。要精确小时级，请用 ISO 时间戳并搭配 `>=` / `<=`。

### 布尔逻辑

| 逻辑 | 写法（任选其一） |
| --- | --- |
| 与 | `AND`、`&&`，或 **直接相邻**（隐式 AND） |
| 或 | `OR`、`\|\|` |
| 非 | `NOT`、`!`、`-` 前缀 |
| 分组 | `( ... )` |

```
q:晚餐 amount:>100        # 隐式 AND：备注含"晚餐" 且 金额>100
q:(tag:旅行 OR tag:出差) AND -has:scheduled
q:!type:income            # 不是收入
```

> 优先级：`NOT > AND > OR`。如不确定，加括号。

### 引号与空格

值里包含空格、冒号或括号，请用双引号包裹：

```
q:comment:"家庭 聚餐"
q:tag:"项目 Alpha"
```

---

## ID vs 名称：自动两种都认

`category` / `tag` / `creator` 这类字段背后都是 `{id, name}` 的实体。语法允许你随便用：

- 输入 **名称**（如 `category:餐饮`）→ 系统自动翻译成对应 ID 再去匹配；
- 输入 **ID**（如 `category:cat_abc123`）→ 直接按 ID 匹配；
- 同名实体（比如两个都叫"打车"的标签）→ 全部命中，符合直觉；
- 名称在元数据里**不存在** → 退化为按字面量匹配，不会报错（也就不会命中任何账单）。

> 优先推荐用名称——更直觉、可读性更好。需要分享/导出查询语句、且要保证语义不随重命名漂移时，才需要切到 ID。

---

## 实战案例

```
# 1. 找出本月所有大于 500 元的非周期支出
q:type:expense AND amount:>500 AND recent:1M AND -has:scheduled

# 2. 旅行相关消费——餐饮或交通分类，限定 USD
q:(category:餐饮 OR category:交通) AND tag:旅行 AND currency:USD

# 3. 备注里有"报销"但还没贴发票（无图片）
q:报销 AND -has:assets

# 4. 所有非"日常"分类的小额收入
q:type:income AND amount:<100 AND -category:日常

# 5. 上半年餐饮 + 标签为家庭的所有账单
q:category:餐饮 AND tag:家庭 AND time:[2025-01-01 TO 2025-06-30]
```

---

## 实现速览（给开发者）

`src/ledger/filter-query/index.ts` 是一个三段式纯管道：

```
parseFilterQuery(query)        : string → RawAST | null      // 不依赖任何外部状态
compileFilterQuery(ast, ctx)   : RawAST × Context → CompiledAST | null
                                                              // 在此把 name 解析为 id、field 收敛为类型化节点
matchFilterQuery(compiled, bill): CompiledAST × Bill → boolean
                                                              // 纯求值，零 context 依赖
```

热路径请用 `createBillMatcher(filter, ctx)`（`src/ledger/utils.ts`）：parse + compile 仅在创建闭包时执行一次，每个 bill 只走最后一段求值——和直接的 `filter.includes(...)` 同量级开销。

```ts
import { createBillMatcher } from "@/ledger/utils";

const matcher = createBillMatcher(filter, {
    categories: allCategories,
    tags: allTags,
    users: allUsers,
    baseCurrency: meta.baseCurrency,
});

const result = bills.filter(matcher);
```

设计上没有任何模块级可变状态，AST/Context 都是纯数据，可以原样移植到 Swift / Kotlin / Rust（带关联值的 enum + 普通函数）。

---

## 已知限制与扩展方向

- 当前 `time:>2025-01-01` 在等号语义里按「同一天」匹配；需要精确到小时/分钟，请改用 ISO 完整时间戳 + `>=` / `<=`。
- 不支持模糊匹配（`*` / `~`）和正则——备注子串匹配走的是 `String.includes`。
- `recent` 的 unit 透传给 `dayjs.subtract`，常用 `d`（天）/`w`（周）/`M`（月）/`y`（年）。注意 `M` 是月、`m` 是分钟。
- 没有缓存层——`createBillMatcher` 每次创建都会 parse+compile。如果你在 UI 里需要响应式，把它包在 `useMemo` / `computed` 里。
