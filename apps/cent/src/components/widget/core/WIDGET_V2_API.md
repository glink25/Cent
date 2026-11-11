# Widget API 2.0

声明 `@widget-api 2.0`。已有 1.x 脚本需升级后才能运行。新组件使用交互式 DSL 和共享 storage，不需要 config 表单。

完整示例为[账户与转账](../examples/accounts.js)。账户余额来自账户标签下的账单，转账保存为两笔关联账单，手续费单列。组件提供按账户筛选的统计视图和排除「不计收支」标签的实际收支视图。

## 作用域与生命周期

- `GlobalMeta.widgets` 保存代码、授权、实例 ID 和 `storage`，在账本成员之间共享。
- `ctx.viewer.id` 是宿主提供的当前用户 ID。组件可以自行实现个人化配置和 computed；这只是呈现规则，不是数据保密边界。
- `ctx.state` / `ctx.form` 由宿主在内存中保存，属于一个视图会话。不同展示位置、不同用户、不同弹窗互不共享草稿。
- Bill 是唯一事实来源。storage 保存配置，不保存需要与账单同步的权威余额。
- 删除组件一并删除 storage，computed 消失；历史 Bill 和其中的引用、私有字段保留，允许定义无法解析。
- 写入并发处理沿用 Cent 底层，不额外引入版本或冲突协议。

## 编写视图

```js
/**
 * @widget-api 2.0
 * @name 示例
 * @permissions billing, edit, storage
 */
export default function Main(ctx) {
    return Button("编辑").key("open").onTap(() =>
        ctx.openModal(Editor, { title: "备注" }, { title: "编辑备注" })
    );
}
export function Editor(ctx) {
    const [text, setText] = ctx.state("text", "");
    return Column(
        Input({ label: ctx.params.title, value: text, onChange: setText }).key("text"),
        Button("保存配置").key("save").onTap(async () => {
            await ctx.api.setStorage({ ...ctx.storage, text });
            await ctx.closeModal();
        }),
    ).gap(12);
}
```

默认导出是主视图；弹窗必须使用具名导出函数。`openModal(viewFunction, params?, {title}?)` 在打开后返回，不等待用户提交。支持最多 7 层弹窗，关闭后回到上一层。Web 宿主使用统一弹窗，继承宿主的关闭动画、返回行为和焦点恢复。`closeModal()` 只能关闭当前弹窗。

`ctx.state(key, initialValue)` 返回 `[value, setter]`。setter 接收值或 `(previous) => next`。key 显式指定，不依赖调用顺序。初始化值只在当前会话缺少该 key 时生效。

`ctx.form(key, initialObject)` 返回 `{values, field(name)}`。`field` 生成 `{value, onChange}`，可展开到控件上；它不限制布局，也不复用旧 config 表单。

状态更新与其他副作用只能出现在回调中。render 和 computed 必须无副作用；不能依赖全局变量、随机数或当前系统时间生成 UI 身份。使用宿主提供的 `ctx.now` 获取本次调用的时间。

## DSL

保留 `Flex / Text / Image / Container` 和已有样式链式方法。增加：

- `Row(...children)` / `Column(...children)`：Flex 的方向简写。
- `.key(string)`：稳定节点身份。动态列表每项必须使用业务 ID；不要用数组下标或随机值。条件分支中的不同操作也应有不同 key。
- `.onTap(async () => ...)`：点击回调，支持等待宿主操作。
- `Button(label)`：配合 onTap 使用。
- `Input({label, value, onChange, type?, placeholder?, disabled?})`：输入值始终是字符串；`type: "decimal" | "number"` 提供数字键盘，由脚本解析并校验。
- `Select({label, value, onChange, options, multiple?, disabled?})`：options 为字符串数组或 `{value: string, label: string}[]`；单选值为字符串，多选值为字符串数组。
- `Switch({label, value, onChange, disabled?})`：布尔值。
- `DateTimePicker({label, value, onChange, disabled?})`：毫秒时间戳，宿主显示本地时间。
- `Line({points: [[x,y], ...], viewBox?, color?, strokeWidth?, label?})`：折线，默认坐标范围 `0 0 100 100`，可通过 width/height 控制尺寸。

