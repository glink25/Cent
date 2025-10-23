# Cent

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

---

## ✨ 特性

- 💾 **数据完全自持**：账本数据保存在你的 GitHub 私人仓库中，无需任何第三方服务器。  
- 👥 **多人协作**：通过 GitHub Collaborator 功能即可共享账本，实时同步修改。  
- ⚡️ **增量同步**：只上传/下载变更数据，大幅缩短同步时间。  
- 📊 **丰富的统计分析**：支持多维度筛选与走势分析，可自定义分析视图。  
- 🏷️ **分类与标签系统**：支持二级分类、自定义标签、图标、排序。  
- 💰 **预算管理**：按分类或标签设置预算并实时监控进度。  
- 🖼️ **附件支持**：可为账单上传图片附件。  
- 📱 **PWA 支持**：可安装到桌面，像原生 App 一样使用，支持 iOS 与 Android。  
- 🔒 **完全开源**：部署成本几乎为零，代码完全可审计、可自建。

---

## 🧠 核心原理

Cent 是一个“纯前端”的 PWA 应用。  
除 GitHub OAuth 登录外，Cent 不依赖任何后端服务。

### 🗂 数据结构

- 每个账本（Book）即为一个 GitHub 仓库。
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

## 📈 功能预览

| 功能 | 截图 |
|------|------|
| 二级分类 & 标签管理 | ![分类示例](https://glink25.github.io/post-assets/mgucw881-cent-accountting.jpg) |
| 自定义标签 | ![标签示例](https://glink25.github.io/post-assets/mgucw884-cent-tag-1.jpg) |
| 统计与分析视图 | ![统计分析](https://glink25.github.io/post-assets/mgucw884-cent-stat.jpg) |
| 预算管理 | ![预算视图](https://glink25.github.io/post-assets/mgucw884-cent-budget.jpg) |
| GitHub 协作 | ![协作功能](https://glink25.github.io/post-assets/mgucw884-github-collaborator.jpg) |

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

---

## 🧪 开发计划

- ✅ 增量同步核心实现  
- ✅ 多人协作账本  
- 🚧 自动测试体系  
- 🚧 地图支出可视化  
- 🚧 更多同步端点（网盘 / 自建服务器）  
- 🚧 移动端交互优化  

---

## 💬 贡献与反馈

Cent 欢迎所有开发者与用户参与贡献：

```bash
# 克隆项目
git clone https://github.com/glink25/Cent.git

# 安装依赖
pnpm install

# 本地运行
pnpm dev
```

## 📜 许可证

本项目采用 Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)
 协议。
 - 允许共享、改编与再发布
 - 必须署名原作者
 - 禁止商业使用
 - 派生作品须使用相同许可协议

 ---

 # Cent

> You might only need an accounting software.

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-green.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![PWA](https://img.shields.io/badge/PWA-supported-blue.svg)]()
[![GitHub Repo](https://img.shields.io/badge/data-storage_on_GitHub-black?logo=github)]()

Cent is a **completely free, open-source, collaborative accounting Web App**,  
which uses a **GitHub Repository** for data synchronization and version control, enabling real-time cross-platform sync without a server.

🔗 **Live Demo**: [https://cent.linkai.work](https://cent.linkai.work)  
💾 **Open Source Repository**: [https://github.com/glink25/Cent](https://github.com/glink25/Cent)  
📖 **Blog**: [https://glink25.github.io/tag/Cent/](https://glink25.github.io/tag/Cent/)  

---

## ✨ Features

- 💾 **Fully Self-Contained Data**: Ledger data is stored in your private GitHub repository, without any third-party servers.  
- 👥 **Multi-User Collaboration**: Share ledgers and synchronize changes in real-time using the GitHub Collaborator feature.  
- ⚡️ **Incremental Sync**: Only uploads/downloads changed data, significantly reducing sync time.  
- 📊 **Rich Statistical Analysis**: Supports multi-dimensional filtering and trend analysis, with customizable analysis views.  
- 🏷️ **Category and Tag System**: Supports two-level categories, custom tags, icons, and sorting.  
- 💰 **Budget Management**: Set budgets by category or tag and monitor progress in real-time.  
- 🖼️ **Attachment Support**: Allows uploading image attachments for bills.  
- 📱 **PWA Support**: Can be installed to the desktop and used like a native App, supported on iOS and Android.  
- 🔒 **Completely Open Source**: Deployment cost is nearly zero, the code is fully auditable and can be self-hosted.

---

## 🧠 Core Principles

Cent is a "pure frontend" PWA application.  
Apart from GitHub OAuth login, Cent does not rely on any backend services.

### 🗂 Data Structure

- Each ledger (Book) corresponds to a GitHub repository.
- Data is stored in JSON format within the repository, supporting historical version rollback.
- Multi-ledger management is achieved by identifying ledgers via repository names.

### 🔁 Incremental Sync Mechanism

Cent incorporates a custom incremental synchronization strategy, only syncing the differential changes:  
- Initial Sync: Full data download.  
- Subsequent Sync: Only transfers newly added or modified parts.  
- Supports offline caching and resume capability.  

This mechanism significantly improves sync efficiency, leading to a smooth and natural collaborative experience.

### 🧩 Extensible Sync Endpoints

The synchronization logic has been abstracted and encapsulated, with future support planned for:  
- Self-hosted Servers  
- Cloud Drives (e.g., Dropbox, OneDrive)  
- Local Offline Ledgers  

---

## 📈 Feature Preview

| Feature | Screenshot |
|------|------|
| Two-Level Categories & Tag Management | ![Category Example](https://glink25.github.io/post-assets/mgucw881-cent-accountting.jpg) |
| Custom Tags | ![Tag Example](https://glink25.github.io/post-assets/mgucw884-cent-tag-1.jpg) |
| Statistics and Analysis View | ![Statistical Analysis](https://glink25.github.io/post-assets/mgucw884-cent-stat.jpg) |
| Budget Management | ![Budget View](https://glink25.github.io/post-assets/mgucw884-cent-budget.jpg) |
| GitHub Collaboration | ![Collaboration Feature](https://glink25.github.io/post-assets/mgucw884-github-collaborator.jpg) |

---

## 🚀 Deployment and Usage

### Method 1: Use the Online Version Directly

1. Open [https://cent.linkai.work](https://cent.linkai.work)
2. Log in and authorize with GitHub
3. Create a new ledger (a new repository will be created automatically)
4. Start recording transactions 🎉

### Method 2: Self-Deployment

1. Fork this repository  
2. Deploy on [Cloudflare Pages](https://pages.cloudflare.com/) or any static hosting platform  
3. Manually input your GitHub Token on the login screen to use it  
4. All ledgers and data are stored in your GitHub repositories  

---

## 🧪 Development Plan

- ✅ Incremental sync core implementation  
- ✅ Multi-user collaborative ledgers  
- 🚧 Automated testing system  
- 🚧 Map visualization of expenditures  
- 🚧 More sync endpoints (Cloud Drives / Self-hosted Servers)  
- 🚧 Mobile interaction optimization  

---

## 💬 Contribution and Feedback

Cent welcomes all developers and users to contribute:

```bash
# Clone the project
git clone [https://github.com/glink25/Cent.git](https://github.com/glink25/Cent.git)

# Install dependencies
pnpm install

# Run locally
pnpm dev
```

## 📜 License
 - This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) License.
 - You are free to share, adapt, and redistribute.
 - You must give appropriate credit.
 - You may not use the material for commercial purposes.
 - If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.