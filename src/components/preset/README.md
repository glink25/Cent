## 预设(Preset)功能介绍

### 预设(Preset)是什么

预设 是用于将用户当前Cent账本的一些个性化配置进行导入和导出的功能，它相当于一个简化版的“导入导出”功能，只导出指定的配置，不涉及任何账单数据的导出。

### 主要功能

预设 目前允许导出如下配置：

- tags: 用户的自定义标签和标签组相关的配置
- categories: 用户的分类数据
- customFilters: 用户的筛选面板数据
- customCSS: 用户的自定义样式

它的主要UI如下：
1，入口：预设功能入口位于`src/components/settings/preset.tsx`，通过设置页按钮进入具体的预设功能页
2，预设功能页：核心UI代码位于`src/components/preset/form.tsx`，目前提供如下功能：
    1，单独更改CSS代码文本框，允许修改用户配置中的CSS样式
后续需要增加如下功能：
预设功能页：
1，增加导入预设功能，允许用户直接导入预设文件(*.cent-preset.json)，将解析后的数据[合并]到当前配置中，具体合并策略详见【预设合并策略】一章。
2，增加导出预设功能，允许用户直接导出预设文件，并在导出前弹出模态框，允许用户勾选需要导出的配置。

### 预设合并策略

由于用户账本当前可能已经修改过配置，为了防止冲突，需要在合并前检测可能存在的冲突并警告用户，以及在合并时尽可能减少对用户原来配置的破坏，预设合并需要遵循下面的策略：
1，合并前检测：
对于不同的配置key，分别应用不同检测规则：
- tag.tags: 如果值完全一致（JSON.stringify全等检测），则认为安全，否则：检查新预设与旧预设是否存在name/id相同的tag，如果不存在则认为安全，否则标记对应风险 TAGS_WOULD_CHANGE
- tag.tagGroups: 如果值完全一致（JSON.stringify全等检测），则认为安全，否则：检查新预设与旧预设是否存在name/id相同的group，如果不存在则认为安全，否则标记对应风险 TAG_GROUPS_WOULD_CHANGE
- category: 如果值完全一致（JSON.stringify全等检测），则认为安全，否则：检查新预设与旧预设是否存在name/id相同的category，如果不存在则认为安全，否则标记对应风险 CATEGORY_WOULD_CHANGE
- customFilters: 如果值完全一致（JSON.stringify全等检测），则认为安全，否则：检查新预设与旧预设是否存在name/id相同的customFilter，如果不存在则认为安全，否则标记对应风险 FILTERS_WOULD_CHANGE
- customCSS:  如果值完全一致（JSON.stringify全等检测），则认为安全，否则标记对应风险 CSS_WOULD_CHANGE
检测函数需要返回不同风险对应的枚举值，并在用户导入预设后弹窗提醒用户所有的风险点。

2，合并策略
- tag.tags: 如果旧预设存在name相同的tag，保留旧预设的name和id，其余使用新预设中对应的tag值；如果旧预设中存在id相同的tag，使用新预设的tag直接替换原来的tag；否则将新预设的tag追加到原有的tags中
- tag.groups: 如果旧预设存在name相同的tagGroup，保留旧预设的name和id，其余使用新预设中对应的tagGroup值；如果旧预设中存在id相同的tagGroup，使用新预设的tag直接替换原来的tagGroup；否则将新预设的tagGroup追加到原有的tagGroup中
- categories: 如果旧预设存在name相同的 category ，保留旧预设的name和id，其余使用新预设中对应的category值；如果旧预设中存在id相同的category，使用新预设的category直接替换原来的category；否则将新预设的category追加到原有的category中
- customFilters: 如果旧预设存在name相同的 customFilters ，保留旧预设的name和id，其余使用新预设中对应的customFilters值；如果旧预设中存在id相同的customFilters，使用新预设的customFilters直接替换原来的customFilters；否则将新预设的customFilters追加到原有的category中
- customCSS: 直接追加新预设的css到原来的结尾（换行追加）

注意，如果新预设中的某些配置没有值（undefined），则不需要更改原来的配置

根据上述内容，更新项目中Preset相关的代码，使其能够实现上述功能，将必要的函数抽离到`src/components/preset/utils.ts`中