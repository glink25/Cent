export default function PopupLayout() {
	return (
		<div className="flex-1 flex flex-col p-2 overflow-hidden">
			<div className="header flex justify-center items-center relative">
				<div
					className="absolute left-0 flex buttoned rounded-full py-1 pl-1 pr-3"
					click="goBack"
				>
					<div className="flex items-center justify-center">
						<i className="icon-chevron-left"></i>
					</div>
					{"back"}
				</div>
				<div>{title}</div>
			</div>
		</div>
	);
}
