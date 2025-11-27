import { useEffect, useRef, useState } from "react";
import { useSize } from "react-use";
import WordCloud from "wordcloud";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { processText } from "@/utils/word";

const ignoredWords = ["alipay", "wechat", "yy"];

type WordCut = Awaited<ReturnType<typeof processText>>;

function TextCloud({ data, className }: { data: WordCut; className?: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const [sized, { width, height }] = useSize(({ width, height }) => (
        <div
            ref={wrapperRef}
            className={cn("relative w-full h-full", className)}
        >
            <canvas
                ref={(el) => {
                    canvasRef.current = el;
                }}
                width={width}
                height={height}
            />
        </div>
    ));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || width === 0 || height === 0) {
            return;
        }
        const list = data.filter((v) => !ignoredWords.includes(v[0]));
        WordCloud(canvas, {
            list,
            gridSize: 8,
            weightFactor: (size) => {
                // 简单的动态缩放逻辑，避免词太大或太小
                const max = list[0][1];
                return Math.max((size / max) * 60, 10); // 最大字号60px
            },
            fontFamily: "Microsoft YaHei, SimHei, sans-serif",
            color: "random-dark",
            rotateRatio: 0.5,
            drawOutOfBound: false,
        });
    }, [data, width, height]);
    return sized;
}

export function AnalysisCloud({ bills }: { bills?: { comment?: string }[] }) {
    const t = useIntl();
    const [wordCut, setWordCut] = useState<WordCut>();
    useEffect(() => {
        const texts: string[] = [];
        bills?.forEach(({ comment }) => {
            if (comment !== undefined) {
                texts.push(comment);
            }
        }, []);
        processText(texts).then(setWordCut);
    }, [bills]);
    return (
        <div className="rounded-md border p-2 w-full flex flex-col">
            <h2 className="font-medium text-lg my-3 text-center">高频词</h2>
            {wordCut === undefined ? (
                <div>加载中</div>
            ) : wordCut.length === 0 ? (
                "暂无高频"
            ) : (
                <div>
                    <TextCloud data={wordCut} />
                </div>
            )}
        </div>
    );
}
