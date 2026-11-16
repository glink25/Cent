/**
 * @widget-api 2.0
 * @name 账户与转账
 * @permissions billing, currency, edit, storage
 */
const baseCurrency = (ctx) => ctx.data.currencies?.base ?? "CNY";
const accountCurrency = (ctx, account) =>
    account?.currency || baseCurrency(ctx);
const ledger = (ctx) => ctx.data.billing ?? [];
const quickCurrencies = (ctx) => [
    ...new Set([baseCurrency(ctx), ...(ctx.data.currencies?.quick ?? [])]),
];
const allAccounts = (ctx) => ctx.storage.accounts ?? [];
const accounts = (ctx) =>
    allAccounts(ctx).filter(
        (account) =>
            !account.ownerId ||
            String(account.ownerId) === String(ctx.viewer.id),
    );
const findAccount = (ctx, id) =>
    accounts(ctx).find((account) => account.id === id);
const details = (ctx, bill) => bill.extra?.[`wc-${ctx.widgetId}`];
const owned = (ctx, bill) => bill.extra?.widgetId === ctx.widgetId;
const ignoredTag = (ctx) => ctx.id("exclude-cash-flow");
const billsFor = (ctx, account) =>
    ledger(ctx).filter((bill) => bill.tagIds?.includes(ctx.id(account.id)));
const categoryDefinitions = [
    ["transfer-out", "转出", "expense", "icon-[mdi--credit-card-outline]"],
    ["transfer-in", "转入", "income", "icon-[mdi--credit-card-refund]"],
    ["transfer-fee", "转账手续费", "expense", "icon-[mdi--cash-minus]"],
    ["opening-in", "期初余额", "income", "icon-[mdi--wallet]"],
    ["opening-out", "期初余额", "expense", "icon-[mdi--wallet]"],
];

export function computed(ctx) {
    const available = accounts(ctx);
    return {
        categories: categoryDefinitions.map(
            ([key, name, type, icon], index) => ({
                id: ctx.id(key),
                name,
                type,
                icon,
                color: "#64748b",
                ...(index < 2 ? { position: 0 } : {}),
            }),
        ),
        tags: [
            ...available.map((account) => ({
                id: ctx.id(account.id),
                name: account.name,
                preferCurrency: accountCurrency(ctx, account),
            })),
            { id: ignoredTag(ctx), name: "不计收支", opaque: true },
        ],
        tagGroups: available.length
            ? [
                  {
                      id: ctx.id("accounts"),
                      name: "账户",
                      color: "blue",
                      position: 999999,
                      singleSelect: true,
                      tagIds: available.map((account) => ctx.id(account.id)),
                  },
              ]
            : [],
        customFilters: [
            {
                id: ctx.id("actual-cash-flow"),
                name: "实际收支",
                filter: { excludeTags: [ignoredTag(ctx)] },
                modules: ["base-analysis", "analysis"],
            },
            ...available.map((account) => ({
                id: ctx.id(`account-view:${account.id}`),
                name: account.name,
                filter: { tags: [ctx.id(account.id)] },
                displayCurrency: accountCurrency(ctx, account),
                modules: ["base-analysis", "analysis"],
            })),
        ],
    };
}

const scale = 10000;
const formatAmount = (amount) =>
    (amount / scale).toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    });
const money = (amount, currency) => `${formatAmount(amount)} ${currency}`;
const date = (time) =>
    new Date(time).toLocaleString("zh-CN", { hour12: false });
const validRate = (rate) => Number.isFinite(rate) && rate > 0;
const recordable = (original, converted) =>
    Number.isSafeInteger(converted) && (original === 0 || converted > 0);
const configuredRate = (ctx, currency) =>
    currency === baseCurrency(ctx)
        ? 1
        : ctx.data.currencies?.custom?.find((item) => item.id === currency)
              ?.rateToBase;

function parseAmount(value) {
    const raw = value.trim();
    if (!/^-?(?:\d+(?:\.\d{0,4})?|\.\d{1,4})$/.test(raw)) return NaN;
    const amount = Math.round(Number(raw) * scale);
    return Number.isSafeInteger(amount) ? amount : NaN;
}

function valueIn(ctx, bill, currency) {
    if (bill.currency?.target === currency)
        return { amount: bill.currency.amount };
    const billBase = bill.currency?.base ?? baseCurrency(ctx);
    if (billBase === currency) return { amount: bill.amount };
    const from = configuredRate(ctx, billBase);
    const to = configuredRate(ctx, currency);
    if (!validRate(from) || !validRate(to)) return {};
    const amount = Math.round((bill.amount * from) / to);
    return Number.isSafeInteger(amount) ? { amount, estimated: true } : {};
}

