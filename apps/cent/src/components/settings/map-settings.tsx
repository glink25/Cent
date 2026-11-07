import { useId, useState } from "react";
import { toast } from "sonner";
import PopupLayout from "@/layouts/popup-layout";
import {
    defaultMapProvider,
    type MapProviderId,
    readMapConfig,
} from "@/ledger/map-config";
import { useIntl } from "@/locale";
import { measure } from "@/measurement";
import { useLedgerStore } from "@/store/ledger";
import { encodeApiKey } from "@/utils/api-key";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

function Credential({
    label,
    value,
    onChange,
    secret = true,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    secret?: boolean;
}) {
    const id = useId();
    const t = useIntl();
    const [visible, setVisible] = useState(false);
    return (
        <div className="flex flex-col gap-1 text-sm">
            <label htmlFor={id}>{label}</label>
            <div className="flex gap-1">
                <Input
                    id={id}
                    type={secret && !visible ? "password" : "text"}
                    autoComplete="off"
                    value={value}
                    onChange={(event) => onChange(event.currentTarget.value)}
                />
                {secret && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-pressed={visible}
                        aria-label={t("map-show-credential")}
                        onClick={() => setVisible(!visible)}
                    >
                        <i
                            aria-hidden="true"
                            className={
                                visible
                                    ? "icon-[mdi--eye-off] size-4"
                                    : "icon-[mdi--eye] size-4"
                            }
                        />
                    </Button>
                )}
            </div>
        </div>
    );
}

