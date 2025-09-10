import { createPortal } from "react-dom";
import { useShallow } from "zustand/shallow";
import { LoginAPI } from "@/api/login";
import { useUserStore } from "@/store/user";

export default function Login() {
	const [isLogin, loading] = useUserStore(
		useShallow((state) => {
			return [Boolean(state.login) && state.id > 0, state.loading];
		}),
	);
	if (isLogin) {
		return null;
	}
	return createPortal(
		<div className="fixed top-0 right-0 z-[9999] w-screen h-screen overflow-hidden">
			<div className="absolute w-full h-full bg-[rgba(0,0,0,0.5)] z-[-1]"></div>
			<div className="w-full h-full flex justify-center items-center">
				<div className="bg-[white] w-[350px] h-[350px] flex justify-center items-center rounded">
					{loading ? (
						<div>
							<i className="icon-[mdi--loading] animate-spin"></i>Login...
						</div>
					) : (
						<button
							type="button"
							className="rounded bg-black text-white px-2 py-1"
							onClick={() => {
								LoginAPI.login();
							}}
						>
							Login to Github
						</button>
					)}
				</div>
			</div>
		</div>,
		document.body,
	);
}
