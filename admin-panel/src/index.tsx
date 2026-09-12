import React from "react";
import { createRoot } from "react-dom/client";

import "./services/setupStepupInterceptor";
import App from "./App";
import { applyCmThemeVariables } from "./design-system/theme/tokens";
import "./i18n";
import "./global.css";
import "./styles/cibermandi-theme.css";

applyCmThemeVariables();

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
