# Política de Privacidad

**Portal Salud Digital**
Versión 1.0

> **Aviso sobre este documento.** Esta política describe cómo Portal Salud Digital trata la información en su condición de proveedor tecnológico. Forma parte integrante de los Términos y Condiciones de Uso. No sustituye la información de privacidad que el Profesional deba facilitar a sus propios Pacientes conforme a la legislación que le resulte aplicable.

---

## 1. Quién trata sus datos y cómo contactarnos

Portal Salud Digital es el prestador del servicio, con operación desde Honduras.

- Privacidad y ejercicio de derechos: **privacidad@portalsaluddigital.com**
- Asuntos legales: **legal@portalsaluddigital.com**
- Seguridad: **seguridad@portalsaluddigital.com**

> **REQUIERE REVISIÓN LEGAL.** La identificación registral completa del prestador y la eventual designación de un delegado de protección de datos o de un representante en otras jurisdicciones deben incorporarse aquí tras la correspondiente evaluación legal.

## 2. Dos categorías de información distintas

Esta política distingue dos conjuntos de información que **no se tratan igual**:

**A. Datos del Profesional y de su cuenta.** Los datos de quien contrata y usa la Plataforma. Los tratamos para prestarle el servicio, facturarle, darle soporte y mantener la seguridad.

**B. Datos de Pacientes.** La información clínica y personal que el Profesional introduce sobre las personas que atiende. **El Profesional decide qué se registra, para qué y durante cuánto tiempo.** Nosotros proporcionamos la infraestructura para almacenarla y protegerla, y accedemos a ella únicamente en los supuestos del apartado 6.

> **REQUIERE REVISIÓN LEGAL.** La calificación jurídica de cada parte respecto de los Datos de Paciente (responsable, corresponsable, encargado del tratamiento o figuras equivalentes) depende de la legislación aplicable y del uso concreto que el Profesional haga de la Plataforma. No la presuponemos en este documento. Debe determinarse mediante evaluación legal por jurisdicción, junto con la necesidad de suscribir un acuerdo de tratamiento de datos.

## 3. Qué datos recopilamos

### 3.1 Datos que nos facilita el Profesional al registrarse y usar la Plataforma

- **Identificación y contacto**: nombre, correo electrónico, teléfono.
- **Datos profesionales**: especialidad, número de colegiación o licencia, años de experiencia, biografía, idiomas, fotografía de perfil, cuando los proporciona.
- **Datos del consultorio**: nombre, dirección, ciudad, coordenadas de ubicación si decide marcarlas, teléfono, sitio web, logotipo, horarios y salas de atención.
- **Credenciales**: la contraseña se almacena únicamente como *hash* con bcrypt; nunca en claro y nunca es recuperable. Si activa la verificación en dos pasos, su secreto TOTP se almacena cifrado.
- **Datos de facturación**: estado de la suscripción, identificadores de la transacción y del plan. **No almacenamos números completos de tarjeta**: los gestiona el procesador de pagos.

### 3.2 Datos técnicos y de sesión

- **Dirección IP** y **agente de usuario** (navegador y sistema operativo), asociados a cada inicio de sesión y a cada aceptación de documentos legales.
- **Sesiones activas**: identificador de sesión, fecha de creación, última actividad, revocación.
- **Registros de auditoría**: acciones relevantes realizadas dentro de la Plataforma, con usuario, clínica, acción, resultado y momento.
- **Registros de aceptación legal**: qué documento, qué versión, qué huella criptográfica, cuándo, desde qué IP y con qué agente de usuario.
- **Registros técnicos del servidor**: errores y trazas necesarias para diagnosticar fallos.
- **Visitas a las páginas públicas**: contamos las cargas de la web pública (inicio, registro, inicio de sesión, mapa). **No guardamos la IP de estas visitas**: se calcula un valor irreversible a partir de la IP, el agente de usuario y una sal que cambia cada día, que permite contar personas distintas dentro de un mismo día y deja de ser correlacionable al día siguiente. **No utilizamos herramientas de analítica de terceros**, precisamente porque el mismo dominio sirve historia clínica.

### 3.3 Datos de Pacientes introducidos por el Profesional

