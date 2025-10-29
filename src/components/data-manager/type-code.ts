import { BillCategories } from "@/ledger/category";
import typeText from "@/ledger/type?raw";

export const TypeText = `${typeText}`.replace(
    "{{AllBillCategories}}",
    JSON.stringify(BillCategories),
);
