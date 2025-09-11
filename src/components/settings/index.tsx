import createConfirmProvider from "../confirm";
import SettingsForm from "./form";

export const [Settings, showSettings] = createConfirmProvider(SettingsForm, {
	dialogTitle: "Settings",
	dialogModalClose: true,
});
