import XCTest

// Opens Safari's share sheet on the page it is showing, picks Pluck, and photographs what follows, every third of a
// second for nine seconds. XCUITest drives the Simulator from inside it: nothing is tapped on the Mac, and the
// Simulator needs no window. Run by scripts/share-sheet.sh, which says where the pictures go (SHOTS).
final class ShareSheetTests: XCTestCase {
  private let out = ProcessInfo.processInfo.environment["SHOTS"] ?? NSTemporaryDirectory()

  private func shot(_ name: String) {
    try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: "\(out)/\(name).png"))
  }

  func testPluckFromSafari() {
    let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
    safari.activate()
    var share = safari.buttons["ShareButton"] // in the toolbar on iPad and before iOS 26
    if !share.waitForExistence(timeout: 3) {
      let more = safari.buttons["MoreMenuButton"] // since iOS 26 an iPhone keeps Share in the page's menu
      for _ in 0..<3 {
        more.tap()
        share = safari.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH 'Share'")).firstMatch
        if share.waitForExistence(timeout: 3) { break }
      }
    }
    XCTAssertTrue(share.exists, "Safari shows no Share button")
    share.tap()
    let pluck = safari.cells["Pluck"].firstMatch
    XCTAssertTrue(pluck.waitForExistence(timeout: 8), "Pluck is not in the share sheet's row of apps")
    shot("0-share-sheet")
    pluck.tap()
    let start = Date()
    for i in 1...26 {
      usleep(250_000)
      shot(String(format: "%02d-%.1fs", i, Date().timeIntervalSince(start)))
    }
  }
}
