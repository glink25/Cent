export function isZenFallbackDevMode() {
    // 本地类型断言而非依赖全局 Window 增强：使 zen 在任何宿主程序（如 cent，其
    // src/vite-env.d.ts 不包含 zen 的全局声明）中被源码消费时都能通过类型检查。
    const w = window as Window & { __ZEN_FALLBACK__?: boolean };
    return import.meta.env.DEV && w.__ZEN_FALLBACK__ === true;
}
