import { BillCategories } from "@/ledger/category";
import typeText from "@/ledger/type?raw";
import { intlCategory } from "@/ledger/utils";
import { t } from "@/locale";
import { useLedgerStore } from "@/store/ledger";

const getCategories = () => {
    const savedCategories = useLedgerStore.getState().infos?.meta.categories;

    const categories = (savedCategories ?? BillCategories).map((v) => {
        const cate = intlCategory(v, t);
        return cate;
    });
    return categories;
};

export const TypeText = `${typeText}`.replace(
    "{{AllBillCategories}}",
    JSON.stringify(getCategories()),
);
