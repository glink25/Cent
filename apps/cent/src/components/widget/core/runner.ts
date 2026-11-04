import type { UserInfo } from "@/api/endpoints/type";
import type { Budget } from "@/ledger/extra-type";
import type { Bill, BillCategory, BillTag } from "@/ledger/type";
import createSandBox from "../../../utils/sandbox";
import compileWidget, { Permission } from "./compile";
import InjectCode from "./global-inject.js?raw";
import RuntimeCode from "./runtime.js?raw";
import { validateRuntimeResult } from "./validation";

type WidgetData = {
    billing?: Bill[];
    filter?: Record<string, unknown>;
    budget?: Budget[];
    collaborators?: (UserInfo & { originalName: string })[];
    categories?: BillCategory[];
    currencies?: {
        base: string;
        custom?: {
            id: string;
            name: string;
            symbol: string;
            rateToBase: number;
        }[];
        quick?: string[];
    };
    tags?: BillTag[];
};

type WidgetEnv = {
    theme: "light" | "dark";
    language: string;
};

type WidgetContext = {
    data: WidgetData;
    settings: Record<string, any>;
    env: WidgetEnv;
};

type RunWidgetOptions = {
    settings?: Record<string, any>;
    env?: Partial<WidgetEnv>;
    grants?: string[];
    runtime?: {
        widgetId: string;
        viewer: { id: string | number };
        storage?: Record<string, unknown>;
        view?: string;
        params?: Record<string, unknown>;
        state?: Record<string, unknown>;
        mode?: "computed";
        event?: { id: string; value?: unknown };
        allowedEvents?: string[];
    };
    onHostCall?: (name: string, params: unknown) => Promise<unknown>;

    getData: () => Promise<{
        bills: Bill[];
        budgets?: Budget[];
        filter?: Record<string, unknown>;
        creators?: (UserInfo & { originalName: string })[];
        categories?: BillCategory[];
        baseCurrency?: string;
        customCurrencies?: {
            id: string;
            name: string;
            symbol: string;
            rateToBase: number;
        }[];
        quickCurrencies?: string[];
        tags?: BillTag[];
    }>;
};

export default async function runWidget(
    widgetCode: string,
    options: RunWidgetOptions,
) {
    const widget = compileWidget(widgetCode);

    const permissions = widget.permissions.filter((p) =>
        (options.grants ?? widget.permissions).includes(p),
    );
    const realData = await options.getData();

    const data: WidgetData = {};

    if (permissions.includes(Permission.Billing)) {
        data.billing = realData.bills;
    }
    if (permissions.includes(Permission.Filter)) {
        data.filter = realData.filter ?? {};
    }
    if (permissions.includes(Permission.Budget)) {
        data.budget = realData.budgets;
    }
    if (permissions.includes(Permission.Collaborators)) {
        data.collaborators = realData.creators;
    }
    if (permissions.includes(Permission.Category)) {
        data.categories = realData.categories;
    }
    if (permissions.includes(Permission.Currency)) {
        data.currencies = {
            base: realData.baseCurrency ?? "CNY",
            custom: realData.customCurrencies,
            quick: realData.quickCurrencies,
        };
    }
    if (permissions.includes(Permission.Tag)) {
        data.tags = realData.tags;
    }

    const settings: Record<string, any> = {};
    if (widget.config) {
        for (const [key, configItem] of Object.entries(widget.config)) {
            if (options.settings && options.settings[key] !== undefined) {
                settings[key] = options.settings[key];
            } else if (configItem.default !== undefined) {
                settings[key] = configItem.default;
            }
        }
    }

    if (options.settings) {
        Object.assign(settings, options.settings);
    }

    const env: WidgetEnv = {
        theme: options.env?.theme ?? "light",
        language: options.env?.language ?? "zh-CN",
    };

    const ctx: WidgetContext = {
        data,
        settings,
        env,
    };

    const isV2 = widget.apiVersion.split(".")[0] === "2";
    const sandbox = createSandBox(
        [],
        undefined,
        undefined,
        options.runtime?.event ? options.onHostCall : undefined,
    );
    let moduleUrl: string | undefined;

    try {
        let code = `${InjectCode}\n${widget.code}`;
        let args: unknown[] = [ctx];
        if (isV2) {
            moduleUrl = URL.createObjectURL(
                new Blob([code], { type: "application/javascript" }),
            );
            code = `${RuntimeCode}\nimport * as widget from ${JSON.stringify(moduleUrl)};\nexport default input => executeWidget(widget, input);`;
            args = [
                {
                    ...options.runtime,
                    widgetId: options.runtime?.widgetId ?? "preview",
                    now: Date.now(),
                    context: {
                        ...ctx,
                        viewer: options.runtime?.viewer ?? { id: "preview" },
                    },
                },
            ];
        }
        const rendered = await sandbox.runDefaultExport(code, args, 5000);
        return {
            success: true,
            result:
                isV2 && options.runtime?.mode !== "computed"
                    ? validateRuntimeResult(rendered)
                    : rendered,
            widget,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            widget,
        };
    } finally {
        sandbox.destroy();
        if (moduleUrl) URL.revokeObjectURL(moduleUrl);
    }
}

export type { WidgetContext, WidgetData, WidgetEnv, RunWidgetOptions };
