// One static import per language, so every bundler (Next, Metro, WXT) inlines the catalogs.
import en from "./en.json";
import es from "./es.json";
import pt_BR from "./pt-BR.json";
import fr from "./fr.json";
import de from "./de.json";
import ja from "./ja.json";
import it from "./it.json";
import nl from "./nl.json";
import ko from "./ko.json";
import zh_Hans from "./zh-Hans.json";

export default { en, es, "pt-BR": pt_BR, fr, de, ja, it, nl, ko, "zh-Hans": zh_Hans };