function accountBalances(ctx) {
    const byTag = new Map(
        allAccounts(ctx).map((account) => [
            ctx.id(account.id),
            { account, amount: 0, estimated: false, missing: 0, ambiguous: 0 },
        ]),
    );
    for (const bill of ledger(ctx)) {
        const matched = [...new Set(bill.tagIds ?? [])]
            .map((tag) => byTag.get(tag))
            .filter(Boolean);
        if (matched.length > 1) {
            for (const entry of matched) entry.ambiguous++;
            continue;
        }
        const entry = matched[0];
        if (!entry) continue;
        const value = valueIn(ctx, bill, accountCurrency(ctx, entry.account));
        const next =
            entry.amount +
            (bill.type === "income" ? value.amount : -value.amount);
        if (!Number.isSafeInteger(next)) {
            entry.missing++;
            continue;
        }
        entry.amount = next;
        entry.estimated ||= Boolean(value.estimated);
    }
    return byTag;
}

function entryAmount(ctx, bill) {
    return money(
        bill.currency?.amount ?? bill.amount,
        bill.currency?.target ?? bill.currency?.base ?? baseCurrency(ctx),
    );
}

function transferEntries(ctx, transferId) {
    return ledger(ctx).filter(
        (bill) =>
            owned(ctx, bill) && details(ctx, bill)?.transferId === transferId,
    );
}

function role(ctx, bill) {
    return details(ctx, bill)?.role ?? (bill.type === "income" ? "in" : "out");
}

function openingBill(ctx, account) {
    return billsFor(ctx, account).find(
        (bill) => owned(ctx, bill) && details(ctx, bill)?.role === "opening",
    );
}

function makeBill(
    ctx,
    {
        account,
        category,
        type,
        original,
        rate,
        time,
        comment,
        transferId,
        role,
        images,
    },
) {
    const amount = Math.round(original * rate);
    if (!recordable(original, amount))
        throw new Error("折算后的金额超出可记账范围，请检查金额和汇率");
    return {
        type,
        categoryId: ctx.id(category),
        amount,
        time,
        ...(comment ? { comment } : {}),
        ...(images?.length ? { images } : {}),
        tagIds: [
            ctx.id(account.id),
            ...(role === "fee" ? [] : [ignoredTag(ctx)]),
        ],
        currency: {
            base: baseCurrency(ctx),
            target: accountCurrency(ctx, account),
            amount: original,
        },
        extra: {
            [`wc-${ctx.widgetId}`]: {
                accountId: account.id,
                role,
                ...(transferId ? { transferId } : {}),
            },
        },
    };
}

const outline = {
    paddingX: 14,
    paddingY: 12,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "theme:border",
    borderRadius: 12,
};
const surface = { ...outline, background: "theme:surface", borderRadius: 16 };
const muted = (label) => Text(label).fontSize(13).color("theme:muted");
const strong = (label) => Text(label).style({ fontWeight: "semibold" });
const errorText = (message, key) =>
    message && Text(message).key(key).fontSize(13).color("theme:danger");

function action(
    label,
    key,
    onTap,
    { primary = false, danger = false, disabled = false } = {},
) {
    return Button({ disabled }, strong(label).fontSize(13))
        .key(key)
        .style({
            ...outline,
            textAlign: "center",
            ...(primary && {
                background: "theme:accent",
                color: "theme:onAccent",
            }),
            ...(danger && {
                borderColor: "theme:danger",
                color: "theme:danger",
            }),
        })
        .onTap(onTap);
}

function panel(...children) {
    return Column(...children).style({ gap: 16, padding: 16 });
}

function section(title, ...children) {
    return Column(strong(title).fontSize(14), ...children).style({
        ...surface,
        gap: 10,
    });
}

const emptyState = (title, message) =>
    Column(strong(title), muted(message)).style({ ...surface, gap: 6 });

function readAccessNotice(ctx) {
    if (ctx.data.billing && ctx.data.currencies) return null;
    const missing = [
        !ctx.data.billing && "读取账单",
        !ctx.data.currencies && "读取币种",
    ].filter(Boolean);
    return panel(
        emptyState(
            "需要读取权限",
            `在小组件设置中编辑「账户与转账」，勾选${missing.join("和")}权限并保存。`,
        ),
    );
}

// Allow a long account name pasted as one word to wrap on a narrow card.
const displayName = (name) =>
    name.replace(/[^\s\u200b]{16}(?=[^\s\u200b])/gu, "$&\u200b");

function balanceNotes(entry) {
    return [
        entry.estimated && "含估算",
        entry.missing && `余额不完整 · ${entry.missing} 笔无法换算`,
        entry.ambiguous && `${entry.ambiguous} 笔带多个账户标签，待修正归属`,
    ]
        .filter(Boolean)
        .join(" · ");
}

function accountSummary(ctx, entry, size = 20) {
    const notes = balanceNotes(entry);
    const currency = accountCurrency(ctx, entry.account);
    return Column(
        Row(
            Container().style({
                width: 9,
                height: 9,
                shrink: 0,
                borderRadius: 5,
                background: entry.account.color ?? "#94a3b8",
                borderWidth: 1,
                borderColor: "theme:border",
            }),
            strong(displayName(entry.account.name))
                .fontSize(13)
                .style({ minWidth: 0, grow: 1 }),
        ).style({ gap: 6, align: "center" }),
        Row(
            strong(formatAmount(entry.amount)).fontSize(size),
            muted(currency),
        ).style({ gap: 5, align: "baseline", wrap: true }),
        notes && muted(notes),
    ).style({ gap: 5, minWidth: 0 });
}

