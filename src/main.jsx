import React from "react";
import ReactDOM from "react-dom/client";
/* The serif face ships with the app rather than loading from Google Fonts.
   Reading works offline, which it did not when the display face lived on a
   third party, and a private journal no longer announces every launch to
   another server. Subsets are unicode-ranged, so English text pulls only the
   latin files. */
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/newsreader/opsz-italic.css";
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
    /* A new build installs quietly and takes over the next time the app is
       launched from a cold start.

       It used to ask, and asking was broken: onNeedRefresh fires while the new
       worker is *waiting*, and activating it requires the updateSW function
       registerSW returns. This called reload() instead, so the old worker kept
       control, the new one kept reporting itself ready, and the prompt came
       back on every single load.

       No dialog now either way. This app does not interrupt writing with a
       system prompt, and it does not need to: navigations are served
       network-first, so any reload already fetches the current index.html and
       with it the current build. The worker is the offline shell, and a shell
       one launch behind costs nothing. */
    registerSW({ immediate: true });
  });
}
