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