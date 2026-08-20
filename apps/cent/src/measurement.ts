export type BillCreateSource =
    | "manual"
    | "keyboard"
    | "voice"
    | "clipboard"
    | "relayr"
    | "url"
    | "duplicate"
    | "split"
    | "import"
    | "assistant_import";

export type TokenRange =
    | "zero"
    | "lt_1k"
    | "1k_4k"
    | "4k_16k"
    | "16k_64k"
    | "gte_64k";

export type TokenUsageApiType =
    | "open_ai_compatible"
    | "google_ai_studio"
    | "local";

export type UsageMetric =
    | "book_count"
    | "custom_theme_enabled"
    | "widget_count"
    | "home_widget_count"
    | "collaborator_count"
    | "custom_category_count"
    | "renamed_category_count"
    | "tag_count"
    | "tag_group_count"
    | "custom_currency_count"
    | "budget_count"
    | "scheduled_count"
    | "enabled_scheduled_count"
    | "map_enabled"
    | "stat_filter_count"
    | "bill_count"
    | "attachment_count";

export type UsageBucket =
    | "0"
    | "1"
    | "2_3"
    | "4_10"
    | "11_plus"
    | "1_3"
    | "11_30"
    | "31_plus"
    | "1_10"
    | "11_50"
    | "51_200"
    | "201_1000"
    | "1001_5000"
    | "5001_plus"
    | "2_5"
    | "6_20"
    | "21_100"
    | "101_plus"
    | "enabled"
    | "disabled";

export type ConfigFeature =
    | "book"
    | "collaborator"
    | "custom_theme"
    | "preset"
    | "widget"
    | "home_widget"
    | "category"
    | "tag"
    | "tag_group"
    | "custom_currency"
    | "budget"
    | "scheduled"
    | "map"
    | "stat_filter";

export type ConfigAction =
    | "create"
    | "update"
    | "delete"
    | "reset"
    | "enable"
    | "disable"
    | "import"
    | "export"
    | "invite";

export type MeasurementEventMap = {
    app_open: undefined;
    login_method_used: {
        method: "github" | "gitee" | "webdav" | "s3" | "offline";
    };
    bill_created: {
        source: BillCreateSource;
        item_count: number;
    };
    search_submitted: {
        mode: "empty" | "keyword" | "filter" | "mixed";
    };
    assistant_opened: {
        surface: "desktop" | "mobile";
    };
    assistant_request_started: undefined;
    ai_token_usage: {
        feature: "assistant" | "zen";
        measurement: "estimated";
        api_type: TokenUsageApiType;
        input_range: TokenRange;
        output_range: TokenRange;
        total_range: TokenRange;
        request_count_range: "zero" | "1" | "2_3" | "4_7" | "gte_8";
        outcome: "completed" | "interrupted" | "failed";
    };
    zen_status: {
        enabled: boolean;
    };
    zen_setting_changed: {
        enabled: boolean;
    };
    zen_opened: {
        state: "ready" | "manual";
    };
    zen_completed: undefined;
    usage_snapshot_metric: {
        metric: UsageMetric;
        bucket: UsageBucket;
        approx_value: number;
    };
    feature_config_changed: {
        feature: ConfigFeature;
        action: ConfigAction;
    };
};

export type MeasurementEventName = keyof MeasurementEventMap;

export type CentMeasurementCollector = <Name extends MeasurementEventName>(
    eventName: Name,
    parameters: MeasurementEventMap[Name],
) => void;

type MeasureArguments<Name extends MeasurementEventName> =
    MeasurementEventMap[Name] extends undefined
        ? []
        : [parameters: MeasurementEventMap[Name]];

export function isMeasurementEnabled() {
    return Boolean(import.meta.env.VITE_GTAG_SCRIPT?.trim());
}

export function isMeasurementReady() {
    return (
        isMeasurementEnabled() &&
        typeof window !== "undefined" &&
        typeof window.__CENT_MEASUREMENT__ === "function"
    );
}

export function measure<Name extends MeasurementEventName>(
    eventName: Name,
    ...[parameters]: MeasureArguments<Name>
) {
    if (!isMeasurementEnabled()) {
        return;
    }
    try {
        window.__CENT_MEASUREMENT__?.(
            eventName,
            parameters as MeasurementEventMap[Name],
        );
    } catch {
        // Measurement must never affect product behavior.
    }
}
