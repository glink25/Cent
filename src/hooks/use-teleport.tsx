import {
	createContext,
	type HTMLAttributes,
	type ReactNode,
	type RefObject,
	useContext,
	useRef,
} from "react";
import { createPortal } from "react-dom";

const TeleportContext = createContext<{
	parentRef: RefObject<HTMLDivElement | null>;
} | null>(null);

export default function createTeleportSlot() {
	function Provider({ children }: { children?: ReactNode }) {
		const parentRef = useRef<HTMLDivElement>(null);
		return (
			<TeleportContext.Provider value={{ parentRef }}>
				{children}
			</TeleportContext.Provider>
		);
	}

	function useTeleportContext() {
		const context = useContext(TeleportContext);
		if (!context) {
			throw new Error("need init TeleportContext first");
		}
		return context;
	}

	function Slot(props: HTMLAttributes<HTMLDivElement>) {
		const { parentRef } = useTeleportContext();
		return <div {...props} ref={parentRef}></div>;
	}

	function Teleport({ children }: { children: ReactNode }) {
		const { parentRef } = useTeleportContext();
		return parentRef.current ? createPortal(children, parentRef.current) : null;
	}

	return {
		Provider,
		Slot,
		Teleport,
	};
}