function compactName(name) {
    const characters = [...name];
    return characters.length > 12
        ? characters.slice(0, 11).join("") + "…"
        : name;
}

function balanceStatus(entry) {
    if (entry.missing || entry.ambiguous) return muted("待核对").fontSize(11);
    return entry.estimated && muted("含估算").fontSize(11);
}

function cardBackground(ctx, account, tint) {
    const color = /^#[\da-f]{6}$/i.test(account.color)
        ? account.color
        : "#dbeafe";
    const weight = ctx.env.theme === "dark" ? tint * 0.3 : tint;
    return `color-mix(in srgb, ${color} ${weight}%, var(--card))`;
}

function iconAction(
    symbol,
    label,
    onTap,
    { primary = false, disabled = false } = {},
) {
    return Button({ label, disabled }, strong(symbol).fontSize(18))
        .key(label)
        .style({
            width: 36,
            height: 36,
            shrink: 0,
            borderWidth: 1,
            borderColor: "theme:border",
            borderRadius: 11,
            textAlign: "center",
            ...(primary && {
                background: "theme:accent",
                color: "theme:onAccent",
            }),
        })
        .onTap(onTap);
}

export default function Main(ctx) {
    const notice = readAccessNotice(ctx);
    if (notice) return notice;

    const available = accounts(ctx);
    const [front, ...behind] = available.slice(0, 3);
    if (!front)
        return Row(
            Column(
                strong("你的账户").fontSize(14),
                muted("关联账单，查看余额。"),
            ).style({ grow: 1, gap: 3 }),
            action(
                "添加第一个账户",
                "create-first",
                () => ctx.openModal(AccountForm, {}, { title: "账户" }),
                { primary: true },
            ),
        ).style({ align: "center", wrap: true, gap: 8, padding: 10 });

    const balances = accountBalances(ctx);
    const entry = balances.get(ctx.id(front.id));
    const openAccount = (account) =>
        ctx.openModal(
            AccountDetail,
            { accountId: account.id },
            { title: "账户详情" },
        );

    return Column(
        ...behind.reverse().map((account, index) => {
            const balance = balances.get(ctx.id(account.id));
            return Button(
                { label: `查看${account.name}流水` },
                Row(
                    Row(
                        strong(compactName(account.name)).fontSize(12),
                        balanceStatus(balance),
                    ).style({ align: "baseline", gap: 5 }),
                    muted(money(balance.amount, accountCurrency(ctx, account))),
                ).style({
                    justify: "space-between",
                    align: "baseline",
                    gap: 6,
                }),
            )
                .key(account.id)
                .style({
                    ...outline,
                    background: cardBackground(
                        ctx,
                        account,
                        index === 0 && behind.length > 1 ? 38 : 60,
                    ),
                    width: index === 0 && behind.length > 1 ? "88%" : "94%",
                    paddingX: 12,
                    paddingY: 3,
                    minHeight: 30,
                    marginBlockStart: index === 0 ? 0 : -6,
                })
                .onTap(() => openAccount(account));
        }),
        Row(
            Button(
                { label: `查看${front.name}流水` },
                Column(
                    Row(
                        strong(compactName(front.name)).fontSize(12),
                        balanceStatus(entry),
                    ).style({ align: "baseline", gap: 5 }),
                    Row(
                        strong(formatAmount(entry.amount)).fontSize(20),
                        muted(accountCurrency(ctx, front)),
                    ).style({ align: "baseline", gap: 5, wrap: true }),
                ),
            )
                .key(front.id)
                .style({ grow: 1, minWidth: 0 })
                .onTap(() => openAccount(front)),
            Row(
                iconAction(
                    "⇄",
                    "转账",
                    () => ctx.openModal(Transfer, {}, { title: "转账" }),
                    {
                        primary: true,
                        disabled: available.length < 2,
                    },
                ),
                iconAction("⋯", "管理账户", () =>
                    ctx.openModal(Management, {}, { title: "管理账户" }),
                ),
            ).style({ align: "center", gap: 6, shrink: 0 }),
        )
            .key("front-card")
            .style({
                ...surface,
                background: cardBackground(ctx, front, 24),
                align: "center",
                gap: 8,
                width: "100%",
                minHeight: 62,
                paddingY: 6,
                marginBlockStart: behind.length ? -6 : 0,
            }),
    ).style({ align: "center", padding: 5 });
}
export { Main };

function accountRows(ctx, account) {
    const rows = new Map();
    for (const bill of billsFor(ctx, account)) {
        const group = owned(ctx, bill) && details(ctx, bill)?.transferId;
        const key = group ? `transfer:${group}` : `bill:${bill.id}`;
        const row = rows.get(key);
        if (row) row.bills.push(bill);
        else rows.set(key, { key, group, bills: [bill] });
    }
    return [...rows.values()]
        .map((row) => ({
            ...row,
            bill:
                row.bills.find((bill) => role(ctx, bill) !== "fee") ??
                row.bills[0],
        }))
        .sort((a, b) => b.bill.time - a.bill.time);
}

