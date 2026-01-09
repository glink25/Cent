import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils";

export interface Message {
    role: "user" | "assistant";
    content: string;
}

export interface ChatCardData {
    id: string;
    messages: Message[];
    input: string;
    isLoading: boolean;
    next?: (message: string) => Promise<string>;
}

const PRESET_QUESTIONS = [
    "分析当前的账单",
    "账单是否有异常",
    "本月支出情况如何",
    "哪些分类花费最多",
];

interface ChatCardProps {
    card: ChatCardData;
    isActive: boolean;
    onActivate: () => void;
    onSendMessage: (message: string) => Promise<void>;
    onInputChange: (value: string) => void;
}

export function ChatCard({
    card,
    isActive,
    onActivate,
    onSendMessage,
    onInputChange,
}: ChatCardProps) {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 自动滚动到底部
    // useEffect(() => {
    //     if (isActive && card.messages.length > 0) {
    //         messagesEndRef.current?.scrollIntoView({ behavior: "smooth", });
    //     }
    // }, [card.messages, isActive]);

    const handleSend = async () => {
        if (!card.input.trim() || card.isLoading) {
            return;
        }
        // 默认卡片（id 为 "default"）即使没有 next 也可以发送，会在 handleSendMessage 中初始化
        if (!card.next && card.id !== "default") {
            return;
        }
        await onSendMessage(card.input.trim());
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handlePresetQuestion = async (question: string) => {
        // 先设置输入值，然后立即发送
        onInputChange(question);
        // 等待状态更新后发送消息
        setTimeout(async () => {
            await onSendMessage(question.trim());
        }, 0);
    };

    return (
        <div
            className={cn(
                "flex flex-col w-full shrink-0 h-full overflow-hidden snap-center",
            )}
        >
            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 snap-center">
                {card.messages.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-8">
                        开始与 AI 对话吧
                    </div>
                ) : (
                    <>
                        {card.messages.map((message, index) => (
                            <div
                                key={`${card.id}-${index}-${message.role}-${message.content.slice(0, 20)}`}
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
                        {card.isLoading && (
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
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* 输入区域 */}
            <div className="p-2 border-t relative">
                {/* 预设问题（悬浮在输入框上方） */}
                {isActive &&
                    card.input === "" &&
                    card.messages.length === 0 && (
                        <div className="absolute bottom-full left-4 right-4 mb-2">
                            <div className="flex flex-wrap gap-2 bg-background/95 backdrop-blur-sm p-2 border-input">
                                {PRESET_QUESTIONS.map((question) => (
                                    <button
                                        key={question}
                                        type="button"
                                        onClick={() =>
                                            handlePresetQuestion(question)
                                        }
                                        className="text-xs px-2 py-1 rounded-md border border-input bg-background hover:bg-accent transition-colors shadow-sm"
                                    >
                                        {question}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                <div className="flex gap-2">
                    <textarea
                        ref={inputRef}
                        value={card.input}
                        onChange={(e) => onInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="输入您的问题..."
                        disabled={
                            card.isLoading ||
                            (!card.next && card.id !== "default")
                        }
                        className="flex-1 h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    />
                    <Button
                        onClick={handleSend}
                        disabled={
                            !card.input.trim() ||
                            card.isLoading ||
                            (!card.next && card.id !== "default")
                        }
                        size="icon"
                        className="h-10 w-[60px] shrink-0"
                    >
                        {card.isLoading ? (
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