Según lo que el Profesional decida registrar, pueden incluir: nombre y datos de contacto, fecha de nacimiento, sexo, identificación, antecedentes, alergias e información crítica, motivo de consulta, diagnósticos, tratamientos, evoluciones, odontogramas, mapas podológicos, valoraciones nutricionales, imágenes clínicas y fotografías, documentos adjuntos, citas, consentimientos firmados e información de pagos de la consulta.

**Se trata de datos de salud**, que la mayoría de ordenamientos considera de categoría especialmente protegida.

### 3.4 Comunicaciones

Contenido de los mensajes que el Profesional intercambia dentro de la Plataforma, sus solicitudes de soporte y las conversaciones con las funciones asistidas, cuando las utiliza.

## 4. Para qué usamos la información

| Finalidad | Qué implica |
|---|---|
| Prestar el servicio | Autenticación, almacenamiento y presentación de la información, agenda, recordatorios, mensajería |
| Seguridad | Detección de accesos indebidos, control de sesiones, límites de uso, auditoría |
| Soporte | Atender incidencias reportadas por el Profesional |
| Facturación | Gestionar la suscripción y los pagos |
| Cumplimiento | Conservar evidencia de aceptaciones contractuales y atender requerimientos legales |
| Comunicaciones de servicio | Avisos operativos, cambios de términos, incidencias de seguridad |
| Mejora del producto | Estadísticas agregadas y anonimizadas, que no permiten identificar a ningún Paciente |
| Marketing | Solo con consentimiento separado y revocable en cualquier momento |

**Las comunicaciones de servicio no son marketing** y no dependen del consentimiento de marketing: son necesarias para la ejecución del contrato (por ejemplo, avisarle de un cambio de términos o de un incidente de seguridad).

> **REQUIERE REVISIÓN LEGAL.** La base jurídica concreta de cada finalidad (ejecución contractual, obligación legal, interés legítimo, consentimiento u otras figuras equivalentes) debe determinarse conforme a la legislación aplicable en cada jurisdicción y documentarse en esta tabla tras la evaluación correspondiente.

## 5. Consentimientos separados

No agrupamos consentimientos distintos en una sola casilla:

- **Obligatorio para usar la Plataforma**: aceptación de los Términos y Condiciones y lectura de esta Política de Privacidad. Sin ello no es posible crear la cuenta.
- **Opcional y revocable**: comunicaciones comerciales y promocionales. Se solicita por separado, viene desmarcado por defecto y puede retirarse en cualquier momento desde Configuración → Legal y privacidad, sin consecuencia alguna sobre el servicio contratado.

Los consentimientos que el Profesional recabe de sus Pacientes son distintos de estos y se gestionan en el módulo de consentimientos de la Plataforma. **No se mezclan con la aceptación de estos documentos.**

## 6. Cuándo accedemos a los Datos de Pacientes

Accedemos únicamente cuando es necesario y en el menor alcance posible:

- Para resolver una incidencia técnica que el Profesional nos reporta.
- Para restaurar una copia de seguridad o corregir un fallo que afecta a la integridad de los datos.
- Para responder a un incidente de seguridad activo.
- Cuando lo exija una autoridad competente conforme a derecho.

Estos accesos quedan registrados. El panel de administración de la plataforma está construido de forma que **los informes de uso muestran recuentos y fechas por clínica, nunca datos de Pacientes**.

## 7. Con quién compartimos información

No vendemos información. Compartimos únicamente lo necesario con proveedores que nos prestan servicios de infraestructura:

| Proveedor | Para qué | Qué recibe |
|---|---|---|
| **Render** | Alojamiento de la aplicación y de la base de datos | Toda la información de la Plataforma, en reposo y en tránsito hacia la aplicación |
| **Cloudinary** | Almacenamiento de imágenes y documentos clínicos | Las imágenes y archivos que el Profesional carga |
| **SendGrid (Twilio)** | Envío de correo transaccional | Dirección de correo y contenido de los avisos (invitaciones, recordatorios, confirmaciones) |
| **PayPal** | Procesamiento de pagos de la suscripción | Datos de la transacción; los datos de la tarjeta los recoge PayPal directamente |
| **OpenAI / Anthropic** | Funciones asistidas por inteligencia artificial, **solo cuando el Profesional las utiliza** | El texto que el Profesional envía a la función asistida |
| **OpenStreetMap / Nominatim** | Mapa y búsqueda de direcciones en las páginas públicas | La dirección o coordenadas consultadas |

