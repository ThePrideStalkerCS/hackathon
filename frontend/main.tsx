import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
// Laufzettel identity, loaded after the old stylesheet on purpose (it remaps the old tokens). See docs/redesign/LAUFZETTEL.md
import "./brand/brand.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
