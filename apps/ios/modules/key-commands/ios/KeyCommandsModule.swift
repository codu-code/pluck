import ExpoModulesCore
import UIKit

extension Notification.Name {
  static let pluckKeyCommand = Notification.Name("PluckKeyCommand")
}

// Every view controller can take a Pluck shortcut: UIKit sends a key command's action up the responder chain, and the
// chain from whatever has focus (a sheet included, through the controller that presented it) reaches the root one.
extension UIViewController {
  @objc func pluckKeyCommand(_ sender: UIKeyCommand) {
    NotificationCenter.default.post(name: .pluckKeyCommand, object: sender.propertyList)
  }
}

// Hardware keyboard shortcuts as UIKeyCommands with titles, so iPadOS lists them when ⌘ is held. The app says which
// commands exist (set); a command it runs comes back as an onKeyCommand event with its id. Commands marked
// typing: false (single letters, ⌘V, the arrows) step aside while a text field is being edited, so typing and
// pasting there work as they always do.
public class KeyCommandsModule: Module {
  private var all: [(command: UIKeyCommand, typing: Bool)] = []
  private var editing = false
  private var observers: [NSObjectProtocol] = []

  public func definition() -> ModuleDefinition {
    Name("KeyCommands")
    Events("onKeyCommand")

    OnCreate {
      let center = NotificationCenter.default
      self.observers = [
        center.addObserver(forName: .pluckKeyCommand, object: nil, queue: .main) { [weak self] note in
          if let id = note.object as? String { self?.sendEvent("onKeyCommand", ["id": id]) }
        },
      ]
      for (name, on) in [
        (UITextField.textDidBeginEditingNotification, true), (UITextField.textDidEndEditingNotification, false),
        (UITextView.textDidBeginEditingNotification, true), (UITextView.textDidEndEditingNotification, false),
      ] {
        self.observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
          self?.editing = on
          self?.install()
        })
      }
    }

    OnDestroy {
      self.observers.forEach { NotificationCenter.default.removeObserver($0) }
    }

    // [{ id, input, modifiers: ["command" | "shift" | "control" | "option"], title, typing }]; [] takes them all away.
    AsyncFunction("set") { (commands: [[String: Any]]) in
      self.all = commands.compactMap { c in
        guard let id = c["id"] as? String, let raw = c["input"] as? String, let title = c["title"] as? String else { return nil }
        let input = Self.input(raw)
        let command = UIKeyCommand(
          title: title, action: #selector(UIViewController.pluckKeyCommand(_:)), input: input,
          modifierFlags: Self.flags(c["modifiers"] as? [String] ?? []), propertyList: id, discoverabilityTitle: title)
        // The arrows and Escape are also wanted by scroll views and sheets; Pluck's take comes first.
        if input == UIKeyCommand.inputUpArrow || input == UIKeyCommand.inputDownArrow { command.wantsPriorityOverSystemBehavior = true }
        return (command, c["typing"] as? Bool ?? true)
      }
      self.install()
    }.runOnQueue(.main)
  }

  private func install() {
    guard let root = Self.root() else { return }
    root.keyCommands?.filter { $0.action == #selector(UIViewController.pluckKeyCommand(_:)) }.forEach { root.removeKeyCommand($0) }
    for (command, typing) in all where typing || !editing { root.addKeyCommand(command) }
  }

  private static func root() -> UIViewController? {
    let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows)
    return (windows.first(where: \.isKeyWindow) ?? windows.first)?.rootViewController
  }

  private static func input(_ raw: String) -> String {
    switch raw {
    case "escape": return UIKeyCommand.inputEscape
    case "up": return UIKeyCommand.inputUpArrow
    case "down": return UIKeyCommand.inputDownArrow
    case "return": return "\r"
    default: return raw
    }
  }

  private static func flags(_ names: [String]) -> UIKeyModifierFlags {
    names.reduce(into: UIKeyModifierFlags()) { f, n in
      switch n {
      case "command": f.insert(.command)
      case "shift": f.insert(.shift)
      case "control": f.insert(.control)
      case "option": f.insert(.alternate)
      default: break
      }
    }
  }
}
