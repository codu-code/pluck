import ExpoModulesCore
import UIKit

// Reads and sets the home screen icon (UIApplication alternate icons). nil is the primary icon.
public class AppIconModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppIcon")

    AsyncFunction("get") { () -> String? in
      UIApplication.shared.alternateIconName
    }.runOnQueue(.main)

    AsyncFunction("set") { (name: String?, promise: Promise) in
      guard UIApplication.shared.supportsAlternateIcons else {
        promise.reject("ERR_APP_ICON", "This device does not change app icons.")
        return
      }
      UIApplication.shared.setAlternateIconName(name) { error in
        if let error { promise.reject("ERR_APP_ICON", error.localizedDescription) } else { promise.resolve(nil) }
      }
    }.runOnQueue(.main)
  }
}
