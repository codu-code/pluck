// Local stand-in for the design canvas runtime, which the handover did not include.
// Supports what the boards use: <x-dc>, <helmet>, {{expr}}, <sc-for>, <sc-if>, <dc-import>, DCLogic with state.
// Serve this folder over http (dc-import fetches sibling boards).
(function () {
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) { Object.assign(this.state, patch); if (this._rerender) this._rerender(); }
    renderVals() { return {}; }
  }

  const evalIn = (expr, scope) => {
    try { return new Function("s", "with(s){return (" + expr + ")}")(scope); }
    catch { return undefined; }
  };
  const whole = /^\s*\{\{([\s\S]*?)\}\}\s*$/;
  const interp = (str, scope) => {
    const m = str.match(whole);
    if (m) return evalIn(m[1], scope);
    return str.replace(/\{\{([\s\S]*?)\}\}/g, (_, e) => { const v = evalIn(e, scope); return v == null ? "" : String(v); });
  };

  const cache = {};
  const load = (name) => cache[name] || (cache[name] = fetch(name + ".dc.html").then((r) => r.text()).then(parseBoard));

  function parseBoard(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const xdc = doc.querySelector("x-dc");
    const helmet = xdc && xdc.querySelector("helmet");
    if (helmet) helmet.remove();
    const script = doc.querySelector("script[data-dc-script]");
    const Component = script
      ? new Function("DCLogic", script.textContent + "\n;return typeof Component !== 'undefined' ? Component : DCLogic;")(DCLogic)
      : DCLogic;
    return { template: xdc ? xdc.innerHTML : "", helmet: helmet ? helmet.innerHTML : "", Component };
  }

  function addHelmet(html) {
    if (!html || addHelmet.seen.has(html)) return;
    addHelmet.seen.add(html);
    const t = document.createElement("template");
    t.innerHTML = html;
    document.head.append(t.content);
  }
  addHelmet.seen = new Set();

  function renderChildren(src, scope, out) {
    for (const child of Array.from(src.childNodes)) renderNode(child, scope, out);
  }

  function renderNode(node, scope, out) {
    if (node.nodeType === 3) { out.append(document.createTextNode(interp(node.textContent, scope) ?? "")); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === "sc-for") {
      const list = interp(node.getAttribute("list") || "", scope) || [];
      const as = node.getAttribute("as") || "item";
      for (const item of list) renderChildren(node, Object.assign(Object.create(scope), { [as]: item }), out);
      return;
    }
    if (tag === "sc-if") {
      if (interp(node.getAttribute("value") || "", scope)) renderChildren(node, scope, out);
      return;
    }
    if (tag === "dc-import") {
      const props = {};
      for (const a of Array.from(node.attributes)) if (a.name !== "name" && !a.name.startsWith("hint-")) props[a.name] = interp(a.value, scope);
      const slot = document.createElement("span");
      slot.style.display = "contents";
      out.append(slot);
      mount(node.getAttribute("name"), props, slot);
      return;
    }
    const el = document.createElementNS(node.namespaceURI, node.tagName);
    for (const a of Array.from(node.attributes)) {
      const v = interp(a.value, scope);
      if (/^on[A-Z]/.test(a.name) || (a.name.startsWith("on") && typeof v === "function")) {
        if (typeof v === "function") el.addEventListener(a.name.slice(2).toLowerCase(), v);
        continue;
      }
      if (v === false || v == null) continue;
      el.setAttribute(a.name, v === true ? "" : v);
    }
    renderChildren(node.content || node, scope, el);
    out.append(el);
  }

  function renderBoard(board, instance, target) {
    const t = document.createElement("template");
    t.innerHTML = board.template;
    const draw = () => {
      const frag = document.createDocumentFragment();
      renderChildren(t.content, instance.renderVals() || {}, frag);
      target.replaceChildren(frag);
    };
    instance._rerender = draw;
    draw();
  }

  async function mount(name, props, target) {
    const board = await load(name);
    addHelmet(board.helmet);
    renderBoard(board, new board.Component(props), target);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const board = parseBoard(document.documentElement.outerHTML);
    document.querySelectorAll("helmet").forEach((h) => h.remove());
    addHelmet(board.helmet);
    const root = document.createElement("div");
    document.querySelector("x-dc").replaceWith(root);
    document.querySelectorAll("script[data-dc-script]").forEach((s) => s.remove());
    renderBoard(board, new board.Component({}), root);
  });
})();
