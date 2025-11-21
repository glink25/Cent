import { type ReactNode, useMemo, useState } from "react";
import { useCopyToClipboard, useLocalStorage } from "react-use";
import { toast } from "sonner";
import PopupLayout from "@/layouts/popup-layout";
import { BillCategories } from "@/ledger/category";
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
import { promptText } from "./llm-prompt";
import { importFromPreviewResult, showImportPreview } from "./preview";
import AlipayCode from "./schemas/alipay.js?raw";
import WechatCode from "./schemas/wechat.js?raw";

type ImportTransformer = {
    id: string;
    label?: ReactNode;
    transformerCode: string;
};

const getDefaultTransformers = () => [
    {
        label: t("alipay-import-transformer"),
        id: "alipay",
        transformerCode: AlipayCode,
    },
    {
        label: t("wechat-import-transformer"),
        id: "wechat",
        transformerCode: WechatCode,
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
        const data = await (async () => {
            try {
                const result = await runCode(
                    selectedTransformer.transformerCode,
                    file,
                );
                return checkJSON(result);
            } catch (error) {
                console.error(error);
                const errorInfo =
                    (error as Error).message ?? JSON.stringify(error);
                setErrorInfo(errorInfo);
                toast.error(errorInfo);
                return undefined;
            } finally {
                setLoading(false);
            }
        })();
        if (!data) {
            return;
        }
        const res = await showImportPreview({
            bills: data.items,
            meta: data.meta,
        });
        if (!res) {
            return;
        }
        if (res.strategy === "overlap") {
            // 智能导入时，需要
        }
        await importFromPreviewResult(res);
        onCancel?.();
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
                <Button onClick={toImport} disabled={loading || !file}>
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
                          'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
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
                          const { fileContent, fileName, DefaultCategories } = e.data;
                          ctx.DefaultCategories = DefaultCategories;
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
        currentWorker.postMessage({
            fileContent,
            fileName,
            DefaultCategories: BillCategories,
        });
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
