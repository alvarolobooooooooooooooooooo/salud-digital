// Salud Digital — punto de entrada de la app de escritorio.
//
// La app NO reimplementa el backend: abre la plataforma web hospedada
// (https://salud-digital.onrender.com) dentro de una ventana nativa
// (WKWebView en macOS) y le agrega capacidades nativas:
//   - instancia única (no abrir dos ventanas)
//   - apertura de enlaces externos en el navegador del sistema
//   - notificaciones nativas (puenteadas desde la campana de la web)

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Instancia única: si el usuario reabre la app, enfocamos la ventana
    // existente en lugar de lanzar otra. Debe registrarse de primero.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        // Abrir URLs/archivos externos con la app por defecto del sistema.
        .plugin(tauri_plugin_opener::init())
        // Notificaciones nativas del sistema (las dispara la web vía IPC).
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
