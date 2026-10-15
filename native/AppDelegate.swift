import Cocoa
import UserNotifications

@main
class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    private var notices: [FloatingNotice] = []
    private var launched = false
    private var pending: [[String:String]] = []
    private(set) var deliveryStatus = "Todavía no se ha recibido un aviso."
    func applicationDidFinishLaunching(_ notification: Notification) {
        UNUserNotificationCenter.current().delegate = self
        launched = true
        let queued = pending
        pending.removeAll()
        queued.forEach { deliver($0) }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if let setup = sender.windows.first(where: { !($0 is NSPanel) }) {
            setup.makeKeyAndOrderFront(nil)
        } else {
            let storyboard = NSStoryboard(name:"Main",bundle:nil)
            if let controller = storyboard.instantiateInitialController() as? NSWindowController {
                setupController = controller
                controller.showWindow(nil)
            }
        }
        return true
    }
    private var setupController: NSWindowController?
    func testNotifications() {
        deliver(["title":"Gmail con Jev está preparado", "sender":"Este es un aviso de prueba.", "url":"https://mail.google.com/mail/u/0/#inbox", "style":"both"])
    }
    private func status(_ value: String) {
        deliveryStatus = value
        NotificationCenter.default.post(name:Notification.Name("GmailJevDeliveryStatus"),object:nil)
    }
    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls {
            guard url.scheme == "gmailjev", url.host == "notice",
                  let components = URLComponents(url:url, resolvingAgainstBaseURL:false),
                  let encoded = components.queryItems?.first(where:{$0.name == "payload"})?.value,
                  encoded.count <= 6000, let data = Data(base64Encoded:encoded),
                  let payload = try? JSONSerialization.jsonObject(with:data) as? [String:String],
                  let raw = payload["url"], let gmail = URL(string:raw), gmail.scheme == "https", gmail.host == "mail.google.com", gmail.user == nil, gmail.password == nil else { continue }
            guard url.port == nil, gmail.port == nil, gmail.path.hasPrefix("/mail/u/") else { continue }
            if launched { deliver(payload) } else { pending.append(payload) }
        }
    }
    private func deliver(_ payload: [String:String]) {
        guard let raw = payload["url"], let gmail = URL(string:raw) else { return }
        let style = payload["style"] ?? "both"
        guard ["both","system","panel"].contains(style) else { return }
        var panelStatus = ""
        if style != "system" {
            notices.forEach { $0.close() }
            notices.removeAll()
            let notice = FloatingNotice(title:payload["title"] ?? "Nuevo correo relevante", sender:payload["sender"] ?? "", url:gmail)
            notices.append(notice)
            notice.orderFrontRegardless()
            panelStatus = notice.isVisible ? "Ventana flotante visible." : "No se pudo mostrar la ventana flotante."
        }
        status(panelStatus.isEmpty ? "Solicitando aviso de macOS…" : panelStatus)
        if style != "panel" {
            Task { @MainActor in
                let center = UNUserNotificationCenter.current()
                let permission = await center.notificationSettings()
                guard permission.authorizationStatus == .authorized || permission.authorizationStatus == .provisional else {
                    status(panelStatus + " macOS: permite los avisos desde esta app y Ajustes del Sistema.")
                    return
                }
                let content = UNMutableNotificationContent()
                content.title = String((payload["title"] ?? "Nuevo correo relevante").prefix(180))
                content.body = String((payload["sender"] ?? "").prefix(300))
                content.sound = .default
                content.userInfo = ["gmailURL":gmail.absoluteString]
                do {
                    try await center.add(UNNotificationRequest(identifier:UUID().uuidString,content:content,trigger:nil))
                    status(panelStatus + " macOS aceptó el aviso; su visibilidad depende de tus ajustes y modos de concentración.")
                } catch { status(panelStatus + " macOS rechazó el aviso: revisa los permisos.") }
            }
        }
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) { completionHandler([.banner, .sound]) }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        if let raw = response.notification.request.content.userInfo["gmailURL"] as? String, let url = URL(string: raw), url.scheme == "https", url.host == "mail.google.com", url.user == nil, url.password == nil {
            NSWorkspace.shared.open(url)
        }
        completionHandler()
    }
}

private final class FloatingNotice: NSPanel {
    private let gmailURL: URL
    init(title: String, sender: String, url: URL) {
        gmailURL = url
        let size = NSSize(width:430, height:245)
        let screen = NSScreen.main ?? NSScreen.screens.first
        let visible = screen?.visibleFrame ?? NSRect(x:0,y:0,width:1440,height:900)
        let frame = NSRect(x:visible.maxX-size.width-24, y:visible.maxY-size.height-28, width:size.width, height:size.height)
        super.init(contentRect:frame, styleMask:[.borderless,.nonactivatingPanel], backing:.buffered, defer:false)
        isReleasedWhenClosed = false
        level = .statusBar
        collectionBehavior = [.canJoinAllSpaces,.fullScreenAuxiliary,.ignoresCycle]
        hidesOnDeactivate = false
        isMovableByWindowBackground = true
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        setAccessibilityLabel("Correo relevante · Gmail con Jev")
        let background = NSVisualEffectView(frame:NSRect(origin:.zero,size:size))
        background.material = .hudWindow
        background.state = .active
        background.wantsLayer = true
        background.layer?.cornerRadius = 20
        background.layer?.borderWidth = 1
        background.layer?.borderColor = NSColor.systemGreen.withAlphaComponent(0.45).cgColor
        contentView = background
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        background.addSubview(stack)
        NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo:background.leadingAnchor,constant:24), stack.trailingAnchor.constraint(equalTo:background.trailingAnchor,constant:-24), stack.topAnchor.constraint(equalTo:background.topAnchor,constant:22)])
        let eyebrow = NSTextField(labelWithString:"✉  GMAIL CON JEV · COINCIDE CON TUS CRITERIOS")
        eyebrow.font = .systemFont(ofSize:10,weight:.semibold)
        eyebrow.textColor = .secondaryLabelColor
        stack.addArrangedSubview(eyebrow)
        let subject = NSTextField(wrappingLabelWithString:String(title.prefix(180)))
        subject.font = .systemFont(ofSize:20,weight:.semibold)
        subject.maximumNumberOfLines = 3
        subject.lineBreakMode = .byTruncatingTail
        stack.addArrangedSubview(subject)
        let from = NSTextField(wrappingLabelWithString:String(sender.prefix(300)))
        from.font = .systemFont(ofSize:13)
        from.textColor = .secondaryLabelColor
        from.maximumNumberOfLines = 2
        from.lineBreakMode = .byTruncatingTail
        stack.addArrangedSubview(from)
        let actions = NSStackView()
        actions.spacing = 12
        let open = NSButton(title:"Abrir correo ↗",target:self,action:#selector(openEmail))
        open.bezelStyle = .rounded
        let dismiss = NSButton(title:"Cerrar",target:self,action:#selector(dismissNotice))
        dismiss.bezelStyle = .rounded
        actions.addArrangedSubview(open)
        actions.addArrangedSubview(dismiss)
        stack.addArrangedSubview(actions)
    }
    @objc private func openEmail() { NSWorkspace.shared.open(gmailURL); close() }
    @objc private func dismissNotice() { close() }
}
