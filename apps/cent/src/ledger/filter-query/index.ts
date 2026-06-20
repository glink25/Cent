import dayjs from "dayjs";
import { numberToAmount } from "../bill";
import type { Bill, BillType } from "../type";

/** 高级搜索语法触发前缀 */
const QUERY_PREFIX = "q:";

// ==========================================
// AST：原始 / 编译后
// ==========================================
export type TermOperator = "EQ" | ">" | ">=" | "<" | "<=" | "RANGE";

export type RawAST =
    | { kind: "AND" | "OR"; left: RawAST; right: RawAST }
    | { kind: "NOT"; node: RawAST }
    | {
          kind: "TERM";
          field: string;
          operator: TermOperator;
          value: string;
      };

export type CompiledAST =
    | { kind: "AND" | "OR"; left: CompiledAST; right: CompiledAST }
    | { kind: "NOT"; node: CompiledAST }
    | { kind: "TYPE"; value: BillType }
    | { kind: "USER"; ids: ReadonlyArray<string | number> }
    | { kind: "CATEGORY"; ids: ReadonlyArray<string> }
    | { kind: "TAG"; ids: ReadonlyArray<string> }
    | { kind: "CURRENCY"; value: string; baseCurrency: string }
    | { kind: "AMOUNT"; operator: TermOperator; value: string }
    | { kind: "TIME"; operator: TermOperator; value: string }
    | { kind: "RECENT"; value: string }
    | {
          kind: "HAS";
          flag: "assets" | "scheduled" | "comment" | "location";
      }
    | { kind: "COMMENT"; value: string }
    | { kind: "ALWAYS"; value: boolean };

// ==========================================
// 上下文（显式参数，无全局状态）
// ==========================================
export interface FilterQueryContext {
    categories?: ReadonlyArray<{ id: string; name: string }>;
    tags?: ReadonlyArray<{ id: string; name: string }>;
    users?: ReadonlyArray<{ id: string | number; name: string }>;
    baseCurrency?: string;
}

// ==========================================
// 入口检测
// ==========================================
export const isFilterQuery = (text: string | undefined): boolean => {
    if (!text) return false;
    return text.trimStart().startsWith(QUERY_PREFIX);
};

const stripPrefix = (text: string): string => {
    const trimmed = text.trimStart();
    return trimmed.startsWith(QUERY_PREFIX)
        ? trimmed.slice(QUERY_PREFIX.length)
        : trimmed;
};

// ==========================================
// Lexer + Parser
// ==========================================
class LuceneParser {
    private tokens: string[];
    private pos = 0;

