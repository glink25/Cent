import type { UserInfo } from "@/api/endpoints/type";
import type { Budget } from "@/ledger/extra-type";
import type { Bill, BillCategory, BillTag } from "@/ledger/type";
import createSandBox from "../../../utils/sandbox";
import compileWidget, { Permission } from "./compile";
import InjectCode from "./global-inject.js?raw";

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

    const realData = await options.getData();

    const data: WidgetData = {};

    if (widget.permissions.includes(Permission.Billing)) {
        data.billing = realData.bills;
    }
    if (widget.permissions.includes(Permission.Filter)) {
        data.filter = realData.filter ?? {};
    }
    if (widget.permissions.includes(Permission.Budget)) {
        data.budget = realData.budgets;
    }
    if (widget.permissions.includes(Permission.Collaborators)) {
        data.collaborators = realData.creators;
    }
    if (widget.permissions.includes(Permission.Category)) {
        data.categories = realData.categories;
    }
    if (widget.permissions.includes(Permission.Currency)) {
        data.currencies = {
            base: realData.baseCurrency ?? "CNY",
            custom: realData.customCurrencies,
            quick: realData.quickCurrencies,
        };
    }
    if (widget.permissions.includes(Permission.Tag)) {
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

    const sandbox = createSandBox([]);

    try {
        const rendered = await sandbox.runDefaultExport(
            `${InjectCode}\n${widget.code}`,
            [ctx],
            5000,
        );
        return {
            success: true,
            result: rendered,
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
    }
}

export type { WidgetContext, WidgetData, WidgetEnv, RunWidgetOptions };
