import { createRoot } from "react-dom/client";
import { I18n } from "@/lib/i18n";
import "@/lib/base.css";
import "./options.css";
import { Options } from "./Options";

createRoot(document.getElementById("root")!).render(<I18n><Options /></I18n>);
