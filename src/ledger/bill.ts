import type { Amount } from "./type";

export const amountToNumber = (v: Amount) => v / 10000;

export const numberToAmount = (v: number) => Math.floor(v * 10000);

export const isValidNumberForAmount = (v: number) => {
    const tmp = numberToAmount(v);
    if (tmp.toString().includes(".")) {
        return false;
    }
    return true;
};
