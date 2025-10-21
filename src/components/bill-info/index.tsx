import createConfirmProvider from "../confirm";
import BillInfo from "./form";

const [BillInfoProvider, showBillInfo] = createConfirmProvider(BillInfo, {
    dialogTitle: "bill info",
    dialogModalClose: true,
    fade: true,
    swipe: false,
});

export { BillInfoProvider, showBillInfo };
