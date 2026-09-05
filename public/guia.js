// ── guia.js — Modo Guía: ayudas flotantes sobre los campos ──
//
// Una tarjeta pequeña que aparece al pasar el mouse (o al llegar con el teclado)
// sobre los campos que suelen costar. Pensada para el médico que acaba de entrar
// a la plataforma, y para desaparecer del todo cuando ya no la necesita: el
// interruptor "Modo Guía" la apaga entera.
//
// Dos decisiones que conviene entender antes de tocar esto:
//
// 1. El texto de cada ayuda NO vive en el HTML. Está en el CATÁLOGO de abajo,
//    indexado por pantalla y selector. En una app de 55 páginas, repartir
//    data-tooltip="..." significa abrir 55 archivos cada vez que se quiere
//    ajustar una frase. Aquí es una línea en un solo sitio. Un elemento puede
//    llevar data-ayuda="..." igualmente, y ese gana: sirve para lo que se pinta
//    desde JavaScript y no tiene un selector estable.
//
// 2. Clases con prefijo sdguia- y CSS inyectado. theme-dark.css pisa .card,
//    .field, .modal y todo <section> con !important; cualquier clase genérica
//    saldría con estilos ajenos.
(function () {
  'use strict';

  if (window.SDGuia) return;

  var CLAVE = 'sd_guia';
  // La PRIMERA tarjeta espera un poco, para no saltar cuando el mouse solo pasa
  // de largo camino de otro sitio. Pero en cuanto sale una, el médico ya está
  // leyendo ayudas: durante el siguiente segundo y medio las demás aparecen al
  // instante, así recorrer un formulario campo por campo se siente inmediato.
  var RETRASO_FRIO = 120;      // ms antes de la primera
  var VENTANA_CALIENTE = 1500; // ms tras cerrarse una en los que ya no hay espera
  var MARGEN = 10;             // separación entre la tarjeta y el elemento

  // ── Catálogo de ayudas ──
  // pantalla → lista de { sel, texto }. El primer selector que coincida gana, así
  // que van de lo más específico a lo más general.
  var CATALOGO = {
    '/consultation-podiatry.html': [
      { sel: '#consDiagnosis', texto: 'Escribe el diagnóstico como lo dirías en voz alta. Este texto es el que verá el paciente en su expediente y el que buscarás dentro de seis meses.' },
      { sel: '#consTreatmentPlan', texto: 'Qué se hará y cada cuánto. Si recetas algo, anótalo aquí con nombre, dosis y duración: Ej. Terbinafina 250mg, 1 tab c/24h por 12 semanas.' },
      { sel: '#consProcedures', texto: 'Lo que hiciste hoy en la silla: deslaminado, corte de uña encarnada, curación. Es lo que sustenta el cobro de la consulta.' },
      { sel: '#consPrevPodologistDetails', texto: 'Si ya lo trató otro podólogo, anota cuándo y por qué. Ahorra repetir tratamientos que ya fallaron.' },
      { sel: '#consTemplateSelect', texto: 'Elige la plantilla de consentimiento antes del procedimiento. Puedes hacerlo firmar en pantalla o subir la foto del papel firmado.' },
      { sel: '#consCost', texto: 'Solo el número, sin la L. Esto alimenta el reporte de Finanzas del mes.' },
      { sel: '#consPaymentNotes', texto: 'Descuentos, paquetes o pagos partidos. Aquí se explica por qué el monto no es el de lista.' },
      { sel: '.btn-save', texto: 'Guarda la consulta en el expediente del paciente. Revisa el diagnóstico antes: editar después queda registrado en la bitácora.' }
    ],
    '/consultation-general.html': [
      { sel: '#mc_chief', texto: 'El motivo en las palabras del paciente, no en las tuyas. "Me duele la cabeza hace 3 días" vale más que "cefalea".' },
      { sel: '#mc_intensity', texto: 'De 0 a 10, según el propio paciente. Sirve para comparar en la siguiente consulta si mejoró o no.' },
      { sel: '#v_bp', texto: 'Sistólica/diastólica, así: 120/80.' },
      { sel: '#dx_main', texto: 'El diagnóstico principal. Si aún no lo tienes, escribe la sospecha — es preferible a dejarlo vacío.' },
      { sel: '#dx_cie', texto: 'Código CIE-10 si lo usas para seguros o reportes. Opcional: puedes dejarlo en blanco.' },
      { sel: '#medList input:nth-child(1)', texto: 'Anota el fármaco con su concentración. Ej. Ibuprofeno 400mg.' },
      { sel: '#medList input:nth-child(2)', texto: 'Cuánto y por dónde. Ej. 1 tableta VO.' },
      { sel: '#medList input:nth-child(3)', texto: 'Cada cuánto y por cuántos días. Ej. c/8h × 5 días.' },
      { sel: '#plan_warnings', texto: 'Los signos por los que el paciente debe volver de inmediato. Es lo que más protege al paciente y a ti.' },
      { sel: '.btn-save-final', texto: 'Cierra la consulta y la guarda en el expediente. El borrador se guarda solo mientras escribes.' }
    ],
    '/patients.html': [
      { sel: '#searchInput', texto: 'Busca por nombre o por número de identidad. No hace falta escribirlo completo.' },
      { sel: '#fName', texto: 'Nombre completo como aparece en la identidad. Así lo encontrarás después sin dudar entre dos parecidos.' },
      { sel: '#fId', texto: 'Identidad hondureña, 13 dígitos. Se le da formato solo mientras escribes. Es lo que evita expedientes duplicados.' },
      { sel: '.btn-add-patient', texto: 'Crea el expediente. Con el nombre y la identidad basta para empezar; lo demás se completa en la consulta.' }
    ],
    '/citas.html': [
      { sel: '#searchInput', texto: 'Filtra las citas del día por nombre del paciente.' },
      { sel: '#btnNewAppointment', texto: 'Agenda una cita. Si el paciente aún no existe, puedes crearlo desde aquí sin salir de la pantalla.' },
      { sel: '#filterToggle', texto: 'Filtra por estado, doctor o consultorio. Los filtros se quedan puestos mientras navegas el día.' }
    ],
    '/configuracion.html': [
      { sel: '#swGuia', texto: 'Esto que estás leyendo es el Modo Guía. Apágalo cuando ya conozcas la plataforma y la interfaz queda limpia.' }
    ]
  };

  // ── Interruptor ──
  // Nace encendido: quien acaba de entrar es justo el que necesita la ayuda. El
  // que ya sabe lo apaga una vez y no vuelve a verlo.
  function activo() {
    try { return localStorage.getItem(CLAVE) !== 'off'; } catch (_) { return true; }
  }
  function fijar(encendido) {
    try { localStorage.setItem(CLAVE, encendido ? 'on' : 'off'); } catch (_) {}
    if (!encendido) ocultar();
    document.documentElement.classList.toggle('sdguia-off', !encendido);
    window.dispatchEvent(new CustomEvent('sdguia:cambio', { detail: { activo: encendido } }));
  }

  var ESTILOS = [
    '.sdguia-tarjeta{',
    '  --sdg-fondo:#ffffff; --sdg-texto:#1e293b; --sdg-suave:#64748b;',
    '  --sdg-borde:rgba(15,23,42,.10); --sdg-acento:#0891b2;',
    '  position:fixed; z-index:9990; max-width:290px; padding:.7rem .8rem;',
    '  background:var(--sdg-fondo); color:var(--sdg-texto);',
    '  border:1px solid var(--sdg-borde); border-left:3px solid var(--sdg-acento);',
    '  border-radius:12px; box-shadow:0 10px 30px rgba(15,23,42,.13);',
    '  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif;',
    '  font-size:.8rem; line-height:1.5; pointer-events:none;',
    '  opacity:0; transform:translateY(4px); transition:opacity .13s ease, transform .13s ease;',
    '}',
    '[data-theme="dark"] .sdguia-tarjeta{',
    '  --sdg-fondo:#141416; --sdg-texto:#f1f5f9; --sdg-suave:#94a3b8;',
    '  --sdg-borde:rgba(255,255,255,.10); --sdg-acento:#06b6d4;',
    '  box-shadow:0 10px 30px rgba(0,0,0,.5);',
    '}',
    '.sdguia-tarjeta.is-visible{opacity:1; transform:translateY(0);}',
    // Sin animación para quien pidió no tener animaciones, y de paso una capa
    // menos que recomponer en el WKWebView de la app de escritorio.
    '@media (prefers-reduced-motion: reduce){',
    '  .sdguia-tarjeta{transition:none; transform:none;}',
    '  .sdguia-tarjeta.is-visible{transform:none;}',
    '}',
    // citas.html y calendario-compartido.html pintan su propio tooltip con
    // [data-tip]:hover::after. Con el Modo Guía encendido saldrían dos a la vez;
    // apagado, el de siempre vuelve intacto.
    'html:not(.sdguia-off) [data-tip]:hover::after,',
    'html:not(.sdguia-off) [data-tip]:hover::before{content:none !important;display:none !important;}'
  ].join('\n');

  var tarjeta = null;
  var temporizador = null;
  var actual = null;
  var ultimoCierre = 0;   // cuándo se ocultó la última: define si seguimos "calientes"

  function crearTarjeta() {
    var estilo = document.createElement('style');
    estilo.textContent = ESTILOS;
    document.head.appendChild(estilo);

    tarjeta = document.createElement('div');
    tarjeta.className = 'sdguia-tarjeta';
    tarjeta.setAttribute('role', 'tooltip');
    tarjeta.hidden = true;
    document.body.appendChild(tarjeta);
  }

  // ── Describidor automático ──
  //
  // La cobertura tiene que ser TOTAL: 1.500 elementos interactivos en 55
  // pantallas. Escribir un texto a mano para cada uno daría relleno ("Nombre:
  // escribe el nombre") y quedaría desactualizado al primer cambio de
  // formulario. Así que lo que no está en el catálogo se describe solo, leyendo
  // lo que la propia página ya dice: su etiqueta, su ejemplo, si es obligatorio
  // y qué límites tiene.
  //
  // Y hay una razón concreta por la que esto sirve y no molesta: el placeholder
  // DESAPARECE en cuanto el médico escribe. "Ej: c/8h × 5 días" solo se ve con
  // el campo vacío; recuperarlo al pasar el mouse es justo cuando hace falta.

  var CAMPOS = 'input,select,textarea';

  function limpiar(t) {
    return String(t || '').replace(/\s+/g, ' ').trim().replace(/[:*]+$/, '').trim();
  }

  // La etiqueta visible del campo, buscada como está escrita en esta app: unas
  // veces <label for>, otras un <label> hermano dentro de .field/.form-group, y
  // en las tablas de antecedentes el nombre vive en la primera celda de la fila.
  function etiquetaDe(el) {
    if (el.id) {
      var porFor = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (porFor) return limpiar(porFor.textContent);
    }
    var envuelto = el.closest('label');
    if (envuelto) {
      var copia = envuelto.cloneNode(true);
      var dentro = copia.querySelector(CAMPOS);
      if (dentro) dentro.remove();
      var t = limpiar(copia.textContent);
      if (t) return t;
    }
    var caja = el.closest('.field,.form-group,.switch-row,.cfg-field');
    if (caja) {
      var lbl = caja.querySelector('label,.switch-title');
      if (lbl && !lbl.contains(el)) {
        var t2 = limpiar(lbl.textContent);
        if (t2) return t2;
      }
    }
    var previo = el.previousElementSibling;
    while (previo) {
      if (previo.tagName === 'LABEL') return limpiar(previo.textContent);
      previo = previo.previousElementSibling;
    }
    var fila = el.closest('tr');
    if (fila) {
      var celda = fila.querySelector('td,th');
      if (celda && !celda.contains(el)) {
        var t3 = limpiar(celda.textContent);
        if (t3) return t3;
      }
    }
    return limpiar(el.getAttribute('aria-label') || el.getAttribute('title') || el.name || '');
  }

  // Qué es este control, dicho en una frase, cuando no hay nada mejor que decir.
  // Nunca se devuelve un eco pelado de la etiqueta: repetir lo que ya se lee en
  // pantalla es ruido, y el ruido es lo que hace que la gente apague la ayuda.
  function naturalezaDe(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'select') {
      var n = el.options ? el.options.length : 0;
      return n ? 'Elige una de las ' + n + ' opciones de la lista.' : 'Elige una opción de la lista.';
    }
    if (tag === 'textarea') return 'Texto libre: escribe con tus palabras, sin límite de líneas.';
    var tipo = (el.type || 'text').toLowerCase();
    if (tipo === 'checkbox') return 'Casilla: márcala si aplica a este paciente.';
    if (tipo === 'radio') return 'Elige una sola de las opciones del grupo.';
    if (tipo === 'date') return 'Fecha. Puedes escribirla o abrir el calendario.';
    if (tipo === 'time') return 'Hora en formato de 24 horas.';
    if (tipo === 'number') return 'Solo números.';
    if (tipo === 'tel') return 'Teléfono. Ej. 9999-9999.';
    if (tipo === 'email') return 'Correo electrónico.';
    if (tipo === 'file') return 'Abre el explorador para elegir un archivo de tu computadora.';
    if (tipo === 'search') return 'Escribe para filtrar la lista según vas tecleando.';
    if (tipo === 'password') return 'Contraseña. No se muestra mientras escribes.';
    return 'Campo de texto.';
  }

  function describirCampo(el) {
    var partes = [];
    var etiqueta = etiquetaDe(el);
    if (etiqueta && etiqueta.length <= 70) partes.push(etiqueta + '.');

    partes.push(naturalezaDe(el));

    var ph = limpiar(el.getAttribute('placeholder'));
    // Un placeholder tipo "Buscar paciente…" solo sobra si el campo YA tiene
    // etiqueta. Sin ella es lo único que identifica al buscador.
    if (ph && ph.toLowerCase() !== (etiqueta || '').toLowerCase() && !(etiqueta && /^buscar/i.test(ph))) {
      partes.push(/^ej\b|^ej\./i.test(ph) ? ph.replace(/^ej[.:]?\s*/i, 'Ejemplo: ') : 'Ejemplo: ' + ph);
    }

    var limites = [];
    if (el.required) limites.push('obligatorio');
    if (el.min !== undefined && el.min !== '' && el.max !== undefined && el.max !== '') {
      limites.push('de ' + el.min + ' a ' + el.max);
    }
    var max = parseInt(el.getAttribute('maxlength') || '0', 10);
    if (max > 0 && max < 500) limites.push('máx. ' + max + ' caracteres');
    if (limites.length) partes.push('(' + limites.join(', ') + ')');

    return partes.join(' ');
  }

  // Las pantallas de la app, por su ruta, para que un enlace diga a dónde lleva
  // en vez de "a otra pantalla".
  var PANTALLAS = {
    '/dashboard.html': 'el inicio', '/citas.html': 'la agenda de citas',
    '/patients.html': 'la lista de pacientes', '/finanzas.html': 'las finanzas',
    '/doctors.html': 'el personal de la clínica', '/consentimientos.html': 'los consentimientos',
    '/recordatorios.html': 'los recordatorios', '/confirmaciones.html': 'las confirmaciones',
    '/agendar-online.html': 'las citas online', '/mi-sitio.html': 'tu sitio web',
    '/configuracion.html': 'la configuración', '/tutoriales.html': 'los tutoriales',
    '/medical-record.html': 'el expediente del paciente', '/crecimiento.html': 'crecimiento',
    '/facturacion.html': 'la facturación', '/plan.html': 'tu plan y suscripción'
  };

  // Los botones de solo icono no tienen texto que leer, pero sí un data-icon.
  // Traducirlo cubre de golpe los botones sin etiqueta de toda la app.
  var POR_ICONO = {
    x: 'Cierra esto', plus: 'Añade un elemento nuevo', edit: 'Edita',
    trash: 'Elimina', download: 'Descarga el archivo', eye: 'Ver el detalle',
    camera: 'Toma o sube una foto', filter: 'Filtra la lista',
    refresh: 'Vuelve a cargar los datos', copy: 'Copia al portapapeles',
    search: 'Busca', menu: 'Abre el menú', bell: 'Tus notificaciones',
    settings: 'Ajustes', logOut: 'Cierra tu sesión', archive: 'Archiva',
    check: 'Confirma', checkmark: 'Confirma', phone: 'Llama por teléfono',
    messageSquare: 'Envía un mensaje', mapPin: 'Ver en el mapa',
    chevronLeft: 'Ir al anterior', chevronRight: 'Ir al siguiente',
    chevronDown: 'Despliega esta sección', arrowLeft: 'Volver atrás',
    image: 'Ver la imagen', fileText: 'Ver el documento', printer: 'Imprime'
  };

  function porIcono(el) {
    var ico = el.matches('[data-icon]') ? el : el.querySelector('[data-icon]');
    var n = ico && ico.getAttribute('data-icon');
    return (n && POR_ICONO[n]) ? POR_ICONO[n] + '.' : null;
  }

  function describirBoton(el) {
    // Con hijos (iconos, insignias, contadores) el textContent sale pegoteado:
    // "Notificaciones Sin novedades 0". Ahí manda la etiqueta accesible.
    var tieneHijos = el.querySelector('*');
    var accesible = limpiar(el.getAttribute('aria-label') || el.getAttribute('title'));
    var texto = tieneHijos ? (accesible || limpiar(el.textContent)) : (limpiar(el.textContent) || accesible);
    if (texto.length > 60) texto = texto.slice(0, 60).trim() + '…';

    if (el.tagName === 'A') {
      var href = el.getAttribute('href') || '';
      if (/^#|^javascript:/.test(href) || !href) return texto ? texto + '.' : 'Enlace.';
      if (/^(https?:)?\/\//.test(href)) return (texto ? texto + '. ' : '') + 'Abre un sitio externo en otra pestaña.';
      var destino = PANTALLAS[href.split('?')[0]];
      return (texto ? texto + '. ' : '') + (destino ? 'Te lleva a ' + destino + '.' : 'Te lleva a otra pantalla de la plataforma.');
    }
    if (!texto) {
      var deIcono = porIcono(el);
      if (deIcono) texto = deIcono.slice(0, -1);
    }
    if (el.disabled) return (texto ? texto + '. ' : '') + 'Desactivado ahora mismo: falta completar algo antes.';
    // Solo es "guardar" si de verdad envía un formulario. Un <button> suelto
    // tiene type="submit" por defecto y no guarda nada.
    if (el.form && (el.type || 'submit').toLowerCase() === 'submit') {
      return (texto ? texto + '. ' : '') + 'Guarda lo que hay en este formulario.';
    }
    return texto ? texto + '.' : 'Botón.';
  }

  function describirAutomatico(el) {
    var control = el.closest(CAMPOS + ',button,a[href],[role="button"]');
    if (!control) return null;
    if (control.type === 'hidden' || control.hidden) return null;
    var tag = control.tagName.toLowerCase();
    if (tag === 'button' || tag === 'a' || control.getAttribute('role') === 'button') {
      return describirBoton(control);
    }
    return describirCampo(control);
  }

  // Devuelve el texto de ayuda de un elemento, o null si no tiene.
  // Orden de mando: lo puesto a mano en el HTML, luego el catálogo de esta
  // pantalla, y si no hay nada, la descripción automática.
  function textoDe(el) {
    // OJO con el nombre: data-guia ya estaba cogido en tutoriales.html, donde
    // guarda el id de un tutorial. Leerlo como texto de ayuda enseñaba el id
    // pelado al médico. Por eso este atributo es data-ayuda.
    var propio = el.closest('[data-ayuda]');
    if (propio) return propio.getAttribute('data-ayuda');

    // La app ya traía su propio tooltip en CSS con data-tip (citas y calendario
    // compartido). Se respeta ese texto en vez de ignorarlo o duplicarlo.
    var tip = el.closest('[data-tip]');
    if (tip) return limpiar(tip.getAttribute('data-tip'));

    var lista = CATALOGO[window.location.pathname];
    if (lista) {
      for (var i = 0; i < lista.length; i++) {
        if (el.closest(lista[i].sel)) return lista[i].texto;
      }
    }
    return describirAutomatico(el);
  }

  // Encima si cabe, debajo si no; y siempre dentro de la ventana a lo ancho.
  function colocar(destino) {
    var r = destino.getBoundingClientRect();
    var t = tarjeta.getBoundingClientRect();
    var arriba = r.top - t.height - MARGEN;
    var y = arriba >= 8 ? arriba : r.bottom + MARGEN;
    var x = r.left + r.width / 2 - t.width / 2;
    x = Math.max(8, Math.min(x, window.innerWidth - t.width - 8));
    tarjeta.style.left = Math.round(x) + 'px';
    tarjeta.style.top = Math.round(y) + 'px';
  }

  function mostrar(destino, texto) {
    actual = destino;
    tarjeta.textContent = texto;
    tarjeta.hidden = false;
    colocar(destino);            // se coloca ya medido, antes de que se vea
    tarjeta.classList.add('is-visible');
  }

  function ocultar() {
    if (temporizador) { clearTimeout(temporizador); temporizador = null; }
    if (!tarjeta || tarjeta.hidden) return;
    ultimoCierre = Date.now();
    actual = null;
    tarjeta.classList.remove('is-visible');
    tarjeta.hidden = true;
  }

  function programar(destino) {
    // e.target puede no ser un elemento (document, un nodo de texto en algún
    // navegador): closest() no existiría y reventaría la escucha para toda la
    // página, no solo para este hover.
    if (!destino || typeof destino.closest !== 'function') return;
    if (!activo() || destino === actual) return;
    var texto = textoDe(destino);
    if (!texto) return;
    if (temporizador) clearTimeout(temporizador);
    // Caliente: venimos de leer otra ayuda hace nada, o hay una abierta ahora
    // mismo y solo estamos saltando al campo de al lado.
    var caliente = (Date.now() - ultimoCierre) < VENTANA_CALIENTE || !tarjeta.hidden;
    if (caliente) { mostrar(destino, texto); return; }
    temporizador = setTimeout(function () { mostrar(destino, texto); }, RETRASO_FRIO);
  }

  // El interruptor vivía aquí: guia.js se inyectaba una fila .sb-item al final
  // del menú lateral. Se retiró porque duplicaba el que ya existe en
  // Configuración → Preferencias → "Ayuda en pantalla", y un ajuste con dos
  // mandos en sitios distintos es un ajuste que nadie sabe dónde buscar.
  // Los sitios donde se enciende y se apaga son ahora Configuración y
  // Tutoriales; ambos hablan con esta misma API (window.SDGuia) y ambos
  // escuchan el evento 'sdguia:cambio', así que siguen sincronizados.

  window.__guiaTextoDe = textoDe;
  window.__guiaDeCatalogo = function (el) {
    var lista = CATALOGO[window.location.pathname] || [];
    if (el.closest('[data-ayuda]')) return true;
    for (var i = 0; i < lista.length; i++) if (el.closest(lista[i].sel)) return true;
    return false;
  };

  window.SDGuia = {
    activo: activo,
    fijar: fijar,
    // Para añadir ayudas desde una pantalla concreta, sin tocar el catálogo:
    //   SDGuia.registrar([{ sel: '#miCampo', texto: '...' }]);
    registrar: function (entradas) {
      var ruta = window.location.pathname;
      CATALOGO[ruta] = (CATALOGO[ruta] || []).concat(entradas || []);
    }
  };

  function iniciar() {
    crearTarjeta();
    document.documentElement.classList.toggle('sdguia-off', !activo());

    // Delegación: un solo par de escuchas para toda la página, y funciona con lo
    // que se pinte después (las filas de medicamento se crean al vuelo).
    document.addEventListener('mouseover', function (e) { programar(e.target); });
    document.addEventListener('mouseout', function (e) {
      if (actual && !actual.contains(e.relatedTarget)) ocultar();
      else if (!actual) ocultar();
    });
    // Teclado: quien tabula por el formulario también merece la ayuda.
    document.addEventListener('focusin', function (e) { programar(e.target); });
    document.addEventListener('focusout', ocultar);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') ocultar(); });
    // Al desplazarse la tarjeta quedaría flotando en el aire: mejor que se vaya.
    window.addEventListener('scroll', ocultar, true);
    window.addEventListener('resize', ocultar);

  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
