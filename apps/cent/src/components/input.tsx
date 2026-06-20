import type React from "react";
import { useRef } from "react";

// 定义组件的props类型
interface IOSUnscrolledInputOneProps
    extends React.InputHTMLAttributes<HTMLInputElement> {}

const IOSUnscrolledInput: React.FC<IOSUnscrolledInputOneProps> = (props) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        const inputElement = inputRef.current;
        if (inputElement) {
            // 检查是否是iOS Safari
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const isSafari =
                /Safari/.test(navigator.userAgent) &&
                !/Chrome/.test(navigator.userAgent);

            if (isIOS && isSafari) {
                // 临时将透明度设为0
                inputElement.style.opacity = "0";

                // 使用setTimeout确保浏览器有足够时间处理透明度变化
                setTimeout(() => {
                    // 恢复透明度
                    inputElement.style.opacity = "1";
                }, 50); // 50毫秒通常足够
            }
        }
        // 调用外部传入的onFocus事件
        if (props.onFocus) {
            props.onFocus(event);
        }
    };

    return <input ref={inputRef} onFocus={handleFocus} {...props} />;
};

export default IOSUnscrolledInput;
