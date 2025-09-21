import { BillCategories } from "@/ledger/category"

export default function useCategory() {
    const categories = BillCategories
    return {
        categories
    }
}