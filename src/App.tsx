import { useState } from "react";

function App() {
	const [count, setCount] = useState(0);

	return (
		<div className="bg-[pink] ">
			<div>
				<i className="icon-[mdi-light--home]" />
				Hello React
			</div>
			<div className="flex gap-2">
				{count}
				<button
					type="button"
					className="rounded border border-slate-900"
					onClick={() => setCount((v) => v + 1)}
				>
					increase
				</button>
			</div>
		</div>
	);
}

export default App;
