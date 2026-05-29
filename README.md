# Cent

简体中文 | [English](./README_EN.md)

> 你可能只需要一个记账软件。

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-green.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![PWA](https://img.shields.io/badge/PWA-supported-blue.svg)]()
[![GitHub Repo](https://img.shields.io/badge/data-storage_on_GitHub-black?logo=github)]()

Cent 是一个 **完全免费、开源的多人协作记账 Web App**，  
基于 **GitHub 仓库** 实现数据同步与版本控制，无需服务器，即可实现跨平台实时同步。

🔗 **在线体验**：[https://cent.linkai.work](https://cent.linkai.work)  
💾 **开源仓库**：[https://github.com/glink25/Cent](https://github.com/glink25/Cent)  
📖 **博客**：[https://glink25.github.io/tag/Cent/](https://glink25.github.io/tag/Cent/)  

📱 **iOS 版下载**：

<a href="https://apps.apple.com/us/app/cent-%E9%87%8D%E6%96%B0%E5%AE%9A%E4%B9%89%E8%AE%B0%E8%B4%A6/id6764264950">
  <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" height="32">
</a>


> [Cent iOS版现已推出 🎉](https://glink25.github.io/post/Cent-iOS%E7%89%88%E7%8E%B0%E5%B7%B2%E6%8E%A8%E5%87%BA/)

---

## 📈 功能预览

| 功能 | 截图 |
|------|------|
| 二级分类 & 标签管理 | ![分类示例](https://glink25.github.io/post-assets/mgucw881-cent-accountting.jpg) |
| 自定义标签系统 | ![标签示例](https://glink25.github.io/post-assets/mgucw884-cent-tag-1.jpg) |
| 统计与分析视图 | ![统计分析](https://glink25.github.io/post-assets/mgucw884-cent-stat.jpg) |
| 预算管理 | ![预算视图](https://glink25.github.io/post-assets/mgucw884-cent-budget.jpg) |
| GitHub 协作 | ![协作功能](https://glink25.github.io/post-assets/mgucw884-github-collaborator.jpg) |

>  **最新更新**：Cent 现已支持 AI 助手、语音记账、多币种管理、地图可视化、周期记账等众多新功能！详见 [Cent 1.1 更新说明](https://glink25.github.io/post/Cent-%E5%B7%B2%E6%94%AF%E6%8C%81%E5%A4%9A%E5%B8%81%E7%A7%8D%E8%87%AA%E5%8A%A8%E8%AE%B0%E8%B4%A6/)。

---

## ✨ 特性

### 💾 数据完全自持
账本数据保存在你的 GitHub/Gitee 私人仓库或 Web DAV 中，无需任何第三方服务器。通过 **GitHub Collaborator** 功能即可实现多人协作，**增量同步**机制只上传/下载变更数据，大幅缩短同步时间。

### 🤖 AI 智能体验
长按记账按钮即可**语音记账**，AI 自动解析金额、分类和备注。配置 OpenAI 兼容 API 后，可进行账单分析、预算建议、年度总结等智能对话，还能根据历史数据**智能预测**分类。

### 💱 多币种 & 周期记账
支持 30+ 种国际货币及自定义币种，实时汇率自动转换，适合出国旅行和跨境消费。为订阅服务、自动续费等创建**周期记账**模板，自动生成账单。

### 📊 统计分析 & 可视化
多维度筛选与趋势分析、自定义分析视图、预算管理与进度监控。在**地图上查看消费足迹**，支持高德地图。

### 🛠️ 更多功能
- 📱 **PWA 支持**：可安装到桌面，像原生 App 一样使用
- 📥 **智能导入**：支持微信/支付宝账单，可用 AI 创建自定义导入方案
- 🏷️ **二级分类 & 标签**：自定义分类、标签分组、单选/多选、偏好币种
- 📋 **快捷操作**：iOS 快捷指令、剪贴板记账、批量编辑、自然语言识别
- 🎨 **个性化**：深色模式、自定义 CSS、键盘定制

*...以及更多功能等你探索 ✨*

## 🧠 核心原理

Cent 是一个“纯前端”的 PWA 应用。  
除 GitHub/Gitee OAuth 登录外，Cent 不依赖任何后端服务。

了解详情：[现在开始将Github作为数据库](https://glink25.github.io/post/%E7%8E%B0%E5%9C%A8%E5%BC%80%E5%A7%8B%E5%B0%86Github%E4%BD%9C%E4%B8%BA%E6%95%B0%E6%8D%AE%E5%BA%93/)

### 🗂 数据结构

- 每个账本（Book）即为一个 GitHub/Gitee 仓库。
- 数据以 JSON 格式存储在仓库中，支持历史版本回滚。
- 通过仓库名识别账本，实现多账本管理。

### 🔁 增量同步机制

Cent 内置一套自定义的增量同步策略，仅同步增量差异：  
- 首次同步：完整下载数据。  
- 后续同步：仅传输新增或修改部分。  
- 支持离线缓存与断点续传。  

该机制显著提升了同步效率，使得多人协作体验流畅自然。

### 🧩 可扩展同步端点

同步逻辑经过抽象封装，未来将支持：  
- 自建服务器  
- 网盘（如 Dropbox、OneDrive）  
- 本地离线账本  

---


## 🚀 部署与使用

### 方式一：直接使用线上版本

1. 打开 [https://cent.linkai.work](https://cent.linkai.work)
2. 使用 GitHub 登录授权
3. 新建账本（将自动创建一个仓库）
4. 开始记账 🎉

### 方式二：自行部署

1. Fork 本仓库  
2. 在 [Cloudflare Pages](https://pages.cloudflare.com/) 或任意静态托管平台部署  
3. 在登录界面手动输入 GitHub Token 使用  
4. 所有账本与数据均存储于你的 GitHub 仓库中  

> 出于安全考虑，self-hosted 方式无法支持 Github/Gitee 一键登录，需要自行在Github/Gitee设置页面生成具有Repo读写权限的token，通过手动输入token功能使用。
Cent使用Cloudflare Workers部署了一个线上鉴权服务，该服务只针对受信任的域名提供服务。如果需要快捷登录服务，可以参考这个项目[cent-github-backend](https://github.com/glink25/cent-github-backend)项目创建自己的后端服务，并自己申请对应平台的OAuth app。

---

## 🧪 开发计划

### 已完成
- ✅ 增量同步核心实现  
- ✅ 多人协作账本  
- ✅ AI 助手功能
- ✅ 语音记账
- ✅ 多币种支持与汇率管理
- ✅ 地图支出可视化（高德地图集成）
- ✅ 周期记账
- ✅ 智能导入（支付宝/微信账单）
- ✅ 标签系统升级
- ✅ Web DAV 同步支持
- ✅ 快捷指令集成
- ✅ 批量编辑功能

### 进行中
- 🚧 自动测试体系
- 🚧 更多同步端点（Dropbox / OneDrive）

### 计划中
- 📋 数据报表导出（PDF/Excel）
- 📋 更多智能功能  

---

## 💬 贡献与反馈

Cent 欢迎所有开发者与用户参与贡献，提交代码前请参考[贡献指南](docs/contributing/zh.md)：

> QQ交流群：861180883

```bash
# 克隆项目
git clone https://github.com/glink25/Cent.git

# 安装依赖
pnpm install

# 本地运行
pnpm dev

# 格式校验
pnpm lint
```

## 📜 许可证

本项目采用 Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)
 协议。
 - 允许共享、改编与再发布
 - 必须署名原作者
 - 禁止商业使用
 - 派生作品须使用相同许可协议

 ---


## ☕️ Buy Me a Coffee

感谢您对本项目的支持！Cent目前仅由单人支持开发，您的捐赠将用于维护和持续开发。

<details>
<summary>点击查看</summary>

### 💰 支付宝 (Alipay)


<img src="https://glink25.github.io/post-assets/sponsor-solana.jpg" width="50%" alt="支付宝收款码">

---

### 🌐 Solana (SOL)

**钱包地址:**

`vEzM9jmxChx2AoMMDpHARHZcUjmUCHdBShwF9eJYGEg`

**二维码:**

<img src="https://glink25.github.io/post-assets/sponsor-alipay.jpg" width="50%" alt="solana">

---
</details>


---

## 🙏 感谢墙 / Donor Wall

感谢所有支持 Cent 项目的捐赠者！您的支持是我持续开发的动力。  
Thank you to all donors who support the Cent project! Your support is the driving force behind my continued development.

<div align="center">

<table>
<tr>
<td align="center">
  <a href="">
    <img src="https://api.dicebear.com/7.x/initials/svg?seed=一" width="60" height="60" alt="" style="border-radius: 50%;"/>
    <br />
    <sub><b>一**户</b></sub>
  </a>
</td>
</tr>
</table>

</div>

---