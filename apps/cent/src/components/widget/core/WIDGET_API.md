# Widget API 1.0 技术规范文档

本规范定义了 Widget 脚本的结构、权限管理、用户交互及渲染逻辑。脚本需保存为 `.js` 文件，并遵循以下约定。

---

## 1. 脚本总体结构
每一个 Widget 脚本必须包含三个核心部分：**元数据与权限声明**（通过头部注释）、**配置表单声明**（导出对象）以及 **主渲染函数**（默认导出）。

```javascript
/**
 * @widget-api 1.0
 * @name 资产概览组件
 * @permissions billing, budget
 */

// 1. 表单声明 (可选)
export const config = { ... };

// 2. 渲染函数 (必选)
export default async (context) => { ... };
```

---

## 2. 权限声明 (Permissions)
Widget 必须在文件头部的 JSDoc 注释中声明其所需访问的数据权限。未声明的权限对应的上下文数据将为 `undefined`。

| 权限标识符 | 数据说明 | 注入上下文后的字段 |
| :--- | :--- | :--- |
| `billing` | 用户的账单历史、收支流水记录 | `context.data.billing` |
| `filter` | 应用当前的全局筛选状态（如时间区间、分类） | `context.data.filter` |
| `budget` | 用户的预算设置及当前执行进度数据 | `context.data.budget` |
| `collaborators` | 账本协作者信息 | `context.data.collaborators` |
| `category` | 账单类别信息 | `context.data.categories` |
| `currency` | 多币种信息 | `context.data.currencies` |
| `tag` | 账单标签信息 | `context.data.tags` |

### 数据结构说明

#### billing 账单流水
```typescript
context.data.billing // Bill[]

type BillType = "income" | "expense";
/** 整数金额，10000:1（即代码中的 amount 数值需除以 10000 才是实际金额） */
type Amount = number;
type GeoLocation = { latitude: number; longitude: number; accuracy: number };

type Bill = {
  /** 每笔账单的唯一标识 */
  id: string;
  /** 账单类型，代表收入或者支出 */
  type: BillType;
  /** 账单的类别 id（对应 BillCategory.id），可以是父类或子类 */
  categoryId: string;
  /** 创建者的 id */
  creatorId: number | string;
  /** 备注 */
  comment?: string;
  /** 整数金额，10000:1 */
  amount: Amount;
  /** 账单发生的时间（毫秒时间戳） */
  time: number;
  /** 账单的图片附件 */
  images?: (File | string)[];
  /** 账单的地址 */
  location?: GeoLocation;
  /** 账单的 tag id 列表 */
  tagIds?: string[];
  /** 多币种信息 */
  currency?: {
    /** 记账当时设置的本位币 */
    base: string;
    /** 记账当时选择的币种 */
    target: string;
    /** 记账当时填写的金额（非 10000:1 缩放） */
    amount: number;
  };
  /** 其他额外信息 */
  extra?: {
    scheduledId?: string;
  };
};
```

#### filter 全局筛选状态
```typescript
context.data.filter // BillFilter（无筛选时为 {}）

type BillFilter = Partial<{
  /** 备注关键字 */
  comment: string;
  /** 相对时间区间（与 start/end 二选一） */
  recent?: {
    value: number;
    unit: "year" | "month" | "week" | "day";
  };
  /** 起始时间（毫秒时间戳） */
  start: number;
  /** 结束时间（毫秒时间戳） */
  end: number;
  /** 限定收/支类型 */
  type: BillType | undefined;
  /** 限定创建者 id 列表 */
  creators: (string | number)[];
  /** 限定分类 id 列表 */
  categories: string[];
  /** 最小金额（实际金额，非 10000:1 缩放） */
  minAmountNumber: number;
  /** 最大金额（实际金额，非 10000:1 缩放） */
  maxAmountNumber: number;
  /** 是否仅资产相关 */
  assets?: boolean;
  /** 是否仅周期记账生成 */
  scheduled?: boolean;
  /** 必须包含的标签 id */
  tags?: string[];
  /** 排除的标签 id */
  excludeTags?: string[];
  /** 展示用的本位币 */
  baseCurrency: string;
  /** 限定币种列表 */
  currencies?: string[];
}>;
```

#### budget 预算
```typescript
context.data.budget // Budget[]

type Budget = {
  /** 预算唯一标识 */
  id: string;
  /** 预算名称 */
  title: string;
  /** 预算起始时间（毫秒时间戳） */
  start: number;
  /** 预算结束时间（毫秒时间戳，可选） */
  end?: number;
  /** 预算重复周期 */
  repeat: {
    unit: "week" | "day" | "month" | "year";
    value: number;
  };
  /** 参与者（创建者 id 列表） */
  joiners: (string | number)[];
  /** 总预算金额（整数，10000:1） */
  totalBudget: number;
  /** 分类预算明细 */
  categoriesBudget?: {
    /** 分类 id */
    id: string;
    /** 该分类的预算金额（整数，10000:1） */
    budget: number;
  }[];
  /** 仅统计这些标签 */
  onlyTags?: string[];
  /** 排除这些标签 */
  excludeTags?: string[];
};
```

> 注：`budget` 中仅包含预算的配置数据，**不包含已使用进度**。如需统计已用金额，需结合 `billing` 数据按 `start`/`end`/`categoriesBudget`/`onlyTags`/`excludeTags` 等字段自行计算。

#### collaborators 协作者信息
```javascript
context.data.collaborators // Array<{ id: string | number; name: string; avatar_url?: string; ... }>
```

