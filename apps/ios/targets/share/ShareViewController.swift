import LinkPresentation
import SwiftUI
import UIKit
import UniformTypeIdentifiers

// The share extension's front door. It plucks as soon as it opens, in place; the app never opens
// (except once, to sign in). It must open fast and never crash, so it stays native and small.
final class ShareViewController: UIViewController {
  private let model = ShareModel()

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear
    model.close = { [weak self] in self?.extensionContext?.completeRequest(returningItems: nil) }
    model.openApp = { [weak self] in self?.open(URL(string: "pluck://signin")!) }
    let host = UIHostingController(rootView: ShareView(model: model))
    host.view.backgroundColor = .clear
    addChild(host)
    host.view.frame = view.bounds
    host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(host.view)
    host.didMove(toParent: self)
    Task { await model.run(with: Shared.inputs(from: extensionContext)) }
  }

  // Extensions cannot call UIApplication.open; the responder chain reaches the host app's application.
  private func open(_ url: URL) {
    var responder: UIResponder? = self
    while let r = responder {
      if let app = r as? UIApplication { app.open(url); break }
      responder = r.next
    }
    extensionContext?.completeRequest(returningItems: nil)
  }
}

enum ShareInput {
  case page(url: String, title: String?, selection: String?, html: String?)
  case text(String)
  case file(URL, name: String, contentType: String)
}

extension Shared {
  // What was shared, in the spec's order: a URL (with Safari's page), else text, else images and a PDF.
  static func inputs(from context: NSExtensionContext?) async -> [ShareInput] {
    sweep() // first, so it never meets a copy this share is still making
    let providers = (context?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
    var out: [ShareInput] = []
    for p in providers {
      if p.hasItemConformingToTypeIdentifier(UTType.propertyList.identifier),
         let dict = try? await p.loadItem(forTypeIdentifier: UTType.propertyList.identifier) as? NSDictionary,
         let page = dict[NSExtensionJavaScriptPreprocessingResultsKey] as? [String: Any], let url = page["url"] as? String {
        out.append(.page(url: url, title: page["title"] as? String, selection: (page["selection"] as? String).flatMap { $0.isEmpty ? nil : $0 },
                         html: (page["html"] as? String).flatMap { $0.isEmpty ? nil : $0 }))
      } else if p.hasItemConformingToTypeIdentifier(UTType.url.identifier), let url = try? await p.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
        // A file from Files is plucked only when it is a PDF or an image the API takes; anything else (a .docx) is left.
        if !url.isFileURL { out.append(.page(url: url.absoluteString, title: nil, selection: nil, html: nil)) }
        else if let contentType = mime(url), let kept = copy(url) { out.append(.file(kept, name: url.lastPathComponent, contentType: contentType)) }
      } else if p.hasItemConformingToTypeIdentifier(UTType.plainText.identifier), let text = try? await p.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
        out.append(.text(text))
      } else if let type = [UTType.pdf, UTType.image].first(where: { p.hasItemConformingToTypeIdentifier($0.identifier) }),
                let file = await fileRepresentation(p, type) {
        // The provider says it is a PDF or an image, so one whose extension says nothing goes as it always has.
        out.append(.file(file, name: p.suggestedName.map { "\($0).\(file.pathExtension)" } ?? file.lastPathComponent,
                         contentType: mime(file) ?? (type == .pdf ? "application/pdf" : "image/jpeg")))
      }
    }
    if out.contains(where: { if case .page = $0 { return true } else { return false } }) { out.removeAll { if case .text = $0 { return true } else { return false } } }
    return Array(out.prefix(10))
  }

  // Files are copied into the App Group, never loaded into memory (extensions get about 120 MB).
  private static func fileRepresentation(_ p: NSItemProvider, _ type: UTType) async -> URL? {
    await withCheckedContinuation { done in
      _ = p.loadFileRepresentation(forTypeIdentifier: type.identifier) { url, _ in done.resume(returning: url.flatMap(copy)) }
    }
  }

  private static func copy(_ url: URL) -> URL? {
    guard let dir = container?.appendingPathComponent("outgoing", isDirectory: true) else { return nil }
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let dest = dir.appendingPathComponent("\(UUID().uuidString).\(url.pathExtension.isEmpty ? "bin" : url.pathExtension)")
    guard (try? FileManager.default.copyItem(at: url, to: dest)) != nil else { return nil }
    try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: dest.path) // a copy keeps the original's date; sweep goes by when it was copied
    return dest
  }

  // A copy goes once its upload is done (PluckClient.pluckFile) or it is handed to the app's queue (PluckClient.queue).
  // One whose upload outlived the sheet, or that was never sent, goes here, a day on, the next time the sheet opens.
  static func sweep() {
    guard let dir = container?.appendingPathComponent("outgoing", isDirectory: true),
          let files = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.contentModificationDateKey]) else { return }
    let dayAgo = Date().addingTimeInterval(-86_400)
    for f in files where ((try? f.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate ?? .distantPast) < dayAgo {
      try? FileManager.default.removeItem(at: f)
    }
  }

  // A link shared from an app comes with no page. iOS's own link preview (what Messages shows) reads it from this
  // phone, as the person would see it, so a reel or a TikTok arrives with a name and a picture; the server never asks.
  @MainActor
  static func preview(of address: String) async -> (title: String?, jpeg: Data?) {
    guard let url = URL(string: address) else { return (nil, nil) }
    let provider = LPMetadataProvider()
    provider.timeout = 3 // the sheet is waiting; without it the server still names the link
    guard let m = try? await provider.startFetchingMetadata(for: url) else { return (nil, nil) }
    guard let p = m.imageProvider else { return (m.title, nil) }
    let image = await withCheckedContinuation { (done: CheckedContinuation<UIImage?, Never>) in
      _ = p.loadObject(ofClass: UIImage.self) { o, _ in done.resume(returning: o as? UIImage) }
    }
    return (m.title, image.flatMap(jpeg))
  }

  // At most 1080 points on the long side, at 1x, under the API's 2 MB.
  private static func jpeg(_ image: UIImage) -> Data? {
    guard image.size.width > 0, image.size.height > 0 else { return nil }
    let scale = min(1, 1080 / max(image.size.width, image.size.height))
    let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let data = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }.jpegData(compressionQuality: 0.8)
    return data.flatMap { $0.count <= 2_000_000 ? $0 : nil }
  }

  // The types the API takes as a file (shared-schemas FILE_TYPES), by what the file is, not a guess: nil for any other.
  private static func mime(_ url: URL) -> String? {
    guard let type = (try? url.resourceValues(forKeys: [.contentTypeKey]))?.contentType ?? UTType(filenameExtension: url.pathExtension) else { return nil }
    let taken: [(UTType, String)] = [(.pdf, "application/pdf"), (.jpeg, "image/jpeg"), (.png, "image/png"), (.heic, "image/heic"), (.webP, "image/webp"), (.gif, "image/gif")]
    return taken.first { type.conforms(to: $0.0) }?.1
  }
}
