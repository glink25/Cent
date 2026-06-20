const Permission = {
    Billing: "billing",
    Filter: "filter",
    Budget: "budget",
    Collaborators: "collaborators",
    Category: "category",
    Currency: "currency",
    Tag: "tag",
} as const;

type FormItemType = "text" | "number" | "date" | "select";

type FormItem = {
    type: FormItemType;
    label: string;
    default?: string | number;
    options?: string[];
};

type WidgetSettingsForm = Record<string, FormItem>;

type ParsedMetadata = {
    apiVersion: string;
    name: string;
    permissions: string[];
};

type CompiledWidget = {
    name: string;
    apiVersion: string;
    permissions: (typeof Permission)[keyof typeof Permission][];
    config: WidgetSettingsForm;
    code: string;
};

function parseMetadata(code: string): ParsedMetadata {
    const metadata: ParsedMetadata = {
        apiVersion: "",
        name: "",
        permissions: [],
    };

    const jsdocMatch = code.match(/\/\*\*[\s\S]*?\*\//);
    if (!jsdocMatch) return metadata;

    const jsdoc = jsdocMatch[0];

    const apiVersionMatch = jsdoc.match(/@widget-api\s+([\d.]+)/);
    if (apiVersionMatch) {
        metadata.apiVersion = apiVersionMatch[1];
    }

    const nameMatch = jsdoc.match(/@name\s+(.+)/);
    if (nameMatch) {
        metadata.name = nameMatch[1].trim();
    }

    const permissionsMatch = jsdoc.match(/@permissions\s+(.+)/);
    if (permissionsMatch) {
        metadata.permissions = permissionsMatch[1]
            .split(",")
            .map((p) => p.trim())
            .filter((p) => Object.values(Permission).includes(p as any));
    }

    return metadata;
}

function extractConfigExport(code: string): string | null {
    const configMatch = code.match(
        /export\s+const\s+config\s*=\s*(\{[\s\S]*?\});?\s*(?:\n|$)/,
    );
    return configMatch ? configMatch[1] : null;
}

function parseConfigObject(configStr: string): WidgetSettingsForm {
    const config: WidgetSettingsForm = {};

    const fieldRegex = /(\w+)\s*:\s*\{([^}]+)\}/g;
    let match: RegExpExecArray | null = fieldRegex.exec(configStr);

    while (match !== null) {
        const fieldName = match[1];
        const fieldContent = match[2];

        const typeMatch = fieldContent.match(/type\s*:\s*['"](\w+)['"]/);
        const labelMatch = fieldContent.match(/label\s*:\s*['"]([^'"]+)['"]/);
        const defaultMatch = fieldContent.match(
            /default\s*:\s*(?:['"]([^'"]+)['"]|(\d+))/,
        );
        const optionsMatch = fieldContent.match(/options\s*:\s*\[([\s\S]*?)\]/);

        if (typeMatch && labelMatch) {
            const type = typeMatch[1] as FormItemType;
            const item: FormItem = {
                type,
                label: labelMatch[1],
            };

            if (defaultMatch) {
                item.default = defaultMatch[2]
                    ? parseInt(defaultMatch[2])
                    : defaultMatch[1];
            }

            if (optionsMatch && type === "select") {
                item.options = optionsMatch[1]
                    .split(",")
                    .map((o) => o.trim().replace(/['"]/g, ""))
                    .filter((o) => o);
            }

            config[fieldName] = item;
        }

        match = fieldRegex.exec(configStr);
    }

    return config;
}

export default function compileWidget(widgetCode: string): CompiledWidget {
    const metadata = parseMetadata(widgetCode);

    let config: WidgetSettingsForm = {};
    const configStr = extractConfigExport(widgetCode);
    if (configStr) {
        config = parseConfigObject(configStr);
    }

    return {
        name: metadata.name,
        apiVersion: metadata.apiVersion,
        permissions: metadata.permissions as any,
        config,
        code: widgetCode,
    };
}

export type { CompiledWidget, FormItem, WidgetSettingsForm };
export { Permission };
