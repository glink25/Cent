# Cent

[简体中文](./README.md) | English

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

📱 **Download for iOS**:

<a href="https://apps.apple.com/us/app/cent-%E9%87%8D%E6%96%B0%E5%AE%9A%E4%B9%89%E8%AE%B0%E8%B4%A6/id6764264950">
  <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" height="32">
</a>


> [Cent iOS Version Is Now Available 🎉](https://glink25.github.io/post/Cent-iOS%E7%89%88%E7%8E%B0%E5%B7%B2%E6%8E%A8%E5%87%BA/)

---

## 📈 Feature Preview

| Feature | Screenshot |
|------|------|
| Two-Level Categories & Tag Management | ![Category Example](https://glink25.github.io/post-assets/mgucw881-cent-accountting.jpg) |
| Custom Tags | ![Tag Example](https://glink25.github.io/post-assets/mgucw884-cent-tag-1.jpg) |
| Statistics and Analysis View | ![Statistical Analysis](https://glink25.github.io/post-assets/mgucw884-cent-stat.jpg) |
| Budget Management | ![Budget View](https://glink25.github.io/post-assets/mgucw884-cent-budget.jpg) |
| GitHub Collaboration | ![Collaboration Feature](https://glink25.github.io/post-assets/mgucw884-github-collaborator.jpg) |

>  **Latest Update**: Cent now supports AI Assistant, Voice Recording, Multi-Currency Management, Map Visualization, Scheduled Billing, and many more features! See [Cent 1.1 Update Notes](https://glink25.github.io/post/Cent-%E5%B7%B2%E6%94%AF%E6%8C%81%E5%A4%9A%E5%B8%81%E7%A7%8D%E8%87%AA%E5%8A%A8%E8%AE%B0%E8%B4%A6/) for details.

---

## ✨ Features

### 💾 Fully Self-Contained Data
Ledger data is stored in your private GitHub/Gitee repository or Web DAV, without any third-party servers. **Multi-user collaboration** via GitHub Collaborator feature, with **incremental sync** mechanism that only uploads/downloads changed data, significantly reducing sync time.

### 🤖 AI-Powered Experience
Long press the recording button for **Voice Recording**, where AI automatically parses amounts, categories, and notes. Configure OpenAI-compatible APIs for intelligent bill analysis, budget suggestions, annual summaries, and **smart predictions** based on historical data.

### 💱 Multi-Currency & Scheduled Billing
Supports 30+ international currencies plus custom currencies, with real-time automatic exchange rate conversion. Perfect for international travel and cross-border transactions. Create **scheduled billing** templates for subscriptions and auto-renewals.

### 📊 Statistics & Visualization
Multi-dimensional filtering and trend analysis, custom analysis views, budget management with progress monitoring. **View spending footprints on a map** with AMap support.

### 🛠️ More Features
- 📱 **PWA Support**: Install to desktop and use like a native app
- 📥 **Smart Import**: WeChat/Alipay bills, create custom import schemes with AI
- 🏷️ **Categories & Tags**: Custom categories, tag groups, single/multi-select, preferred currencies
- 📋 **Quick Actions**: iOS Shortcuts, clipboard entry, batch editing, natural language recognition
- 🎨 **Customization**: Dark mode, custom CSS, keyboard customization

*...and many more features waiting to be discovered ✨*

---

## 🧠 Core Principles

Cent is a "pure frontend" PWA application.  
Apart from GitHub OAuth login, Cent does not rely on any backend services.

Learn more: [Using GitHub as a Database](https://glink25.github.io/post/%E7%8E%B0%E5%9C%A8%E5%BC%80%E5%A7%8B%E5%B0%86Github%E4%BD%9C%E4%B8%BA%E6%95%B0%E6%8D%AE%E5%BA%93/)

### 🗂 Data Structure

- Each ledger (Book) corresponds to a GitHub/Gitee repository.
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

> For security reasons, the self-hosted method cannot support GitHub/Gitee one-click-authentication. You will need to manually generate a token with read and write permissions for the repository (Repo) on the Github/Gitee settings page, and use it through the manual token input feature.
Cent uses Cloudflare Workers to deploy an online authentication service, which only provides services for trusted domains. If you require a quick login service, you can refer to the project [cent-github-backend](https://github.com/glink25/cent-github-backend) to create your own backend service and apply for an OAuth app on the corresponding platform yourself.

---

## 🧪 Development Plan

### Completed
- ✅ Incremental sync core implementation  
- ✅ Multi-user collaborative ledgers  
- ✅ AI assistant features
- ✅ Voice recording
- ✅ Multi-currency support and exchange rate management
- ✅ Map visualization of expenditures (AMap integration)
- ✅ Scheduled billing
- ✅ Smart import (Alipay/WeChat bills)
- ✅ Tag system upgrade
- ✅ Web DAV sync support
- ✅ Shortcuts integration
- ✅ Batch editing

### In Progress
- 🚧 Automated testing system 
- 🚧 More sync endpoints (Dropbox / OneDrive)

### Planned
- 📋 Data report export (PDF/Excel)
- 📋 More intelligent features  

---

## 💬 Contribution and Feedback

Cent welcomes all developers and users to contribute. Please refer to the [Contribution Guide](docs/contributing/en.md) before submitting code:

> QQ Group: 861180883

```bash
# Clone the project
git clone https://github.com/glink25/Cent.git

# Install dependencies
pnpm install

# Run locally
pnpm dev

# Lint
pnpm lint
```

## 📜 License

This project is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) License.
- You are free to share, adapt, and redistribute.
- You must give appropriate credit.
- You may not use the material for commercial purposes.
- If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.

---

## ☕️ Buy Me a Coffee

Thank you for your support! Cent is currently maintained by a single developer, and your donations will be used for maintenance and continuous development.

---

<details>
<summary>Click to view</summary>

### 💰 Alipay

<img src="https://glink25.github.io/post-assets/sponsor-solana.jpg" width="50%" alt="Alipay QR Code">

---

### 🌐 Solana (SOL)

**Wallet Address:**

`vEzM9jmxChx2AoMMDpHARHZcUjmUCHdBShwF9eJYGEg`

**QR Code:**

<img src="https://glink25.github.io/post-assets/sponsor-alipay.jpg" width="50%" alt="solana">

---
</details>
