import { type ReactNode, useMemo, useState } from "react";
import { useCopyToClipboard, useLocalStorage } from "react-use";
import { toast } from "sonner";
import PopupLayout from "@/layouts/popup-layout";
import type { ExportedJSON } from "@/ledger/type";
import { t, useIntl } from "@/locale";
import { readClipboard } from "@/utils/clipboard";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { TypeText } from "./type-code";

const promptText = `你是一个专业的JavaScript开发者，你的任务是编写一个数据转换函数。

**任务:**
编写一个名为 \`transform\` 的JavaScript函数，该函数接收一个“文件对象”，并将其转换为“我的记账App标准交易结构”。

**重要提示:**
输入参数 \`file\` 是一个 **文件对象**，代表用户上传的完整文件内容，你可以将用户在本次对话中上传的文件作为示例了解该文件的具体结构。
你需要自己解析这个文件（例如，如果它是CSV，你需要使用ctx.Papa进行文件解析；如果它是excel，你需要 \`ctx.XLSX进行解析\`；如果它是JSON，你需要 \`JSON.parse\`）。

---

**1. 输入数据:**
\`\`\`
用户在本次对话中所携带的文件（json,csv或者excel格式）
\`\`\`

---

**2. 目标格式 (必须严格遵守):**
输出必须是一个对象数组，每个对象都符合这个TypeScript接口：
\`\`\`typescript
/**
 * 我的记账App标准交易结构
 */
${TypeText}
\`\`\`

---

**3. 转换逻辑 (请仔细推理):**
- **解析:** 首先判断输入文件是CSV、JSON还是其他格式，并通过ctx中的对应工具将其解析为JavaScript对象数组。
- **映射:** 遍历解析后的数组，并根据标准交易结构中的提示，将文件中的数据尽可能转换到标准的交易结构数据ExportedJSON

---

**4. 你的输出:**
**只**输出 \`transform\` 函数的JavaScript代码。不要包含任何解释、Markdown标记 (如 \`\`\`) 或其他文本。

**函数模板:**
function transform(file:File, ctx:{Papa:any /** 专门用于解析CSV文件的第三方JS库，你应该遵循该库最新的使用方法来使用 */ ,XLSX:any /** 专门用于解析Excel文件的第三方JS库，你应该遵循该库最新的使用方法来使用 */}) {
  // 'data' 是一个包含文件所有内容的字符串。
  
  // 步骤1: 解析字符串 (例如: CSV 或 JSON)
  let parsedData = [];
  try {
    // 在这里添加你的解析逻辑
    // 例如，如果是JSON:
    // parsedData = JSON.parse(data);
    
    // 例如，如果是CSV，分析CSV的结构并准确提取出包含账单的数组部分:
    // const lines = Papa.parse(file, {
                //     header: true,
                //     preview: 3, // 只解析前3行数据
                //     dynamicTyping: false, // 全部读为字符串，让LLM处理
                //     skipEmptyLines: true,
                //     complete: (summaryResult) => {
                //         if (summaryResult.errors.length) {
                //             return reject(new Error(summaryResult.errors[0].message));
                //         }
                //         inputSummaryData = summaryResult.data;
                //         document.getElementById('inputSummary').textContent = JSON.stringify(inputSummaryData, null, 2);
                        
                //         // 2. 解析完整数据
                //         Papa.parse(file, {
                //             header: true,
                //             dynamicTyping: false,
                //             skipEmptyLines: true,
                //             complete: (fullResult) => {
                //                 if (fullResult.errors.length) {
                //                     return reject(new Error(fullResult.errors[0].message));
                //                 }
                //                 fullParsedData = fullResult.data;
                //                 resolve();
                //             },
                //             error: (err) => reject(err)
                //         });
                //     },
                //     error: (err) => reject(err)
                // });

  } catch (e) {
    console.error("解析原始字符串失败:", e);
    return []; // 解析失败返回空数组
  }

  // 步骤2: 映射数据
  const transformedData = parsedData.map(item => {
    try {
      return {
        // ... 在这里映射字段 ...
      };
    } catch (e) {
      console.error("处理单项数据失败:", item, e);
      return null; // 转换失败则返回 null
    }
  }).filter(Boolean); // 过滤掉转换失败的项
  
  return transformedData;
}`;

type ImportTransformer = {
    id: string;
    label?: ReactNode;
    transformerCode: string;
};

const getDefaultTransformers = () => [
    {
        label: t("alipay-import-transformer"),
        id: "alipay",
        transformerCode: ``,
    },
    {
        label: t("wechat-import-transformer"),
        id: "wechat",
        transformerCode: ``,
    },
];

const CUSTOM_TRANSFORMERS_KEY = "custom-import-transformers";

