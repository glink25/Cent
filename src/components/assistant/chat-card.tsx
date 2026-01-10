/** biome-ignore-all lint/suspicious/noArrayIndexKey: <explanation> */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { t, useIntl } from "@/locale";
import { cn } from "@/utils";
import type { Message } from "./chat";

export interface ChatCardData {
    id: string;
    messages: Message[];
    isLoading: boolean;
}

const PRESET_QUESTIONS = [
    {
        label: t("preset_question.analyze_ledger.label"),
        prompt: t("preset_question.analyze_ledger.prompt"),
    },
    {
        label: t("preset_question.monthly_budget.label"),
        prompt: t("preset_question.monthly_budget.prompt"),
    },
    {
        label: t("preset_question.anomaly_detection.label"),
        prompt: t("preset_question.anomaly_detection.prompt"),
    },
];

interface ChatCardProps {
    messages: Message[];
    isLoading: boolean;
    onSendMessage: (message: string) => Promise<void>;
    onDelete?: () => void;
}

export function ChatCard({
    messages,
    isLoading,
    onSendMessage,
    onDelete,
}: ChatCardProps) {
    const t = useIntl();

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [input, setInput] = useState("");
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messages.length > 0) {
            messagesContainerRef.current?.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [messages.length]);

    const handleSend = async () => {
        const input = inputRef.current?.value ?? "";
        onSendMessage(input.trim());
        setInput("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handlePresetQuestion = async (question: string) => {
        // 先设置输入值，然后立即发送
        setInput(question);
        // 等待状态更新后发送消息
        setTimeout(() => {
            handleSend();
        }, 0);
    };

    return (
        <div
            className={cn(
                "flex flex-col w-full shrink-0 h-full overflow-hidden snap-center relative",
            )}
        >
            {/* 消息列表 */}
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 snap-center"
            >
                {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                        {t("start-talk-to-ai")}
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => (
                            <div
                                key={`${index}-${message.role}`}
                                className={cn(
                                    "flex",
                                    message.role === "user"
                                        ? "justify-end"
                                        : "justify-start",
                                )}
                            >
                                <div
                                    className={cn(
                                        "rounded-md px-3 py-2 max-w-[80%] text-sm !select-auto",
                                        message.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted",
                                    )}
                                >
                                    {message.content}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="rounded-md px-3 py-2 bg-muted text-sm">
                                    <span className="inline-flex items-center gap-1">
                                        <span className="animate-pulse">
                                            ...
                                        </span>
                                    </span>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 输入区域 */}
            <div className="relative">
                {/* 预设问题（悬浮在输入框上方） */}
                {
                    <div className="w-full p-2">
                        <div className="w-full flex gap-2 bg-background/95 backdrop-blur-sm border-input overflow-x-auto">
                            {PRESET_QUESTIONS.map((question, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() =>
                                        handlePresetQuestion(question.prompt)
                                    }
                                    className="flex-shrink-0 text-xs px-2 py-1 rounded-md border border-input bg-background hover:bg-accent transition-colors shadow-sm"
                                >
                                    {question.label}
                                </button>
                            ))}
                        </div>
                    </div>
                }
                <div className="flex gap-2 px-2">
                    {onDelete && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onDelete}
                            disabled={isLoading}
                            className="h-10 shrink-0"
                        >
                            <i className="icon-[mdi--delete-outline] text-sm"></i>
                        </Button>
                    )}
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t("input-your-questions")}
                        disabled={isLoading}
                        className="flex-1 h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        size="icon"
                        className="h-10 w-[60px] shrink-0"
                    >
                        {isLoading ? (
                            <i className="icon-[mdi--loading] animate-spin"></i>
                        ) : (
                            <i className="icon-[mdi--send]"></i>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
