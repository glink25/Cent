import "./utils/shim.ts";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import "./index.css";

import { initIntl, LocaleProvider } from "./locale/index.tsx";
import RootRoute from "./route.tsx";
import { getBrowserLang } from "./locale/utils.ts";

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
