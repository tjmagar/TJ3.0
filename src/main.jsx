import React from "react";
import ReactDOM from "react-dom/client";
import { installStorage } from "./storage.js";
import App from "./App.jsx";

installStorage();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({
      onNeedRefresh() {
        if (confirm("A new version of TJ 3.0 is ready. Reload now?")) {
          window.location.reload();
        }
      },
    });
  });
}
