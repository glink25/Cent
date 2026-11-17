import { isEqual } from "lodash-es";
import type { DSLNode } from "../type";

export function nodeKey(node: DSLNode, index: number) {
    return JSON.stringify([node.type, node.key ?? index]);
}

export function reconcileNode(
    previous: DSLNode | undefined,
    next: DSLNode,
): DSLNode {
    if (!previous || previous.type !== next.type || previous.key !== next.key)
        return next;

    const oldChildren = new Map(
        previous.children.map((child, index) => [nodeKey(child, index), child]),
    );
    const children = next.children.map((child, index) =>
        reconcileNode(oldChildren.get(nodeKey(child, index)), child),
    );
    if (
        children.length === previous.children.length &&
        children.every((child, index) => child === previous.children[index]) &&
        isEqual(previous.props, next.props) &&
        isEqual(previous.style, next.style) &&
        isEqual(previous.events, next.events)
    )
        return previous;
    return { ...next, children };
}
