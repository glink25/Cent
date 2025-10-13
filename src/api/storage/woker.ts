/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { expose } from "comlink";
import { BillIndexeBDStorage } from "@/gitray";
import { StashBucket } from "@/gitray/stash";
import type { Bill, BillFilter } from "@/ledger/type";
import { isBillMatched } from "@/ledger/utils";
import type { GlobalMeta } from ".";
import { analysis as analysisBills, type AnalysisType } from "./analysis";

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

const analysis = async (
	storeFullName: string,
	dateRange: [number, number], // 时间戳ms
	analysisUnit: "year" | "month" | "week" | "day",
	type: AnalysisType,
) => {
	const result = await analysisBills(dateRange, type, analysisUnit, (range) =>
		filter(storeFullName, { start: range[0], end: range[1] }),
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
