import { createRoot } from "react-dom/client";
import { I18n } from "@/lib/i18n";
import "@/lib/base.css";
import "./popup.css";
import { Popup } from "./Popup";

createRoot(document.getElementById("root")!).render(<I18n><Popup /></I18n>);
