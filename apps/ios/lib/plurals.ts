// Hermes on iOS has no Intl.PluralRules, which use-intl needs for every "{count, plural, …}" message: without it the
// key shows instead ("ios.settings.days"). The polyfill steps in only where it is missing, with Pluck's languages.
import "@formatjs/intl-pluralrules/polyfill.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-pluralrules/locale-data/es.js";
import "@formatjs/intl-pluralrules/locale-data/pt.js";
import "@formatjs/intl-pluralrules/locale-data/fr.js";
import "@formatjs/intl-pluralrules/locale-data/de.js";
import "@formatjs/intl-pluralrules/locale-data/ja.js";
import "@formatjs/intl-pluralrules/locale-data/it.js";
import "@formatjs/intl-pluralrules/locale-data/nl.js";
import "@formatjs/intl-pluralrules/locale-data/ko.js";
import "@formatjs/intl-pluralrules/locale-data/zh.js";
