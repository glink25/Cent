import "./utils/shim.ts";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import "./index.css";

import RootRoute from "./route.tsx";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<MemoryRouter>
			<RootRoute />
		</MemoryRouter>
	</StrictMode>,
);
