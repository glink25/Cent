import { z } from "zod";
import type { Bill } from "@/ledger/type";

export const jsonObject = z.record(z.string(), z.json());
const billInput = z
    .object({
        type: z.enum(["income", "expense"]),
        categoryId: z.string().min(1),
        amount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        time: z.number().finite(),
        comment: z.string().optional(),
        tagIds: z.array(z.string()).optional(),
        images: z.array(z.string()).optional(),
        location: z
            .object({
                latitude: z.number(),
                longitude: z.number(),
                accuracy: z.number(),
            })
            .optional(),
        currency: z
            .object({
                base: z.string(),
                target: z.string(),
                amount: z.number().int().nonnegative(),
            })
            .optional(),
        extra: jsonObject.optional(),
    })
    .strict();
export const editSchema = z
    .object({
        create: z.array(billInput).max(1000).default([]),
        update: z
            .array(z.object({ id: z.string(), value: billInput }))
            .max(1000)
            .default([]),
        delete: z.array(z.string()).max(1000).default([]),
    })
    .strict();

export function validateEdit(input: unknown, widgetId: string, bills: Bill[]) {
    const edit = editSchema.parse(input);
    const ids = [...edit.update.map((item) => item.id), ...edit.delete];
    if (new Set(ids).size !== ids.length)
        throw new Error("Duplicate bill operation");
    for (const id of ids) {
        const bill = bills.find((b) => b.id === id);
        if (!bill || bill.extra?.widgetId !== widgetId)
            throw new Error("Widgets may only modify bills they created");
    }
    for (const value of [
        ...edit.create,
        ...edit.update.map((item) => item.value),
    ]) {
        for (const key of Object.keys(value.extra ?? {})) {
            if (key !== `wc-${widgetId}`)
                throw new Error(
                    "Only the widget's own extra namespace is writable",
                );
        }
    }
    return edit;
}

/** Validate data coming out of a Worker before React consumes it. */
export function validateRuntimeResult(value: unknown) {
    const result = z
        .object({ dsl: z.unknown(), state: jsonObject })
        .parse(value);
    let count = 0;
    const style = z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean()]),
    );
    const visit = (
        value: unknown,
        depth = 0,
        parent?: string,
        displayOnly = false,
    ): string | undefined => {
        if (++count > 5000 || depth > 64)
            throw new Error("Widget UI is too large");
        const node = z
            .object({
                type: z.enum([
                    "Text",
                    "Image",
                    "Flex",
                    "Container",
                    "Button",
                    "Input",
                    "FilePicker",
                    "Attachment",
                    "ChoiceGroup",
                    "Choice",
                    "Select",
                    "Switch",
                    "DateTimePicker",
                    "Line",
                ]),
                key: z.string().optional(),
                props: jsonObject,
                style,
                events: z
                    .object({
                        onTap: z.string().optional(),
                        onChange: z.string().optional(),
                    })
                    .optional(),
                children: z.array(z.unknown()),
            })
            .parse(value);
        const props = node.props;
        if (
            displayOnly &&
            (node.events?.onTap ||
                node.events?.onChange ||
                ![
                    "Text",
                    "Image",
                    "Attachment",
                    "Flex",
                    "Container",
                    "Line",
                ].includes(node.type))
        )
            throw new Error("Button and Choice content must be display nodes");
        if (props.accessibleLabel !== undefined)
            z.string().parse(props.accessibleLabel);
        if (node.type === "FilePicker") {
            z.string().min(1).parse(props.label);
            if (props.value !== undefined)
                z.array(z.string()).max(3).parse(props.value);
            if (props.multiple !== undefined) z.boolean().parse(props.multiple);
            if (node.events?.onTap) throw new Error("FilePicker uses onChange");
        }
        if (node.type === "Attachment") {
            z.string().min(1).parse(props.billId);
            z.number()
                .int()
                .nonnegative()
                .max(Number.MAX_SAFE_INTEGER)
                .parse(props.index);
            if (props.alt !== undefined) z.string().parse(props.alt);
        }
        if (node.type === "ChoiceGroup") {
            z.string().min(1).parse(props.label);
            if (props.value !== undefined) z.string().parse(props.value);
            if (node.events?.onTap)
                throw new Error("ChoiceGroup uses onChange");
        }
        if ((node.type === "Choice") !== (parent === "ChoiceGroup"))
            throw new Error(
                "Choice nodes must be direct children of ChoiceGroup",
            );
        if (node.type === "Choice") {
            z.string().min(1).parse(props.value);
            if (node.events?.onTap || node.events?.onChange)
                throw new Error("Choice events belong to ChoiceGroup");
            if (props.selectedStyle !== undefined)
                style.parse(props.selectedStyle);
        }
        if (node.type === "Text")
            z.union([z.string(), z.number()]).parse(props.content);
        if (node.type === "Image") z.string().parse(props.src);
        if (props.label !== undefined) z.string().parse(props.label);
        if (node.type === "Select") {
            z.array(
                z.union([
                    z.string(),
                    z.object({ value: z.string(), label: z.string() }),
                ]),
            ).parse(props.options);
            if (props.value !== undefined)
                (props.multiple ? z.array(z.string()) : z.string()).parse(
                    props.value,
                );
        }
        if (node.type === "DateTimePicker" && props.value !== undefined)
            z.number()
                .min(-8640000000000000)
                .max(8640000000000000)
                .parse(props.value);
        if (node.type === "Line")
            z.array(z.tuple([z.number(), z.number()])).parse(props.points);
        const choices = new Set<string>();
        for (const child of node.children) {
            const choice = visit(
                child,
                depth + 1,
                node.type,
                displayOnly || node.type === "Button" || node.type === "Choice",
            );
            if (choice !== undefined) {
                if (choices.has(choice))
                    throw new Error("Duplicate Choice value");
                choices.add(choice);
            }
        }
        return node.type === "Choice" ? (props.value as string) : undefined;
    };
    visit(result.dsl);
    return result;
}