回调不会进入可序列化 DSL。渲染时运行时生成事件标识；事件触发时使用最新宿主状态和数据重新构建视图，再恢复目标回调。不存在或已关闭视图中的事件被拒绝。每次运行结束销毁 Worker。视图内部可以使用普通函数分解复杂 UI。

事件按会话宿主顺序处理；输入控件在重绘时保持节点身份。写入期间点击按钮不可用，失败显示错误并保留表单。事件执行中的局部变量是快照，不会在 await 后自动更新。

## 上下文与授权

- `ctx.widgetId`：当前安装实例 ID。
- `ctx.viewer.id`：当前用户 ID。
- `ctx.storage`：本次执行开始时读取的共享 JSON 对象。
- `ctx.params`：打开视图时的参数。
- `ctx.now`：毫秒时间戳。
- `ctx.env`、`ctx.settings`：环境和旧配置兼容入口。
- `ctx.id(localKey)`：`wc-<widgetId>:<localKey>`，用于稳定元数据 ID。
- `ctx.viewModule("ExportedView")`：统计视图中的临时模块引用，复用父组件代码、授权和 storage。

读取权限继续使用 billing/filter/budget/collaborators/category/currency/tag，按声明与安装授权的交集注入。

**2.0 的 `data.billing` 是完整账本快照**，不再隐式限制为首页前 200 条或当前统计筛选结果。统计位置可通过 filter 权限读取 `data.filter.billIds` 获取当前范围 ID；脚本自行选择统计范围。computed 不读取账单，只读取基础元数据与 storage，避免数据循环依赖。

`edit`、`storage` 是新增写入权限，在编辑器中显式勾选。storage 快照本身可以读取，storage 权限控制持久化写入。预览仅修改内存副本，不写账本。

## 写入账单

```js
const { createdIds } = await ctx.api.edit({
    create: [billInput],
    update: [{ id: existingId, value: completeBillInput }],
    delete: [existingId],
});
```

三个数组均可省略。一次最多各 1000 项，底层以一个 batch 提交。不另行承诺底层之外的同步或事务语义。

billInput 遵循 Cent Bill 格式，但不包含 id/creatorId，由宿主生成或保留。amount 为非负安全整数，10000:1；time 为毫秒时间戳。update 提供完整的可编辑字段。

宿主写入 `extra.widgetId` 作为创建来源。组件不能提供或改写它；修改与删除必须命中当前实例创建的账单。私有字段只能位于 `extra["wc-" + ctx.widgetId]`，内容为 JSON。宿主保留更新目标原有的其他 extra 字段。

编辑失败抛出异常，因此以下写法只在成功后关闭：

```js
await ctx.api.edit({ create: bills });
await ctx.closeModal();
```

## 共享 storage

`await ctx.api.setStorage(nextObject)` 替换当前实例的 storage；传入标准 JSON 对象，序列化大小上限为 1 MB。更新单个字段时使用 `{...ctx.storage, field: value}`。不修改其他组件的 storage，不自动更新当前回调中已有的快照。

## computed 元数据

```js
export function computed(ctx) {
    return {
        categories: [{ id: ctx.id("out"), name: "转出", type: "expense", icon: "", color: "#888", position: 0 }],
        tags: [{ id: ctx.id("wallet"), name: "钱包", opaque: true }],
        tagGroups: [{ id: ctx.id("accounts"), name: "账户", color: "blue", position: 999999, tagIds: [ctx.id("wallet")] }],
        customFilters: [{
            id: ctx.id("view"), name: "账户统计",
            filter: { tags: [ctx.id("wallet")] },
            modules: [ctx.viewModule("AccountStatistics")],
        }],
    };
}
```

