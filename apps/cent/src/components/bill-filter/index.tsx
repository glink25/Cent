import createConfirmProvider from "../confirm";
import BillFilterView from "./filter-view";
import BillFilterForm from "./form";

export default BillFilterForm;

const confirms = createConfirmProvider(BillFilterView, {
    dialogTitle: "Edit Bill Filter",
    fade: true,
    swipe: false,
    contentClassName: "overflow-hidden",
});

const [BillFilterViewProvider, showBillFilterView] = confirms;

export { BillFilterViewProvider };

export { showBillFilterView };