function ledgerRow(ctx, account, row) {
    const { bill, group } = row;
    const other =
        group &&
        transferEntries(ctx, group).find(
            (item) =>
                role(ctx, item) === (bill.type === "income" ? "out" : "in"),
        );
    const name =
        other && findAccount(ctx, details(ctx, other)?.accountId)?.name;
    const opening = owned(ctx, bill) && details(ctx, bill)?.role === "opening";
    const direction = bill.type === "income" ? "收入" : "支出";
    const summary = group
        ? bill.type === "income"
            ? `从 ${name ?? "另一账户"} 转入`
            : `转出到 ${name ?? "另一账户"}`
        : opening
          ? "期初余额"
          : direction;
    const currency = accountCurrency(ctx, account);
    const values = row.bills.map((item) => {
        const value = valueIn(ctx, item, currency);
        return { ...value, sign: item.type === "income" ? 1 : -1 };
    });
    const total = values.reduce(
        (sum, value) => sum + value.sign * value.amount,
        0,
    );
    const label = Number.isSafeInteger(total)
        ? `${values.some((value) => value.estimated) ? "约 " : ""}${total > 0 ? "+" : ""}${money(total, currency)}`
        : entryAmount(ctx, bill);
    const content = Row(
        Column(
            strong(displayName(summary)).fontSize(14),
            muted(date(bill.time)),
            bill.comment && muted(displayName(bill.comment)),
        ).style({ grow: 1, minWidth: 105, gap: 3 }),
        strong(label).fontSize(14).style({ textAlign: "end" }),
        group && muted("›"),
    ).style({ align: "center", wrap: true, gap: 8 });
    if (!group) return Container(content).key(row.key).style(outline);
    return Button({}, content)
        .key(row.key)
        .style(outline)
        .onTap(() =>
            ctx.openModal(
                TransferDetail,
                { transferId: group },
                { title: "转账详情" },
            ),
        );
}

export function AccountDetail(ctx) {
    const notice = readAccessNotice(ctx);
    if (notice) return notice;
    const account = findAccount(ctx, ctx.params.accountId);
    if (!account)
        return panel(emptyState("账户已删除", "返回账户列表查看其他账户。"));
    const entry = accountBalances(ctx).get(ctx.id(account.id));
    const [requestedPage, setPage] = ctx.state("page", 0);
    const rows = accountRows(ctx, account);
    const last = Math.max(0, Math.ceil(rows.length / 10) - 1);
    const page = Math.min(requestedPage, last);
    const hasOpening = Boolean(openingBill(ctx, account));
    return panel(
        section("当前余额", accountSummary(ctx, entry, 28)),
        Row(
            action(
                "从此账户转账",
                "transfer",
                () =>
                    ctx.openModal(
                        Transfer,
                        { from: account.id },
                        { title: "转账" },
                    ),
                { primary: true, disabled: accounts(ctx).length < 2 },
            ),
            action(
                hasOpening ? "更正期初余额" : "录入期初余额",
                "opening",
                () =>
                    ctx.openModal(
                        OpeningBalance,
                        { accountId: account.id },
                        { title: "期初余额" },
                    ),
            ),
        ).style({ wrap: true, gap: 8 }),
        Column(
            Row(strong("账户流水"), muted(`共 ${rows.length} 条`)).style({
                justify: "space-between",
                align: "center",
            }),
            !rows.length &&
                emptyState(
                    "暂无流水",
                    "日常记账时选中这个账户标签，账单会出现在这里。",
                ),
            ...rows
                .slice(page * 10, page * 10 + 10)
                .map((row) => ledgerRow(ctx, account, row)),
        )
            .key("ledger")
            .gap(8),
        last > 0 &&
            Row(
                action("上一页", "prev", () => setPage(page - 1), {
                    disabled: page === 0,
                }),
                muted(`${page + 1} / ${last + 1}`),
                action("下一页", "next", () => setPage(page + 1), {
                    disabled: page === last,
                }),
            ).style({
                align: "center",
                justify: "space-between",
                gap: 8,
                wrap: true,
            }),
    );
}