各数组可省略，每组最多 1000 项；同组 ID 不得重复，必须使用当前实例命名空间。不同用户对应同一业务对象时保持相同 ID，不同对象不能复用 ID。引用字段使用完整 ID。

条目可带 `position`，必须为非负安全整数，始终相对于**原始列表**：`0` 插入第一项前，`n` 插入原始索引 n 前；超过原始长度（例如 `999999`）或省略时追加。同一插入槽按组件安装顺序、组件返回数组顺序排列，不受异步计算完成顺序影响。例如原始 `[A, B]` 加上 `X(0), Y(0), Z(999)`，结果为 `[X, Y, A, B, Z]`。分类合并后再构建树，位置不改变父子关系；标签组的位置只针对真实标签组，“未分组”仍固定在最后。

类型区分声明、宿主派生项与有效读取项：

```ts
type ComputedDeclaration<T> = T & { position?: number };
type ComputedEntry<T> = ComputedDeclaration<T> & { widgetId: string };
type EffectiveEntry<T> = T | ComputedEntry<T>;
```

`widgetId` 由宿主注入，脚本传入的同名字段不会决定来源。基础 BillCategory/BillTag/BillTagGroup/BillFilterView 不包含来源或位置字段；UI 通过 `isComputedEntry()` 判断派生项。有效读取层返回基础项与派生项的联合类型，保存与导出仍读取原始 meta。

结果在内存中合并，禁止普通编辑入口修改；不会写回 meta。组件失败不会阻断其他组件，错误可从 `useWidgetMeta().errors` 查看。

`opaque` 只改变账单列表透明度，不排除统计。未返回的定义不提供解析，不区分可见/可选。

## 验证

```sh
node --test apps/cent/scripts/widget-runtime.test.mjs
pnpm --filter cent lint
```

浏览器宿主已实现以上交互。其他原生宿主需要实现相同 DSL 事件、表单、弹窗及能力桥接；本仓库不包含原生端实现。

### 组合布局与原生控件

节点可以用 `.style({...})` 一次设置样式，也可以混用已有链式方法。便携样式采用逻辑尺寸。尺寸、间距、边框使用非负数，宽高也可写百分比。新增属性包括 `wrap`、`grow`、`shrink`、`minWidth`、`maxWidth`、`minHeight`、`paddingX`、`paddingY`、`borderWidth`、`borderColor`、`fontWeight` 和 `textAlign`。`fontWeight` 支持 normal、medium、semibold、bold，`textAlign` 支持 start、center、end。颜色可用十六进制值或宿主主题色 `theme:surface`、`theme:muted`、`theme:border`、`theme:accent`、`theme:onAccent`、`theme:danger`。已有 Web 样式值继续可用。

- `Button({ label?, disabled?, expanded? }, ...children)` 可组合展示内容。带可读文字时可从内容获取名称，纯图形按钮需提供 label。expanded 用于展开或收起其他内容的操作。
- `ChoiceGroup({ label, value, onChange, disabled? }, ...choices)` 管理单选。每个 `Choice({ value, label?, disabled?, selectedStyle? }, ...children)` 使用不同的非空字符串 value。作者控制选项布局和选中外观，宿主提供焦点、键盘操作和选中语义。
- Button 和 Choice 内部可放 Flex、Container、Text、Image、Line 等展示节点。其它按钮或输入控件应作为同级节点。
- Input、Select、Switch、DateTimePicker 的 style 设置外层布局。默认 label 由宿主显示，也可以用自己的 Text 布局并通过 accessibleLabel 为控件提供可访问名称。

