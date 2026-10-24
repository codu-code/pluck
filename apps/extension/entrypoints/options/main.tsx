import { createRoot } from "react-dom/client";
import "@/lib/base.css";
import "./options.css";
import { Options } from "./Options";

createRoot(document.getElementById("root")!).render(<Options />);
