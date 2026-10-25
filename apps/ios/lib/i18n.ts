import "./plurals";
import { matchLocale, messagesFor } from "@pluck/i18n";
import { getCalendars, getLocales } from "expo-localization";

// The iPhone's language (or the one picked for Pluck in iOS Settings, which restarts the app), read once at launch.
export const locale = matchLocale(getLocales().map((l) => l.languageTag));
export const timeZone = getCalendars()[0]?.timeZone ?? "UTC";
export const messages = { ios: messagesFor("ios", locale) };
