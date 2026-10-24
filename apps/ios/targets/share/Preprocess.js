// Safari runs this on the page before the share sheet opens. What the browser rendered (logins, paywalls,
// single-page apps) goes to Pluck, so the kept page is the one you were reading.
var Preprocess = function () {};
Preprocess.prototype = {
  run: function (args) {
    var og = document.querySelector('meta[property="og:image"]');
    var html = document.documentElement.outerHTML;
    args.completionFunction({
      url: document.URL,
      title: document.title,
      selection: String(window.getSelection() || ""),
      html: html.length <= 4000000 ? html : "",
      image: og ? og.content : "",
    });
  },
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Safari looks this global up by name
var ExtensionPreprocessingJS = new Preprocess();
