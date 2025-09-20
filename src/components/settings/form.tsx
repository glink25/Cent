import { LoginAPI } from "@/api/login";
import { StorageAPI } from "@/api/storage";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { useUserStore } from "@/store/user";
import Backup from "../backup";
import { Book } from "../book";
import Budget from "../budget";
import CategoryManerger from "../category";
import { Button } from "../ui/button";
import Launguage from "./language";

function UserInfo() {
	const t = useIntl();
	const { login, avatar_url, name, expired } = useUserStore();
	const toLogOut = async () => {
		const ok = confirm(t("logout-warning"));
		if (!ok) {
			return;
		}
		await StorageAPI.dangerousClearAll();
		localStorage.clear();
		sessionStorage.clear();
		location.reload();
	};
	return (
		<div
			className="flex items-center justify-between gap-2 px-8 py-4
        "
		>
			<div className="flex items-center gap-2">
				<img
					src={avatar_url}
					alt={login}
					className="w-12 h-12 rounded-full border"
				/>

				<div>
					<div className="font-semibold">{name}</div>
					<div className="text-sm opacity-60">{login}</div>
				</div>
			</div>
			<div className="flex items-center gap-2">
				{expired && (
					<Button
						variant="outline"
						onClick={() => {
							LoginAPI.login();
						}}
					>
						<i className="icon-[mdi--reload]"></i>
						{t("re-login")}
					</Button>
				)}
				<Button variant="destructive" onClick={toLogOut}>
					{t("logout")}
				</Button>
			</div>
		</div>
	);
}

export default function SettingsForm({
	onConfirm,
	onCancel,
}: {
	onConfirm?: (isEdit: boolean) => void;
	onCancel?: () => void;
}) {
	const t = useIntl();
	return (
		<PopupLayout onBack={onCancel} title={t("settings")}>
			<div className="divide-y divide-solid flex flex-col">
				<UserInfo />
				<Book />
				<CategoryManerger />
				<Budget />
				<Backup />
				<Launguage />
			</div>
		</PopupLayout>
	);
}