export function TransferDetail(ctx) {
    const notice = readAccessNotice(ctx);
    if (notice) return notice;
    if (typeof ctx.params.transferId !== "string")
        return panel(Text("转账已不存在"));
    const bills = transferEntries(ctx, ctx.params.transferId);
    const [deleting, setDeleting] = ctx.state("deleting", false);
    if (!bills.length) return panel(Text("转账已不存在"));
    const titles = { out: "转出本金", in: "实际到账", fee: "手续费" };
    const sorted = ["out", "in", "fee"].flatMap((kind) =>
        bills.filter((bill) => role(ctx, bill) === kind),
    );
    const memo = bills.find((bill) => bill.comment)?.comment;
    const receipts = sorted.flatMap((bill) =>
        (bill.images ?? []).map((_, index) =>
            Attachment({ billId: bill.id, index, alt: "转账凭证" })
                .key(`${bill.id}:${index}`)
                .style({
                    width: 88,
                    height: 88,
                    mode: "cover",
                    borderRadius: 8,
                }),
        ),
    );
    return panel(
        ...sorted.map((bill) =>
            Row(
                Column(
                    strong(titles[role(ctx, bill)]),
                    muted(
                        displayName(
                            findAccount(ctx, details(ctx, bill)?.accountId)
                                ?.name ?? "账户不可用",
                        ),
                    ),
                    muted(date(bill.time)),
                ).style({ grow: 1, gap: 4 }),
                strong(entryAmount(ctx, bill)),
            )
                .key(bill.id)
                .style({ ...surface, wrap: true, gap: 8, align: "center" }),
        ),
        memo && section("备注", Text(displayName(memo))),
        receipts.length > 0 &&
            section("凭证", Row(...receipts).style({ wrap: true, gap: 8 })),
        deleting
            ? section(
                  "删除整笔转账",
                  Text(
                      `将删除 ${sorted.length} 笔关联账单（${sorted.map((bill) => titles[role(ctx, bill)]).join("、")}），并更新账户余额。`,
                  ).color("theme:danger"),
                  Row(
                      action("取消", "cancel", () => setDeleting(false)),
                      action(
                          "确认删除",
                          "confirm-delete",
                          async () => {
                              await ctx.api.edit({
                                  delete: sorted.map((bill) => bill.id),
                              });
                              await ctx.closeModal();
                          },
                          { danger: true },
                      ),
                  ).style({ wrap: true, gap: 8 }),
              )
            : action("删除整笔转账", "delete", () => setDeleting(true), {
                  danger: true,
              }),
    );
}

function moneyField(form, field, label, currency, error) {
    return Column(
        Input({
            label: `${label} · ${currency}`,
            type: "decimal",
            placeholder: "0.00",
            ...form.field(field),
        }).key("input"),
        errorText(error, "error"),
    )
        .key(field)
        .style({ gap: 4, minWidth: 120, grow: 1 });
}

function rateField(ctx, form, field, label, currency, error) {
    const configured = configuredRate(ctx, currency);
    return Column(
        Input({
            label: `${label} · 1 ${currency} = ? ${baseCurrency(ctx)}`,
            type: "decimal",
            placeholder: validRate(configured)
                ? String(configured)
                : "请输入本笔汇率",
            ...form.field(field),
        }).key("input"),
        validRate(configured) && muted(`留空使用账本汇率 ${configured}`),
        errorText(error, "error"),
    )
        .key(field)
        .gap(4);
}

function resolvedRate(ctx, currency, draft) {
    if (currency === baseCurrency(ctx) || !draft.trim())
        return configuredRate(ctx, currency);
    return Number(draft);
}

function accountPicker(
    ctx,
    form,
    available,
    balances,
    field,
    other,
    label,
    picker,
    setPicker,
) {
    const account = available.find((item) => item.id === form.values[field]);
    const expanded = picker === field;
    return Column(
        Button(
            { expanded, label: `${label}：${account?.name ?? "请选择"}` },
            Column(
                muted(label),
                strong(account ? displayName(account.name) : "选择账户"),
                account && muted(accountCurrency(ctx, account)),
            ).gap(3),
        )
            .key("trigger")
            .style(surface)
            .onTap(() => setPicker(expanded ? "" : field)),
        expanded &&
            ChoiceGroup(
                {
                    label,
                    ...form.field(field),
                    onChange: (value) => {
                        form.field(field).onChange(value);
                        form.field(
                            field === "from" ? "outRate" : "inRate",
                        ).onChange("");
                        form.field(
                            field === "from" ? "outCurrency" : "inCurrency",
                        ).onChange("");
                        setPicker("");
                    },
                },
                ...available.map((option) =>
                    Choice(
                        {
                            value: option.id,
                            disabled: option.id === form.values[other],
                            selectedStyle: {
                                borderColor: "theme:accent",
                                background: "theme:surface",
                            },
                        },
                        accountSummary(
                            ctx,
                            balances.get(ctx.id(option.id)),
                            14,
                        ),
                    )
                        .key(option.id)
                        .style(outline),
                ),
            )
                .key("choices")
                .gap(6),
    )
        .key(field)
        .style({ grow: 1, minWidth: 115, gap: 6 });
}

