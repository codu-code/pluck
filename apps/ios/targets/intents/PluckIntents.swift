import AppIntents
import Foundation

// The extension's entry point. Without it the executable has no __swift5_entry and iOS refuses to install the app.
@main
struct PluckIntentsExtension: AppIntentsExtension {}

// "Pluck a link" and "Pluck a note", for Siri, Spotlight, Shortcuts and the Action button. They pluck the way the
// share sheet does: the same session, the same answers ("Plucked."), and with no connection the same queue, which
// the app sends when it next opens. The words are the share catalog's (packages/i18n/messages/share).

struct PluckLink: AppIntent {
  static let title: LocalizedStringResource = "intentLinkTitle"
  static let description = IntentDescription("intentLinkDescription")

  @Parameter(title: "intentLink")
  var link: URL

  func perform() async throws -> some IntentResult & ProvidesDialog {
    try await pluck(["url": link.absoluteString])
  }
}

struct PluckNote: AppIntent {
  static let title: LocalizedStringResource = "intentNoteTitle"
  static let description = IntentDescription("intentNoteDescription")

  @Parameter(title: "intentNoteText", inputOptions: String.IntentInputOptions(multiline: true))
  var text: String

  // No links: a Note. Links in it: each its own Item, as pasting into Add does.
  func perform() async throws -> some IntentResult & ProvidesDialog {
    try await pluck(["text": text, "clientKey": UUID().uuidString]) // sent and, with no answer, queued under one key: never two Notes
  }
}

enum PluckIntentError: Error, CustomLocalizedStringResourceConvertible {
  case signedOut, refused(String)
  var localizedStringResource: LocalizedStringResource {
    switch self {
    case .signedOut: return "openToSignIn"
    case .refused(let message): return "\(message)"
    }
  }
}

private func pluck(_ body: [String: Any]) async throws -> some IntentResult & ProvidesDialog {
  let client = PluckClient()
  guard client.session() != nil else { throw PluckIntentError.signedOut }
  do {
    _ = try await client.pluck(body)
    return .result(dialog: IntentDialog(LocalizedStringResource("plucked")))
  } catch PluckError.offline {
    client.queue(body: body) // goes up when the app next opens with a connection
    return .result(dialog: IntentDialog(LocalizedStringResource("queuedTitle")))
  } catch PluckError.signedOut {
    throw PluckIntentError.signedOut
  } catch PluckError.refused(let message) {
    throw PluckIntentError.refused(message)
  }
}

// The phrases Siri and Spotlight know, in every language (AppShortcuts.xcstrings, from the share catalog's phrase*).
struct PluckShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: PluckLink(), phrases: ["Pluck a link with \(.applicationName)"], shortTitle: "intentLinkTitle", systemImageName: "link")
    AppShortcut(intent: PluckNote(), phrases: ["Pluck a note with \(.applicationName)"], shortTitle: "intentNoteTitle", systemImageName: "square.and.pencil")
  }
}
