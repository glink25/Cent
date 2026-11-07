// biome-ignore-all lint/correctness/noUnusedVariables: Injected DSL globals are consumed by widget source.
function createDSLNode(type) {
    return {
        type,
        props: {},
        children: [],
        style: {},
    };
}

function applyMethods(node) {
    const methods = {
        style(values) {
            Object.assign(node.style, values);
            return this;
        },
        key(value) {
            node.key = String(value);
            return this;
        },
        onTap(callback) {
            node.props.onTap = callback;
            return this;
        },
        onChange(callback) {
            node.props.onChange = callback;
            return this;
        },
        fontSize(value) {
            node.style.fontSize = value;
            return this;
        },
        color(value) {
            node.style.color = value;
            return this;
        },
        bold(value) {
            node.style.bold = value;
            return this;
        },
        direction(value) {
            node.style.direction = value;
            return this;
        },
        justify(value) {
            node.style.justify = value;
            return this;
        },
        align(value) {
            node.style.align = value;
            return this;
        },
        gap(value) {
            node.style.gap = value;
            return this;
        },
        width(value) {
            node.style.width = value;
            return this;
        },
        height(value) {
            node.style.height = value;
            return this;
        },
        mode(value) {
            node.style.mode = value;
            return this;
        },
        bg(value) {
            node.style.background = value;
            return this;
        },
        padding(value) {
            node.style.padding = value;
            return this;
        },
        borderRadius(value) {
            node.style.borderRadius = value;
            return this;
        },
    };
    return Object.assign(methods, { _node: node });
}

function Flex() {
    const node = createDSLNode("Flex");
    const children = Array.from(arguments).filter(Boolean);
    node.children = children.map((child) =>
        child?._node ? child._node : child,
    );
    const proxy = applyMethods(node);
    const result = Object.create(proxy);
    result._node = node;
    return result;
}

function Text(content) {
    const node = createDSLNode("Text");
    node.props.content = content;
    const proxy = applyMethods(node);
    const result = Object.create(proxy);
    result._node = node;
    return result;
}

function Image(src) {
    const node = createDSLNode("Image");
    node.props.src = src;
    const proxy = applyMethods(node);
    const result = Object.create(proxy);
    result._node = node;
    return result;
}

function Container() {
    const node = createDSLNode("Container");
    const children = Array.from(arguments).filter(Boolean);
    node.children = children.map((child) =>
        child?._node ? child._node : child,
    );
    const proxy = applyMethods(node);
    const result = Object.create(proxy);
    result._node = node;
    return result;
}

function Column(...children) {
    return Flex(...children).direction("column");
}
function Row(...children) {
    return Flex(...children).direction("row");
}
function control(type, props) {
    const node = createDSLNode(type);
    node.props = props;
    return applyMethods(node);
}
function withChildren(type, props, children) {
    const result = control(type, props);
    result._node.children = children
        .filter(Boolean)
        .map((child) => child._node ?? child);
    return result;
}
function Button(label, ...children) {
    return typeof label === "string"
        ? control("Button", { label })
        : withChildren("Button", label, children);
}
function ChoiceGroup(props, ...children) {
    return withChildren("ChoiceGroup", props, children);
}
function Choice(props, ...children) {
    return withChildren("Choice", props, children);
}
function Input(props) {
    return control("Input", props);
}
function Select(props) {
    return control("Select", props);
}
function Switch(props) {
    return control("Switch", props);
}
function DateTimePicker(props) {
    return control("DateTimePicker", props);
}
function Line(props) {
    return control("Line", props);
}

function FilePicker(props) {
    return control("FilePicker", props);
}
function Attachment(props) {
    return control("Attachment", props);
}