export function Transfer(ctx) {
    const notice = readAccessNotice(ctx);
    if (notice) return notice;
    const form = ctx.form("transfer", {
        from: ctx.params.from ?? "",
        to: "",
        amount: "",
        received: "",
        fee: "",
        outCurrency: "",
        inCurrency: "",
        outRate: "",
        inRate: "",
        time: ctx.now,
        separateDates: false,
        arrival: ctx.now,
        comment: "",
        images: [],
    });
    const [picker, setPicker] = ctx.state("picker", "");
    const [submitted, setSubmitted] = ctx.state("submitted", false);
    const [showOptions, setShowOptions] = ctx.state(
        "show-transfer-options",
        false,
    );
    const [transferId] = ctx.state(
        "transfer-id",
        `${ctx.now}-${Math.random().toString(36).slice(2)}`,
    );
    const available = accounts(ctx);
    const balances = accountBalances(ctx);
    const f = form.values;
    const from = findAccount(ctx, f.from);
    const to = findAccount(ctx, f.to);
    const outCurrency = f.outCurrency || accountCurrency(ctx, from);
    const inCurrency = f.inCurrency || accountCurrency(ctx, to);
    const crossCurrency = Boolean(from && to && outCurrency !== inCurrency);
    const original = parseAmount(f.amount);
    const received = crossCurrency ? parseAmount(f.received) : original;
    const fee = f.fee.trim() ? parseAmount(f.fee) : 0;
    const outRate = resolvedRate(ctx, outCurrency, f.outRate);
    const inRate = crossCurrency
        ? resolvedRate(ctx, inCurrency, f.inRate)
        : outRate;
    const arrival = f.separateDates ? f.arrival : f.time;

    const problems = {};
    if (!from || !to || from.id === to.id)
        problems.accounts = "请选择不同的转出和转入账户";
    if (!(original > 0)) problems.amount = "请输入大于零的金额，最多四位小数";
    if (crossCurrency && !(received > 0))
        problems.received = "请输入大于零的到账金额";
    if (!(fee >= 0) || (original > 0 && !Number.isSafeInteger(original + fee)))
        problems.fee = "请输入有效的手续费金额";
    if (
        fee > 0 &&
        validRate(outRate) &&
        !recordable(fee, Math.round(fee * outRate))
    )
        problems.fee = "折算后的手续费超出可记账范围，请检查金额和汇率";
    if (!validRate(outRate)) problems.outRate = "请输入大于零的折算汇率";
    if (crossCurrency && !validRate(inRate))
        problems.inRate = "请输入大于零的折算汇率";
    if (
        !Number.isFinite(f.time) ||
        !Number.isFinite(arrival) ||
        arrival < f.time
    )
        problems.date = "到账时间不得早于转出时间";
    if (
        original > 0 &&
        validRate(outRate) &&
        !recordable(original, Math.round(original * outRate))
    )
        problems.amount = "折算后的转出金额超出可记账范围";
    if (
        crossCurrency &&
        received > 0 &&
        validRate(inRate) &&
        !recordable(received, Math.round(received * inRate))
    )
        problems.received = "折算后的到账金额超出可记账范围";
    const errors = submitted ? problems : {};

    const save = async () => {
        setSubmitted(true);
        if (problems.fee || problems.date) setShowOptions(true);
        if (Object.keys(problems).length) return;

        if (transferEntries(ctx, transferId).length) {
            await ctx.closeModal();
            return;
        }
        const outgoingAccount = { ...from, currency: outCurrency };
        const incomingAccount = { ...to, currency: inCurrency };
        const common = { comment: f.comment, transferId };
        const create = [
            makeBill(ctx, {
                ...common,
                account: outgoingAccount,
                category: "transfer-out",
                type: "expense",
                original,
                rate: outRate,
                time: f.time,
                role: "out",
                images: f.images,
            }),
            makeBill(ctx, {
                ...common,
                account: incomingAccount,
                category: "transfer-in",
                type: "income",
                original: received,
                rate: inRate,
                time: arrival,
                role: "in",
            }),
        ];
        if (fee > 0)
            create.push(
                makeBill(ctx, {
                    ...common,
                    account: outgoingAccount,
                    category: "transfer-fee",
                    type: "expense",
                    original: fee,
                    rate: outRate,
                    time: f.time,
                    role: "fee",
                }),
            );
        await ctx.api.edit({ create });
        await ctx.closeModal();
    };

    const debit = original + fee;
    return panel(
        Row(
            accountPicker(
                ctx,
                form,
                available,
                balances,
                "from",
                "to",
                "转出账户",
                picker,
                setPicker,
            ),
            Text("→").fontSize(18).color("theme:muted").style({ shrink: 0 }),
            accountPicker(
                ctx,
                form,
                available,
                balances,
                "to",
                "from",
                "转入账户",
                picker,
                setPicker,
            ),
        )
            .key("accounts")
            .style({ wrap: true, align: "start", gap: 8 }),
        errorText(errors.accounts, "accounts-error"),
        Row(
            moneyField(
                form,
                "amount",
                crossCurrency ? "转出本金" : "转账金额",
                outCurrency,
                errors.amount,
            ),
            crossCurrency &&
                moneyField(
                    form,
                    "received",
                    "实际到账",
                    inCurrency,
                    errors.received,
                ),
        )
            .key("amounts")
            .style({ wrap: true, gap: 8 }),
        from &&
            outCurrency !== baseCurrency(ctx) &&
            rateField(
                ctx,
                form,
                "outRate",
                "转出汇率",
                outCurrency,
                errors.outRate,
            ),
        crossCurrency &&
            inCurrency !== baseCurrency(ctx) &&
            rateField(
                ctx,
                form,
                "inRate",
                "到账汇率",
                inCurrency,
                errors.inRate,
            ),
        Button(
            { expanded: showOptions },
            Row(
                Column(
                    strong("更多选项").fontSize(14),
                    muted("手续费、币种、时间、备注和凭证"),
                ).gap(3),
                muted(showOptions ? "收起" : "展开"),
            ).style({ justify: "space-between", align: "center", gap: 8 }),
        )
            .key("options")
            .style(outline)
            .onTap(() => setShowOptions(!showOptions)),
        showOptions &&
            Column(
                moneyField(
                    form,
                    "fee",
                    "手续费（选填）",
                    outCurrency,
                    errors.fee,
                ),
                Row(
                    Select({
                        label: "转出币种",
                        options: [
                            ...new Set([outCurrency, ...quickCurrencies(ctx)]),
                        ],
                        value: outCurrency,
                        disabled: !from,
                        onChange: (value) => {
                            form.field("outCurrency").onChange(value);
                            form.field("outRate").onChange("");
                        },
                    })
                        .key("out-currency")
                        .style({ grow: 1, minWidth: 120 }),
                    Select({
                        label: "到账币种",
                        options: [
                            ...new Set([inCurrency, ...quickCurrencies(ctx)]),
                        ],
                        value: inCurrency,
                        disabled: !to,
                        onChange: (value) => {
                            form.field("inCurrency").onChange(value);
                            form.field("inRate").onChange("");
                        },
                    })
                        .key("in-currency")
                        .style({ grow: 1, minWidth: 120 }),
                )
                    .key("currencies")
                    .style({ wrap: true, gap: 8 }),
                DateTimePicker({
                    label: f.separateDates ? "转出时间" : "转账时间",
                    ...form.field("time"),
                }).key("time"),
                Switch({
                    label: "分别设置转出与到账时间",
                    ...form.field("separateDates"),
                    onChange: (value) => {
                        if (value) form.field("arrival").onChange(f.time);
                        form.field("separateDates").onChange(value);
                    },
                }).key("separate"),
                f.separateDates &&
                    DateTimePicker({
                        label: "到账时间",
                        ...form.field("arrival"),
                    }).key("arrival"),
                errorText(errors.date, "date-error"),
                Input({
                    label: "备注",
                    placeholder: "选填",
                    ...form.field("comment"),
                }).key("comment"),
                FilePicker({
                    label: "转账凭证（选填）",
                    multiple: true,
                    ...form.field("images"),
                }).key("images"),
            )
                .key("option-fields")
                .style({ ...outline, gap: 12 }),
        section(
            "转账预览",
            Row(
                Column(
                    muted("实际扣款"),
                    strong(
                        original > 0 && fee >= 0 && Number.isSafeInteger(debit)
                            ? money(debit, outCurrency)
                            : "待填写",
                    ).fontSize(17),
                ).style({ gap: 4, grow: 1, minWidth: 100 }),
                Column(
                    muted("实际到账"),
                    strong(
                        received > 0 ? money(received, inCurrency) : "待填写",
                    ).fontSize(17),
                ).style({ gap: 4, grow: 1, minWidth: 100 }),
            ).style({ wrap: true, gap: 8 }),
            fee > 0 &&
                original > 0 &&
                muted(
                    `本金 ${money(original, outCurrency)} + 手续费 ${money(fee, outCurrency)}`,
                ),
            muted(
                f.separateDates
                    ? `转出 ${date(f.time)} · 到账 ${date(arrival)}`
                    : `转账时间 ${date(f.time)}`,
            ),
        ).key("summary"),
        action("确认转账", "confirm", save, { primary: true }),
    );
}