    constructor(query: string) {
        const regex =
            /AND|OR|NOT|&&|\|\||!|-|\(|\)|(?:[a-zA-Z_][a-zA-Z0-9_-]*:)?(?:\[[^\]]+\]|"[^"]+"|[^\s()]+)/g;
        this.tokens = query.match(regex) ?? [];
    }

    parse(): RawAST | null {
        if (this.tokens.length === 0) return null;
        return this.parseExpression();
    }

    private peek(): string | undefined {
        return this.tokens[this.pos];
    }

    private match(...expected: string[]): boolean {
        const t = this.tokens[this.pos];
        if (t !== undefined && expected.includes(t)) {
            this.pos++;
            return true;
        }
        return false;
    }

    private parseExpression(): RawAST {
        let left = this.parseAndExpression();
        while (this.match("OR", "||")) {
            left = { kind: "OR", left, right: this.parseAndExpression() };
        }
        return left;
    }

    private parseAndExpression(): RawAST {
        let left = this.parseUnaryExpression();
        while (true) {
            if (this.match("AND", "&&")) {
                left = {
                    kind: "AND",
                    left,
                    right: this.parseUnaryExpression(),
                };
                continue;
            }
            const next = this.peek();
            if (next === undefined) break;
            if (next === "OR" || next === "||" || next === ")") break;
            // 隐式 AND
            left = { kind: "AND", left, right: this.parseUnaryExpression() };
        }
        return left;
    }

    private parseUnaryExpression(): RawAST {
        if (this.match("NOT", "!", "-")) {
            return { kind: "NOT", node: this.parseUnaryExpression() };
        }
        return this.parsePrimary();
    }

    private parsePrimary(): RawAST {
        if (this.match("(")) {
            const node = this.parseExpression();
            this.match(")");
            return node;
        }
        const tok = this.tokens[this.pos++];
        return this.parseTerm(tok ?? "");
    }

    private parseTerm(token: string): RawAST {
        if (!token) {
            return {
                kind: "TERM",
                field: "comment",
                operator: "EQ",
                value: "",
            };
        }

        let field = "comment";
        let value = token;

        const colonIdx = token.indexOf(":");
        if (
            colonIdx > 0 &&
            /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(token.slice(0, colonIdx))
        ) {
            field = token.slice(0, colonIdx);
            value = token.slice(colonIdx + 1);
        }

        let operator: TermOperator = "EQ";
        if (value.startsWith(">=")) {
            operator = ">=";
            value = value.slice(2);
        } else if (value.startsWith("<=")) {
            operator = "<=";
            value = value.slice(2);
        } else if (value.startsWith(">")) {
            operator = ">";
            value = value.slice(1);
        } else if (value.startsWith("<")) {
            operator = "<";
            value = value.slice(1);
        } else if (value.startsWith("[") && value.endsWith("]")) {
            operator = "RANGE";
            value = value.slice(1, -1);
        }

        if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
            value = value.slice(1, -1);
        }

        return { kind: "TERM", field, operator, value };
    }
}

/** 解析（纯函数，不依赖 context）。返回 null 表示空查询，匹配时视为通过 */
export const parseFilterQuery = (query: string): RawAST | null => {
    const body = stripPrefix(query);
    return new LuceneParser(body).parse();
};

// ==========================================
// 编译：name → id 解析与 field 类型化
// ==========================================
const resolveIds = <T extends string | number>(
    input: string,
    list: ReadonlyArray<{ id: T; name: string }> | undefined,
): T[] => {
    if (!list || list.length === 0) return [input as unknown as T];
    const matched: T[] = [];
    for (const item of list) {
        if (String(item.id) === input || item.name === input) {
            matched.push(item.id);
        }
    }
    return matched.length > 0 ? matched : [input as unknown as T];
};

const compileTerm = (
    field: string,
    operator: TermOperator,
    value: string,
    ctx: FilterQueryContext,
): CompiledAST => {
    switch (field) {
        case "type":
            return { kind: "TYPE", value: value as BillType };
        case "creator":
        case "user":
            return { kind: "USER", ids: resolveIds(value, ctx.users) };
        case "category":
            return {
                kind: "CATEGORY",
                ids: resolveIds(value, ctx.categories),
            };
        case "tag":
            return { kind: "TAG", ids: resolveIds(value, ctx.tags) };
        case "currency":
            return {
                kind: "CURRENCY",
                value,
                baseCurrency: ctx.baseCurrency ?? "",
            };
        case "amount":
            return { kind: "AMOUNT", operator, value };
        case "time":
            return { kind: "TIME", operator, value };
        case "recent":
            return { kind: "RECENT", value };
        case "has":
            if (
                value === "assets" ||
                value === "scheduled" ||
                value === "comment" ||
                value === "location"
            ) {
                return { kind: "HAS", flag: value };
            }
            return { kind: "ALWAYS", value: false };
        default:
            return { kind: "COMMENT", value };
    }
};

const compileNode = (ast: RawAST, ctx: FilterQueryContext): CompiledAST => {
    switch (ast.kind) {
        case "AND":
        case "OR":
            return {
                kind: ast.kind,
                left: compileNode(ast.left, ctx),
                right: compileNode(ast.right, ctx),
            };
        case "NOT":
            return { kind: "NOT", node: compileNode(ast.node, ctx) };
        case "TERM":
            return compileTerm(ast.field, ast.operator, ast.value, ctx);
    }
};