#### categories 账单类别
```javascript
context.data.categories // Array<{ id: string; name: string; type: 'income' | 'expense'; icon: string; color: string; parent?: string; ... }>
```

#### currencies 多币种
```javascript
context.data.currencies // { base: string; custom?: Array<{ id, name, symbol, rateToBase }>; quick?: string[] }
```

#### tags 账单标签
```javascript
context.data.tags // Array<{ id: string; name: string; preferCurrency?: string; ... }>
| `collaborators` | 账本协作者信息 | `context.data.collaborators` |
| `category` | 账单分类信息 | `context.data.categories` |
| `currency` | 多币种配置信息 | `context.data.currencies` |
| `tag` | 账单标签信息 | `context.data.tags` |

---

## 3. 表单声明 (Config Form)
通过导出 `config` 对象，Widget 可以要求用户在放置组件前输入特定的配置参数。这些参数将通过 `context.settings` 注入渲染函数。

### 表单配置项类型
* **text**: 文本输入框。
* **number**: 数字输入框
* **date**: 日期选择器。
* **select**: 下拉单选。

**示例：**
```javascript
export const config = {
  title: { type: 'text', label: '组件标题', default: '我的账单' },
  threshold: { type: 'number', label: '预警阈值', default: 1000 },
  category: { type: 'select', label: '统计分类', options: ['餐饮', '交通', '购物'] },
  time: { type: 'date', label: '开始时间' },
};
```

---

## 4. 渲染函数 (Render Function)
Widget 脚本必须默认导出一个函数（支持 `async`）。该函数是 Widget 的生命周期核心，负责将数据转化为 UI 描述。

### 函数签名
`export default async function(context): DSL`

### 参数：`context` 对象
`context` 是一个只读对象，包含了脚本运行所需的所有外部信息：

| 属性 | 类型 | 说明 |
| :--- | :--- | :--- |
| `data` | `Object` | 包含已授权读取的业务数据（如 `data.billing`）。 |
| `settings` | `Object` | 包含用户在“表单声明”中填写的数值。 |
| `env` | `Object` | 包含系统环境信息，如 `env.theme` (light/dark) 或 `env.language`。 |

---

## 5. UI 描述语言 (DSL)
渲染函数必须返回由预定义帮助函数构建的 DSL 对象。这些函数支持链式调用以配置样式。

### 基础组件库
* **`Flex(...children)`**: 容器组件。
    * `.direction(value)`: 布局方向，可选 `'row' | 'column'`。
    * `.justify(value)`: 对齐方式，如 `'center' | 'space-between'`。
    * `.align(value)`: 交叉轴对齐，如 `'center' | 'stretch'`。
    * `.gap(value)`: 子元素间距（数字）。
* **`Text(content)`**: 文本组件。
    * `.fontSize(value)`: 字号。
    * `.color(value)`: 颜色（Hex 或 rgba 字符串）。
    * `.bold(bool)`: 是否加粗。
* **`Image(src)`**: 图片组件。
    * `.width(value)` / `.height(value)`: 尺寸。
    * `.mode(value)`: 裁剪模式，如 `'cover' | 'contain'`。
* **`Container(...children)`**: 万能容器，支持更多样式属性如 `.bg()`, `.padding()`, `.borderRadius()`。

---

## 6. 完整代码示例
以下是一个标准的 Widget 脚本实现参考：

```javascript
/**
 * @widget-api 1.0
 * @name 预算进度条
 * @permissions budget, billing
 */

export const config = {
  showPercent: { type: 'select', label: '显示百分比', options: ['是', '否'], default: '是' }
};

export default async ({ data, settings }) => {
  // data.budget 为 Budget[]，这里取第一个预算演示
  const budget = (data.budget ?? [])[0];
  if (!budget) return Text('暂无预算').color('#999');

  // amount 为 10000:1 的整数金额，需统一换算为实际数值
  const total = budget.totalBudget / 10000;

  // budget 中不包含已使用进度，需从 billing 中按预算的时间范围与参与者过滤累计支出
  const start = budget.start;
  const end = budget.end ?? Date.now();
  const used = (data.billing ?? [])
    .filter(b =>
      b.type === 'expense' &&
      b.time >= start && b.time <= end &&
      budget.joiners.includes(b.creatorId)
    )
    .reduce((sum, b) => sum + b.amount / 10000, 0);

  const ratio = total > 0 ? used / total : 0;
  const isWarning = ratio > 0.9;

  return Flex(
    Text(budget.title || "预算进度").fontSize(14).color('#999'),
    Flex(
      Container().bg(isWarning ? 'red' : 'green').width(`${Math.min(ratio, 1) * 100}%`).height(8),
      Container().bg('#eee').width(`${Math.max(1 - ratio, 0) * 100}%`).height(8)
    ).direction('row').borderRadius(4).padding(2),
    settings.showPercent === '是' ? Text(`${Math.round(ratio * 100)}%`).bold() : null
  ).direction('column').gap(8);
};
```

---

## 7. 执行约束
1.  **纯净性**：渲染函数应尽可能为纯函数，不建议在函数内部产生副作用（如修改全局变量）。
2.  **超时**：渲染函数执行时间不得超过 2000ms，否则系统将强制终止。
3.  **安全性**：脚本无法访问 `eval`, `Function` (构造函数), `XMLHttpRequest`, `WebSocket` 以及任何 DOM 元素。