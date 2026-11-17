// The author-facing callbacks never cross the Worker boundary.
export async function executeWidget(module, input) {
    const freeze = (value) => {
        if (value && typeof value === "object" && !Object.isFrozen(value)) {
            Object.freeze(value);
            for (const child of Object.values(value)) freeze(child);
        }
        return value;
    };
    const states = structuredClone(input.state ?? {});
    const callbacks = new Map();
    let phase = "render";
    const requireEvent = () => {
        if (phase !== "event")
            throw new Error("Side effects are only allowed in event callbacks");
    };
    const call = (name, params) => {
        requireEvent();
        return globalThis.__CALL_HOST__(name, params);
    };
    const id = (key) => `wc-${input.widgetId}:${key}`;
    const ctx = {
        ...freeze(input.context),
        widgetId: input.widgetId,
        now: input.now,
        storage: freeze(input.storage ?? {}),
        params: freeze(input.params ?? {}),
        id,
        viewModule: (view) => `widget-view:${input.widgetId}:${view}`,
        state(key, initial) {
            if (!key || ["__proto__", "prototype", "constructor"].includes(key))
                throw new Error("Invalid state key");
            if (!Object.hasOwn(states, key))
                states[key] = structuredClone(initial);
            return [
                freeze(states[key]),
                (value) => {
                    requireEvent();
                    states[key] =
                        typeof value === "function"
                            ? value(states[key])
                            : value;
                },
            ];
        },
        form(key, initial) {
            const [values, set] = ctx.state(key, initial);
            return {
                values,
                field(name) {
                    return {
                        value: values[name],
                        onChange: (value) =>
                            set((prev) => ({ ...prev, [name]: value })),
                    };
                },
            };
        },
        openModal(view, params = {}, options = {}) {
            const name = Object.keys(module).find(
                (key) =>
                    module[key] === view &&
                    key !== "default" &&
                    key !== "computed",
            );
            if (!name) throw new Error("Modal views must be named exports");
            return call("openModal", {
                view: name,
                params,
                title: options.title ?? name,
            });
        },
        closeModal: () => call("closeModal", {}),
        api: {
            edit: (changes) => call("edit", changes),
            setStorage: (value) => call("setStorage", value),
        },
    };
    if (input.mode === "computed") {
        // No state, UI or write capabilities are passed to computed.
        return module.computed
            ? await module.computed({
                  widgetId: ctx.widgetId,
                  storage: ctx.storage,
                  viewer: ctx.viewer,
                  data: ctx.data,
                  settings: ctx.settings,
                  env: ctx.env,
                  id,
                  viewModule: ctx.viewModule,
              })
            : {};
    }
    const view = module[input.view ?? "default"];
    if (typeof view !== "function" || input.view === "computed")
        throw new Error("Unknown widget view");
    let count = 0;
    function serialize(value, path = "root", depth = 0) {
        if (++count > 5000 || depth > 64)
            throw new Error("Widget UI is too large");
        const node = value?._node ?? value;
        if (!node || typeof node.type !== "string")
            throw new Error("Invalid DSL node");
        const identity = `${path}/${encodeURIComponent(node.type)}${
            node.key === undefined ? "" : `/key:${encodeURIComponent(node.key)}`
        }`;
        const props = {};
        const events = {};
        for (const [key, value] of Object.entries(node.props ?? {})) {
            if (key === "onTap" || key === "onChange") {
                if (typeof value !== "function")
                    throw new Error(`${key} must be a function`);
                const eventId = `${identity}:${key}`;
                if (callbacks.has(eventId))
                    throw new Error("Duplicate interactive key");
                callbacks.set(
                    eventId,
                    node.type === "ChoiceGroup" && key === "onChange"
                        ? (selected) => {
                              if (
                                  node.props.disabled ||
                                  !node.children.some(
                                      (child) =>
                                          child.type === "Choice" &&
                                          !child.props.disabled &&
                                          child.props.value === selected,
                                  )
                              )
                                  throw new Error(
                                      "Choice is no longer available",
                                  );
                              return value(selected);
                          }
                        : value,
                );
                events[key] = eventId;
            } else {
                props[key] = value;
            }
        }
        const siblingKeys = new Set();
        const children = (node.children ?? [])
            .filter(Boolean)
            .map((child, index) => {
                const raw = child._node ?? child;
                const key =
                    raw.key === undefined ? `index:${index}` : `key:${raw.key}`;
                if (siblingKeys.has(key))
                    throw new Error("Duplicate sibling key");
                siblingKeys.add(key);
                return serialize(
                    child,
                    `${identity}/${raw.key === undefined ? key : "child"}`,
                    depth + 1,
                );
            });
        return {
            type: node.type,
            key: node.key,
            props,
            events,
            children,
            style: node.style ?? {},
        };
    }
    const dsl = serialize(await view(ctx));
    if (input.event) {
        const callback = callbacks.get(input.event.id);
        // Reject stale/removed events instead of dispatching a different control.
        if (!callback || !input.allowedEvents?.includes(input.event.id))
            throw new Error("Widget event is no longer available");
        phase = "event";
        await callback(input.event.value);
    }
    return { dsl, state: states };
}
