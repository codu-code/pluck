import { createRoot } from "react-dom/client";
import { I18n } from "@/lib/i18n";
import { t } from "@/lib/t";
import "@/lib/base.css";
import "./options.css";
import { Options } from "./Options";

document.title = t("options.title");
createRoot(document.getElementById("root")!).render(<I18n><Options /></I18n>);