export const compileFilterQuery = (
    ast: RawAST | null,
    ctx: FilterQueryContext,
): CompiledAST | null => (ast ? compileNode(ast, ctx) : null);

// ==========================================
// 求值（纯函数）
// ==========================================
const matchAmount = (
    bill: Bill,
    operator: TermOperator,
    value: string,
): boolean => {
    if (operator === "RANGE") {
        const [minStr, maxStr] = value.split(/\s+TO\s+/i);
        const min = Number(minStr);
        const max = Number(maxStr);
        const lo = numberToAmount(Number.isFinite(min) ? min : -Infinity);
        const hi = numberToAmount(Number.isFinite(max) ? max : Infinity);
        const [a, b] = lo < hi ? [lo, hi] : [hi, lo];
        return bill.amount >= a && bill.amount <= b;
    }
    const num = Number(value);
    if (!Number.isFinite(num)) return false;
    const target = numberToAmount(num);
    switch (operator) {
        case ">":
            return bill.amount > target;
        case ">=":
            return bill.amount >= target;
        case "<":
            return bill.amount < target;
        case "<=":
            return bill.amount <= target;
        default:
            return bill.amount === target;
    }
};

const matchTime = (
    bill: Bill,
    operator: TermOperator,
    value: string,
): boolean => {
    const billTime = dayjs.unix(bill.time / 1000);
    if (operator === "RANGE") {
        const [minStr, maxStr] = value.split(/\s+TO\s+/i);
        const start = dayjs(minStr);
        const end = dayjs(maxStr);
        return billTime.isSameOrAfter(start) && billTime.isSameOrBefore(end);
    }
    const target = dayjs(value);
    if (!target.isValid()) return false;
    switch (operator) {
        case ">":
            return billTime.isAfter(target);
        case ">=":
            return billTime.isSameOrAfter(target);
        case "<":
            return billTime.isBefore(target);
        case "<=":
            return billTime.isSameOrBefore(target);
        default:
            return billTime.isSame(target, "day");
    }
};

const matchRecent = (bill: Bill, value: string): boolean => {
    const m = value.match(/^(\d+)([a-zA-Z]+)$/);
    if (!m) return false;
    const start = dayjs()
        .subtract(Number(m[1]), m[2] as dayjs.ManipulateType)
        .startOf("day");
    return dayjs.unix(bill.time / 1000).isSameOrAfter(start);
};

export const matchFilterQuery = (
    compiled: CompiledAST | null,
    bill: Bill,
): boolean => {
    if (!compiled) return true;
    switch (compiled.kind) {
        case "AND":
            return (
                matchFilterQuery(compiled.left, bill) &&
                matchFilterQuery(compiled.right, bill)
            );
        case "OR":
            return (
                matchFilterQuery(compiled.left, bill) ||
                matchFilterQuery(compiled.right, bill)
            );
        case "NOT":
            return !matchFilterQuery(compiled.node, bill);
        case "TYPE":
            return bill.type === compiled.value;
        case "USER":
            return compiled.ids.some((u) => bill.creatorId === u);
        case "CATEGORY":
            return compiled.ids.some((c) => bill.categoryId === c);
        case "TAG":
            return compiled.ids.some((t) => bill.tagIds?.includes(t));
        case "CURRENCY":
            return (
                (bill.currency?.target ?? compiled.baseCurrency) ===
                compiled.value
            );
        case "AMOUNT":
            return matchAmount(bill, compiled.operator, compiled.value);
        case "TIME":
            return matchTime(bill, compiled.operator, compiled.value);
        case "RECENT":
            return matchRecent(bill, compiled.value);
        case "HAS": {
            if (compiled.flag === "assets")
                return Boolean(bill.images?.some((img) => Boolean(img)));
            if (compiled.flag === "scheduled")
                return Boolean(bill.extra?.scheduledId);
            if (compiled.flag === "comment")
                return Boolean(bill.comment && bill.comment.length > 0);
            return Boolean(bill.location);
        }
        case "COMMENT":
            return Boolean(bill.comment?.includes(compiled.value));
        case "ALWAYS":
            return compiled.value;
    }
};