export function OpeningBalance(ctx) {
    const notice = readAccessNotice(ctx);
    if (notice) return notice;
    const account = findAccount(ctx, ctx.params.accountId);
    if (!account)
        return panel(emptyState("账户已删除", "返回账户列表查看其他账户。"));
    const previous = openingBill(ctx, account);
    const currency = accountCurrency(ctx, account);
    const previousOriginal =
        previous && (previous.currency?.amount ?? previous.amount);
    const previousRate =
        previousOriginal && previous.currency?.base === baseCurrency(ctx)
            ? String(previous.amount / previousOriginal)
            : "";
    const form = ctx.form("opening", {
        amount: previous
            ? String(
                  ((previous.type === "expense" ? -1 : 1) * previousOriginal) /
                      scale,
              )
            : "",
        time: previous?.time ?? ctx.now,
        rate: previousRate,
    });
    const [error, setError] = ctx.state("opening-error", "");
    return panel(
        section(
            displayName(account.name),
            muted(
                "输入开始追踪账户时的余额。欠款可填负数，期初余额不计入实际收支。",
            ),
        ),
        moneyField(form, "amount", "期初余额", currency),
        DateTimePicker({ label: "期初日期", ...form.field("time") }).key(
            "time",
        ),
        currency !== baseCurrency(ctx) &&
            rateField(ctx, form, "rate", "折算汇率", currency),
        errorText(error, "error"),
        action(
            "保存期初余额",
            "save-opening",
            async () => {
                const original = parseAmount(form.values.amount);
                const rate =
                    original === 0
                        ? 1
                        : resolvedRate(ctx, currency, form.values.rate);
                if (
                    !Number.isSafeInteger(original) ||
                    !Number.isFinite(form.values.time) ||
                    !validRate(rate)
                ) {
                    setError("请检查期初金额、日期和折算汇率");
                    return;
                }
                const value = makeBill(ctx, {
                    account,
                    original: Math.abs(original),
                    rate,
                    time: form.values.time,
                    category: original < 0 ? "opening-out" : "opening-in",
                    type: original < 0 ? "expense" : "income",
                    role: "opening",
                });
                await ctx.api.edit(
                    previous
                        ? { update: [{ id: previous.id, value }] }
                        : { create: [value] },
                );
                await ctx.closeModal();
            },
            { primary: true },
        ),
    );
}