También podremos revelar información cuando lo exija una orden de autoridad competente conforme a derecho, o cuando sea necesario para proteger derechos, seguridad o integridad de las personas o de la Plataforma.

**Uso de las funciones asistidas.** Si el Profesional utiliza funciones asistidas por inteligencia artificial, el texto que envíe se transmite al proveedor correspondiente. Recomendamos no introducir en ellas datos identificativos de Pacientes que no sean estrictamente necesarios.

> **REQUIERE REVISIÓN LEGAL.** La condición contractual de cada proveedor como subencargado, los acuerdos que deban suscribirse con ellos y el mecanismo válido de transferencia internacional deben ser evaluados por asesoría legal. La lista de subprocesadores se mantiene actualizada en este documento y su modificación se comunica mediante una nueva versión.

## 8. Transferencias internacionales

Nuestros proveedores de infraestructura operan servidores fuera de Honduras, principalmente en los Estados Unidos de América. Esto implica que la información puede tratarse en países distintos al de residencia del Profesional o de sus Pacientes.

> **REQUIERE REVISIÓN LEGAL.** El mecanismo de legitimación de estas transferencias (cláusulas contractuales tipo, decisiones de adecuación u otros instrumentos equivalentes según la jurisdicción) debe determinarse mediante evaluación legal. La arquitectura de la Plataforma permite documentar y publicar dicho mecanismo cuando se establezca.

## 9. Cuánto tiempo conservamos la información

| Información | Conservación |
|---|---|
| Cuenta y datos del Profesional | Mientras la cuenta esté activa, y después durante los plazos legales aplicables |
| Datos de Pacientes | Los determina el Profesional, sujeto a los plazos legales de conservación del expediente clínico de su jurisdicción. **No se eliminan automáticamente al cerrar la cuenta** |
| Registros de aceptación legal | De forma prolongada, porque constituyen la evidencia del contrato. No se purgan |
| Registros de auditoría del sistema | Periodo configurable (por defecto 90 días) |
| Sesiones | Las revocadas o inactivas se eliminan periódicamente (por defecto, 30 días) |
| Eventos de pago | Periodo configurable (por defecto 180 días) tras su procesamiento |
| Visitas a páginas públicas | Periodo configurable (por defecto 365 días). No contienen IP |

Los plazos por defecto son configurables por entorno y revisables jurídicamente.

> **REQUIERE REVISIÓN LEGAL.** Los plazos obligatorios de conservación del expediente clínico varían por país y por tipo de profesión. Deben fijarse conforme a la legislación sanitaria aplicable al Profesional.

## 10. Seguridad

Medidas técnicas y organizativas actualmente implementadas:

- **Cifrado en tránsito**: HTTPS obligatorio, con HSTS.
- **Cifrado en reposo**: proporcionado por el proveedor de base de datos y de almacenamiento de archivos. Adicionalmente, ciertos campos sensibles (secretos de segundo factor, contenido de determinados registros de auditoría) se cifran a nivel de aplicación con una clave separada.
- **Contraseñas**: almacenadas como *hash* bcrypt. Nunca en claro, nunca recuperables.
- **Verificación en dos pasos (TOTP)**: disponible para todas las cuentas.
- **Sesiones**: cookie `HttpOnly`, `Secure` y `SameSite`, con identificador de sesión revocable individualmente y a distancia. El usuario puede ver y cerrar sus sesiones activas.
- **Control de acceso por rol** y aislamiento por clínica: cada consulta a la base de datos se acota a la clínica del usuario autenticado.
- **Puerta de acceso clínico**: los roles que no son personal de la clínica quedan cerrados por defecto frente a la API clínica; se emplea una lista de permitidos, no de prohibidos.
- **Política de seguridad de contenido (CSP)** que restringe el destino de las peticiones del navegador, mitigando la exfiltración de información en caso de inyección de código.
- **Límites de uso y de recursos** por IP y por usuario, para contener abusos y ataques de denegación de servicio.
- **Registros de auditoría** de las acciones relevantes.
- **Copias de seguridad** gestionadas por el proveedor de base de datos, con procedimientos de restauración.
- **Registro de aceptaciones legales inmutable**: las tablas de aceptación y de auditoría legal están protegidas a nivel de base de datos contra modificación y borrado.
- **Sin analítica de terceros** ni almacenamiento en caché de información clínica por parte del *service worker* de la aplicación.

