import { StorageAPI } from "@/api/storage";
import { useUserStore } from "@/store/user";
import { FORMAT_BACKUP, showFilePicker } from "../file-picker";
import { OncentImport, showOncentImport } from "./oncent";

function UserInfo() {
	const { login, avatar, name } = useUserStore();
	const toLogOut = async () => {
		const ok = confirm(
			"Are you sure to log out? changes not synced will be discard",
		);
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
			className="flex items-center justify-between gap-2
        "
		>
			<div className="flex items-center gap-2">
				<img src={avatar} alt={login} className="w-12 h-12 rounded-full" />

				<div>
					<div className="font-semibold">{name}</div>
					<div className="text-sm opacity-60">{login}</div>
				</div>
			</div>
			<div>
				<button
					type="button"
					className="bg-red-600 text-white rounded px-2 py-1 text-sm cursor-pointer"
					onClick={toLogOut}
				>
					logout
				</button>
			</div>
		</div>
	);
}

function Backup() {
	const toImport = async () => {
		const [jsonFile] = await showFilePicker({ accept: FORMAT_BACKUP });
		const jsonText = await jsonFile.text();
		const data = JSON.parse(jsonText);
		await showOncentImport(data);
	};
	return (
		<div className="backup">
			<button type="button" onClick={toImport}>
				Import from oncent.github.io
			</button>
			<OncentImport />
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
	return (
		<div className="flex-1 flex flex-col p-2 overflow-hidden">
			<div className="header flex justify-center items-center relative pb-2">
				<button
					type="button"
					className="absolute left-0 flex buttoned rounded-full py-1 pl-1 pr-3 cursor-pointer"
					onClick={() => {
						onCancel?.();
					}}
				>
					<div className="flex items-center justify-center">
						<i className="icon-[mdi--chevron-left]"></i>
					</div>
					{"back"}
				</button>
				<div>{"Settings"}</div>
			</div>
			<UserInfo />
			<Backup />
		</div>
	);
}
