import { z } from "zod";
import { createTool } from "@/assistant";
import type { PreviewState } from "@/components/data-manager/preview";
import {
    importFromPreviewResult,
    showImportPreview,
} from "@/components/data-manager/preview-form";
import type { Bill, BillCategory, BillTag, GlobalMeta } from "@/ledger/type";

const billSchema = z
    .object({
        id: z
            .string()
            .describe(
                "账单的唯一标识，应保证唯一。建议使用 crypto.randomUUID()，或 time 与序号拼接形式。",
            ),
        type: z
            .enum(["income", "expense"])
            .describe("账单类型：income(收入) 或 expense(支出)。"),
        categoryId: z
            .string()
            .describe(
                "账单分类的 id。必须引用一个已存在的分类（先调用 getAccountMeta 获取可用分类），" +
                    "或者在 meta.categories 中新增自定义分类后再使用其 id。",
            ),
        creatorId: z
            .union([z.number(), z.string()])
            .describe("创建者 id。若不确定，可填写 0。"),
        comment: z
            .string()
            .optional()
            .describe("备注。导入时不确定的信息也可保存在这里。"),
        amount: z
            .number()
            .int()
            .describe(
                "整数金额，单位为分的一万分之一（实际金额 × 10000）。" +
                    "例如 ¥12.34 应写作 123400；¥0.01 应写作 100。" +
                    "切勿直接传入人民币元值。",
            ),
        time: z
            .number()
            .describe(
                "账单发生时间，毫秒级 epoch 时间戳（Date.now() 同单位）。",
            ),
        images: z
            .array(z.string())
            .optional()
            .describe(
                "账单图片附件，字符串数组。每个元素可以是 " +
                    "(1) data: URI（如 'data:image/png;base64,...'）；" +
                    "(2) 公网可访问的 http(s) URL。请勿传入本地文件路径。",
            ),
        location: z
            .object({
                latitude: z.number(),
                longitude: z.number(),
                accuracy: z.number(),
            })
            .optional()
            .describe("地理位置（可选）。"),
        tagIds: z
            .array(z.string())
            .optional()
            .describe(
                "标签 id 数组。必须引用已存在的标签 id（通过 getAccountMeta 获取），" +
                    "或在 meta.tags 中新增标签后再使用其 id。",
            ),
        currency: z
            .object({
                base: z.string().describe("记账时的本位币代码，如 CNY。"),
                target: z.string().describe("实际记账币种代码。"),
                amount: z
                    .number()
                    .describe(
                        "原始记账金额（人类可读金额，例如 12.34），不需要 ×10000。",
                    ),
            })
            .optional()
            .describe("多币种信息（可选）。"),
    })
    .describe("单笔账单，字段含义对应 Cent 的 Bill 类型。");

const categorySchema = z
    .object({
        type: z.enum(["income", "expense"]),
        name: z.string(),
        id: z.string(),
        icon: z.string().optional().default(""),
        color: z.string().optional().default(""),
        customName: z.literal(true).describe("新增分类必须为 true。"),
        parent: z
            .string()
            .optional()
            .describe("父类 id，留空表示该项本身就是父类。"),
    })
    .describe(
        "新增的自定义分类。仅在已有分类中没有合适项时新增，否则应复用 getAccountMeta 返回的已有分类。",
    );

const tagSchema = z
    .object({
        id: z.string(),
        name: z.string(),
    })
    .describe("新增的标签。仅在已有标签中没有合适项时新增。");

const metaSchema = z
    .object({
        categories: z
            .array(categorySchema)
            .optional()
            .describe("本次导入需要新增的分类。"),
        tags: z
            .array(tagSchema)
            .optional()
            .describe("本次导入需要新增的标签。"),
    })
    .partial()
    .optional()
    .describe(
        "可选的全局配置增量。只放本次导入新增的分类/标签，不要重复已有项。",
    );

const argSchema = z
    .object({
        items: z
            .array(billSchema)
            .min(1)
            .describe("待导入的账单列表，至少一条。"),
        meta: metaSchema,
    })
    .describe(
        "符合 Cent ExportedJSON 结构的导入数据。生成前请先调用 getAccountMeta 获取" +
            "现有分类与标签，复用已有的 id；只有在没有合适项时才在 meta 中新增。",
    );

const returnSchema = z.object({
    ok: z.boolean().describe("是否成功导入。"),
    imported: z
        .number()
        .optional()
        .describe("成功导入的账单数量（ok=true 时存在）。"),
    strategy: z
        .enum(["append", "overlap"])
        .optional()
        .describe("用户选择的导入策略（ok=true 时存在）。"),
    reason: z
        .string()
        .optional()
        .describe("失败原因，例如 'user_cancelled'（ok=false 时存在）。"),
});

// —— 静态类型校验：确保 Zod schema 推断出的形状与 Cent 真实类型保持一致。
// 任意 schema 与对应类型偏离时，下方的 const 赋值会立刻产生 ts 错误。
// 注意：ExportedJSON.items 是 Full<Bill>[]（带 __create_at 等仓储字段），
// 而 AI 生成的是裸 Bill，仓储元数据由导入流程补齐，因此这里只校验到 Bill。
const _assertBillSchema: Bill = null as unknown as z.infer<typeof billSchema>;
const _assertCategorySchema: BillCategory = null as unknown as z.infer<
    typeof categorySchema
>;
const _assertTagSchema: BillTag = null as unknown as z.infer<typeof tagSchema>;
const _assertMetaSchema: Partial<GlobalMeta> = null as unknown as NonNullable<
    z.infer<typeof metaSchema>
>;
const _assertArgItems: Bill[] = null as unknown as z.infer<
    typeof argSchema
>["items"];
void _assertBillSchema;
void _assertCategorySchema;
void _assertTagSchema;
void _assertMetaSchema;
void _assertArgItems;

export const ImportBillsTool = createTool({
    name: "importBills",
    describe:
        "导入一批 AI 生成的账单到 Cent。调用前应先通过 getAccountMeta 获取已有的分类和标签，" +
        "以便为每条账单选择合理的 categoryId / tagIds。金额字段 amount 必须为整数 ×10000；" +
        "时间字段 time 为毫秒 epoch；图片可用 data: URI 内联。" +
        "调用后会弹出导入预览对话框，由用户最终确认是否写入账本。",
    argSchema,
    returnSchema,
    handler: async (arg) => {
        const previewInput: PreviewState = {
            bills: arg.items as unknown as PreviewState["bills"],
            meta: arg.meta as unknown as PreviewState["meta"],
        };
        const res = await showImportPreview(previewInput);
        if (!res) {
            return { ok: false, reason: "user_cancelled" };
        }
        await importFromPreviewResult(res);
        return {
            ok: true,
            imported: arg.items.length,
            strategy: res.strategy,
        };
    },
});
