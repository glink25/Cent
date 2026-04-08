## Widget 功能介绍

Cent 致力于成为最好的记账App，但是用户的需求是做不完的，总有这样那样的细节无法考虑周到。为了让用户完全自定义自己的账本，Cent决定使用全新的 Widget API ，用于满足不同用户的高级自定义需求。

### Widget 是什么？

Widget是一个能狗自由处理账单数据，并且渲染为简单UI的JS脚本，它能够让用户自由统计、筛选数据，并且展示出来。

### Widget主要功能

Widget的功能入口位于settings页面-账本设置-主题与预设功能下方，名称为Widget设置，进入Widget设置页后，将会看到目前所有安装的Widget列表，列表中的元素包含Widget的名称、界面预览，和一个编辑按钮，下方还有一个switch控件标识是否需要在首页展示。Widget设置页面右上角有一个新增Widget按钮，点击按钮，或者点击列表Widget的编辑按钮，都会进入Widget编辑页面（新增的话即为空的widget），与其他设置功能的交互逻辑保持一致。（参考预算功能页）

#### Widget编辑页

Widget 编辑页由一个简易的文本输入框,权限介绍栏,表单区域和一个Widget预览区域组成：
输入框用于输入Widget的js源代码脚本；
权限介绍栏用于展示当前脚本声明的权限，并且允许用户勾选是否允许；
表单区域会根据Widget声明的config配置，渲染表单组件，并且让用户填写对应值，这些值会被用于widget的渲染
预览区域则会渲染该Widget的界面，用于调试。

#### Widget 展示
1. Widget 可以配置是否在首页展示showInHome，在 Widget 列表中每个Widget项目都有一个Switch控件用于切换。当开启后，首页(src/pages/home/index.tsx)中将会展示Widget列表，就像预算Budget组件那样，在Promotion组件上方新增一个横向滑动容器，容器里将会展示启用的widget，使用useSnap可以滑动切换不同的Widget

2. TODO: Widget 也可以展示在统计页，通过筛选视图配置，可以配置具体要展示哪些Widget，在统计页面展示的Widget获取到的Billing数据将为筛选后的数据。

### Widget 配置表单

Widget的核心代码已经在./core/runner.ts 中定义好，表单功能已完整实现。以下是关键实现说明：

#### 1. 表单功能实现（已完成）
- Widget 脚本通过 `export const config` 声明表单配置项
- 表单组件 `ConfigForm` 根据 config 自动渲染对应的表单控件
- 支持四种表单类型：`text`、`number`、`date`、`select`
- 用户填写的 settings 值会持久化保存在 Widget 配置中
- 表单值变化时实时更新预览（500ms 防抖）

#### 2. 数据流向
```
Widget 定义 config → compileWidget 解析 → ConfigForm 渲染 → 用户填写 → 
formSettings 状态管理 → runWidget 传入 context.settings → 渲染函数使用
```

#### 3. 配置示例
```javascript
export const config = {
  title: { type: 'text', label: '标题', default: '我的账单' },
  threshold: { type: 'number', label: '阈值', default: 1000 },
  category: { type: 'select', label: '分类', options: ['餐饮', '交通'] },
  startDate: { type: 'date', label: '开始日期' }
};

export default async ({ data, settings }) => {
  const title = settings.title || '默认标题';
  const threshold = settings.threshold || 0;
  // 使用 settings 中的值...
};
```