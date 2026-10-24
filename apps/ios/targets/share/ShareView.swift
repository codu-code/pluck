import SwiftUI

// The sheet from the IOSShare board: "Plucked." at once, two tags and the last list, the kind, a note, Done.
// It closes itself after two seconds unless you start using it.

private extension Color {
  init(hex: UInt32) { self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255) }
}

private enum Palette {
  static func ground(_ dark: Bool) -> Color { dark ? Color(hex: 0x10130F) : Color(hex: 0xF6F8F4) }
  static func ink(_ dark: Bool) -> Color { dark ? Color(hex: 0xECEFE8) : Color(hex: 0x151A13) }
  static func ink2(_ dark: Bool) -> Color { dark ? Color(hex: 0xA0A898) : Color(hex: 0x525A4E) }
  static func chip(_ dark: Bool) -> Color { dark ? Color(hex: 0x252A22) : Color(hex: 0xE3E8DE) }
  static func surface(_ dark: Bool) -> Color { dark ? Color(hex: 0x191D17) : .white }
  static func line(_ dark: Bool) -> Color { dark ? Color(hex: 0x363C33) : Color(hex: 0xD3D9CE) }
  static let brand = Color(hex: 0x1E5C45)
  static let onBrand = Color(hex: 0xF6F8F4)
  static let mint = Color(hex: 0x7FD3AE)
  static let handle = Color(hex: 0xC3CABC)
  static let dashed = Color(hex: 0x9AA392)
}

private let kinds: [(key: String, name: String, d: String)] = [
  ("link", "Read", "M3 4.5h10M3 8h10M3 11.5h6"),
  ("video", "Watch", "M3.5 3h9a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7A1.5 1.5 0 0 1 3.5 3zM6.75 6v4l3.25-2z"),
  ("pdf", "PDF", "M4 2h5l3 3v9H4zM9 2v3h3M6 9h4M6 11.5h4"),
  ("image", "Image", "M3 3h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM2 11l3.5-3.5 3 3 2-2L14 12"),
  ("todo", "Todo", "M3.5 2.5h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM5.5 8.2l1.8 1.8 3.2-4"),
  ("note", "Note", "M3 13l.8-3L10.5 3.3l2.2 2.2L6 12.2zM9.3 4.5l2.2 2.2"),
  ("thing", "Thing", "M3 5.5h10l-.8 8.5H3.8zM6 5.5V4.5a2 2 0 0 1 4 0v1"),
]

@MainActor
final class ShareModel: ObservableObject {
  enum Phase { case working, plucked, queued, signedOut, failed(String) }
  @Published var phase: Phase = .working
  @Published var title = ""
  @Published var item: PluckedItem?
  @Published var tagIds: Set<String> = []
  @Published var addedToList = false
  @Published var note = ""
  @Published var engaged = false // a tap or the note field keeps the sheet open
  var close: () -> Void = {}
  var openApp: () -> Void = {}
  let client = PluckClient()
  lazy var tags = Array(client.tags.prefix(2))
  lazy var lastList = client.lastList

  func run(with inputs: [ShareInput]) async {
    guard client.session() != nil else { phase = .signedOut; return }
    guard !inputs.isEmpty else { phase = .failed("Nothing Pluck can keep here."); return }
    var queued = false
    for input in inputs {
      do {
        let plucked: PluckedItem?
        switch input {
        case let .page(url, title, selection, html):
          self.title = title ?? url
          var body: [String: Any] = ["url": url]
          if let title { body["title"] = title }
          if let selection { body["selection"] = selection }
          if let html { body["html"] = html }
          do { plucked = try await client.pluck(body) } catch PluckError.offline { client.queue(body: body); queued = true; continue }
        case let .text(text):
          self.title = String(text.prefix(80))
          do { plucked = try await client.pluck(["text": text]) } catch PluckError.offline { client.queue(body: ["text": text]); queued = true; continue }
        case let .file(url, name, contentType):
          self.title = name
          do { plucked = try await client.pluckFile(url, name: name, contentType: contentType) } catch PluckError.offline {
            client.queue(file: (url, name, contentType)); queued = true; continue
          }
        }
        if item == nil, let plucked { item = plucked; tagIds = Set(plucked.tagIds); if !plucked.title.isEmpty { self.title = plucked.title } }
      } catch PluckError.signedOut {
        phase = .signedOut; return
      } catch PluckError.refused(let message) {
        phase = .failed(message); return
      } catch {
        phase = .failed("That did not work."); return
      }
    }
    phase = queued && item == nil ? .queued : .plucked
    try? await Task.sleep(for: .seconds(2))
    if !engaged { finish() }
  }

  func toggle(_ tag: TagRef) {
    engaged = true
    guard let id = item?.id else { return }
    if tagIds.contains(tag.id) { tagIds.remove(tag.id) } else { tagIds.insert(tag.id) }
    let ids = Array(tagIds)
    Task { _ = try? await client.patch(id, ["tagIds": ids]) }
  }

  func addToList() {
    engaged = true
    guard let id = item?.id, let list = lastList, !addedToList else { return }
    addedToList = true
    Task { try? await client.addToList(list.id, id) }
  }

  func setKind(_ kind: String) {
    engaged = true
    guard let id = item?.id else { return }
    Task { if let updated = try? await client.patch(id, ["kind": kind]) { item = updated } }
  }

  func finish() {
    let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let id = item?.id, !trimmed.isEmpty else { return close() }
    Task {
      _ = try? await client.patch(id, ["note": trimmed])
      close()
    }
  }
}

struct ShareView: View {
  @ObservedObject var model: ShareModel
  @Environment(\.colorScheme) private var scheme
  @FocusState private var noteFocused: Bool
  private var dark: Bool { scheme == .dark }

