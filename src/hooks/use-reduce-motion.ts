import { useEffect, useRef } from 'react';

/**
 * @param callback - 当检测到减弱动态效果设置在短时间内连续变化时执行的回调函数。
 * @param options - 配置选项
 * @param options.threshold - 触发回调所需的变化次数阈值。默认为 2 次。
 * @param options.timeout - 定义“短时间”的时间窗口，单位为毫秒。默认为 1000 毫秒。
 */
const useRapidReducedMotionChange = (
    callback: () => void,
    options?: { disable?: boolean; threshold?: number; timeout?: number }
): void => {
    const { threshold = 2, timeout = 3000, disable } = options || {};
    const changeCount = useRef<number>(0);
    const timer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // 确保在浏览器环境下执行
        if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined' || disable) {
            return;
        }

        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

        const handleChange = () => {
            // 如果计时器已存在，则清除它，以重置时间窗口
            if (timer.current) {
                clearTimeout(timer.current);
            }

            // 增加变化计数
            changeCount.current += 1;

            // 如果变化次数达到阈值，则立即执行回调并重置计数器
            if (changeCount.current >= threshold) {
                callback();
                changeCount.current = 0; // 重置
            } else {
                // 未达到阈值，则启动一个计时器。
                // 如果在 timeout 时间内没有再次变化，计数器将被重置。
                timer.current = setTimeout(() => {
                    changeCount.current = 0;
                }, timeout);
            }
        };

        // 添加事件监听器
        // 使用 'change' 事件，而不是已弃用的 addListener
        mediaQuery.addEventListener('change', handleChange);

        // 组件卸载时的清理函数
        return () => {
            mediaQuery.removeEventListener('change', handleChange);
            // 同时清理可能存在的计时器
            if (timer.current) {
                clearTimeout(timer.current);
            }
        };
    }, [callback, threshold, timeout, disable]);
};

export default useRapidReducedMotionChange;