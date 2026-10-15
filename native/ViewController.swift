import Cocoa
import SafariServices
import WebKit
import UserNotifications

let extensionBundleIdentifier = "io.github.jaumesaa.GmailJev.Extension"

class ViewController: NSViewController {
    @IBOutlet var webView: WKWebView!
    private let delivery = NSTextField(wrappingLabelWithString: "")
    override func viewDidLoad() {
        super.viewDidLoad()
        webView.isHidden = true
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([stack.centerXAnchor.constraint(equalTo: view.centerXAnchor), stack.centerYAnchor.constraint(equalTo: view.centerYAnchor), stack.widthAnchor.constraint(lessThanOrEqualToConstant: 460)])
        let title = NSTextField(labelWithString: "Notificaciones de Gmail con Jev")
        title.font = .boldSystemFont(ofSize: 23)
        stack.addArrangedSubview(title)
        let detail = NSTextField(wrappingLabelWithString: "1. Activa la extensión en Safari.\n2. Permite sus avisos.\n3. Introduce tu clave y tus criterios desde el botón de la extensión.\n\nMantén abierta la lista de Recibidos de Gmail. Puede leer cada mensaje en una pestaña temporal y devolverlo a sin leer. Avisos del sistema y ventana flotante, a tu elección.")
        stack.addArrangedSubview(detail)
        stack.addArrangedSubview(NSButton(title: "Abrir ajustes de Safari", target: self, action: #selector(openSafari)))
        stack.addArrangedSubview(NSButton(title: "Permitir notificaciones", target: self, action: #selector(allowNotifications)))
        stack.addArrangedSubview(NSButton(title: "Abrir Gmail", target: self, action: #selector(openGmail)))
        stack.addArrangedSubview(NSButton(title: "Probar ambos avisos", target: self, action: #selector(testNotifications)))
        delivery.font = .systemFont(ofSize:12)
        delivery.textColor = .secondaryLabelColor
        stack.addArrangedSubview(delivery)
        NotificationCenter.default.addObserver(self, selector:#selector(updateStatus), name:Notification.Name("GmailJevDeliveryStatus"), object:nil)
        updateStatus()
    }
    @objc private func updateStatus() { delivery.stringValue = (NSApp.delegate as? AppDelegate)?.deliveryStatus ?? "Diagnóstico no disponible." }
    @objc private func testNotifications() { (NSApp.delegate as? AppDelegate)?.testNotifications() }
    @objc private func openSafari() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in }
    }
    @objc private func allowNotifications() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { allowed, error in
            DispatchQueue.main.async {
                let alert = NSAlert()
                alert.messageText = allowed ? "Avisos permitidos" : "Revisa los permisos de notificación"
                alert.informativeText = allowed ? "Puedes probar un aviso desde los ajustes de la extensión." : "Abre Ajustes del Sistema → Notificaciones → GmailJev y permite los avisos."
                alert.runModal()
            }
        }
    }
    @objc private func openGmail() { NSWorkspace.shared.open(URL(string: "https://mail.google.com/mail/u/0/#inbox")!) }
}
