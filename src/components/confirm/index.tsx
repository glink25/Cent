import { Dialog, VisuallyHidden } from "radix-ui";
import type { JSX } from "react";
import { useShallow } from "zustand/shallow";
import { confirmStoreFactory } from "./state";

export default function createConfirmProvider<Value, Returned = Value>(
	Form: (props: {
		edit?: Value;
		onCancel?: () => void;
		onConfirm?: (v: Returned) => void;
	}) => JSX.Element,
	{
		dialogTitle,
		dialogDescription = dialogTitle,
		dialogModalClose,
	}: {
		dialogTitle: string;
		dialogDescription?: string;
		dialogModalClose?: boolean;
	},
) {
	const useStore = confirmStoreFactory<Value, Returned>();
	function Confirm() {
		const [visible, editBill, controller] = useStore(
			useShallow((state) => {
				return [state.visible, state.edit, state.controller];
			}),
		);
		// if (!visible) {
		// 	return null;
		// }

		const onCancel = () => {
			controller?.reject();
			useStore.getState().update({ visible: false });
		};
		const onConfirm = (v: Returned) => {
			controller?.resolve(v);
			useStore.getState().update({ visible: false });
		};
		return (
			<Dialog.Root
				open={visible}
				onOpenChange={(v) => {
					if (dialogModalClose && !v) {
						onCancel();
					}
				}}
			>
				<Dialog.Portal>
					<Dialog.Overlay className="fixed inset-0 bg-[rgba(128,128,128,0.5)] data-[state=open]:animate-overlayShow" />
					<Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-md bg-[white] p-[25px] shadow-[var(--shadow-6)] focus:outline-none data-[state=open]:animate-contentShow">
						<VisuallyHidden.Root>
							<Dialog.Title>{dialogTitle}</Dialog.Title>
							<Dialog.Description>{dialogDescription}</Dialog.Description>
						</VisuallyHidden.Root>
						<Form edit={editBill} onCancel={onCancel} onConfirm={onConfirm} />
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog.Root>
		);
	}

	const confirm = useStore.getState().open;

	return [Confirm, confirm] as const;
}
