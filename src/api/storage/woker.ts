/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { expose } from "comlink";
import { BillIndexeBDStorage } from "@/gitray";
import { StashBucket } from "@/gitray/stash";
import type { Bill, BillFilter } from "@/ledger/type";
import { isBillMatched } from "@/ledger/utils";
import type { GlobalMeta } from ".";
import { analysisBills } from "./analysis";

const storeMap = new Map<
	string,
	{ itemStorage: BillIndexeBDStorage; itemBucket: StashBucket<Bill> }
>();
const getDB = (storeFullName: string) => {
	const itemStorage =
		storeMap.get(storeFullName)?.itemStorage ??
		new BillIndexeBDStorage(`book-${storeFullName}`);
	const itemBucket =
		storeMap.get(storeFullName)?.itemBucket ??
		new StashBucket(
			itemStorage.createArrayableStorage,
			itemStorage.createStorage,
		);
	storeMap.set(storeFullName, { itemStorage, itemBucket });
	return { itemBucket };
};

const filter = async (storeFullName: string, rule: BillFilter) => {
	const items = await getDB(storeFullName).itemBucket.getItems();
	return items.filter((v) => isBillMatched(v, rule));
};

const getInfo = async (storeFullName: string) => {
	const bucket = getDB(storeFullName).itemBucket;
	const globalMeta: GlobalMeta = (await bucket.getMeta()) ?? {};
	return {
		meta: globalMeta,
	};
};

// 我正在编写一个分析账单的应用程序，它的数据将会被用到下面的UI中：
// <div class="common">日均支出x，月均支出y，年均支出z</div>
// <div class="predict">预计本周/本月/今年支出y</div>
// <div class="compare">比昨天/上周/上月/去年增长x%，比去年同期增长y%</div>
// 当然，你也可以改进我的分析描述，例如，添加更多的对比维度和对应的文案
// 处于性能考虑，计算时只需考虑 analysisUnit ，例如如果analysisUnit为week，则predict和compare均只需计算本周和上周的数据，其他同理
// 并且如果不传入analysisUnit，则只需计算common中的数据，无需计算其他数据
// 假设你已经有了获取dateRange期间账单的函数，请尝试补全这个函数，当涉及到日期计算时，请尽可能使用dayjs来计算
// 注意，analysis只需要返回具体数值即可，不需要涉及UI和文本
const analysis = async (
	storeFullName: string,
	dateRange: [number, number], // 时间戳ms
	analysisUnit?: "year" | "month" | "week" | "day",
) => {
	const result = await analysisBills(
		(range) => filter(storeFullName, { start: range[0], end: range[1] }),
		dateRange,
		analysisUnit,
	);
	return result;
};

const exposed = {
	init: (v: any) => {},
	getInfo,
	filter,
	analysis,
};

export type Exposed = typeof exposed;

expose(exposed);
