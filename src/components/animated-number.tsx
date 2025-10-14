import { type HTMLMotionProps, motion, useSpring } from "framer-motion";
import type React from "react";
import { useEffect, useRef, useState } from "react";

type AnimatedNumberProps = {
    value: number;
} & HTMLMotionProps<"span">;

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
    value,
    ...restProps
}) => {
    const previousValueRef = useRef(value);

    // 根据传入的 value 自动判断小数位数
    const precision = (value.toString().split(".")[1] || "").length;

    const springValue = useSpring(previousValueRef.current, {
        stiffness: 100,
        damping: 20,
    });

    const [displayValue, setDisplayValue] = useState(value.toFixed(precision));

    useEffect(() => {
        springValue.set(value);

        const unsubscribe = springValue.on("change", (latest) => {
            // 检查 value 是否为整数
            const isInteger = Number.isInteger(value);

            if (isInteger) {
                // 如果 value 是整数，只显示整数
                setDisplayValue(Math.round(latest).toString());
            } else {
                // 如果 value 是小数，使用自动计算的精度
                setDisplayValue(latest.toFixed(precision));
            }
        });

        return () => unsubscribe();
    }, [springValue, value, precision]);

    useEffect(() => {
        previousValueRef.current = value;
    });

    return <motion.span {...restProps}>{displayValue}</motion.span>;
};

export default AnimatedNumber;
