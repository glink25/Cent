import { Dialog, VisuallyHidden } from "radix-ui";
import type { ReactNode } from "react";
import { useShallow } from "zustand/shallow";
import { cn } from "@/utils";
import { confirmStoreFactory } from "./state";

export default function createConfirmProvider<Value, Returned = Value>(
	Form: (props: {
		edit?: Value;
		onCancel?: () => void;
		onConfirm?: (v: Returned) => void;
	}) => ReactNode,
	{
		dialogTitle,
		dialogDescription = dialogTitle,
		dialogModalClose,
		contentClassName,
	}: {
		dialogTitle: string;
		dialogDescription?: string;
		dialogModalClose?: boolean;
		contentClassName?: string;
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
					<Dialog.Overlay className="fixed inset-0 bg-[rgba(128,128,128,0.5)] data-[state=open]:animate-overlay-show" />
					<div className="fixed top-0 left-0 w-full h-full flex justify-center items-center">
						<Dialog.Content className={cn('bg-white max-h-[85vh] w-[90vw] max-w-[500px] data-[state=open]:animate-content-show', contentClassName)}>
							<VisuallyHidden.Root>
								<Dialog.Title>{dialogTitle}</Dialog.Title>
								<Dialog.Description>{dialogDescription}</Dialog.Description>
							</VisuallyHidden.Root>
							<Form edit={editBill} onCancel={onCancel} onConfirm={onConfirm} />
						</Dialog.Content>
					</div>
				</Dialog.Portal>
			</Dialog.Root>
		);
	}

	const confirm = useStore.getState().open;

	return [Confirm, confirm] as const;
}
