## Assistant V2 功能更新

Assistant V2用于完全取代旧的 assistant 功能，它采用了全新的UI界面，在桌面端和移动端有着更为友好的用户交互体验，并且基于assistant-v2/core，支持更加强大灵活的AI体验。

### 核心升级点

1，全新界面
Assistant V2的整体界面全部重做，拥有独立的交互面板，聊天窗口风格也更为现代，与其他在线AI聊天服务保持一致。

2，AI功能升级
AI功能彻底重做，基于core核心createContext功能搭建全新的AI chat工作流，并且完全不兼容旧数据。

### 注意细节

1，在进行v2代码编写时，需要严格按照目前的v2代码结构和界面结构来进行，不要改动界面布局和组件使用方式。例如MainAssistant的compound模式，这是不允许更改的。
2，需要构建一个全新的zustand store用于保存v2的所有状态，包括聊天记录等，并且通过idb库自行构建一个persist插件用于持久化保存
3，核心界面组件为./main.tsx