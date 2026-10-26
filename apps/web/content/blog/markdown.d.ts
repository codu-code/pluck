// Markdown files load as their text (the "*.md" rule in next.config.ts).
declare module "*.md" {
  const text: string;
  export default text;
}
