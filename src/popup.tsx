import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

document.documentElement.classList.add("ext");
document.body.classList.add("ext");
createRoot(document.getElementById("root")!).render(<App mode="popup" active lit />);
