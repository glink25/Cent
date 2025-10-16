/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { expose, transfer } from "comlink";
import { BillIndexeBDStorage } from "@/gitray";
import { StashBucket } from "@/gitray/stash";
import type { Bill, BillFilter } from "@/ledger/type";
import { isBillMatched } from "@/ledger/utils";
import { blobToBase64 } from "@/utils/file";
import type { ExportedJSON, GlobalMeta } from ".";
import { type AnalysisType, analysis as analysisBills } from "./analysis";

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

const toJSON = async (storeFullName: string) => {
    const { meta } = await getInfo(storeFullName);
    const items = await filter(storeFullName, {});
    await Promise.all(
        items.map(async (v) => {
            // convert to base64
            const imagesJSON = v.images
                ? await Promise.all(
                      v.images?.map(async (img) => {
                          if (img instanceof File) {
                              const str = await blobToBase64(img);
                              const base64Url = `data:${img.type};base64,${str}`;
                              return base64Url;
                          }
                          return img;
                      }),
                  )
                : undefined;
            v.images = imagesJSON;
            return v;
        }),
    );
    const json = JSON.stringify({
        meta,
        items,
    } as ExportedJSON);
    return json;
};

const exportToArrayBuffer = async (storeFullName: string) => {
    const data = await toJSON(storeFullName);
    const uint8 = new TextEncoder().encode(data);
    // 把对象和要转移的 buffer 一起返回，并声明 transferables
    return transfer(
        uint8.buffer, // 返回值
        [uint8.buffer], // 要转移的对象
    );
};

const exposed = {
    init: (v: any) => {},
    getInfo,
    filter,
    analysis,
    exportToArrayBuffer,
};

export type Exposed = typeof exposed;

expose(exposed);
