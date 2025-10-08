import "./utils/shim";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import "./index.css";

import { initIntl, LocaleProvider } from "./locale/index";
import RootRoute from "./route";
import { usePreferenceStore } from "./store/preference";

const lang = usePreferenceStore.getState().locale;
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
