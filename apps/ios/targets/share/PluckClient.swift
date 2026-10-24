import Foundation
import Security

// The share extension's side of the API. It shares the app's session (the Keychain item the app writes with
// expo-secure-store) and its App Group (tags, the last list, and anything waiting to sync).
enum Shared {
  static let group = "group.io.getpluck.app"
  static var defaults: UserDefaults? { UserDefaults(suiteName: group) }
  static var container: URL? { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) }
  static var pending: URL? {
    guard let dir = container?.appendingPathComponent("pending", isDirectory: true) else { return nil }
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }
}

struct Session: Codable {
  var server: String
  var clientId: String?
  var access: String?
  var refresh: String?
  var expiresAt: Double?
  var apiKey: String?
  var email: String?
}

struct TagRef: Codable, Identifiable, Hashable { let id: String; let name: String }
struct ListRef: Codable { let id: String; let name: String }
struct PluckedItem: Codable { let id: String; let title: String; let kind: String; let tagIds: [String] }

enum PluckError: Error { case signedOut, offline, refused(String) }

final class PluckClient {
  // expo-secure-store: service "<keychainService>:no-auth", account = the key's UTF-8 bytes.
  private let keychainQuery: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "pluck:no-auth",
    kSecAttrAccount as String: Data("session".utf8),
  ]

  func session() -> Session? {
    var query = keychainQuery
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var out: AnyObject?
    guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
    let session = try? JSONDecoder().decode(Session.self, from: data)
    return (session?.access != nil || session?.apiKey != nil) ? session : nil
  }

  private func save(_ session: Session) {
    guard let data = try? JSONEncoder().encode(session) else { return }
    SecItemUpdate(keychainQuery as CFDictionary, [kSecValueData as String: data] as CFDictionary)
  }

  // A key, or an access token refreshed a minute before it runs out (the app refreshes the same way).
  private func bearer() async throws -> (String, String) {
    guard var s = session() else { throw PluckError.signedOut }
    if let key = s.apiKey { return (s.server, "Bearer \(key)") }
    if let access = s.access, (s.expiresAt ?? 0) / 1000 - Date().timeIntervalSince1970 > 60 { return (s.server, "Bearer \(access)") }
    guard let refresh = s.refresh, let clientId = s.clientId, let url = URL(string: "\(s.server)/api/auth/oauth2/token") else { throw PluckError.signedOut }
    var req = URLRequest(url: url, timeoutInterval: 5)
    req.httpMethod = "POST"
    req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "content-type")
    var form = URLComponents()
    form.queryItems = [.init(name: "grant_type", value: "refresh_token"), .init(name: "refresh_token", value: refresh),
                       .init(name: "client_id", value: clientId), .init(name: "resource", value: "\(s.server)/api/v1")]
    req.httpBody = form.percentEncodedQuery?.data(using: .utf8)
    let (data, res) = try await send(req)
    guard (res as? HTTPURLResponse)?.statusCode == 200,
          let json = try JSONSerialization.jsonObject(with: data) as? [String: Any], let access = json["access_token"] as? String else { throw PluckError.signedOut }
    s.access = access
    s.refresh = (json["refresh_token"] as? String) ?? s.refresh
    s.expiresAt = (Date().timeIntervalSince1970 + ((json["expires_in"] as? Double) ?? 3600)) * 1000
    save(s)
    return (s.server, "Bearer \(access)")
  }

  private func send(_ req: URLRequest) async throws -> (Data, URLResponse) {
    do { return try await URLSession.shared.data(for: req) } catch { throw PluckError.offline }
  }

  private func call(_ method: String, _ path: String, _ body: [String: Any]?) async throws -> [String: Any] {
    let (server, auth) = try await bearer()
    guard let url = URL(string: server + path) else { throw PluckError.refused("Bad server address.") }
    var req = URLRequest(url: url, timeoutInterval: 5) // the share sheet must answer fast; slower means "will sync"
    req.httpMethod = method
    req.setValue(auth, forHTTPHeaderField: "authorization")
    if let body {
      req.setValue("application/json", forHTTPHeaderField: "content-type")
      req.httpBody = try JSONSerialization.data(withJSONObject: body)
    }
    let (data, res) = try await send(req)
    let status = (res as? HTTPURLResponse)?.statusCode ?? 0
    let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    if status == 401 { throw PluckError.signedOut }
    if status >= 500 || status == 429 { throw PluckError.offline }
    if status >= 400 { throw PluckError.refused(((json["error"] as? [String: Any])?["message"] as? String) ?? "That did not work.") }
    return json
  }

  private func item(from json: [String: Any]) -> PluckedItem? {
    guard let i = json["item"] as? [String: Any] ?? ((json["results"] as? [[String: Any]])?.first?["item"] as? [String: Any]),
          let data = try? JSONSerialization.data(withJSONObject: i) else { return nil }
    return try? JSONDecoder().decode(PluckedItem.self, from: data)
  }

  func pluck(_ body: [String: Any]) async throws -> PluckedItem? {
    item(from: try await call("POST", "/api/v1/items", body.merging(["source": "ios"]) { a, _ in a }))
  }

  func patch(_ id: String, _ body: [String: Any]) async throws -> PluckedItem? {
    item(from: try await call("PATCH", "/api/v1/items/\(id)", body))
  }

  func addToList(_ listId: String, _ itemId: String) async throws {
    _ = try await call("POST", "/api/v1/lists/\(listId)/items", ["itemId": itemId])
  }

  // A file: the item now, the bytes by a background upload that carries on after the sheet closes.
  func pluckFile(_ file: URL, name: String, contentType: String) async throws -> PluckedItem? {
    let size = (try? FileManager.default.attributesOfItem(atPath: file.path)[.size] as? Int) ?? 1
    let json = try await call("POST", "/api/v1/items/files", ["name": name, "contentType": contentType, "size": max(size, 1), "source": "ios"])
    guard let upload = (json["uploadUrl"] as? String).flatMap(URL.init(string:)) else { throw PluckError.refused("No upload address.") }
    var req = URLRequest(url: upload)
    req.httpMethod = "PUT"
    req.setValue(contentType, forHTTPHeaderField: "content-type")
    let config = URLSessionConfiguration.background(withIdentifier: "io.getpluck.share.\(UUID().uuidString)")
    config.sharedContainerIdentifier = Shared.group
    URLSession(configuration: config).uploadTask(with: req, fromFile: file).resume()
    return item(from: json)
  }

  // Offline: written to the App Group; the app sends it when it next opens.
  func queue(body: [String: Any]? = nil, file: (url: URL, name: String, contentType: String)? = nil) {
    guard let dir = Shared.pending else { return }
    let id = UUID().uuidString
    var record: [String: Any] = [:]
    if let body { record["body"] = body.merging(["source": "ios"]) { a, _ in a } }
    if let file {
      let kept = "pending/\(id).\(file.url.pathExtension)"
      if let container = Shared.container { try? FileManager.default.copyItem(at: file.url, to: container.appendingPathComponent(kept)) }
      record["file"] = ["name": file.name, "contentType": file.contentType, "path": kept]
    }
    if let data = try? JSONSerialization.data(withJSONObject: record) { try? data.write(to: dir.appendingPathComponent("\(id).json")) }
  }

  var tags: [TagRef] {
    guard let raw = Shared.defaults?.string(forKey: "tags"), let data = raw.data(using: .utf8) else { return [] }
    return (try? JSONDecoder().decode([TagRef].self, from: data)) ?? []
  }

  var lastList: ListRef? {
    guard let raw = Shared.defaults?.string(forKey: "lastList"), let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(ListRef.self, from: data)
  }
}
