import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

export type SponsorTabMeta = { name: string; label: ReactNode };

type SponsorCtx = {
    active: string | undefined;
    setActive: (v: string) => void;
    register: (meta: SponsorTabMeta) => void;
    unregister: (name: string) => void;
};

const SponsorContext = createContext<SponsorCtx | null>(null);

export function SponsorRoot({
    defaultValue,
    children,
    className,
}: {
    defaultValue?: string;
    children: ReactNode;
    className?: string;
}) {
    const [tabs, setTabs] = useState<SponsorTabMeta[]>([]);
    const [active, setActive] = useState<string | undefined>(defaultValue);

    const register = useCallback((meta: SponsorTabMeta) => {
        setTabs((prev) => {
            const i = prev.findIndex((t) => t.name === meta.name);
            if (i >= 0) {
                if (prev[i].label === meta.label) {
                    return prev;
                }
                const next = prev.slice();
                next[i] = meta;
                return next;
            }
            return [...prev, meta];
        });
    }, []);

    const unregister = useCallback((name: string) => {
        setTabs((prev) => prev.filter((t) => t.name !== name));
    }, []);

    useEffect(() => {
        if (!active && tabs.length > 0) {
            setActive(tabs[0].name);
        }
    }, [active, tabs]);

    const ctxValue = useMemo(
        () => ({ active, setActive, register, unregister }),
        [active, register, unregister],
    );

    return (
        <SponsorContext.Provider value={ctxValue}>
            <Tabs
                value={active ?? ""}
                onValueChange={setActive}
                className={className ?? "flex-1 flex flex-col px-4 gap-3"}
            >
                <div className="w-full flex justify-center">
                    <TabsList>
                        {tabs.map((t) => (
                            <TabsTrigger key={t.name} value={t.name}>
                                {t.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>
                {children}
            </Tabs>
        </SponsorContext.Provider>
    );
}

export function SponsorTab({
    name,
    children,
}: {
    name: string;
    children: ReactNode;
}) {
    const ctx = useContext(SponsorContext);
    useEffect(() => {
        if (!ctx) return;
        ctx.register({ name, label: children });
        return () => ctx.unregister(name);
    }, [name, children, ctx]);
    return null;
}

export function SponsorTabContent({
    name,
    children,
    className,
}: {
    name: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <TabsContent value={name} className={className}>
            {children}
        </TabsContent>
    );
}
