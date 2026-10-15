import SafariServices
import Security
import UserNotifications
import AppKit

private struct SafeError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

private enum Vault {
    static var query: [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "GmailJev.TypeSafe", kSecAttrAccount as String: "api-key"] }
    static func read() throws -> String? {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data, let key = String(data: data, encoding: .utf8) else {
            throw SafeError(message: "No se puede acceder al llavero. Desbloquea el Mac y vuelve a intentarlo.")
        }
        return key
    }
    static func save(_ key: String) throws {
        let data = Data(key.utf8)
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var request = query
            request[kSecValueData as String] = data
            request[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            guard SecItemAdd(request as CFDictionary, nil) == errSecSuccess else { throw SafeError(message: "No se pudo guardar la clave en el llavero.") }
        } else if status != errSecSuccess { throw SafeError(message: "No se pudo actualizar la clave en el llavero.") }
    }
    static func delete() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw SafeError(message: "No se pudo borrar la clave del llavero.") }
    }
}

// Redirects are never followed: a credential must only reach api.typesafe.ai.
private final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems.first as? NSExtensionItem,
              let message = item.userInfo?[SFExtensionMessageKey] as? [String: Any] else {
            complete(context, ["ok": false, "error": "Solicitud no válida."])
            return
        }
        // Intentionally never log message: it can contain a secret or email content.
        Task {
            do { complete(context, try await handle(message)) }
            catch { complete(context, ["ok": false, "error": (error as? SafeError)?.message ?? "No se pudo completar la operación. Comprueba la conexión."]) }
        }
    }
    private func complete(_ context: NSExtensionContext, _ value: [String: Any]) {
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: value]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
    private func handle(_ message: [String: Any]) async throws -> [String: Any] {
        switch message["command"] as? String {
        case "keyStatus": return ["ok": true, "configured": try Vault.read() != nil]
        case "saveKey":
            guard let raw = message["key"] as? String else { throw SafeError(message: "Introduce tu clave de TypeSafe.") }
            let key = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard key.count >= 16, key.count <= 512, key.unicodeScalars.allSatisfy({ $0.value >= 33 && $0.value <= 126 }) else { throw SafeError(message: "La clave no tiene un formato válido.") }
            try Vault.save(key)
            return ["ok": true]
        case "deleteKey": try Vault.delete(); return ["ok": true]
        case "evaluate":
            guard let key = try Vault.read() else { throw SafeError(message: "Configura tu clave de TypeSafe en los ajustes.") }
            guard let request = message["request"] as? [String: Any],
                  let model = request["model"] as? String, ["jev-1.13.0", "jev-1.14.0"].contains(model),
                  let questions = request["questions"] as? [String: Any], questions.count == 1,
                  let question = questions["notify"] as? [String: Any], question["type"] as? String == "noul",
                  request["state"] is [String: Any], JSONSerialization.isValidJSONObject(request) else { throw SafeError(message: "Solicitud de evaluación no válida.") }
            let body = try JSONSerialization.data(withJSONObject: request)
            guard body.count <= 96000 else { throw SafeError(message: "El correo supera el tamaño permitido.") }
            var http = URLRequest(url: URL(string: "https://api.typesafe.ai/v1/systemone")!)
            http.httpMethod = "POST"
            http.timeoutInterval = 30
            http.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
            http.setValue("application/json", forHTTPHeaderField: "Content-Type")
            http.httpBody = body
            let configuration = URLSessionConfiguration.ephemeral
            configuration.timeoutIntervalForRequest = 30
            configuration.timeoutIntervalForResource = 35
            configuration.httpCookieStorage = nil
            configuration.urlCache = nil
            let session = URLSession(configuration: configuration, delegate: NoRedirects(), delegateQueue: nil)
            defer { session.invalidateAndCancel() }
            let (data, response): (Data, URLResponse)
            do { (data, response) = try await session.data(for: http) }
            catch { throw SafeError(message: "TypeSafe no responde. Comprueba la wifi; se reintentará con espera.") }
            guard let response = response as? HTTPURLResponse else { throw SafeError(message: "Respuesta de TypeSafe no válida.") }
            switch response.statusCode {
            case 200: break
            case 401, 403: throw SafeError(message: "Clave rechazada por TypeSafe (\(response.statusCode)). Revísala en ajustes.")
            case 429, 529: throw SafeError(message: "TypeSafe está ocupado (\(response.statusCode)). Se reintentará con espera.")
            default: throw SafeError(message: "TypeSafe devolvió HTTP \(response.statusCode). Consulta sus ajustes de cuenta.")
            }
            guard data.count <= 65536,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let answers = json["answers"] as? [String: Any],
                  let answer = answers["notify"] as? [String: Any], answer["type"] as? String == "noul",
                  let probability = answer["noul"] as? NSNumber, CFGetTypeID(probability) != CFBooleanGetTypeID(),
                  probability.doubleValue.isFinite, (0...1).contains(probability.doubleValue),
                  let answeredModel = json["model"] as? String else { throw SafeError(message: "Respuesta de Jev no válida.") }
            let usage = json["usage"] as? [String: Any]
            return ["ok": true, "probability": probability.doubleValue, "model": answeredModel, "inputTokens": usage?["input_tokens"] as? Int ?? 0]
        case "notify":
            guard let title = message["title"] as? String, let body = message["body"] as? String,
                  let rawURL = message["url"] as? String, let url = URL(string: rawURL),
                  url.scheme == "https", url.host == "mail.google.com", url.user == nil, url.password == nil,
                  url.port == nil, url.path.hasPrefix("/mail/u/") else { throw SafeError(message: "Aviso no válido.") }
            let style = message["style"] as? String ?? "both"
            guard ["both", "system", "panel"].contains(style) else { throw SafeError(message: "Tipo de aviso no válido.") }
            let payload = try JSONSerialization.data(withJSONObject: ["title":String(title.prefix(180)), "sender":String(body.prefix(300)), "url":url.absoluteString, "style":style])
            var components = URLComponents()
            components.scheme = "gmailjev"
            components.host = "notice"
            components.queryItems = [URLQueryItem(name:"payload", value:payload.base64EncodedString())]
            let appURL = Bundle.main.bundleURL.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            guard let noticeURL = components.url, appURL.pathExtension == "app" else { throw SafeError(message: "No se encuentra la app para los avisos.") }
            let configuration = NSWorkspace.OpenConfiguration()
            configuration.activates = false
            configuration.addsToRecentItems = false
            do {
                let _: NSRunningApplication = try await withCheckedThrowingContinuation { continuation in
                    NSWorkspace.shared.open([noticeURL], withApplicationAt: appURL, configuration: configuration) { app, error in
                        if let app { continuation.resume(returning:app) }
                        else { continuation.resume(throwing:error ?? SafeError(message:"No se pudo abrir la app de avisos.")) }
                    }
                }
            } catch { throw SafeError(message:"No se pudo abrir GmailJev. Abre la app y vuelve a probar.") }
            return ["ok": true, "warning": "Solicitud enviada a GmailJev. Comprueba el aviso; el diagnóstico está en la app."]
        default: throw SafeError(message: "Acción nativa desconocida.")
        }
    }
}
