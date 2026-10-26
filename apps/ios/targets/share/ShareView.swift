import SwiftUI

// The sheet from the IOSShare board: "Plucked." at once, the title, two tags and the last list, the kind, a note, Done.
// It stays until Done or a tap outside (the board closed it after two seconds, too soon to write anything).

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

// Geist, as in the app; each size follows the reader's text size setting.
private enum Typeface {
  static let heading = Font.custom("Geist-Bold", size: 24, relativeTo: .title)
  static let title = Font.custom("Geist-SemiBold", size: 17, relativeTo: .body)
  static let body = Font.custom("Geist-Regular", size: 17, relativeTo: .body)
  static let chip = Font.custom("Geist-Regular", size: 15, relativeTo: .subheadline)
  static let label = Font.custom("Geist-Regular", size: 13, relativeTo: .footnote)
  static let button = Font.custom("Geist-SemiBold", size: 17, relativeTo: .body)
}

private let kinds: [(key: String, name: String, d: String)] = [
  ("link", String(localized: "kindRead"), "M3 4.5h10M3 8h10M3 11.5h6"),
  ("video", String(localized: "kindWatch"), "M3.5 3h9a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7A1.5 1.5 0 0 1 3.5 3zM6.75 6v4l3.25-2z"),
  ("pdf", String(localized: "kindPdf"), "M4 2h5l3 3v9H4zM9 2v3h3M6 9h4M6 11.5h4"),
  ("image", String(localized: "kindImage"), "M3 3h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM2 11l3.5-3.5 3 3 2-2L14 12"),
  ("todo", String(localized: "kindTodo"), "M3.5 2.5h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM5.5 8.2l1.8 1.8 3.2-4"),
  ("note", String(localized: "kindNote"), "M3 13l.8-3L10.5 3.3l2.2 2.2L6 12.2zM9.3 4.5l2.2 2.2"),
  ("thing", String(localized: "kindThing"), "M3 5.5h10l-.8 8.5H3.8zM6 5.5V4.5a2 2 0 0 1 4 0v1"),
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
  @Published private(set) var finishing = false
  private var titleEdited = false // only a title the person typed goes up, never the one shown
  private var work: [Task<Void, Never>] = [] // tags, list, kind and covers still on their way up
  var close: () -> Void = {}
  var openApp: () -> Void = {}
  let client = PluckClient()
  lazy var tags = Array(client.tags.prefix(2))
  lazy var lastList = client.lastList

  // shared-schemas isRenameable, the same rule: a reel, a post or a picture often comes with no title of its own, and
  // nor does a link whose title is still its address, so it can be named here. An article keeps its page's.
  var renameable: Bool {
    guard let item else { return false }
    return item.preview == "player" || item.preview == "post" || item.kind == "image" || (item.titleIsDerived == true && item.title == item.url)
  }

  // The title field: what the person types there, and only that, is sent as the new title.
  var editableTitle: Binding<String> {
    Binding(get: { self.title }, set: { self.title = $0; self.titleEdited = true })
  }

  func run(with inputs: [ShareInput]) async {
    guard client.session() != nil else { phase = .signedOut; return }
    guard !inputs.isEmpty else { phase = .failed(String(localized: "nothingToKeep")); return }
    var queued = false
    var covers: [(id: String, jpeg: Data)] = []
    for input in inputs {
      do {
        let plucked: PluckedItem?
        switch input {
        case let .page(url, title, selection, html):
          if item == nil { self.title = title ?? url } // the sheet is about the first thing shared
          let preview = html == nil ? await Shared.preview(of: url) : nil // from an app, not Safari
          var body: [String: Any] = ["url": url]
          if let title = title ?? preview?.title { body["title"] = title }
          if let selection { body["selection"] = selection }
          if let html { body["html"] = html }
          do { plucked = try await client.pluck(body) } catch PluckError.offline { client.queue(body: body); queued = true; continue }
          if let plucked, plucked.hasCover != true, let jpeg = preview?.jpeg { covers.append((plucked.id, jpeg)) }
        case let .text(text):
          if item == nil { self.title = String(text.prefix(80)) }
          do { plucked = try await client.pluck(["text": text]) } catch PluckError.offline { client.queue(body: ["text": text]); queued = true; continue }
        case let .file(url, name, contentType):
          if item == nil { self.title = name }
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
        phase = .failed(String(localized: "didNotWork")); return
      }
    }
    phase = queued && item == nil ? .queued : .plucked
    for c in covers { work.append(Task { [client] in await client.putCover(c.id, jpeg: c.jpeg) }) } // while the sheet is open
  }

  func toggle(_ tag: TagRef) {
    guard let id = item?.id else { return }
    if tagIds.contains(tag.id) { tagIds.remove(tag.id) } else { tagIds.insert(tag.id) }
    let ids = Array(tagIds)
    work.append(Task { [client] in _ = try? await client.patch(id, ["tagIds": ids]) })
  }

  func addToList() {
    guard let id = item?.id, let list = lastList, !addedToList else { return }
    addedToList = true
    work.append(Task { [client] in try? await client.addToList(list.id, id) })
  }

  func setKind(_ kind: String) {
    guard let id = item?.id else { return }
    work.append(Task { if let updated = try? await client.patch(id, ["kind": kind]) { item = updated } })
  }

  // Done or a tap outside: the note and a typed title go up, and what was tapped finishes, before the sheet closes.
  // The wait is capped: a cover that is slow to upload is not worth holding the sheet open for.
  func finish() {
    guard !finishing else { return }
    finishing = true
    var edit: [String: Any] = [:]
    let typedNote = String(note.trimmingCharacters(in: .whitespacesAndNewlines).prefix(10_000)) // the API's limits
    let typedTitle = String(title.components(separatedBy: .newlines).joined(separator: " ").trimmingCharacters(in: .whitespaces).prefix(500))
    if !typedNote.isEmpty { edit["note"] = typedNote }
    if renameable, titleEdited, !typedTitle.isEmpty, typedTitle != item?.title { edit["title"] = typedTitle }
    let pending = work
    Task {
      await withTaskGroup(of: Void.self) { group in
        group.addTask { for t in pending { await t.value } }
        group.addTask { try? await Task.sleep(for: .seconds(4)) }
        await group.next() // whichever is first
        group.cancelAll()
      }
      if let id = item?.id, !edit.isEmpty { _ = try? await client.patch(id, edit) }
      close()
    }
  }
}

struct ShareView: View {
  @ObservedObject var model: ShareModel
  @Environment(\.colorScheme) private var scheme
  @State private var formHeight: CGFloat = 0 // the form's own height: it scrolls only when the keyboard leaves less room
  private var dark: Bool { scheme == .dark }

  var body: some View {
    ZStack(alignment: .bottom) {
      Color.black.opacity(0.30).ignoresSafeArea().onTapGesture { model.finish() }
      VStack(alignment: .leading, spacing: 16) {
        Capsule().fill(Palette.handle).frame(width: 36, height: 5).frame(maxWidth: .infinity)
        content
      }
      .padding(EdgeInsets(top: 10, leading: 20, bottom: 16, trailing: 20))
      .background {
        UnevenRoundedRectangle(topLeadingRadius: 16, topTrailingRadius: 16).fill(Palette.ground(dark)).ignoresSafeArea(.container, edges: .bottom)
      }
    }
    .font(Typeface.body)
    .foregroundStyle(Palette.ink(dark))
  }

  @ViewBuilder private var content: some View {
    switch model.phase {
    case .working:
      HStack(spacing: 12) { ProgressView(); Text("plucking").foregroundStyle(Palette.ink2(dark)) }.frame(minHeight: 44)
    case .signedOut:
      Text("signedOutTitle").font(Typeface.heading)
      Text("signedOutBody").foregroundStyle(Palette.ink2(dark))
      primary("openToSignIn") { model.openApp() }
    case .queued:
      header(String(localized: "queuedTitle"), subtitle: String(localized: "queuedBody"))
      primary("done") { model.close() }
    case let .failed(message):
      Text("failedTitle").font(Typeface.heading)
      Text(message).foregroundStyle(Palette.ink2(dark))
      primary("done") { model.close() }
    case .plucked:
      header(String(localized: "plucked"), subtitle: model.renameable ? model.item?.siteName : model.title)
      // What you came to change comes first, so the keyboard never hides it; Done stays above the keyboard.
      ScrollView {
        form.onGeometryChange(for: CGFloat.self) { $0.size.height } action: { formHeight = $0 }
      }
      .scrollBounceBehavior(.basedOnSize)
      .scrollDismissesKeyboard(.interactively)
      .frame(maxHeight: formHeight)
      primary("done", busy: model.finishing) { model.finish() }
    }
  }

  private var form: some View {
    VStack(alignment: .leading, spacing: 16) {
      if model.renameable {
        group("title") {
          TextField("title", text: model.editableTitle, axis: .vertical).lineLimit(1...3).font(Typeface.title).boxed(dark)
        }
      }
      group("note") {
        TextField("notePlaceholder", text: $model.note, axis: .vertical).lineLimit(2...6).boxed(dark)
      }
      if !model.tags.isEmpty || model.lastList != nil {
        group("tagsAndList") {
          HStack(spacing: 8) {
            ForEach(model.tags) { tag in chip(tag.name, on: model.tagIds.contains(tag.id)) { model.toggle(tag) } }
            if let list = model.lastList {
              Button { model.addToList() } label: {
                HStack(spacing: 6) { glyph("M8 3v10M3 8h10", size: 14, color: Palette.ink(dark), width: 1.6); Text(list.name).lineLimit(1) }
                  .font(Typeface.chip)
                  .padding(.horizontal, 14).frame(height: 44)
                  .background(model.addedToList ? Palette.chip(dark) : .clear, in: Capsule())
                  .overlay(Capsule().strokeBorder(Palette.dashed, style: StrokeStyle(lineWidth: 1.5, dash: model.addedToList ? [] : [4, 3])))
              }
              .accessibilityLabel(String(format: model.addedToList ? String(localized: "addedToList") : String(localized: "addToList"), list.name))
            }
          }
        }
      }
      group("kind") {
        HStack {
          ForEach(kinds, id: \.key) { k in
            let on = model.item?.kind == k.key
            Button { model.setKind(k.key) } label: {
              glyph(k.d, size: 17, color: on ? Palette.ground(dark) : Palette.ink(dark), width: 1.4) // the reverse of the rest, in both themes
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
    }
  }

  private func group(_ name: LocalizedStringKey, @ViewBuilder _ body: () -> some View) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(name).font(Typeface.label).foregroundStyle(Palette.ink2(dark))
      body()
    }
  }

  private func header(_ title: String, subtitle: String?) -> some View {
    HStack(spacing: 12) {
      ZStack { Circle().fill(Palette.mint); glyph("M3.5 8.5l3 3 6-7", size: 24, color: Color(hex: 0x151A13), width: 2) }.frame(width: 44, height: 44)
      VStack(alignment: .leading, spacing: 0) {
        Text(title).font(Typeface.heading).tracking(-0.7)
        if let subtitle { Text(subtitle).lineLimit(1).truncationMode(.tail).foregroundStyle(Palette.ink2(dark)) }
      }
    }
  }

  private func chip(_ text: String, on: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(text).font(Typeface.chip).padding(.horizontal, 16).frame(height: 44)
        .background(on ? Palette.brand : Palette.chip(dark), in: Capsule())
        .foregroundStyle(on ? Palette.onBrand : Palette.ink(dark))
    }
    .accessibilityAddTraits(on ? .isSelected : [])
  }

  // busy: what was changed is still going up; the label stays for VoiceOver, hidden behind the spinner.
  private func primary(_ text: LocalizedStringKey, busy: Bool = false, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Text(text).font(Typeface.button).opacity(busy ? 0 : 1)
        .overlay { if busy { ProgressView().tint(Palette.onBrand) } }
        .frame(maxWidth: .infinity, minHeight: 50).background(Palette.brand, in: RoundedRectangle(cornerRadius: 12)).foregroundStyle(Palette.onBrand)
    }
    .disabled(busy)
  }

  private func glyph(_ d: String, size: CGFloat, color: Color, width: CGFloat) -> some View {
    SVGPath(d: d).stroke(color, style: StrokeStyle(lineWidth: width, lineCap: .round, lineJoin: .round)).frame(width: size, height: size)
  }
}

private extension View {
  // A field on the sheet: the surface, a hairline, 44 points at least.
  func boxed(_ dark: Bool) -> some View {
    padding(.horizontal, 14).padding(.vertical, 11).frame(minHeight: 44)
      .background(Palette.surface(dark), in: RoundedRectangle(cornerRadius: 10))
      .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Palette.line(dark)))
  }
}

