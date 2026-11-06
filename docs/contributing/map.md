# Cent v3 地图与账单位置

本文记录 v3 Web 地图的交付行为、账单位置协议和 provider 扩展约定。Web 支持浏览器定位，以及高德和 Google Maps 的手动选点与账单地图。iOS 和 Android 接入同一协议时应遵循下文的数据与兼容原则。

## 产品行为

- 地图设置沿用 Cent 的公共弹窗、选择器、标签页和输入框。高德和 Google Maps 的配置可以同时保存，顶部独立选择默认地图。编辑某个标签页或清除该页配置时，保留另一家配置。
- 账单编辑器保留**一个位置图标**。没有位置时，点击获取浏览器当前位置；已有位置时，点击同一处打开当前 provider 的手动选点界面。新增账单的自动定位开关沿用这一定位流程。浏览器定位独立于地图配置；当前 provider 没有可用的选点能力时，已有位置仍可以删除。
- 高德选点使用中心准星，Google Maps 使用点击选点。选点交互由各自的 provider 决定，可以独立增加 POI 搜索或位置吸附。统计地图和选点共用当前地图选择。地图配置缺失或 SDK 加载失败时，提示用户配置、切换或重试。

## 位置数据与兼容

- 账单沿用 `GeoLocation { latitude, longitude, accuracy }`。新定位或重新选定的位置以 **WGS‑84** 保存。设备定位保留以米为单位的精度，手动选点沿用 `accuracy: 0`。
- 坐标转换在 provider 边界完成。高德将账单坐标转为 GCJ‑02，用于初始位置、标记和视野；确认新点时，以高德官方正向转换为基准反算 WGS‑84。Google Maps 直接使用 WGS‑84。地图渲染和切换只计算显示坐标。
- 历史坐标原样保留，读取时统一视为 WGS‑84。部分旧高德选点升级后可能偏移，可通过重新选点修正。取消、未移动位置就确认、编辑备注、同步以及备份导入导出，都应保留原坐标和精度。新旧端共享原有位置字段，旧端显示新坐标时仍可能有误差。

## 配置协议

`GlobalMeta.map` 沿用对象结构，所有字段可选。

| 字段 | 用途 | 保存方式 |
| --- | --- | --- |
| `amapKey`、`amapSecurityCode` | 高德浏览器 Key 和安全密钥 | 现有 `encodeApiKey` / `decodeApiKey`（Base64） |
| `googleKey` | Google Maps JavaScript API 浏览器 Key | 同上 |
| `googleMapId` | Google JavaScript Map ID，用于 Advanced Markers | 去除首尾空白后保存原值 |
| `defaultProvider` | 默认地图，`"amp"` 或 `"google"` | 缺省为 `"amp"`，即高德 |

Google 需要启用 Maps JavaScript API 和计费，使用按站点来源和 API 限制的浏览器 Key，以及正式的 JavaScript Map ID。Base64 是存储编码，Key 的使用范围由 Google Cloud 配置限制。 [Google API Key 指南](https://developers.google.com/maps/documentation/javascript/get-api-key) · [Advanced Markers 指南](https://developers.google.com/maps/documentation/javascript/advanced-markers/start)

旧 Web 仍能读取原高德字段。旧 Android 保存或清除高德配置时可能整体覆盖 `map`，从而丢失 Google 配置和默认选择。原生端跟进时应只更新自己管理的字段，保留其他 provider 配置和未知字段。

## Provider 扩展约定

- 自动定位、手动选点和地图渲染是独立能力。浏览器定位独立于地图 provider；账单编辑器决定单一位置入口如何响应，provider 提供后续的选点界面。业务组件通过能力接口调用地图，不直接判断 SDK 或使用其坐标类型。
- 手动选点接收可选的 WGS‑84 初始位置，返回 `selected`、`unchanged` 或 `cancelled`。只有 `selected` 携带新的 WGS‑84 位置并更新账单。渲染接收过滤后的账单点，标记、中心和视野使用同一批转换结果。
- SDK 按需加载，关闭或切换时清理地图和监听器，忽略已取消任务的回调。选点渲染异常应留在弹窗内，用户能返回账单编辑器。弹窗状态只传入普通组件函数，React 懒加载对象留在 provider 内部，避免被状态仓库冻结。
- 新增 SDK 时，从 [provider 入口](../../apps/cent/src/components/map/provider.tsx) 注册适配器，并实现所需的 [能力接口](../../apps/cent/src/components/map/protocol.ts)。将 SDK 类型、凭据处理后的初始化和坐标转换留在各自适配器。

验收时覆盖单图标的两种状态、旧高德配置、仅 Google 的配置、双 SDK 切换、取消和异常恢复。构建与模拟 SDK 验证可覆盖应用逻辑；真实地图验收还需检查 Google 标记及跨 SDK 落点，用独立地标核对高德大陆样本 10 米误差目标和境外样本是否产生额外偏移。
