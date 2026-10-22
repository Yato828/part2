import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const wide = new URLSearchParams(window.location.search).get("view") === "desk";
document.documentElement.classList.toggle("ext", !wide);
document.body.classList.toggle("ext", !wide);
document.documentElement.classList.toggle("extension-desk", wide);
if (wide)
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute("content", "width=device-width, initial-scale=1");
createRoot(document.getElementById("root")!).render(
  <App mode={wide ? "desk" : "popup"} active lit />,
);
