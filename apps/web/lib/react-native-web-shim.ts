// What the Note editor's web build asks of "react-native" (next.config.ts aliases the name to this file): which
// platform it is on, and a colour as CSS already has it. The web app has no React Native in it.
export const Platform = { OS: "web" as const, select: <T,>(by: { web?: T; default?: T }) => by.web ?? by.default };
export const processColor = <T,>(color: T) => color;