function SmartImport({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();

    const [selected, setSelected] = useState(
        () => getDefaultTransformers()[0].id,
    );
    const DefaultTransformers = useMemo(() => getDefaultTransformers(), []);
    const [customTransformers, setCustomTransformers] = useLocalStorage(
        CUSTOM_TRANSFORMERS_KEY,
        [] as ImportTransformer[],
    );
    const AllTransformers = useMemo(
        () => [...DefaultTransformers, ...customTransformers!],
        [customTransformers, DefaultTransformers],
    );

    const selectedTransformer = AllTransformers.find((v) => v.id === selected);
    const isDefaultTransformer = Boolean(
        DefaultTransformers.find((v) => v.id === selected),
    );
    const updateTransformerCode = (code: string) => {
        setCustomTransformers((prev) => {
            const newValue = code;
            const item = prev?.find((v) => v.id === selected);
            if (!item) {
                return prev;
            }
            item.transformerCode = newValue;
            return [...(prev ?? [])];
        });
    };

    const toEditName = () => {
        const name = prompt(t("please-enter-a-new-schema-name"));
        if (!name) {
            return;
        }
        setCustomTransformers((prev) => {
            const newValue = name;
            const item = prev?.find((v) => v.id === selected);
            if (!item) {
                return prev;
            }
            item.id = newValue;
            Promise.resolve().then(() => {
                setSelected(item.id);
            });
            return [...(prev ?? [])];
        });
    };

    const [file, setFile] = useState<File>();
    const [errorInfo, setErrorInfo] = useState<string>();
    const [, copy] = useCopyToClipboard();

    const [loading, setLoading] = useState(false);

    const toImport = async () => {
        if (!selectedTransformer?.transformerCode || !file) {
            return;
        }
        setLoading(true);
        try {
            const result = await runCode(
                selectedTransformer.transformerCode,
                file,
            );
            console.log(result, "res");
            const data = checkJSON(result);
            console.log(data);
        } catch (error) {
            console.error(error);
            setErrorInfo((error as Error).message ?? JSON.stringify(error));
        } finally {
            setLoading(false);
        }
    };
    return (
        <PopupLayout
            title={t("smart-import")}
            onBack={onCancel}
            className="h-full overflow-hidden"
            right={
                <Button
                    disabled={loading}
                    onClick={() => {
                        setCustomTransformers((prev) => {
                            const id = `${t("custom-import-transformer-name")}${(prev?.length ?? 0) + 1}`;
                            Promise.resolve().then(() => {
                                setSelected(id);
                            });
                            return [
                                ...(prev ?? []),
                                {
                                    id,
                                    transformerCode: "",
                                },
                            ];
                        });
                    }}
                >
                    {t("add-new-scheme")}
                </Button>
            }
        >
            <div className="flex gap-3 flex-col flex-1 p-4 overflow-y-auto px-4">
                <div className="flex gap-2 items-center">
                    <span className="flex-shrink-0">{t("select-scheme")}:</span>
                    <Select value={selected} onValueChange={setSelected}>
                        <SelectTrigger>
                            <SelectValue className="w-[180px]"></SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {AllTransformers.map(({ id, label }) => (
                                <SelectItem key={id} value={id}>
                                    {label ?? id}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {!isDefaultTransformer && (
                        <Button variant="secondary" onClick={toEditName}>
                            {t("rename-scheme")}
                        </Button>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    <span className="flex-shrink-0">{t("bill-file")}:</span>
                    <Input
                        type="file"
                        onChange={(e) => {
                            const file = e.currentTarget.files?.item(0);
                            if (file) {
                                setFile(file);
                            }
                        }}
                    />
                </div>
                {!isDefaultTransformer && (
                    <div className="flex flex-col gap-2">
                        <div className="text-xs opacity-60">
                            {t("step1-prompt-copy")}
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 rounded-md border p-1 h-9 text-xs break-all opacity-40 overflow-y-auto">
                                {promptText}
                            </div>
                            <Button
                                variant="secondary"
                                onClick={async () => {
                                    await copy(promptText);
                                    toast.success(t("copy-success"));
                                }}
                            >
                                {t("copy-prompt")}
                            </Button>
                        </div>
                        <div className="text-xs opacity-60">
                            {t("step2-code-paste")}
                        </div>
                        <div className="flex gap-2">
                            <textarea
                                placeholder={t("placeholder-paste-code")}
                                className="w-full border rounded-md p-1 h-20 resize-none text-sm"
                                value={selectedTransformer?.transformerCode}
                                onChange={(e) => {
                                    const newValue = e.currentTarget.value;
                                    updateTransformerCode(newValue);
                                }}
                            ></textarea>
                            <div className="flex flex-col gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={async () => {
                                        const { text } = await readClipboard();
                                        if (text !== null) {
                                            updateTransformerCode(text);
                                        }
                                    }}
                                >
                                    {t("paste")}
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => updateTransformerCode("")}
                                >
                                    {t("clear")}
                                </Button>
                            </div>
                        </div>
                        <div className="text-xs opacity-60">
                            {t("step3-import-finish")}
                        </div>
                        {errorInfo && (
                            <div className="flex gap-2">
                                <div className="flex-1 rounded-md border p-1 h-9 text-xs text-red-500 select-auto overflow-x-auto">
                                    {errorInfo}
                                </div>
                                <Button
                                    variant="secondary"
                                    onClick={async () => {
                                        await copy(errorInfo);
                                        toast.success(t("copy-success"));
                                    }}
                                >
                                    {t("copy-error-info")}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="flex-shrink-0 px-4 pb-4 flex justify-end">
                <Button onClick={toImport} disabled={loading}>
                    {loading && (
                        <i className="icon-[mdi--loading] animate-spin"></i>
                    )}
                    {t("import")}
                </Button>
            </div>
        </PopupLayout>
    );
}

const runCode = (code: string, file: File) => {
    // 1. 验证和清理
    const transformCode = code.trim();

    // 2. 动态 Worker 脚本生成
    const workerScriptContent = `
                      // 引入 PapaParse 和 XLSX 库的 CDN 地址
                      importScripts(
                          'https://cdn.jsdelivr.net/npm/papaparse@5.5.3/papaparse.min.js',
                          'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
                      );

                      // --- 暴露依赖 (Papa/XLSX) ---
                      const ctx = {
                          Papa: self.Papa, 
                          XLSX: self.XLSX
                      };

                      // --- 核心转换函数 (用户输入) ---
                      ${transformCode}

                      // Web Worker 接收消息的监听器，使用 async/await 来安全地处理 transform 函数的返回值
                      self.onmessage = async (e) => {
                          const { fileContent, fileName } = e.data;
                          
                          // 确保 transform 函数存在
                          if (typeof transform === 'function') {
                              let result;
                              try {
                                  // 使用 await 来确保等待 transform 函数（无论是同步还是异步）的最终结果
                                  result = await transform(fileContent, ctx);
                                  
                                  // 检查返回结果是否是 Promise，如果是，则说明 await 失败或用户返回了未解析的 Promise
                                  if (result && typeof result.then === 'function') {
                                       self.postMessage({ error: true, message: "Worker: transform 函数返回了一个未解析的 Promise。请确保返回一个普通对象。", data: [] });
                                       return; // 阻止后续代码执行
                                  }

                              } catch (error) {
                                console.error(error)
                                  // 捕获 transform 函数执行过程中抛出的同步或异步错误
                                  result = { error: true, message: "Worker: transform 函数执行异常: " + error.message, data: [] };
                              }
                              
                              // 发送最终的可克隆结果对象
                              self.postMessage(result);
                              
                          } else {
                               self.postMessage({ error: true, message: "Worker: 用户输入的代码中未定义名为 'transform' 的函数。", data: [] });
                          }
                      };
                  `;

    // 3. Worker 创建和设置
    const workerBlob = new Blob([workerScriptContent], {
        type: "application/javascript",
    });
    const workerUrl = URL.createObjectURL(workerBlob);
    const currentWorker = new Worker(workerUrl);
    return new Promise((resolve, reject) => {
        // 监听 Worker 的返回结果
        currentWorker.onmessage = (e) => {
            const result = e.data;
            console.log(result, "result");

            if (result.error) {
                reject(result.message);
            } else {
                resolve(result);
            }
            // 清理 URL 对象
            URL.revokeObjectURL(workerUrl);
        };

        // 监听 Worker 错误
        currentWorker.onerror = (e) => {
            console.error("Worker Error:", e);
            reject(e);
            // 清理 URL 对象
            URL.revokeObjectURL(workerUrl);
        };

        const fileContent = file;
        const fileName = file.name;

        // 将数据发送到 Worker
        currentWorker.postMessage({ fileContent, fileName });
    });
};

const checkJSON = (v: unknown) => {
    if (!v || typeof v !== "object") {
        throw new Error("result is not an object");
    }
    if (!Array.isArray((v as any)["items"])) {
        throw new Error("the value of key 'items' in result is not an array");
    }
    if ((v as ExportedJSON).items.length === 0) {
        throw new Error("the array value of key 'items's length is 0");
    }
    return v as ExportedJSON;
};

export const [SmartImportProvider, showSmartImport] = createConfirmProvider(
    SmartImport,
    {
        dialogTitle: "Smart Import",
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
    },
);