  var body: some View {
    ZStack(alignment: .bottom) {
      Color.black.opacity(0.30).ignoresSafeArea().onTapGesture { model.finish() }
      VStack(alignment: .leading, spacing: 16) {
        Capsule().fill(Palette.handle).frame(width: 36, height: 5).frame(maxWidth: .infinity)
        content
      }
      .padding(EdgeInsets(top: 10, leading: 20, bottom: 34, trailing: 20))
      .background(Palette.ground(dark), in: UnevenRoundedRectangle(topLeadingRadius: 16, topTrailingRadius: 16))
    }
    .ignoresSafeArea(edges: .bottom)
    .onChange(of: noteFocused) { _, focused in if focused { model.engaged = true } }
  }

  @ViewBuilder private var content: some View {
    switch model.phase {
    case .working:
      HStack(spacing: 12) { ProgressView(); Text("Plucking…").foregroundStyle(Palette.ink2(dark)) }.frame(minHeight: 44)
    case .signedOut:
      Text("Not signed in.").font(.system(size: 22, weight: .bold)).foregroundStyle(Palette.ink(dark))
      Text("Sign in once. After that the share sheet does the rest.").foregroundStyle(Palette.ink2(dark))
      primary("Open Pluck to sign in") { model.openApp() }
    case .queued:
      header(title: "Plucked. Will sync.", subtitle: "It's on your phone. It goes up when you're back online.", size: 22)
      primary("Done") { model.close() }
    case let .failed(message):
      Text("Couldn't pluck that.").font(.system(size: 22, weight: .bold)).foregroundStyle(Palette.ink(dark))
      Text(message).foregroundStyle(Palette.ink2(dark))
      primary("Done") { model.close() }
    case .plucked:
      header(title: "Plucked.", subtitle: model.title, size: 24)
      if !model.tags.isEmpty || model.lastList != nil {
        VStack(alignment: .leading, spacing: 8) {
          label("Tags and list")
          HStack(spacing: 8) {
            ForEach(model.tags) { tag in chip(tag.name, on: model.tagIds.contains(tag.id)) { model.toggle(tag) } }
            if let list = model.lastList {
              Button { model.addToList() } label: {
                HStack(spacing: 6) { glyph("M8 3v10M3 8h10", size: 14, color: Palette.ink(dark), width: 1.6); Text(list.name).lineLimit(1) }
                  .padding(.horizontal, 14).frame(height: 44)
                  .background(model.addedToList ? Palette.chip(dark) : .clear, in: Capsule())
                  .overlay(Capsule().strokeBorder(Palette.dashed, style: StrokeStyle(lineWidth: 1.5, dash: model.addedToList ? [] : [4, 3])))
              }
              .foregroundStyle(Palette.ink(dark))
              .accessibilityLabel(model.addedToList ? "Added to \(list.name)" : "Add to \(list.name)")
            }
          }
        }
      }
      VStack(alignment: .leading, spacing: 8) {
        label("Kind")
        HStack {
          ForEach(kinds, id: \.key) { k in
            let on = model.item?.kind == k.key
            Button { model.setKind(k.key) } label: {
              glyph(k.d, size: 17, color: on ? Palette.onBrand : Palette.ink(dark), width: 1.4)
                .frame(width: 36, height: 44)
                .background(on ? Palette.ink(dark) : Palette.surface(dark), in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(on ? Palette.ink(dark) : Palette.line(dark)))
            }
            .accessibilityLabel(k.name)
            .accessibilityAddTraits(on ? .isSelected : [])
            .disabled(!["link", "video", "pdf", "image"].contains(k.key) || model.item == nil)
            if k.key != "thing" { Spacer(minLength: 0) }
          }
        }
      }
      TextField("Why you plucked it, in a line. Optional.", text: $model.note)
        .focused($noteFocused)
        .padding(.horizontal, 14).frame(height: 44)
        .background(Palette.surface(dark), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Palette.line(dark)))
        .submitLabel(.done)
        .onSubmit { model.finish() }
      primary("Done") { model.finish() }
    }
  }

  private func header(title: String, subtitle: String, size: CGFloat) -> some View {
    HStack(spacing: 12) {
      ZStack { Circle().fill(Palette.mint); glyph("M3.5 8.5l3 3 6-7", size: 24, color: Color(hex: 0x151A13), width: 2) }.frame(width: 44, height: 44)
      VStack(alignment: .leading, spacing: 0) {
        Text(title).font(.system(size: size, weight: .bold)).tracking(-0.7).foregroundStyle(Palette.ink(dark))
        Text(subtitle).lineLimit(1).truncationMode(.tail).foregroundStyle(Palette.ink2(dark))
      }
    }
  }

  private func label(_ text: String) -> some View { Text(text).font(.system(size: 13)).foregroundStyle(Palette.ink2(dark)) }

  private func chip(_ text: String, on: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(text).padding(.horizontal, 16).frame(height: 44)
        .background(on ? Palette.brand : Palette.chip(dark), in: Capsule())
        .foregroundStyle(on ? Palette.onBrand : Palette.ink(dark))
    }
    .accessibilityAddTraits(on ? .isSelected : [])
  }

  private func primary(_ text: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(text).fontWeight(.semibold).frame(maxWidth: .infinity, minHeight: 50).background(Palette.brand, in: RoundedRectangle(cornerRadius: 12)).foregroundStyle(Palette.onBrand)
    }
  }

  private func glyph(_ d: String, size: CGFloat, color: Color, width: CGFloat) -> some View {
    SVGPath(d: d).stroke(color, style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round)).frame(width: size, height: size)
  }
}
