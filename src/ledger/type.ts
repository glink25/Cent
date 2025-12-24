// @annotation: Full 在这里并无实际作用，只是用于拓展一些额外内容，无需考虑，Full<T> 可视为等价于 T
import type { Full } from "@/database/stash";
// @annotation: 其他工具type，无需考虑
import type {
    BillFilter,
    BillTagGroup,
    Budget,
    CustomCurrency,
    PersonalMeta,
} from "./extra-type";

export type { CustomCurrency, PersonalMeta, BillFilter, Budget, BillTagGroup };

/** 账单类型，代表收入或者支出 */
export type BillType = "income" | "expense";

/** 整数金额，10000:1 */
export type Amount = number;

/** 地理位置类型 */
export type GeoLocation = {
    latitude: number;
    longitude: number;
    accuracy: number;
};

export type Bill = {
    /** 每笔账单的唯一标识 */
    id: string;
    /** 账单类型，代表收入或者支出 */
    type: BillType;
    /** 账单的类别，每笔账单只能有一个分类，可以是父类，也可以是子类 */
    categoryId: string;
    /** 创建者的id */
    creatorId: number | string;
    /** 备注，导入时不确定的信息也可以保存在这里 */
    comment?: string;
    /** 整数金额，10000:1 */
    amount: Amount;
    /** 账单发生的时间*/
    time: number;
    /** 账单的图片附件*/
    images?: (File | string)[];
    /** 账单的地址*/
    location?: GeoLocation;
    /** 账单的tag，可以为多个*/
    tagIds?: string[];
    /** 多币种 */
    currency?: {
        // 记账当时设置的本位币
        base: string;
        // 记账当时选择的币种
        target: string;
        // 记账当时填写的金额
        amount: number;
    };
};

/** 每笔账单仅可以设置一个BillCategory，用于标记这些支出或者收入项属于某些分类
 * 分类也分为父类和子类，分别表示更加详细的类别
 * 一般来说，大部分账单分类都可以在默认的分类中找到，如果实在没有对应的分类，应该将新增的分类添加到GlobalMeta.categories中，新增分类只需要@required 标记的字段即可，并且新增的分类customName字段必须为true，其余字段可以根据需要设置为空字符串或者undefined
 * 默认的分类为：{{AllBillCategories}}
 */

export type BillCategory = {
    // @required 分类的消费类型，指定是支出还是收入
    type: BillType;
    // @required 分类的名称
    name: string;
    // @required 分类的id
    id: string;
    // 分类的图标
    icon: string;
    // 分类的颜色
    color: string;
    // 内部使用，分类的自定义名称，当用户修改了默认分类的名称后启用，非默认分类和新增的分类customName字段必须为true
    customName?: boolean;
    // 父类的id，如果为空，则该分类视为父类
    parent?: string;
};

/** 每笔账单可以设置多个BillTag，一般用于标记这些支出或者收入项与某些事件相关联
 * @example 一次旅行中的所有消费事件都可以使用一个tag记录，例如xxx旅行
 */
export type BillTag = {
    // tag的唯一标识符
    id: string;
    // tag的名称
    name: string;
    /** 在编辑账单页选中该标签时，将自动切换金额为对应的币种 */
    preferCurrency?: string;
};

// 全局文件配置
export type GlobalMeta = {
    // 自定义过滤器，可以略过
    customFilters?: { id: string; filter: BillFilter; name: string }[];
    // 自定义预算，可以略过
    budgets?: Budget[];
    // 用户自定义配置，可以略过
    personal?: Record<string, PersonalMeta>;
    // 自定义分类，所有新增的分类都应该放在这里
    categories?: BillCategory[];
    // 自定义Tag，所有tag都应该放在这里
    tags: BillTag[];
    // 本位货币
    baseCurrency?: string;
    customCurrencies?: CustomCurrency[];
    quickCurrencies?: string[];
};

// 这是最终导出的核心JSON数据结构，使用这个数据结构可以直接被解析成可以识别的数据
export type ExportedJSON = {
    // 所有的交易记录
    items: Full<Bill>[];
    // 额外的配置数据
    meta: GlobalMeta;
};