```js
const form = ctx.form("transfer", { from: "" });
return ChoiceGroup(
    { label: "转出账户", ...form.field("from") },
    ...accounts.map(account =>
        Choice(
            { value: account.id, selectedStyle: { borderColor: "theme:accent" } },
            Row(Text(account.name).bold(true), Text(account.balance)).gap(12),
        ).key(account.id).style({ paddingX: 12, borderWidth: 1, borderRadius: 10 }),
    ),
).gap(8);
```

应用内各端按相同的布局与字段语义实现。日期选择、输入法、焦点和触感由宿主提供，原生适配可以使用 iOS 系统控件或 Android Material 控件。主屏幕 Widget 适配优先呈现展示节点，交互表单在 Cent 应用内打开。本仓库的实现和验证范围为 Web。

### 刷新与节点身份

给动态列表项和会出现在条件分支旁的输入字段设置稳定的 key。宿主在同级按 key 与节点类型匹配，省略 key 时使用位置。内容相同的子树可以复用，重排列表时仍保留对应控件。事件只更新当前会话及新增视图，账单、storage 或外部数据变化会刷新相关视图。弹窗栈中被覆盖的视图保留其节点，恢复时继续使用原来的会话。以上由宿主完成，视图函数仍返回完整 DSL。

### 账单图片附件

- `FilePicker({ label, value, onChange, multiple?, disabled? })` 使用宿主文件选择器，需声明并获授 `edit` 权限。当前账单附件格式为 PNG、JPEG、GIF 和 WebP。默认单选，开启 `multiple` 后最多 3 张，每张最多 10 MB。
- `onChange` 接收 `string[]`，可以直接绑定 `ctx.form().field()`。这些字符串是当前视图会话中的临时引用。重新选择或清除会替换该选择器的上一批引用。取消系统选择器保留已有选择。
- 在 `ctx.api.edit()` 的账单 `images` 字段传入这些引用，宿主将选中的图片作为普通账单附件保存。更新账单时省略 `images` 保留已有附件，传 `[]` 清除。临时引用仅用于当前会话的提交。
- `Attachment({ billId, index, alt? })` 通过账单 ID 和从 0 开始的附件索引显示已保存的图片，需声明并获授 `billing` 权限。可用 `.style()` 设置尺寸、圆角和裁剪方式。编辑器预览中的保存只作用于模拟账单。

```js
const form = ctx.form("bill", { images: [] });
return Column(
    FilePicker({ label: "凭证", multiple: true, ...form.field("images") }).key("images"),
    Button("保存").onTap(async () => {
        await ctx.api.edit({ create: [{ ...draft, images: form.values.images }] });
        await ctx.closeModal();
    }),
);
```

### computed 自定义币种

computed 可返回 `customCurrencies` 数组。每项使用现有 CustomCurrency 字段及可选 position，ID 使用 ctx.id()。rateToBase 为正有限数，表示一单位该币种对应的账本本位币金额。

```js
export function computed(ctx) {
    return {
        customCurrencies: [{
            id: ctx.id("points"),
            name: "积分",
            symbol: "P",
            rateToBase: 0.01,
            position: 0,
        }],
    };
}
```

宿主注入来源信息后，将币种加入内存中的自定义币种列表，供币种设置、快捷币种选择、记账和统计换算使用。来源组件管理币种定义。用户可以将其加入账本 quickCurrencies。保存和导出仅包含原始币种配置，卸载组件后移除其 computed 币种，历史账单保留原币金额与本位币金额。

普通视图的 ctx.data.currencies.custom 包含当前生效的自定义币种，computed 执行时读取原始配置。ctx.data.currencies.quick 对应账本 quickCurrencies，账户与转账示例以此生成币种选项，同时保留本位币和当前账户币种。

宿主决定画布尺寸、外部间距、圆角裁剪，以及弹窗导航和安全区域。小组件画布内部默认零边距，首页、统计页、预览和弹窗内容区均由小组件根节点通过 padding / paddingX / paddingY 控制留白。宿主标题、关闭按钮、加载与错误提示，以及原生输入控件自身的内部留白不属于 DSL 画布。
