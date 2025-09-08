import createConfirmProvider from "../confirm";
import BillInfo from "./form";

const [BillInfoProvider, showBillInfo] = createConfirmProvider(BillInfo, {
	dialogTitle: "bill info",
	dialogModalClose: true,
});

export { BillInfoProvider, showBillInfo };