Ninguna medida de seguridad es infalible. Si se produjera un incidente que afecte a la información, lo notificaremos a los Profesionales afectados sin demora indebida, con la información disponible sobre su alcance y las medidas adoptadas.

> **REQUIERE REVISIÓN LEGAL.** Los plazos y destinatarios de notificación de incidentes (autoridades de control, personas afectadas) varían por jurisdicción y deben determinarse mediante evaluación legal.

## 11. Derechos sobre la información

Según la legislación que le resulte aplicable, el Profesional puede tener derecho a: **acceder** a sus datos, **rectificarlos**, **solicitar su supresión**, obtener su **portabilidad**, **limitar** u **oponerse** a determinados tratamientos, y **retirar** los consentimientos opcionales en cualquier momento.

Puede ejercerlos escribiendo a **privacidad@portalsaluddigital.com**. Verificaremos su identidad antes de atender la solicitud y responderemos en el plazo que exija la legislación aplicable.

**Solicitudes de Pacientes.** Cuando la solicitud provenga de un Paciente, la dirigiremos al Profesional que gestiona su expediente, que es quien decide sobre esa información, y le prestaremos la asistencia técnica necesaria para atenderla. La supresión de información clínica está sujeta a los plazos legales de conservación del expediente.

**Autoexportación.** Sin necesidad de solicitud, el Profesional puede exportar desde la propia Plataforma su historial de aceptaciones legales con toda la evidencia asociada.

> **REQUIERE REVISIÓN LEGAL.** El catálogo exacto de derechos, los plazos de respuesta y la autoridad de control ante la que reclamar dependen de la jurisdicción del solicitante.

## 12. Cookies y almacenamiento local

Usamos el mínimo imprescindible:

- **`sd_token`** — cookie estrictamente necesaria que mantiene la sesión iniciada. `HttpOnly`, no accesible desde JavaScript.
- **Almacenamiento local del navegador** — preferencias de interfaz (tema, rol para mostrar el menú correcto). No contiene información clínica.

**No utilizamos cookies de publicidad, de seguimiento entre sitios ni de analítica de terceros.**

## 13. Menores de edad

La cuenta de la Plataforma está dirigida a profesionales de la salud mayores de edad. Los expedientes de Pacientes menores de edad son gestionados por el Profesional, a quien corresponde recabar las autorizaciones de quienes ejerzan la representación legal conforme a la normativa aplicable.

## 14. Cambios en esta política

Cada versión de este documento se conserva íntegra, con su número de versión, fecha de publicación, fecha de entrada en vigor y huella criptográfica. Las versiones anteriores permanecen consultables. Cuando un cambio sea sustancial, se solicitará una nueva confirmación de lectura antes de continuar utilizando la Plataforma, y las confirmaciones anteriores se conservarán.

## 15. Declaración sobre marcos de cumplimiento

Portal Salud Digital **no declara**, en este documento ni en ningún material de la Plataforma, estar certificado o ser conforme con HIPAA, con el RGPD europeo, con la legislación hondureña de protección de datos ni con ningún otro marco normativo específico.

La arquitectura de la Plataforma está construida para poder soportar los requisitos técnicos que estos marcos exigen —trazabilidad, control de acceso, cifrado, retención configurable, evidencia de consentimiento, capacidad de exportación y de supresión, y respuesta a incidentes—, pero **el estado de cumplimiento de cualquier marco concreto solo puede determinarse mediante una evaluación legal y técnica especializada**, y en su caso mediante la suscripción de los acuerdos correspondientes con los clientes y proveedores implicados.

Cualquier afirmación de cumplimiento que se haga en el futuro estará respaldada por dicha evaluación.
