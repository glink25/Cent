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

---

## ✨ Features

### Core Features
- 💾 **Fully Self-Contained Data**: Ledger data is stored in your private GitHub/Gitee repository or Web DAV, without any third-party servers.  
- 👥 **Multi-User Collaboration**: Share ledgers and synchronize changes in real-time using the GitHub/Gitee Collaborator feature.  
- ⚡️ **Incremental Sync**: Only uploads/downloads changed data, significantly reducing sync time.  
- 📱 **PWA Support**: Can be installed to the desktop and used like a native App, supported on iOS and Android.  
- 🔒 **Completely Open Source**: Deployment cost is nearly zero, the code is fully auditable and can be self-hosted.

### AI-Powered Features
- 🤖 **AI Assistant**: Supports OpenAI-compatible APIs for intelligent bill analysis, budget suggestions, and annual summaries.
- 🎤 **Voice Recording**: Quick voice-based bill entry with speech recognition and keyboard text input support.
- 🧠 **Smart Prediction**: Auto-predicts categories and notes based on time patterns to improve recording efficiency.

### Multi-Currency Support
- 💱 **Multi-Currency Management**: Supports 30+ international currencies, custom currencies, and real-time exchange rate conversion.
- 💰 **Base Currency Settings**: Freely switch base currency, manually adjust exchange rates, and use quick currency shortcuts.

### Billing Features
- 🔄 **Scheduled Billing**: Automatically records periodic bills for subscriptions and auto-renewals.
- 🗺️ **Map Visualization**: Automatically records bill locations and displays spending footprints on a map (AMap support).
- 📝 **Batch Editing**: Multi-select bills for batch category/tag modification or deletion.
- 🖼️ **Attachment Support**: Upload image attachments for bills with cache management.
- 📋 **Quick Entry**: Support for clipboard quick entry and iOS Shortcuts integration.

### Data Management
- 🖼️ **Smart Import**: Supports WeChat/Alipay bill imports and AI-powered custom import schemes.
- 📤 **Import/Export**: Freely import and export bill data to eliminate data anxiety.
- 🗜️ **Bill Compression**: Compress cloud incremental data to reduce storage space.

### Statistics & Analysis
- 📊 **Rich Statistical Analysis**: Supports multi-dimensional filtering and trend analysis with customizable and saveable analysis views.  
- 📈 **Multi-Dimensional Trends**: User expense/income/balance trends, category structure, frequent word clouds, etc.
- 💰 **Budget Management**: Set budgets by category or tag and monitor progress in real-time, with category budget support.  

### Categories & Tags
- 🏷️ **Two-Level Category System**: Supports custom two-level categories, icons, and sorting.  
- 🔖 **Tag System**: Supports tag groups, single/multi-select tags, required tags, and tag-preferred currencies.

### Customization
- 🎨 **Custom Themes**: Supports custom CSS and dark mode (follow system/manual switch).
- ⌨️ **Keyboard Customization**: Customize keyboard height and multiply keys (quick input of 00/000).

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
