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
    * `.color(value)`: 颜色（Hex/RGBA）。
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
 * @permissions budget
 */

export const config = {
  showPercent: { type: 'Select', label: '显示百分比', options: ['是', '否'], default: '是' }
};

export default async ({ data, settings }) => {
  const { total, used } = data.budget;
  const isWarning = used / total > 0.9;

  return Flex(
    Text(settings.title || "预算进度").fontSize(14).color('#999'),
    Flex(
      Container().bg(isWarning ? 'red' : 'green').width(`${(used/total)*100}%`).height(8),
      Container().bg('#eee').width(`${(1 - used/total)*100}%`).height(8)
    ).direction('row').borderRadius(4).padding(2),
    settings.showPercent === '是' ? Text(`${Math.round(used/total*100)}%`).bold() : null
  ).direction('column').gap(8);
};
```

---

## 7. 执行约束
1.  **纯净性**：渲染函数应尽可能为纯函数，不建议在函数内部产生副作用（如修改全局变量）。
2.  **超时**：渲染函数执行时间不得超过 2000ms，否则系统将强制终止。
3.  **安全性**：脚本无法访问 `eval`, `Function` (构造函数), `XMLHttpRequest`, `WebSocket` 以及任何 DOM 元素。