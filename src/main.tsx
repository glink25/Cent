import "./utils/shim.ts";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import "./index.css";

import { getBrowserLang, initIntl, LocaleProvider } from "./locale/index.tsx";
import RootRoute from "./route.tsx";

const lang = getBrowserLang();
initIntl(lang).then(() => {
	createRoot(document.getElementById("root")!).render(
		<StrictMode>
			<LocaleProvider>
				<MemoryRouter>
					<RootRoute />
				</MemoryRouter>
			</LocaleProvider>
		</StrictMode>,
	);
});
