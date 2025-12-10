# **Contributing to Cent 🚀**

首先，非常感谢您有兴趣为 **Cent** 做出贡献！

Cent 是一个旨在打破服务器束缚的自由记账软件。我们需要您的帮助来让它变得更好。无论您是修复 Bug、改进文档，还是提出新功能，我们都热烈欢迎。

为了确保代码质量、维护项目的长期健康以及降低沟通成本，请在提交 Pull Request 或 Issue 之前仔细阅读本指南。

## **🌟 Cent 核心理念 (Core Philosophy)**

Cent 与传统的 Web 应用架构不同，我们在设计上有两条不可逾越的原则。**如果您希望为 Cent 贡献功能，请务必遵守：**

### **1\. Serverless First (无服务器依赖)**

Cent 的目标是完全解耦后端。

* **原则：** 在开发任何新功能时，**必须**首先确保该功能在**没有服务器后端接口**的情况下依然正常可用。  
* **解释：** Github 和 WebDAV 等同步端点仅用于数据的存储和备份，不应承载业务计算逻辑。

### **2\. Sync Synergy (多端协同优先)**

Cent 底层天然支持多用户、多设备协同。

* **原则：** 在修改数据结构或添加功能时，必须考虑到多设备同步场景。  
* **解释：** 请确保您的代码逻辑处理了并发写入的情况，避免因同步机制导致的数据丢失。

## **🛠 开发规范 (Development Guidelines)**

### **1\. 环境准备**

Cent 是一个 React SPA PWA 项目，使用pnpm作为包管理器。

\# 安装依赖 (只能使用 pnpm )  
pnpm install

\# 启动开发服务器  
pnpm run dev

### **2\. 代码格式化与 Lint (Code Style)**

我们使用 [**Biome**](https://biomejs.dev/) 进行严格的代码格式化和 Lint 校验。

* **⚠️ 强制规则：** 我们**不接受**任何未通过 Biome 校验的代码。  
* 参差不齐的代码格式会带来极大的沟通成本，并可能导致合并冲突或潜在 Bug。

在提交代码前，请务必执行以下命令并确保无报错：

\# 检查代码风格  
pnpm run lint

\# 自动修复格式问题  
pnpm run check

### **3\. 核心敏感区域 (Critical Zones)**

以下目录包含 Cent 的核心同步引擎和数据层逻辑：

* 📂 src/api  
* 📂 src/database

**修改规则：**

1. 涉及上述目录的修改必须经过**严格验证**。  
2. 必须确保**向后兼容**，严禁引入导致老版本客户端数据损坏的破坏性变更（Breaking Changes）。  
3. 在修改前，建议详细阅读项目文档中的【Cent 底层原理】(TODO)系列文章。  
4. 修改前请先提交 Issue 阐述修改思路，避免做无用功。

## **🔄 工作流 (Workflow)**

1. **Issue First:** 如果您计划开发新功能或进行大规模重构，请务必先提交一个 Issue 进行讨论。  
2. **Branching:** 基于 main 分支创建您的开发分支。  
   * 功能：feat/feature-name  
   * 修复：fix/bug-issue-number  
3. **Commit:** 推荐遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。  
   * feat: add webdav support  
   * fix: resolve sync data loss on ios  
4. **Pull Request:** 提交 PR 时，请关联相关的 Issue，并描述清楚您的变更内容和测试步骤。
5. **AI:** 如果你使用大模型协助生成代码，请提交对应的提示词

## **🐛 Bug 报告**

我们欢迎反馈 Bug，为了提高处理效率，请使用我们的 [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md)。请务必提供：

* 准确的运行平台和操作系统。  
* 使用的同步方式（WebDAV/Github/Local）。  
* 可复现的步骤。

再次感谢您对开源社区的贡献！Happy Coding\! 🎉