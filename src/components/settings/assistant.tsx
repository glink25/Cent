import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";
import PopupLayout from "@/layouts/popup-layout";
import type { AIConfig } from "@/ledger/extra-type";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { decodeApiKey, encodeApiKey } from "@/utils/api-key";
import { requestAI } from "../assistant/request";
import createConfirmProvider from "../confirm";
import modal from "../modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";

// 配置编辑弹框
function ConfigForm({
    onCancel,
    onConfirm,
    edit,
}: {
    onConfirm?: (v: AIConfig) => void;
    onCancel?: () => void;
    edit?: AIConfig;
}) {
    const t = useIntl();
    const [name, setName] = useState(edit?.name ?? "");
    const [apiKey, setApiKey] = useState(edit ? decodeApiKey(edit.apiKey) : "");
    const [apiUrl, setApiUrl] = useState(edit?.apiUrl ?? "");
    const [model, setModel] = useState(edit?.model ?? "");
    const [apiType, setApiType] = useState<AIConfig["apiType"]>(
        edit?.apiType ?? "open-ai-compatible",
    );
    const [isTesting, setIsTesting] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);

    const handleSave = useCallback(() => {
        // 验证
        if (!name.trim()) {
            toast.error(t("config-name-required"));
            return;
        }
        if (!apiKey.trim()) {
            toast.error(t("api-key-required"));
            return;
        }
        if (!apiUrl.trim()) {
            toast.error(t("api-url-required"));
            return;
        }
        if (!model.trim()) {
            toast.error(t("model-required"));
            return;
        }

        const config: AIConfig = {
            id: edit?.id ?? `config-${Date.now()}`,
            name: name.trim(),
            apiKey: encodeApiKey(apiKey.trim()),
            apiUrl: apiUrl.trim(),
            model: model.trim(),
            apiType: apiType,
        };

        onConfirm?.(config);
    }, [name, apiKey, apiUrl, model, apiType, edit, onConfirm, t]);

    const handleTestConnection = useCallback(async () => {
        if (!apiKey.trim() || !apiUrl.trim() || !model.trim()) {
            toast.error(t("api-key-required"));
            return;
        }

        setIsTesting(true);
        try {
            // 构建测试配置对象
            const testConfig: AIConfig = {
                id: "test",
                name: "test",
                apiKey: apiKey.trim(),
                apiUrl: apiUrl.trim(),
                model: model.trim(),
                apiType: apiType,
            };

            // 构建测试消息
            const testMessages: Array<{
                role: "system" | "user" | "assistant";
                content: string;
            }> = [
                {
                    role: "user",
                    content: "请直接输出文本“测试完成”",
                },
            ];

            await requestAI(testMessages, testConfig);
            toast.success(t("connection-success"));
            return;
        } catch (error) {
            toast.error(
                `${t("connection-failed")}: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
        } finally {
            setIsTesting(false);
        }
    }, [apiKey, apiUrl, model, apiType, t]);

    return (
        <PopupLayout
            title={edit ? t("edit-ai-config") : t("create-ai-config")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="flex-1 flex flex-col pb-4 gap-4 overflow-hidden">
                <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                    {/* 配置名称 */}
                    <div className="px-4">
                        <div className="text-sm py-1">
                            {t("ai-config-name")}
                        </div>
                        <Input
                            name="ai-config-name"
                            placeholder={t("ai-config-name-placeholder")}
                            value={name}
                            onChange={(e) => setName(e.currentTarget.value)}
                        />
                    </div>

                    {/* API 类型 */}
                    <div className="px-4">
                        <div className="text-sm py-1">
                            {t("ai-config-api-type")}
                        </div>
                        <Select
                            value={apiType}
                            onValueChange={(value: AIConfig["apiType"]) =>
                                setApiType(value)
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="open-ai-compatible">
                                    {t("open-ai-compatible")}
                                </SelectItem>
                                <SelectItem value="google-ai-studio">
                                    {t("google-ai-studio")}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="text-xs opacity-60 mt-1">
                            {apiType === "open-ai-compatible"
                                ? t("ai-config-api-type-description", {
                                      a: (chunks: React.ReactNode) => (
                                          <a
                                              href="https://platform.openai.com/docs/api-reference"
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-500 hover:text-blue-600 underline"
                                          >
                                              {chunks}
                                          </a>
                                      ),
                                  })
                                : t("ai-config-api-type-google-description", {
                                      a: (chunks: React.ReactNode) => (
                                          <a
                                              href="https://ai.google.dev/api"
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-500 hover:text-blue-600 underline"
                                          >
                                              {chunks}
                                          </a>
                                      ),
                                  })}
                        </div>
                    </div>

                    {/* API URL */}
                    <div className="px-4">
                        <div className="text-sm py-1">
                            {t("ai-config-api-url")}
                        </div>
                        <Input
                            name="ai-config-url"
                            placeholder={t("ai-config-api-url-placeholder")}
                            value={apiUrl}
                            onChange={(e) => setApiUrl(e.currentTarget.value)}
                        />
                        <div className="text-xs opacity-60 mt-1">
                            {t("ai-config-api-url-description", {
                                a: (chunks: React.ReactNode) => (
                                    <a
                                        href="https://glink25.github.io/post/%E4%BD%BF%E7%94%A8Relayr%E4%BB%A3%E7%90%86%E5%8D%8F%E8%AE%AEURL/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:text-blue-600 underline"
                                    >
                                        {chunks}
                                    </a>
                                ),
                            })}
                        </div>
                    </div>

                    {/* API Key */}
                    <div className="px-4">
                        <div className="text-sm py-1">
                            {t("ai-config-api-key")}
                        </div>
                        <div className="relative">
                            <Input
                                name="ai-config-password"
                                type={showApiKey ? "text" : "password"}
                                placeholder={t("ai-config-api-key-placeholder")}
                                value={apiKey}
                                onChange={(e) =>
                                    setApiKey(e.currentTarget.value)
                                }
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-0 top-0 h-full px-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            >
                                {showApiKey ? (
                                    <i className="icon-[mdi--eye-off] size-4"></i>
                                ) : (
                                    <i className="icon-[mdi--eye] size-4"></i>
                                )}
                            </button>
                        </div>
                        <div className="text-xs opacity-60 mt-1">
                            {t("ai-config-api-key-description")}
                        </div>
                    </div>

                    {/* Model */}
                    <div className="px-4">
                        <div className="text-sm py-1">
                            {t("ai-config-model")}
                        </div>
                        <Input
                            name="ai-config-model"
                            placeholder={t("ai-config-model-placeholder")}
                            value={model}
                            onChange={(e) => setModel(e.currentTarget.value)}
                        />
                        <div className="text-xs opacity-60 mt-1">
                            {t("ai-config-model-description")}
                        </div>
                    </div>
                </div>

                {/* 测试连接按钮 */}
                <div className="px-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className="w-full"
                    >
                        {isTesting
                            ? t("testing-connection")
                            : t("test-connection")}
                    </Button>
                </div>

                {/* 保存按钮 */}
                <div className="px-4">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onCancel}
                            className="flex-1"
                        >
                            {t("cancel")}
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleSave}
                            className="flex-1"
                        >
                            {t("save")}
                        </Button>
                    </div>
                </div>
            </div>
        </PopupLayout>
    );
}

const [ConfigFormProvider, showConfigForm] = createConfirmProvider(ConfigForm, {
    dialogTitle: "create-ai-config",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
});

// 主配置列表界面
function Form({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    const { id: userId } = useUserStore();

    // 获取配置列表和默认配置ID
    const { configs, defaultConfigId } = useLedgerStore(
        useShallow((state) => {
            const assistantData =
                state.infos?.meta.personal?.[userId]?.assistant;
            return {
                configs: assistantData?.configs,
                defaultConfigId: assistantData?.defaultConfigId,
            };
        }),
    );

    // 迁移旧的智谱GLM配置
    useEffect(() => {
        const migrateOldConfig = async () => {
            const oldApiKey =
                useLedgerStore.getState().infos?.meta.personal?.[userId]
                    ?.assistant?.bigmodel?.apiKey;
            const existingConfigs =
                useLedgerStore.getState().infos?.meta.personal?.[userId]
                    ?.assistant?.configs ?? [];

            // 如果有旧配置且还没有迁移
            if (
                oldApiKey &&
                !existingConfigs.some((c) => c.id === "zhipu-glm-migrated")
            ) {
                await useLedgerStore.getState().updatePersonalMeta((prev) => {
                    if (!prev.assistant) {
                        prev.assistant = {};
                    }
                    if (!prev.assistant.configs) {
                        prev.assistant.configs = [];
                    }

                    // 添加迁移的配置
                    prev.assistant.configs.push({
                        id: "zhipu-glm-migrated",
                        name: "智谱GLM",
                        apiKey: oldApiKey,
                        apiUrl: "https://open.bigmodel.cn/api/paas/v4",
                        model: "glm-4-flash",
                        apiType: "open-ai-compatible",
                    });

                    // 如果没有默认配置，设置这个为默认
                    if (!prev.assistant.defaultConfigId) {
                        prev.assistant.defaultConfigId = "zhipu-glm-migrated";
                    }

                    // 删除旧的配置
                    delete prev.assistant.bigmodel;

                    return prev;
                });
            }
        };

        migrateOldConfig();
    }, [userId]);

    const handleCreateConfig = useCallback(async () => {
        const config = await showConfigForm();
        if (!config) {
            return;
        }
        await useLedgerStore.getState().updatePersonalMeta((prev) => {
            if (!prev.assistant) {
                prev.assistant = {};
            }
            if (!prev.assistant.configs) {
                prev.assistant.configs = [];
            }

            prev.assistant.configs.push(config);

            // 如果是第一个配置，自动设为默认
            if (prev.assistant.configs.length === 1) {
                prev.assistant.defaultConfigId = config.id;
            }

            return prev;
        });
        toast.success(t("ai-config-saved"));
    }, [t]);

    const handleEditConfig = useCallback(
        async (config: AIConfig) => {
            const updatedConfig = await showConfigForm(config);
            if (!updatedConfig) {
                return;
            }
            await useLedgerStore.getState().updatePersonalMeta((prev) => {
                if (!prev.assistant?.configs) return prev;

                const index = prev.assistant.configs.findIndex(
                    (c) => c.id === updatedConfig.id,
                );
                if (index !== -1) {
                    prev.assistant.configs[index] = updatedConfig;
                }

                return prev;
            });
            toast.success(t("ai-config-saved"));
        },
        [t],
    );

    const handleSetDefault = useCallback(async (configId: string) => {
        await useLedgerStore.getState().updatePersonalMeta((prev) => {
            if (!prev.assistant) {
                prev.assistant = {};
            }
            prev.assistant.defaultConfigId = configId;
            return prev;
        });
    }, []);

    const handleDeleteConfig = useCallback(
        async (configId: string) => {
            await modal.prompt({
                title: t("are-you-sure-to-delete-this-config"),
            });
            await useLedgerStore.getState().updatePersonalMeta((prev) => {
                if (!prev.assistant?.configs) return prev;

                prev.assistant.configs = prev.assistant.configs.filter(
                    (c) => c.id !== configId,
                );

                // 如果删除的是默认配置
                if (prev.assistant.defaultConfigId === configId) {
                    // 如果还有其他配置，选第一个作为默认
                    if (prev.assistant.configs.length > 0) {
                        prev.assistant.defaultConfigId =
                            prev.assistant.configs[0].id;
                    } else {
                        prev.assistant.defaultConfigId = "";
                    }
                }

                return prev;
            });
            toast.success(t("ai-config-deleted"));
        },
        [t],
    );

    return (
        <PopupLayout
            title={t("ai-assistant")}
            onBack={onCancel}
            className="h-full overflow-hidden"
            right={
                <Button
                    variant="default"
                    size="sm"
                    onClick={handleCreateConfig}
                    className="w-full"
                >
                    <i className="icon-[mdi--plus] size-4"></i>
                    {t("create-ai-config")}
                </Button>
            }
        >
            <div className="flex-1 flex flex-col overflow-y-auto pb-4">
                {/* 配置列表 */}
                <div className="px-4">
                    <div className="text-sm font-medium py-2">
                        {t("ai-config-list")}
                    </div>
                    {(configs?.length ?? 0) === 0 ? (
                        <div className="text-xs opacity-60 text-center py-8">
                            {t("no-ai-configs")}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {configs?.map((config) => (
                                <div
                                    key={config.id}
                                    className={cn(
                                        "border rounded-md p-3",
                                        config.id === defaultConfigId
                                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                            : "border-gray-200 dark:border-gray-700",
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <div className="font-medium text-sm flex items-center gap-2">
                                                {config.name}
                                                {config.id ===
                                                    defaultConfigId && (
                                                    <span className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded">
                                                        {t("default-config")}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs opacity-60 mt-1">
                                                {config.model}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    handleEditConfig(config)
                                                }
                                                className="h-7 px-2"
                                            >
                                                <i className="icon-[mdi--pencil] size-4"></i>
                                            </Button>
                                            {
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        handleDeleteConfig(
                                                            config.id,
                                                        )
                                                    }
                                                    className="h-7 px-2 text-red-500 hover:text-red-600"
                                                >
                                                    <i className="icon-[mdi--delete] size-4"></i>
                                                </Button>
                                            }
                                        </div>
                                    </div>
                                    {config.id !== defaultConfigId && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                handleSetDefault(config.id)
                                            }
                                            className="w-full text-xs h-7"
                                        >
                                            {t("set-as-default")}
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <ConfigFormProvider />
        </PopupLayout>
    );
}

const [AssistantProvider, showAssistant] = createConfirmProvider(Form, {
    dialogTitle: "ai-assistant",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
});

export default function AssistantSettingsItem() {
    const t = useIntl();
    const betaClassName = `relative after:content-['beta'] after:rounded after:bg-yellow-400 after:px-[2px] after:text-[8px] after:block after:absolute after:top-0 after:right-0 after:translate-x-[calc(100%+4px)]`;

    return (
        <div className="assistant">
            <Button
                onClick={() => {
                    showAssistant();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div
                        className={cn(betaClassName, "flex items-center gap-2")}
                    >
                        <i className="icon-[mdi--robot-outline] size-5"></i>
                        {t("ai-assistant")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <AssistantProvider />
        </div>
    );
}
