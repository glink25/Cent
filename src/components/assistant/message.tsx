/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: <explanation> */
import { marked } from "marked";
import { Collapsible } from "radix-ui";
import { useIntl } from "@/locale";
import "./prose.css";
import type { Message } from "../../assistant/type";

export function MessageBubble({ message }: { message: Message }) {
    const t = useIntl();
    switch (message.role) {
        case "user":
            return (
                <div className="flex justify-end">
                    <div className="border rounded-md p-2 max-w-[70%]">
                        <div className="whitespace-pre-wrap select-all">
                            {message.raw}
                        </div>
                        {message.assets?.[0] && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {message.assets.map((file, i) => (
                                    <span
                                        key={i}
                                        className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1"
                                    >
                                        <span>📎</span>
                                        <span className="truncate max-w-20">
                                            {file.name}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            );

        case "assistant":
            return (
                <div className="flex justify-start">
                    <div className="border rounded-md p-2 bg-muted w-full overflow-auto">
                        {message.formatted.thought && (
                            <details className="text-xs opacity-60 mb-2">
                                <summary className="cursor-pointer hover:opacity-80">
                                    {t("thought")}
                                </summary>
                                <div className="mt-1 whitespace-pre-wrap select-all">
                                    {message.formatted.thought}
                                </div>
                            </details>
                        )}
                        <div
                            className="prose prose-sm max-w-none select-all"
                            dangerouslySetInnerHTML={{
                                __html: marked.parse(
                                    message.formatted.answer || message.raw,
                                    { async: false },
                                ),
                            }}
                        />
                    </div>
                </div>
            );

        case "tool":
            return (
                <Collapsible.Root className="bg-muted/50 rounded-md p-2 text-xs select-all">
                    <Collapsible.Trigger className="flex items-center justify-between w-full cursor-pointer hover:bg-accent/50 p-1 rounded">
                        <div className="flex items-center gap-2">
                            <span>🔧</span>
                            <span className="font-medium">
                                {message.formatted.name}
                            </span>
                        </div>
                        {message.formatted.runningTime !== undefined && (
                            <span className="opacity-60 text-[10px]">
                                {message.formatted.runningTime}ms
                            </span>
                        )}
                    </Collapsible.Trigger>
                    <Collapsible.Content className="overflow-hidden mt-2 space-y-1 data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close">
                        <div>
                            <strong>参数:</strong>
                            <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-x-auto">
                                {JSON.stringify(
                                    message.formatted.params,
                                    null,
                                    2,
                                )}
                            </pre>
                        </div>
                        {Boolean(message.formatted.returns) && (
                            <div>
                                <strong>返回:</strong>
                                <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-x-auto">
                                    {JSON.stringify(
                                        message.formatted.returns,
                                        null,
                                        2,
                                    )}
                                </pre>
                            </div>
                        )}
                        {Boolean(message.formatted.errors) && (
                            <div className="text-destructive">
                                <strong>错误:</strong>
                                {JSON.stringify(
                                    message.formatted.errors,
                                    null,
                                    2,
                                )}
                            </div>
                        )}
                    </Collapsible.Content>
                </Collapsible.Root>
            );

        default:
            return null;
    }
}
console.log(
    marked.parse(
        `
# Markdown样式测试文档
## 标题
这是一个一级标题。
### 副标题
这是一个二级标题。
## 引用
这是一个引用示例：
> 这是一段引用文字。
## 表格
下面是一个简单的表格示例：
| 标题1 | 标题2 | 标题3 |
| --- | --- | --- |
| 内容1 | 内容2 | 内容3 |
| 内容4 | 内容5 | 内容6 |
## 列表
这是一个无序列表示例：
- 列表项1
- 列表项2
- 列表项3
这是一个有序列表示例：
1. 列表项1
2. 列表项2
3. 列表项3
## 代码块
\`\`\`python
def hello_world():
    print("Hello, world!")
\`\`\`
## 分隔线
---
这是一个分隔线。
## 链接
这是一个链接示例：[点击这里](https://www.example.com)
## 图片
![Markdown图片示例](https://www.example.com/image.png)`,
        { async: false },
    ),
);