export function Management(ctx) {
    const notice = readAccessNotice(ctx);
    if (notice) return notice;
    const balances = accountBalances(ctx);
    const available = accounts(ctx);
    return panel(
        Row(
            strong(`账户 · ${available.length}`).style({ grow: 1 }),
            action(
                "新建账户",
                "add",
                () => ctx.openModal(AccountForm, {}, { title: "新建账户" }),
                { primary: true },
            ),
        ).style({ wrap: true, align: "center", gap: 8 }),
        !available.length &&
            emptyState("暂无账户", "可以先添加日常使用的银行卡或钱包。"),
        ...available.map((account) =>
            Row(
                Button(
                    { label: `查看${account.name}流水` },
                    accountSummary(ctx, balances.get(ctx.id(account.id)), 15),
                )
                    .key("details")
                    .style({ grow: 1, minWidth: 0 })
                    .onTap(() =>
                        ctx.openModal(
                            AccountDetail,
                            { accountId: account.id },
                            { title: "账户详情" },
                        ),
                    ),
                action("编辑", "edit", () =>
                    ctx.openModal(
                        AccountForm,
                        { accountId: account.id },
                        { title: "编辑账户" },
                    ),
                ).style({ shrink: 0 }),
            )
                .key(account.id)
                .style({ ...outline, gap: 8, align: "center" }),
        ),
    );
}

const colors = [
    { value: "#dbeafe", label: "蓝色" },
    { value: "#dcfce7", label: "绿色" },
    { value: "#fef3c7", label: "黄色" },
    { value: "#fce7f3", label: "粉色" },
];

export function AccountForm(ctx) {
    const notice = readAccessNotice(ctx);
    if (notice) return notice;
    const [createdId, setCreatedId] = ctx.state("created-account", "");
    if (createdId)
        return AccountDetail({ ...ctx, params: { accountId: createdId } }).key(
            "created-detail",
        );
    const account = findAccount(ctx, ctx.params.accountId);
    if (ctx.params.accountId && !account)
        return panel(emptyState("账户已删除", "返回账户列表查看其他账户。"));
    const form = ctx.form("account", {
        name: account?.name ?? "",
        color: account?.color ?? colors[0].value,
        currency: accountCurrency(ctx, account),
    });
    const [deleting, setDeleting] = ctx.state("deleting", false);
    const [error, setError] = ctx.state("account-error", "");
    const hasBills = Boolean(account && billsFor(ctx, account).length);
    const currencies = [
        ...new Set([form.values.currency, ...quickCurrencies(ctx)]),
    ];

    return panel(
        Input({
            label: "账户名称",
            placeholder: "例如 工资卡",
            ...form.field("name"),
        }).key("name"),
        Select({
            label: "账户颜色",
            options: colors.some((color) => color.value === form.values.color)
                ? colors
                : [...colors, { value: form.values.color, label: "当前颜色" }],
            ...form.field("color"),
        }).key("color"),
        Select({
            label: "账户币种",
            options: currencies,
            disabled: hasBills,
            ...form.field("currency"),
        }).key("currency"),
        muted(
            hasBills
                ? "已有流水，保留该账户币种。"
                : "日常记账选中账户标签时，会优先使用此币种。",
        ),
        errorText(error, "error"),
        action(
            account ? "保存账户" : "创建账户",
            "save",
            async () => {
                const name = form.values.name.trim();
                if (!name) {
                    setError("请输入账户名称");
                    return;
                }
                const next = {
                    ...account,
                    ...form.values,
                    name,
                    color: form.values.color || colors[0].value,
                    currency: hasBills
                        ? accountCurrency(ctx, account)
                        : form.values.currency || baseCurrency(ctx),
                    id:
                        account?.id ??
                        `account-${ctx.now}-${Math.random().toString(36).slice(2)}`,
                };
                await ctx.api.setStorage({
                    ...ctx.storage,
                    accounts: account
                        ? allAccounts(ctx).map((item) =>
                              item.id === account.id ? next : item,
                          )
                        : [...allAccounts(ctx), next],
                });
                if (account) await ctx.closeModal();
                else setCreatedId(next.id);
            },
            { primary: true },
        ),
        account &&
            !hasBills &&
            (deleting
                ? section(
                      "删除空账户",
                      muted("账户及其自动生成的标签和统计视图将被移除。"),
                      Row(
                          action("取消", "cancel", () => setDeleting(false)),
                          action(
                              "确认删除账户",
                              "confirm-delete",
                              async () => {
                                  await ctx.api.setStorage({
                                      ...ctx.storage,
                                      accounts: allAccounts(ctx).filter(
                                          (item) => item.id !== account.id,
                                      ),
                                  });
                                  await ctx.closeModal();
                              },
                              { danger: true },
                          ),
                      ).style({ wrap: true, gap: 8 }),
                  )
                : action("删除空账户", "delete", () => setDeleting(true), {
                      danger: true,
                  })),
    );
}