function MapConfigForm({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    const config = useLedgerStore((state) => state.infos?.meta.map);
    const [initial] = useState(() => readMapConfig(config));
    const [initialDefault] = useState(() => defaultMapProvider(config));
    const [amapKey, setAmapKey] = useState(initial.amp.key);
    const [securityCode, setSecurityCode] = useState(initial.amp.securityCode);
    const [googleKey, setGoogleKey] = useState(initial.google.key);
    const [mapId, setMapId] = useState(initial.google.mapId);
    const [provider, setProvider] = useState<MapProviderId>(initialDefault);
    const [saving, setSaving] = useState(false);

    const ampReady = !!(amapKey.trim() && securityCode.trim());
    const googleReady = !!(googleKey.trim() && mapId.trim());
    const ampEdited =
        amapKey !== initial.amp.key ||
        securityCode !== initial.amp.securityCode;
    const googleEdited =
        googleKey !== initial.google.key || mapId !== initial.google.mapId;

    async function save() {
        if (saving) return;
        if (
            (ampEdited &&
                Boolean(amapKey.trim()) !== Boolean(securityCode.trim())) ||
            (googleEdited &&
                Boolean(googleKey.trim()) !== Boolean(mapId.trim()))
        ) {
            toast.error(t("map-config-incomplete"));
            return;
        }
        setSaving(true);
        try {
            await useLedgerStore.getState().updateGlobalMeta((meta) => {
                const map = { ...meta.map };
                if (ampEdited) {
                    if (ampReady) {
                        map.amapKey = encodeApiKey(amapKey.trim());
                        map.amapSecurityCode = encodeApiKey(
                            securityCode.trim(),
                        );
                    } else {
                        delete map.amapKey;
                        delete map.amapSecurityCode;
                    }
                }
                if (googleEdited) {
                    if (googleReady) {
                        map.googleKey = encodeApiKey(googleKey.trim());
                        map.googleMapId = mapId.trim();
                    } else {
                        delete map.googleKey;
                        delete map.googleMapId;
                    }
                }
                if (
                    provider !== initialDefault &&
                    (provider === "amp" ? ampReady : googleReady)
                ) {
                    map.defaultProvider = provider;
                }
                return { ...meta, map };
            });
            measure("feature_config_changed", {
                feature: "map",
                action: ampReady || googleReady ? "enable" : "disable",
            });
            toast.success(t("map-config-saved"));
            onCancel?.();
        } catch {
            toast.error(t("map-config-save-failed"));
        } finally {
            setSaving(false);
        }
    }

    return (
        <PopupLayout
            title={t("map-settings")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <i
                            aria-hidden="true"
                            className="icon-[mdi--map-outline] size-5 text-muted-foreground"
                        />
                        {t("map-default-provider")}
                    </div>
                    <Select
                        value={provider}
                        onValueChange={(value) =>
                            setProvider(value === "google" ? "google" : "amp")
                        }
                    >
                        <SelectTrigger
                            size="sm"
                            aria-label={t("map-default-provider")}
                            className="bg-background"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="amp" disabled={!ampReady}>
                                {t("map-provider-amap")}
                            </SelectItem>
                            <SelectItem value="google" disabled={!googleReady}>
                                Google Maps
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Tabs defaultValue={initialDefault} className="mt-5">
                    <TabsList
                        className="grid w-full grid-cols-2"
                        aria-label={t("map-settings")}
                    >
                        <TabsTrigger value="amp">
                            {t("map-provider-amap")}
                        </TabsTrigger>
                        <TabsTrigger value="google">Google Maps</TabsTrigger>
                    </TabsList>
                    <TabsContent value="amp" className="space-y-3 pt-2">
                        <Credential
                            label={t("amap-key")}
                            value={amapKey}
                            onChange={setAmapKey}
                        />
                        <Credential
                            label={t("amap-security-code")}
                            value={securityCode}
                            onChange={setSecurityCode}
                        />
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                                {t("map-settings-help", {
                                    a: (children: React.ReactNode) => (
                                        <a
                                            className="underline underline-offset-2"
                                            href="https://lbs.amap.com/api/jsapi-v2/guide/abc/prepare"
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {children}
                                        </a>
                                    ),
                                })}
                            </p>
                            {(amapKey || securityCode) && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="shrink-0 text-muted-foreground"
                                    onClick={() => {
                                        setAmapKey("");
                                        setSecurityCode("");
                                    }}
                                >
                                    {t("clear-map-config")}
                                </Button>
                            )}
                        </div>
                    </TabsContent>
                    <TabsContent value="google" className="space-y-3 pt-2">
                        <Credential
                            label={t("map-google-key")}
                            value={googleKey}
                            onChange={setGoogleKey}
                        />
                        <Credential
                            label={t("map-google-map-id")}
                            value={mapId}
                            onChange={setMapId}
                            secret={false}
                        />
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            {t("map-google-setup")}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                            <a
                                className="text-xs text-muted-foreground underline underline-offset-2"
                                href="https://developers.google.com/maps/documentation/javascript/advanced-markers/start"
                                target="_blank"
                                rel="noreferrer"
                            >
                                {t("map-google-docs")}
                            </a>
                            {(googleKey || mapId) && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="shrink-0 text-muted-foreground"
                                    onClick={() => {
                                        setGoogleKey("");
                                        setMapId("");
                                    }}
                                >
                                    {t("clear-map-config")}
                                </Button>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t px-4 py-3 sm:px-6">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                    className="min-w-20"
                >
                    {t("cancel")}
                </Button>
                <Button
                    size="sm"
                    onClick={save}
                    disabled={saving}
                    className="min-w-20"
                >
                    {t("save")}
                </Button>
            </div>
        </PopupLayout>
    );
}

const [MapConfigFormProvider, showMapConfig] = createConfirmProvider(
    MapConfigForm,
    {
        dialogTitle: "map-settings",
        dialogModalClose: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[min(490px,calc(100vh-32px))] sm:w-[90vw] sm:max-w-[440px]",
    },
);

export default function MapSettingsItem() {
    const t = useIntl();
    return (
        <div className="map-settings">
            <Button
                onClick={() => {
                    void showMapConfig().catch(() => {});
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--map-outline] size-5"></i>
                        {t("map-settings")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
        </div>
    );
}

export { MapConfigFormProvider, showMapConfig };
