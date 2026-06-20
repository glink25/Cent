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
        child && child._node ? child._node : child,
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
        child && child._node ? child._node : child,
    );
    const proxy = applyMethods(node);
    const result = Object.create(proxy);
    result._node = node;
    return result;
}
