# 功能开发指南

本文档提供了在项目中添加新功能的通用指南，特别适用于在 Settings 中添加新功能项。本指南基于项目的代码风格和组件编写规范，确保新功能与现有代码保持一致。

## 目录

1. [功能类型判断](#功能类型判断)
2. [文件组织规范](#文件组织规范)
3. [组件编写规范](#组件编写规范)
4. [弹窗式设置页面](#弹窗式设置页面)
5. [简单设置项](#简单设置项)
6. [国际化处理](#国际化处理)
7. [样式规范](#样式规范)
8. [类型定义规范](#类型定义规范)
9. [完整示例流程](#完整示例流程)

---

## 功能类型判断

在开始开发前，需要判断功能的复杂度：

- **简单设置项**：无需跳转页面，直接在设置列表中显示和操作（如主题切换、语言选择）
- **复杂设置项**：需要跳转到独立页面进行配置（如用户管理、实验性功能）

### 判断标准

- 如果功能只需要 1-2 个简单的开关或选择器 → **简单设置项**
- 如果功能需要多个配置项、列表管理、表单输入等 → **复杂设置项**

---

## 文件组织规范

### 1. Settings 功能文件位置

所有 Settings 相关的功能组件应放在 `src/components/settings/` 目录下：

```
src/components/settings/
├── index.tsx          # Settings 入口和 Provider
├── form.tsx           # Settings 主表单（需要在这里注册新功能）
├── your-feature.tsx   # 你的新功能文件
└── ...
```

### 2. 文件命名规范

- 使用 kebab-case 命名：`your-feature.tsx`
- 文件名应清晰描述功能用途
- 如果功能有多个相关文件，可以创建子目录

### 3. 组件导出规范

- **默认导出**：主要的 Settings Item 组件
- **命名导出**：辅助组件、工具函数、类型定义等

```typescript
// 默认导出主组件
export default function YourFeatureSettingsItem() {
    // ...
}

// 命名导出辅助组件（如需要）
export function YourFeatureForm() {
    // ...
}
```

---

## 组件编写规范

### 1. 函数式组件

项目使用函数式组件，不使用类组件：

```typescript
// ✅ 正确
export default function YourFeatureSettingsItem() {
    // ...
}

// ❌ 错误
export default class YourFeatureSettingsItem extends React.Component {
    // ...
}
```

### 2. TypeScript 类型定义

- **Props 类型**：直接在函数参数中定义内联类型，不使用单独的 interface（除非类型复杂或需要复用）

```typescript
// ✅ 推荐：简单 Props 使用内联类型
export default function YourFeatureSettingsItem() {
    // ...
}

function Form({ onCancel }: { onCancel?: () => void }) {
    // ...
}

// ✅ 也可以：复杂类型使用 interface
interface ComplexFormProps {
    onCancel?: () => void;
    onConfirm?: (value: string) => void;
    initialData?: SomeType;
}

function ComplexForm({ onCancel, onConfirm, initialData }: ComplexFormProps) {
    // ...
}
```

- **类型导出**：如果类型需要在多个文件中使用，应单独定义并导出

```typescript
// type.ts 或直接在组件文件中
export type YourFeatureType = {
    id: string;
    name: string;
    // ...
};
```

### 3. Hooks 使用

- 使用项目提供的 hooks（如 `useIntl`, `useTheme`, `usePreference` 等）
- 自定义 hooks 放在 `src/hooks/` 目录
- 遵循 React Hooks 规则

### 4. 导入顺序规范

建议按以下顺序组织导入：

1. React 相关
2. 第三方库
3. 项目内部工具和工具函数（`@/utils`, `@/hooks` 等）
4. 项目内部组件
5. 类型定义

```typescript
import { type ReactNode } from "react";
import { toast } from "sonner";
import { useIntl } from "@/locale";
import { usePreference } from "@/store/preference";
import PopupLayout from "@/layouts/popup-layout";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import type { YourFeatureType } from "./type";
```

---

## 弹窗式设置页面

对于需要独立页面的复杂设置项，使用 `createConfirmProvider` 创建弹窗。

### 1. 使用 createConfirmProvider

```typescript
import createConfirmProvider from "../confirm";
import PopupLayout from "@/layouts/popup-layout";

// 定义表单组件
function Form({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    
    return (
        <PopupLayout
            title={t("your-feature-title")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            {/* 你的表单内容 */}
        </PopupLayout>
    );
}

// 创建 Provider 和显示函数
const [YourFeatureProvider, showYourFeature] = createConfirmProvider(Form, {
    dialogTitle: "your-feature-title", // 国际化 key
    dialogModalClose: true, // 是否允许点击外部关闭
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
});

// 导出 Settings Item 组件
export default function YourFeatureSettingsItem() {
    const t = useIntl();
    return (
        <div className="your-feature">
            <Button
                onClick={() => {
                    showYourFeature();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--your-icon] size-5"></i>
                        {t("your-feature-name")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <YourFeatureProvider />
        </div>
    );
}
```

### 2. createConfirmProvider 配置说明

- `dialogTitle`: 弹窗标题的国际化 key（字符串）或 ReactNode
- `dialogDescription`: 弹窗描述（可选，默认等于 dialogTitle）
- `dialogModalClose`: 是否允许点击遮罩层关闭（默认 false）
- `contentClassName`: 弹窗内容容器的 className，用于自定义样式
- `fade`: 是否启用淡入淡出动画（可选）
- `swipe`: 是否启用滑动关闭（可选）

### 3. PopupLayout 使用

`PopupLayout` 是弹窗内容的布局组件，提供统一的头部和返回按钮：

```typescript
<PopupLayout
    title={t("page-title")}        // 页面标题
    onBack={onCancel}              // 返回按钮回调
    className="h-full overflow-hidden"  // 自定义 className
    hideBack={false}               // 是否隐藏返回按钮（可选）
    right={<SomeComponent />}       // 右侧内容（可选）
>
    {/* 页面内容 */}
</PopupLayout>
```

---

## 简单设置项

对于简单的设置项，直接在 Settings 列表中渲染，无需弹窗。

### 标准结构

```typescript
import { useIntl } from "@/locale";
import { usePreference } from "@/store/preference";
import { Switch } from "../ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

export default function YourFeatureSettingsItem() {
    const t = useIntl();
    const [value, setValue] = usePreference("yourPreferenceKey");
    
    return (
        <div className="w-full px-4 py-1 text-sm">
            <div className="w-full px-4 flex justify-between items-center text-sm font-medium">
                <div className="flex items-center gap-2">
                    <i className="icon-[mdi--your-icon] size-5"></i>
                    {t("your-feature-name")}
                </div>
                {/* 根据需求选择 Switch 或 Select */}
                <Switch
                    checked={value}
                    onCheckedChange={setValue}
                />
                {/* 或 */}
                <Select
                    value={value ?? "default"}
                    onValueChange={setValue}
                >
                    <SelectTrigger className="w-fit text-xs rounded-sm">
                        <SelectValue></SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="option1">{t("option1")}</SelectItem>
                        <SelectItem value="option2">{t("option2")}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
```

### 带描述的设置项

```typescript
<div className="w-full min-h-10 pb-2 flex justify-between items-center px-4">
    <div className="text-sm">
        <div>{t("setting-name")}</div>
        <div className="text-xs opacity-60">
            {t("setting-description")}
        </div>
    </div>
    <Switch
        checked={value}
        onCheckedChange={setValue}
    />
</div>
```

---

## 国际化处理

### 1. 使用 useIntl Hook

所有用户可见的文本都应使用国际化：

```typescript
import { useIntl } from "@/locale";

function YourComponent() {
    const t = useIntl();
    
    return (
        <div>
            {t("your-i18n-key")}
        </div>
    );
}
```

### 2. 国际化 Key 命名规范

- 使用 kebab-case：`your-feature-name`
- 保持语义清晰：`auto-locate-when-add-bill`
- 描述性文本添加后缀：`your-feature-description`

### 3. 添加国际化文本

在国际化文件中添加对应的 key：

- `src/locale/lang/zh.json` - 中文
- `src/locale/lang/en.json` - 英文

```json
{
    "your-feature-name": "功能名称",
    "your-feature-title": "功能标题",
    "your-feature-description": "功能描述"
}
```

---

## 样式规范

### 1. Tailwind CSS

项目使用 Tailwind CSS 进行样式管理，优先使用 Tailwind 工具类。

### 2. Settings Item 按钮样式

所有 Settings Item 的入口按钮应使用统一样式：

```typescript
<Button
    variant="ghost"
    className="w-full py-4 rounded-none h-auto"
>
    <div className="w-full px-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <i className="icon-[mdi--icon-name] size-5"></i>
            {t("feature-name")}
        </div>
        <i className="icon-[mdi--chevron-right] size-5"></i>
    </div>
</Button>
```

### 3. 布局规范

- **列表分隔**：使用 `divide-y divide-solid` 创建分隔线
- **滚动容器**：使用 `overflow-y-auto` 和 `flex-1` 实现滚动
- **间距**：使用 Tailwind 的 spacing 工具类（`px-4`, `py-2` 等）

```typescript
<div className="flex-1 overflow-y-auto flex flex-col divide-y pb-4">
    {/* 列表项 */}
</div>
```

### 4. 图标使用

项目使用 Material Design Icons，通过 `icon-[mdi--icon-name]` 类名使用：

```typescript
<i className="icon-[mdi--account-supervisor-outline] size-5"></i>
```

常用图标：
- `mdi--chevron-right` - 右箭头
- `mdi--settings` - 设置
- `mdi--flask` - 实验性功能
- `mdi--theme-light-dark` - 主题
- `mdi--language` - 语言

### 5. 响应式设计

使用 Tailwind 的响应式前缀（`sm:`, `md:`, `lg:` 等）：

```typescript
className="rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]"
```

---

## 类型定义规范

### 1. 类型文件组织

- 如果类型只在单个文件中使用，直接在文件中定义
- 如果类型需要在多个文件中使用，创建 `type.ts` 文件或使用合适的共享位置

### 2. 类型命名

- 使用 PascalCase：`YourFeatureType`
- 接口使用 PascalCase：`YourFeatureProps`
- 类型别名使用 PascalCase：`YourFeatureConfig`

### 3. 类型导出

```typescript
// 在组件文件中
export type YourFeatureType = {
    id: string;
    name: string;
};

// 或创建 type.ts
export type YourFeatureType = {
    // ...
};

export type YourFeatureConfig = {
    // ...
};
```

---

## 完整示例流程

以下以添加一个 "Preset（主题与预设）" 功能为例，展示完整开发流程。

### 步骤 1: 创建功能文件

在 `src/components/settings/` 目录下创建 `preset.tsx`：

```typescript
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";

function Form({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    
    return (
        <PopupLayout
            title={t("preset")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="flex-1 flex flex-col overflow-y-auto py-4">
                {/* 你的预设功能内容 */}
                <div className="px-4">
                    <p>{t("preset-description")}</p>
                </div>
            </div>
        </PopupLayout>
    );
}

const [PresetProvider, showPreset] = createConfirmProvider(Form, {
    dialogTitle: "preset",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
});

export default function PresetSettingsItem() {
    const t = useIntl();
    return (
        <div className="preset">
            <Button
                onClick={() => {
                    showPreset();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--palette-outline] size-5"></i>
                        {t("preset")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <PresetProvider />
        </div>
    );
}
```

### 步骤 2: 在 Settings Form 中注册

编辑 `src/components/settings/form.tsx`，导入并添加到列表：

```typescript
// 在文件顶部添加导入
import PresetSettingsItem from "./preset";

// 在 SettingsForm 组件的列表中添加
<div className="flex-1 overflow-y-auto flex flex-col divide-y pb-4">
    {/* ... 其他设置项 ... */}
    <PresetSettingsItem />
    {/* ... 其他设置项 ... */}
</div>
```

### 步骤 3: 添加国际化文本

在 `src/locale/lang/zh.json` 和 `src/locale/lang/en.json` 中添加：

```json
// zh.json
{
    "preset": "主题与预设",
    "preset-description": "管理主题和预设配置"
}

// en.json
{
    "preset": "Theme & Preset",
    "preset-description": "Manage theme and preset configurations"
}
```

### 步骤 4: 实现功能逻辑

根据具体需求实现功能逻辑，包括：
- 状态管理（使用 Zustand store 或 usePreference）
- 数据持久化
- 用户交互逻辑

---

## 注意事项

1. **保持一致性**：新功能的代码风格、组件结构应与现有代码保持一致
2. **错误处理**：添加适当的错误处理和用户提示（使用 `toast` 等）
3. **性能考虑**：对于复杂列表，考虑使用虚拟滚动或分页
4. **可访问性**：确保组件支持键盘导航和屏幕阅读器
5. **测试**：在开发完成后进行充分测试，确保功能正常工作

---

## 参考示例

可以参考以下现有实现：

- **简单设置项**：`src/components/settings/theme.tsx`, `src/components/settings/language.tsx`
- **复杂设置项**：`src/components/settings/user.tsx`, `src/components/settings/lab.tsx`
- **弹窗实现**：查看 `src/components/confirm/index.tsx` 了解 createConfirmProvider 的工作原理

---

## 总结

遵循本指南可以确保新功能：
- ✅ 符合项目代码风格
- ✅ 与现有组件保持一致
- ✅ 正确使用项目提供的工具和组件
- ✅ 支持国际化
- ✅ 具有良好的用户体验

如有疑问，请参考现有代码实现或咨询项目维护者。
