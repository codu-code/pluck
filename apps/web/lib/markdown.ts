import MarkdownIt from "markdown-it";

// Kept pages are untrusted. Raw HTML is off (escaped, never rendered) and markdown-it refuses
// javascript:, vbscript:, file: and data: links. Links open outside; images never send a referrer.
const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

const defaultLink = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx]!.attrSet("target", "_blank");
  tokens[idx]!.attrSet("rel", "noopener noreferrer nofollow");
  return defaultLink(tokens, idx, options, env, self);
};
const defaultImage = md.renderer.rules.image!;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  tokens[idx]!.attrSet("loading", "lazy");
  tokens[idx]!.attrSet("referrerpolicy", "no-referrer");
  return defaultImage(tokens, idx, options, env, self);
};

export const renderReader = (markdown: string): string => md.render(markdown);
