import { throttle } from "echarts/core";
import { useEffect } from "react";

type Size = {
    width: number;
    height: number
}
export default function useResize(el: HTMLElement | undefined | null, callback: (sizer: () => Size) => void) {
    useEffect(() => {
        if (!el) {
            return
        }
        if (typeof ResizeObserver === 'undefined') {
            const fn = throttle(() => {
                callback(() => el.getBoundingClientRect())
            }, 20)
            window.addEventListener("resize", fn)
            return () => {
                window.removeEventListener("resize", fn)
            }
        }
        const ob = new ResizeObserver((entries) => {
            entries.forEach((v) => {
                callback(() => v.contentRect)
            })
        })
        ob.observe(el)
        return () => {
            ob.disconnect()
        }
    }, [callback, el])
}