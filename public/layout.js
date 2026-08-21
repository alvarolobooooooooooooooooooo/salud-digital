// ── layout.js — Global Sidebar & Header Injection ──

(function() {
  // Cargar icons.js si no está disponible
  if (typeof Icons === 'undefined') {
    const script = document.createElement('script');
    script.src = '/icons.js';
    script.onload = () => console.log('[layout.js] Icons library loaded');
    document.head.appendChild(script);
  }

  console.log('[layout.js] Loading...');
  // Detect active page
  const path = window.location.pathname;
  console.log('[layout.js] Path:', path);
  const activeMap = {
    '/dashboard.html': 'dashboard',
    '/patients.html': 'patients',
    '/patient.html': 'patients',
    '/mensajes.html': 'mensajes',
    '/citas.html': 'citas',
    '/calendario-compartido.html': 'calendario-compartido',
    '/finanzas.html': 'finanzas',
    '/facturacion.html': 'facturacion',
    '/doctors.html': 'doctors',
    '/consentimientos.html': 'consentimientos',
    '/recordatorios.html': 'recordatorios',
    '/confirmaciones.html': 'confirmaciones',
    '/agendar-online.html': 'agendar-online',
    '/mi-sitio.html': 'mi-sitio',
    '/crecimiento.html': 'crecimiento',
    '/plan.html': 'plan',
    '/consultation.html': '',
    '/consultation-nutrition.html': '',
    '/view-consultation.html': '',
    '/clinical-record.html': '',
    '/medical-record.html': '',
    '/admin.html': 'admin',
    // Inventario desactivado — para reactivar, descomentar esta línea:
    // '/inventario.html': 'inventario',
    '/configuracion.html': 'configuracion',
    '/recepcion-inicio.html': 'rec-inicio',
    '/recepcion-citas.html': 'rec-citas',
    '/recepcion-pagos.html': 'rec-pagos'
  };
  const activePage = activeMap[path] || '';

  // Determine user role
  const role = localStorage.getItem('sd_role');
  const isSuperAdmin = role === 'super_admin';
  const isClinicAdmin = role === 'clinic_admin';
  const isReceptionist = role === 'receptionist';
  const isDoctor = role === 'doctor';

  function buildSidebarHTML() {
    let sections = [];

    if (isSuperAdmin) {
      // Super admin sidebar
      sections = [
        {
          label: 'AJUSTES',
          items: [
            { href: '/admin.html', key: 'admin', iconName: 'settings', label: 'Administración' }
          ]
        }
      ];
    } else if (isReceptionist) {
      // Receptionist sidebar
      sections = [
        {
          label: 'GENERAL',
          items: [
            { href: '/recepcion-inicio.html', key: 'rec-inicio', iconName: 'home', label: 'Inicio' },
            { href: '/recepcion-citas.html', key: 'rec-citas', iconName: 'calendar', label: 'Citas Hoy' },
            { href: '/recepcion-pagos.html', key: 'rec-pagos', iconName: 'wallet', label: 'Pagos' }
          ]
        },
        {
          label: 'AJUSTES',
          items: [
            { href: '/configuracion.html', key: 'configuracion', iconName: 'settings', label: 'Configuración' }
          ]
        }
      ];
    } else if (isClinicAdmin) {
      // Clinic admin sidebar
      sections = [
        {
          label: 'GENERAL',
          items: [
            { href: '/dashboard.html', key: 'dashboard', iconName: 'home', label: 'Inicio' },
            { href: '/citas.html', key: 'citas', iconName: 'calendar', label: 'Citas' },
            // Calendario Compartido desactivado — para reactivar, descomentar esta línea:
            // { href: '/calendario-compartido.html', key: 'calendario-compartido', iconName: 'calendar', label: 'Calendario Compartido' },
            { href: '/patients.html', key: 'patients', iconName: 'users', label: 'Pacientes' },
            // Mensajes desactivado — para reactivar, descomentar esta línea:
            // { href: '/mensajes.html', key: 'mensajes', iconName: 'messageSquare', label: 'Mensajes' },
            { href: '/finanzas.html', key: 'finanzas', iconName: 'wallet', label: 'Finanzas' }
            // Facturación desactivada — para reactivar, descomentar esta línea (y añadir la coma arriba):
            // ,{ href: '/facturacion.html', key: 'facturacion', iconName: 'fileText', label: 'Facturación' }
          ]
        },
        {
          label: 'CLÍNICA',
          items: [
            { href: '/doctors.html', key: 'doctors', iconName: 'staff', label: 'Personal' },
            { href: '/consentimientos.html', key: 'consentimientos', iconName: 'fileText', label: 'Consentimientos' },
            { href: '/recordatorios.html', key: 'recordatorios', iconName: 'bell', label: 'Recordatorios' },
            { href: '/confirmaciones.html', key: 'confirmaciones', iconName: 'check', label: 'Confirmaciones' },
            { href: '/agendar-online.html', key: 'agendar-online', iconName: 'calendar', label: 'Citas Online' },
            { href: '/mi-sitio.html', key: 'mi-sitio', iconName: 'globe', label: 'Mi Sitio Web' }
          ]
        },
        // Inventario desactivado — la sección OPERACIONES solo contenía esa entrada.
        // Para reactivar, descomentar este bloque:
        // {
        //   label: 'OPERACIONES',
        //   items: [
        //     { href: '/inventario.html', key: 'inventario', iconName: 'package', label: 'Inventario' }
        //   ]
        // },
        {
          label: 'AJUSTES',
          items: [
            { href: '/configuracion.html', key: 'configuracion', iconName: 'settings', label: 'Configuración' },
            { href: '/plan.html', key: 'plan', iconName: 'creditCard', label: 'Suscripción' }
          ]
        }
      ];
    } else {
      // Doctor sidebar
      sections = [
        {
          label: 'GENERAL',
          items: [
            { href: '/dashboard.html', key: 'dashboard', iconName: 'home', label: 'Inicio' },
            { href: '/citas.html', key: 'citas', iconName: 'calendar', label: 'Citas' },
            // Calendario Compartido desactivado — para reactivar, descomentar esta línea:
            // { href: '/calendario-compartido.html', key: 'calendario-compartido', iconName: 'calendar', label: 'Calendario Compartido' },
            { href: '/patients.html', key: 'patients', iconName: 'users', label: 'Pacientes' },
            // Mensajes desactivado — para reactivar, descomentar esta línea:
            // { href: '/mensajes.html', key: 'mensajes', iconName: 'messageSquare', label: 'Mensajes' },
            { href: '/finanzas.html', key: 'finanzas', iconName: 'wallet', label: 'Finanzas' }
            // Facturación desactivada — para reactivar, descomentar esta línea (y añadir la coma arriba):
            // ,{ href: '/facturacion.html', key: 'facturacion', iconName: 'fileText', label: 'Facturación' }
          ]
        },
        {
          label: 'CLÍNICA',
          items: [
            { href: '/consentimientos.html', key: 'consentimientos', iconName: 'fileText', label: 'Consentimientos' },
            { href: '/recordatorios.html', key: 'recordatorios', iconName: 'bell', label: 'Recordatorios' },
            { href: '/confirmaciones.html', key: 'confirmaciones', iconName: 'check', label: 'Confirmaciones' },
            { href: '/agendar-online.html', key: 'agendar-online', iconName: 'calendar', label: 'Citas Online' }
          ]
        },
        {
          label: 'AJUSTES',
          items: [
            { href: '/configuracion.html', key: 'configuracion', iconName: 'settings', label: 'Configuración' },
            { href: '/plan.html', key: 'plan', iconName: 'creditCard', label: 'Suscripción' }
          ]
        }
      ];
    }

    // Flatten sections to get all items for mobile menu
    const allItems = sections.flatMap(section => section.items);

    const navItems = sections.map(section => {
      const sectionHTML = `
        <div class="sb-section">
          <div class="sb-section-label">${section.label}</div>
          ${section.items.map(item => {
            const isActive = item.key === activePage ? 'active' : '';
            return `<a href="${item.href}" class="sb-item ${isActive}" data-icon="${item.iconName}">
              <span class="sb-icon"></span>
              <span>${item.label}</span>
            </a>`;
          }).join('')}
        </div>
      `;
      return sectionHTML;
    }).join('');

    // Mobile menu items (exclude items reserved for the drawer)
    const mobileMenuItems = allItems.filter(item => item.key !== 'consentimientos' && item.key !== 'recordatorios' && item.key !== 'confirmaciones' && item.key !== 'agendar-online' && item.key !== 'inventario' && item.key !== 'configuracion' && item.key !== 'plan' && item.key !== 'calendario-compartido' && item.key !== 'mi-sitio' && item.key !== 'doctors' && item.key !== 'facturacion').map(item => {
      const isActive = item.key === activePage ? 'active' : '';
      return `<a href="${item.href}" class="mobile-nav-item ${isActive}" data-icon="${item.iconName}">
        <span class="mobile-icon"></span>
        <span>${item.label}</span>
      </a>`;
    }).join('');

    const hamburgerMenu = `<button class="mobile-nav-hamburger" id="mobileMenuToggle" title="Menú">
      <span class="hamburger-icon" id="hamburgerIcon"></span>
      <span class="close-icon" id="closeIcon" style="display: none;"></span>
    </button>`;

    const mobileSidebar = `<div class="mobile-sidebar-overlay" id="mobileSidebarOverlay"></div>
      <aside class="mobile-sidebar" id="mobileSidebar">
        <div class="mobile-sidebar-header">
          <h2 class="mobile-sidebar-title">Menú</h2>
          <button class="mobile-sidebar-close" id="closeSidebarBtn"></button>
        </div>

        <div class="mobile-sidebar-content">
          <div class="sidebar-section">
            <div class="sb-profile" style="margin: 0;">
              <div class="sb-profile-row">
                <div class="sb-avatar" id="sbAvatarMobile">?</div>
                <div class="sb-user-block">
                  <div class="sb-specialty" id="sbSpecialtyMobile"></div>
                  <div class="sb-user-name" id="sbNameMobile">—</div>
                  <div class="sb-clinic" id="sbClinicMobile">—</div>
                </div>
              </div>
            </div>
          </div>

          ${isDoctor ? `<div class="sidebar-section sidebar-section--notif">
            <button type="button" class="sb-notif-card" id="sdNotifBellSidebar" aria-label="Notificaciones">
              <span class="sb-notif-icon-wrap">
                <span class="sb-notif-icon" id="sdNotifBellIconSidebar"></span>
                <span class="sb-notif-icon-pulse" aria-hidden="true"></span>
              </span>
              <span class="sb-notif-content">
                <span class="sb-notif-title">Notificaciones</span>
                <span class="sb-notif-status" id="sdNotifStatusSidebar">Sin novedades</span>
              </span>
              <span class="sb-notif-trail">
                <span class="sb-notif-badge" id="sdNotifBadgeSidebar" hidden>0</span>
                <span class="sb-notif-chevron" id="sdNotifChevronSidebar"></span>
              </span>
            </button>
          </div>` : ''}

          ${isReceptionist ? `<div class="sidebar-section">
            <div class="sidebar-label">AJUSTES</div>
            <a href="/configuracion.html" class="sidebar-menu-link">
              <span id="configMenuIcon"></span>
              <span>Configuración</span>
            </a>
          </div>` : `<!-- Sección GENERAL del cajón móvil desactivada: sus dos entradas (Facturación y
               Calendario Compartido) están desactivadas. Para reactivar, descomentar este bloque
               y dentro de él solo la entrada que se quiera mostrar:
          <div class="sidebar-section">
            <div class="sidebar-label">GENERAL</div>
            <a href="/facturacion.html" class="sidebar-menu-link">
              <span id="facturacionMenuIcon"></span>
              <span>Facturación</span>
            </a>
            <a href="/calendario-compartido.html" class="sidebar-menu-link">
              <span id="calCompartidoIcon"></span>
              <span>Calendario Compartido</span>
            </a>
          </div>
          -->
          <div class="sidebar-section">
            <div class="sidebar-label">CLÍNICA</div>
            ${isClinicAdmin ? `<a href="/doctors.html" class="sidebar-menu-link">
              <span id="personalMenuIcon"></span>
              <span>Personal</span>
            </a>` : ''}
            <a href="/consentimientos.html" class="sidebar-menu-link">
              <span id="consentsIcon"></span>
              <span>Consentimientos</span>
            </a>
            <a href="/recordatorios.html" class="sidebar-menu-link">
              <span id="remindersIcon"></span>
              <span>Recordatorios</span>
            </a>
            <a href="/confirmaciones.html" class="sidebar-menu-link">
              <span id="confirmsIcon"></span>
              <span>Confirmaciones</span>
            </a>
            <a href="/agendar-online.html" class="sidebar-menu-link">
              <span id="citasOnlineIcon"></span>
              <span>Citas Online</span>
            </a>
            ${isClinicAdmin ? `<a href="/mi-sitio.html" class="sidebar-menu-link">
              <span id="miSitioMenuIcon"></span>
              <span>Mi Sitio Web</span>
            </a>` : ''}
          </div>
          <!-- Sección OPERACIONES del cajón móvil desactivada: su única entrada
               (Inventario) está desactivada. Para reactivar, descomentar este bloque
               y volver a interpolarlo con \${isClinicAdmin ? \`…\` : ''}:
            <div class="sidebar-section">
              <div class="sidebar-label">OPERACIONES</div>
              <a href="/inventario.html" class="sidebar-menu-link">
                <span id="inventarioMenuIcon"></span>
                <span>Inventario</span>
              </a>
            </div>
          -->
          <div class="sidebar-section">
            <div class="sidebar-label">AJUSTES</div>
            <a href="/configuracion.html" class="sidebar-menu-link">
              <span id="configMenuIcon"></span>
              <span>Configuración</span>
            </a>
            <a href="/plan.html" class="sidebar-menu-link">
              <span id="planMenuIcon"></span>
              <span>Suscripción</span>
            </a>
          </div>`}

          <div class="sidebar-section">
            <div class="sidebar-label">Sesión</div>
            <button class="sidebar-menu-link sidebar-logout-link" onclick="logout()">
              <span id="logoutIcon"></span>
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>`;

    const desktopBell = isDoctor ? `
      <button type="button" class="sd-notif-bell" id="sdNotifBellDesktop" aria-label="Notificaciones" title="Notificaciones">
        <span class="sd-notif-bell-icon" id="sdNotifBellIconDesktop"></span>
        <span class="sd-notif-badge" id="sdNotifBadgeDesktop" hidden>0</span>
      </button>` : '';

    const mobileBell = isDoctor ? `
      <button type="button" class="sd-notif-bell sd-notif-bell--mobile" id="sdNotifBellMobile" aria-label="Notificaciones" title="Notificaciones">
        <span class="sd-notif-bell-icon" id="sdNotifBellIconMobile"></span>
        <span class="sd-notif-badge" id="sdNotifBadgeMobile" hidden>0</span>
      </button>` : '';

    const notifPanel = isDoctor ? `
      <div class="sd-notif-panel" id="sdNotifPanel" role="dialog" aria-label="Notificaciones" hidden>
        <div class="sd-notif-panel-header">
          <div class="sd-notif-panel-title">
            <span class="sd-notif-panel-title-icon" id="sdNotifPanelTitleIcon"></span>
            <span>Notificaciones</span>
          </div>
          <button type="button" class="sd-notif-panel-close" id="sdNotifPanelClose" aria-label="Cerrar">
            <span id="sdNotifPanelCloseIcon"></span>
          </button>
        </div>
        <div class="sd-notif-panel-body" id="sdNotifPanelBody"></div>
        <div class="sd-notif-panel-footer" id="sdNotifPanelFooter" hidden>
          <button type="button" class="sd-notif-clear" id="sdNotifClear">Marcar todas como leídas</button>
        </div>
      </div>
      <div class="sd-notif-toast-stack" id="sdNotifToastStack" aria-live="polite"></div>` : '';

    const sidebarLogoBlock = isDoctor ? `
        <div class="sb-logo-row">
          <div class="sb-logo" id="sbLogoIcon">
            <span></span>
          </div>
          ${desktopBell}
        </div>` : `
        <div class="sb-logo" id="sbLogoIcon">
          <span></span>
        </div>`;

    return `
      <aside id="sidebar">
        ${sidebarLogoBlock}

        <div class="sb-profile">
          <div class="sb-profile-row">
            <div class="sb-avatar" id="sbAvatar">?</div>
            <div class="sb-user-block">
              <div class="sb-specialty" id="sbSpecialty"></div>
              <div class="sb-user-name" id="sbName">—</div>
              <div class="sb-clinic" id="sbClinic">—</div>
            </div>
          </div>
        </div>

        <nav class="sb-nav">
          ${navItems}
        </nav>

        <button class="sb-logout" onclick="logout()">
          <span id="sidebarLogoutIcon"></span>
          <span>Cerrar Sesión</span>
        </button>

        <button class="sb-toggle" id="sidebarToggle" title="Expandir/contraer">
          <span id="toggleIcon"></span>
        </button>
      </aside>

      <nav id="mobileNav" class="mobile-nav">
        <svg width="0" height="0" style="position:absolute;pointer-events:none" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="mobileNavIconGradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24">
              <stop offset="0%" stop-color="#134e4a"/>
              <stop offset="100%" stop-color="#38bdf8"/>
            </linearGradient>
          </defs>
        </svg>
        ${mobileMenuItems}
        ${hamburgerMenu}
      </nav>
      ${mobileSidebar}
      ${notifPanel}
    `;
  }

  function renderSidebarIcons() {
    if (typeof Icons === 'undefined') return;

    // Logo icon (marca oficial — cruz molinillo, colores fijos de marca)
    const logoIcon = document.querySelector('#sbLogoIcon span:first-child');
    if (logoIcon && !logoIcon.innerHTML.trim()) logoIcon.innerHTML = Icons.render('logoMark', 30);

    // Sidebar nav icons
    document.querySelectorAll('.sb-item[data-icon]').forEach(item => {
      const icon = item.querySelector('.sb-icon');
      if (icon && !icon.innerHTML.trim()) icon.innerHTML = Icons.render(item.dataset.icon, 16);
    });

    // Mobile nav icons
    document.querySelectorAll('.mobile-nav-item[data-icon]').forEach(item => {
      const icon = item.querySelector('.mobile-icon');
      if (icon && !icon.innerHTML.trim()) icon.innerHTML = Icons.render(item.dataset.icon, 26);
    });

    // Logout icons
    const sidebarLogout = document.querySelector('#sidebarLogoutIcon');
    if (sidebarLogout && !sidebarLogout.innerHTML.trim()) sidebarLogout.innerHTML = Icons.render('logOut', 16);

    const mobileLogout = document.querySelector('#logoutIcon');
    if (mobileLogout && !mobileLogout.innerHTML.trim()) mobileLogout.innerHTML = Icons.render('logOut', 16);

    // Toggle icon
    const toggleIcon = document.querySelector('#toggleIcon');
    if (toggleIcon && !toggleIcon.innerHTML.trim()) toggleIcon.innerHTML = Icons.render('chevronRight', 16);

    // Hamburger and close icons
    const hamburgerIcon = document.querySelector('#hamburgerIcon');
    const closeIcon = document.querySelector('#closeIcon');
    if (hamburgerIcon && !hamburgerIcon.innerHTML.trim()) hamburgerIcon.innerHTML = Icons.render('menu', 20);
    if (closeIcon && !closeIcon.innerHTML.trim()) closeIcon.innerHTML = Icons.render('x', 20);

    // Close sidebar button icon
    const closeSidebarBtn = document.querySelector('#closeSidebarBtn');
    if (closeSidebarBtn && !closeSidebarBtn.innerHTML.trim()) closeSidebarBtn.innerHTML = Icons.render('x', 18);

    // Notification icon
    const notificationIcon = document.querySelector('#notificationIcon');
    if (notificationIcon && !notificationIcon.innerHTML.trim()) notificationIcon.innerHTML = Icons.render('bell', 24);

    // Calendario Compartido menu icon
    const facturacionMenuIcon = document.querySelector('#facturacionMenuIcon');
    if (facturacionMenuIcon && !facturacionMenuIcon.innerHTML.trim()) facturacionMenuIcon.innerHTML = Icons.render('fileText', 16);

    const calCompartidoIcon = document.querySelector('#calCompartidoIcon');
    if (calCompartidoIcon && !calCompartidoIcon.innerHTML.trim()) calCompartidoIcon.innerHTML = Icons.render('calendar', 16);

    // Citas Online menu icon
    const citasOnlineIcon = document.querySelector('#citasOnlineIcon');
    if (citasOnlineIcon && !citasOnlineIcon.innerHTML.trim()) citasOnlineIcon.innerHTML = Icons.render('calendar', 16);

    // Consents menu icon
    const consentsIcon = document.querySelector('#consentsIcon');
    if (consentsIcon && !consentsIcon.innerHTML.trim()) consentsIcon.innerHTML = Icons.render('fileText', 16);

    // Reminders menu icon
    const remindersIcon = document.querySelector('#remindersIcon');
    if (remindersIcon && !remindersIcon.innerHTML.trim()) remindersIcon.innerHTML = Icons.render('bell', 16);

    // Confirmations menu icon
    const confirmsIcon = document.querySelector('#confirmsIcon');
    if (confirmsIcon && !confirmsIcon.innerHTML.trim()) confirmsIcon.innerHTML = Icons.render('check', 16);

    // Inventario desactivado — para reactivar, descomentar estas líneas:
    // const inventarioMenuIcon = document.querySelector('#inventarioMenuIcon');
    // if (inventarioMenuIcon && !inventarioMenuIcon.innerHTML.trim()) inventarioMenuIcon.innerHTML = Icons.render('package', 16);

    // Mi Sitio Web menu icon (drawer móvil)
    const miSitioMenuIcon = document.querySelector('#miSitioMenuIcon');
    if (miSitioMenuIcon && !miSitioMenuIcon.innerHTML.trim()) miSitioMenuIcon.innerHTML = Icons.render('globe', 16);

    const personalMenuIcon = document.querySelector('#personalMenuIcon');
    if (personalMenuIcon && !personalMenuIcon.innerHTML.trim()) personalMenuIcon.innerHTML = Icons.render('staff', 16);

    // Configuración menu icon
    const configMenuIcon = document.querySelector('#configMenuIcon');
    if (configMenuIcon && !configMenuIcon.innerHTML.trim()) configMenuIcon.innerHTML = Icons.render('settings', 16);

    // Suscripción menu icon (drawer móvil)
    const planMenuIcon = document.querySelector('#planMenuIcon');
    if (planMenuIcon && !planMenuIcon.innerHTML.trim()) planMenuIcon.innerHTML = Icons.render('creditCard', 16);

    // Doctor notification bell icons
    const bellDesktop = document.querySelector('#sdNotifBellIconDesktop');
    if (bellDesktop && !bellDesktop.innerHTML.trim()) bellDesktop.innerHTML = Icons.render('bell', 18);
    const bellMobile = document.querySelector('#sdNotifBellIconMobile');
    if (bellMobile && !bellMobile.innerHTML.trim()) bellMobile.innerHTML = Icons.render('bell', 22);
    const bellSidebar = document.querySelector('#sdNotifBellIconSidebar');
    if (bellSidebar && !bellSidebar.innerHTML.trim()) bellSidebar.innerHTML = Icons.render('bell', 18);
    const notifChevSidebar = document.querySelector('#sdNotifChevronSidebar');
    if (notifChevSidebar && !notifChevSidebar.innerHTML.trim()) notifChevSidebar.innerHTML = Icons.render('chevronRight', 16);
    const notifTitleIcon = document.querySelector('#sdNotifPanelTitleIcon');
    if (notifTitleIcon && !notifTitleIcon.innerHTML.trim()) notifTitleIcon.innerHTML = Icons.render('bell', 18);
    const notifCloseIcon = document.querySelector('#sdNotifPanelCloseIcon');
    if (notifCloseIcon && !notifCloseIcon.innerHTML.trim()) notifCloseIcon.innerHTML = Icons.render('x', 16);
  }

  function injectSidebar() {
    console.log('[layout.js] injectSidebar called');

    // Check if sidebar already exists (to avoid re-injection on page navigation)
    const existingSidebar = document.getElementById('sidebar');
    if (existingSidebar) {
      console.log('[layout.js] Sidebar already exists, updating only active state');
      // Just update the active state for navigation
      document.querySelectorAll('.sb-item').forEach(el => el.classList.remove('active'));
      const activeItem = document.querySelector(`.sb-item[href="${window.location.pathname}"]`);
      if (activeItem) activeItem.classList.add('active');
      renderSidebarIcons();
      return;
    }

    // Create and insert sidebar + mobile nav (first load only)
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildSidebarHTML();

    // Get all elements (desktop sidebar, mobile nav, mobile overlay, mobile sidebar, notif panel, toast stack)
    const sidebarEl = wrapper.querySelector('aside#sidebar');
    const mobileNavEl = wrapper.querySelector('nav#mobileNav');
    const mobileOverlayEl = wrapper.querySelector('.mobile-sidebar-overlay');
    const mobileSidebarEl = wrapper.querySelector('aside.mobile-sidebar');
    const notifPanelEl = wrapper.querySelector('#sdNotifPanel');
    const notifToastStackEl = wrapper.querySelector('#sdNotifToastStack');

    console.log('[layout.js] Sidebar element:', sidebarEl);

    if (sidebarEl) {
      document.body.insertBefore(sidebarEl, document.body.firstChild);
      console.log('[layout.js] Sidebar injected');
    }
    if (mobileNavEl) {
      document.body.insertBefore(mobileNavEl, document.body.firstChild);
      console.log('[layout.js] Mobile nav injected');
    }
    if (mobileOverlayEl) {
      document.body.insertBefore(mobileOverlayEl, document.body.firstChild);
      console.log('[layout.js] Mobile overlay injected');
    }
    if (mobileSidebarEl) {
      document.body.insertBefore(mobileSidebarEl, document.body.firstChild);
      console.log('[layout.js] Mobile sidebar injected');
    }
    if (notifPanelEl) {
      document.body.appendChild(notifPanelEl);
    }
    if (notifToastStackEl) {
      document.body.appendChild(notifToastStackEl);
    }

    // Render icons immediately if available, or after Icons loads
    if (typeof Icons !== 'undefined') {
      renderSidebarIcons();
    } else {
      setTimeout(() => renderSidebarIcons(), 100);
    }

    // Mark main content for margin-left
    const mainEl = document.querySelector('main');
    if (mainEl && !mainEl.classList.contains('layout-main')) {
      mainEl.classList.add('layout-main');
    }

    // Load user profile
    loadUserProfile();
  }

  async function loadUserProfile() {
    try {
      // Try to use cached profile first
      const cached = localStorage.getItem('sd_user_profile');
      if (cached) {
        const cachedData = JSON.parse(cached);
        updateProfileUI(cachedData);
      }

      // Load fresh data from API
      const me = await api('/api/auth/me');
      if (me) {
        // Cache the profile
        localStorage.setItem('sd_user_profile', JSON.stringify(me));
        updateProfileUI(me);
      }
    } catch (e) {
      console.error('Error loading user profile:', e);
    }
  }

  function updateProfileUI(user) {
    if (!user) return;

    const rawName = user.name || user.email.split('@')[0];
    const hasPrefix = /^(dr\.?|dra\.?)\s/i.test(rawName);
    const displayName = (user.role === 'doctor' && !hasPrefix)
      ? `Dr. ${rawName}`
      : rawName;
    const initials = displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    const avatarEls = [
      document.getElementById('sbAvatar'),
      document.getElementById('sbAvatarMobile')
    ];
    const nameEls = [
      document.getElementById('sbName'),
      document.getElementById('sbNameMobile')
    ];
    const clinicEls = [
      document.getElementById('sbClinic'),
      document.getElementById('sbClinicMobile')
    ];
    const specialtyEls = [
      document.getElementById('sbSpecialty'),
      document.getElementById('sbSpecialtyMobile')
    ];

    avatarEls.forEach(el => {
      if (!el) return;
      // Default: gradient del CSS + iniciales como fallback siempre.
      el.style.removeProperty('background-image');
      el.textContent = initials;
      // Si hay photo_url, intentamos cargarla. Solo si carga, la pintamos
      // encima del gradiente y limpiamos las iniciales. Si falla (404, CORS,
      // URL rota), nos quedamos con iniciales + gradiente — sin círculo vacío.
      // Va con `important` a propósito: los temas pintan el avatar con
      // `background: … !important`, que sin esto tumba la foto (pasaba en dark).
      if (user.photo_url) {
        const img = new Image();
        img.onload = () => {
          el.style.setProperty('background-image', `url("${user.photo_url}")`, 'important');
          el.style.setProperty('background-size', 'cover', 'important');
          el.style.setProperty('background-position', 'center', 'important');
          el.textContent = '';
        };
        img.onerror = () => { /* dejamos iniciales + gradiente */ };
        img.src = user.photo_url;
      }
    });
    nameEls.forEach(el => { if (el) el.textContent = displayName; });
    clinicEls.forEach(el => { if (el) el.textContent = user.clinic_name || ''; });

    let specialtyText = '';
    if (user.role === 'receptionist') specialtyText = 'Recepcionista';
    else if (user.role === 'clinic_admin') specialtyText = 'Administrador de clínica';
    else if (user.specialty) {
      specialtyText = user.specialty;
      localStorage.setItem('sd_user_specialty', user.specialty);
    }
    specialtyEls.forEach(el => { if (el) el.textContent = specialtyText; });
  }

  function initSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('sidebarToggle');

    if (!toggle || !sidebar) {
      console.warn('[layout.js] Toggle elements not found');
      return;
    }

    // Load saved state
    const savedState = localStorage.getItem('sd_sidebar_expanded');
    if (savedState === 'true') {
      sidebar.classList.add('expanded');
    }

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const isExpanded = sidebar.classList.contains('expanded');
      if (isExpanded) {
        sidebar.classList.remove('expanded');
        localStorage.setItem('sd_sidebar_expanded', 'false');
      } else {
        sidebar.classList.add('expanded');
        localStorage.setItem('sd_sidebar_expanded', 'true');
      }
    });
  }

  // Inject sidebar immediately (DOM is always ready when this script runs)
  injectSidebar();

  // Update notifications in sidebar
  window.updateNotifications = function(notifications) {
    const panel = document.getElementById('notificationPanel');
    if (!panel) return;

    // Handle both array and count formats
    const notifyArray = Array.isArray(notifications) ? notifications : [];
    const count = Array.isArray(notifications) ? notifications.length : (typeof notifications === 'number' ? notifications : 0);

    if (count === 0) {
      panel.innerHTML = `<div style="text-align: center; padding: 1.5rem; color: #94a3b8;">
        <div style="margin-bottom: 0.5rem; opacity: 0.6;" id="emptyNotificationIcon"></div>
        <p style="font-size: 0.85rem;">Sin notificaciones</p>
      </div>`;
      if (typeof Icons !== 'undefined') {
        const icon = document.getElementById('emptyNotificationIcon');
        if (icon) icon.innerHTML = Icons.render('bell', 32);
      }
    } else if (notifyArray.length > 0) {
      const html = notifyArray.map(n => `
        <div class="notification-item-content">
          <div class="notification-item-title">${esc(n.title || 'Notificación')}</div>
          <div class="notification-item-text">${esc(n.message || '')}</div>
          <div class="notification-item-time">${esc(n.time || '')}</div>
        </div>
      `).join('');
      panel.innerHTML = html;
    }
  };

  // Handle mobile sidebar toggle
  function initMobileSidebar() {
    const toggleBtn = document.getElementById('mobileMenuToggle');
    const closeBtn = document.getElementById('closeSidebarBtn');
    const sidebar = document.getElementById('mobileSidebar');
    const overlay = document.getElementById('mobileSidebarOverlay');

    console.log('[layout.js] initMobileSidebar - toggleBtn:', !!toggleBtn, 'sidebar:', !!sidebar, 'overlay:', !!overlay);

    if (!toggleBtn || !sidebar || !overlay) {
      console.warn('[layout.js] Mobile sidebar elements not found');
      return;
    }

    const hamburgerIcon = toggleBtn.querySelector('.hamburger-icon');
    const closeIcon = toggleBtn.querySelector('.close-icon');

    // El scrim acompaña al cajón al cerrar (.closing) durante lo que dura el
    // deslizamiento; si se ocultara de golpe, la página aparecería nítida antes
    // de que el cajón terminara de salir y se vería un corte vertical.
    const DRAWER_MS = 350;
    let closingTimer = null;

    function openSidebar() {
      console.log('[layout.js] Opening sidebar');
      clearTimeout(closingTimer);
      overlay.classList.remove('closing');
      sidebar.classList.add('active');
      overlay.classList.add('active');
      if (hamburgerIcon) hamburgerIcon.style.display = 'none';
      if (closeIcon) closeIcon.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
      console.log('[layout.js] Closing sidebar');
      const estabaAbierto = overlay.classList.contains('active');
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
      if (estabaAbierto) {
        overlay.classList.add('closing');
        clearTimeout(closingTimer);
        closingTimer = setTimeout(() => overlay.classList.remove('closing'), DRAWER_MS);
      }
      if (hamburgerIcon) hamburgerIcon.style.display = 'block';
      if (closeIcon) closeIcon.style.display = 'none';
      document.body.style.overflow = '';
      toggleBtn.blur();
    }

    toggleBtn.addEventListener('click', (e) => {
      console.log('[layout.js] Hamburger clicked');
      e.preventDefault();
      if (sidebar.classList.contains('active')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', closeSidebar);
    }

    overlay.addEventListener('click', closeSidebar);

    // Close on navigation
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      if (link && !link.classList.contains('mobile-nav-item') && sidebar.classList.contains('active')) {
        closeSidebar();
      }
    });

    // Show page loader on mobile nav click
    document.querySelectorAll('.mobile-nav-item[data-icon]').forEach(item => {
      item.addEventListener('click', () => {
        const pageLoader = document.getElementById('pageLoader');
        if (pageLoader) {
          pageLoader.classList.remove('hidden');
          pageLoader.style.opacity = '1';
        }
      });
    });

    console.log('[layout.js] Mobile sidebar initialized');
  }

  // Try to initialize multiple times with delays
  let initAttempts = 0;
  const initInterval = setInterval(() => {
    initAttempts++;
    const sidebar = document.getElementById('mobileSidebar');
    if (sidebar || initAttempts > 20) {
      clearInterval(initInterval);
      setTimeout(() => initMobileSidebar(), 50);
    }
  }, 50);

  // Initialize toggle (retry if needed)
  function tryInitToggle(attempt = 1) {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');

    if (toggle && sidebar) {
      initSidebarToggle();
    } else if (attempt < 10) {
      setTimeout(() => tryInitToggle(attempt + 1), 50);
    }
  }

  tryInitToggle();

  // ── Doctor notification bell (citas confirmadas por paciente) ──
  if (isDoctor) {
    initDoctorNotifications();
  }

  function initDoctorNotifications() {
    const POLL_MS = 20000;
    const STORAGE_KEY = 'sd_seen_confirmations';
    const PERM_PROMPTED_KEY = 'sd_notif_permission_prompted';

    let cached = [];
    let firstLoad = true;
    let panelOpen = false;
    let pollTimer = null;
    let audioCtx = null;

    function getSeenSet() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Set();
        return new Set(JSON.parse(raw));
      } catch (_) { return new Set(); }
    }
    function persistSeenSet(set) {
      try {
        // Cap at 200 IDs to prevent unbounded growth
        const arr = Array.from(set).slice(-200);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      } catch (_) {}
    }

    function relativeTime(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
      if (diff < 60) return 'hace unos segundos';
      if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
      if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
      const day = d.toLocaleDateString('es-HN', { day: 'numeric', month: 'short' });
      return day;
    }

    function formatScheduled(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      const date = d.toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric', month: 'short' });
      const time = d.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${date} · ${time}`;
    }

    // Premium two-tone chime via WebAudio — no asset needed
    function playChime() {
      try {
        if (!audioCtx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          audioCtx = new Ctx();
        }
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
        const now = audioCtx.currentTime;
        const tones = [
          { f: 880, t: 0,    d: 0.18 },
          { f: 1318.5, t: 0.12, d: 0.32 }
        ];
        tones.forEach(({ f, t, d }) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.value = f;
          gain.gain.setValueAtTime(0, now + t);
          gain.gain.linearRampToValueAtTime(0.18, now + t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
          osc.connect(gain).connect(audioCtx.destination);
          osc.start(now + t);
          osc.stop(now + t + d + 0.02);
        });
      } catch (_) {}
    }

    function ensureNotifPermission() {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default' && !sessionStorage.getItem(PERM_PROMPTED_KEY)) {
        sessionStorage.setItem(PERM_PROMPTED_KEY, '1');
        // Lazy request on first user gesture (browser requirement)
        const requestOnce = () => {
          try { Notification.requestPermission().catch(() => {}); } catch (_) {}
          window.removeEventListener('click', requestOnce);
          window.removeEventListener('keydown', requestOnce);
        };
        window.addEventListener('click', requestOnce, { once: true });
        window.addEventListener('keydown', requestOnce, { once: true });
      }
    }

    // ── Puente a la app NATIVA de escritorio (Tauri / macOS) ──
    // Cuando la plataforma corre dentro de la app de Mac, el WKWebView NO
    // muestra las notificaciones web; usamos las notificaciones nativas del
    // sistema y el badge del Dock. Fuera de la app, todo esto es no-op.
    const inTauri = typeof window !== 'undefined' && !!(window.__TAURI__ || window.__TAURI_INTERNALS__);

    function tauriNotify(title, body) {
      try {
        const core = window.__TAURI__ && window.__TAURI__.core;
        if (core && typeof core.invoke === 'function') {
          core.invoke('plugin:notification|notify', {
            options: { title: String(title || 'Salud Digital'), body: String(body || '') }
          }).catch(() => {});
        }
      } catch (_) {}
    }

    function tauriDockBadge(count) {
      try {
        const w = window.__TAURI__ && window.__TAURI__.window;
        const getWin = w && (w.getCurrentWindow || w.getCurrent);
        if (getWin) {
          const win = getWin.call(w);
          if (win && typeof win.setBadgeCount === 'function') {
            win.setBadgeCount(count > 0 ? count : undefined).catch(() => {});
          }
        }
      } catch (_) {}
    }

    function fireBrowserNotification(item) {
      const title = item.status === 'confirmed'
        ? 'Cita confirmada'
        : 'Cita cancelada por el paciente';
      const body = `${item.patient_name} · ${formatScheduled(item.scheduled_at)}`;
      // App nativa de escritorio → notificación del sistema.
      if (inTauri) { tauriNotify(title, body); return; }
      // Navegador → API de notificaciones web.
      try {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;
        const n = new Notification(title, {
          body,
          tag: `sd-conf-${item.id}`,
          silent: false
        });
        n.onclick = () => {
          window.focus();
          window.location.href = '/confirmaciones.html';
          n.close();
        };
      } catch (_) {}
    }

    function showToast(item) {
      const stack = document.getElementById('sdNotifToastStack');
      if (!stack) return;
      const isConfirm = item.status === 'confirmed';
      const toast = document.createElement('div');
      toast.className = 'sd-notif-toast ' + (isConfirm ? 'sd-notif-toast--confirm' : 'sd-notif-toast--decline');
      toast.innerHTML = `
        <div class="sd-notif-toast-icon">${
          typeof Icons !== 'undefined' ? Icons.render(isConfirm ? 'check' : 'x', 18) : ''
        }</div>
        <div class="sd-notif-toast-body">
          <div class="sd-notif-toast-title">${isConfirm ? 'Cita confirmada' : 'Cita cancelada'}</div>
          <div class="sd-notif-toast-text">${esc(item.patient_name)}</div>
          <div class="sd-notif-toast-meta">${esc(formatScheduled(item.scheduled_at))}</div>
        </div>
        <button type="button" class="sd-notif-toast-close" aria-label="Cerrar">${
          typeof Icons !== 'undefined' ? Icons.render('x', 14) : '×'
        }</button>
      `;
      stack.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('show'));
      const remove = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 320);
      };
      toast.querySelector('.sd-notif-toast-close').addEventListener('click', remove);
      toast.addEventListener('click', (e) => {
        if (e.target.closest('.sd-notif-toast-close')) return;
        window.location.href = '/confirmaciones.html';
      });
      setTimeout(remove, 7000);
    }

    function renderPanel() {
      const body = document.getElementById('sdNotifPanelBody');
      const footer = document.getElementById('sdNotifPanelFooter');
      if (!body) return;

      if (!cached.length) {
        body.innerHTML = `
          <div class="sd-notif-empty">
            <div class="sd-notif-empty-icon">${typeof Icons !== 'undefined' ? Icons.render('bell', 28) : ''}</div>
            <div class="sd-notif-empty-title">Sin novedades</div>
            <div class="sd-notif-empty-text">Aquí verás cuando un paciente confirme su cita.</div>
          </div>`;
        if (footer) footer.hidden = true;
        return;
      }
      const seen = getSeenSet();
      const html = cached.map(item => {
        const isConfirm = item.status === 'confirmed';
        const unread = !seen.has(item.id);
        return `
          <div class="sd-notif-item ${unread ? 'unread' : ''} ${isConfirm ? 'is-confirm' : 'is-decline'}">
            <div class="sd-notif-item-dot"></div>
            <div class="sd-notif-item-icon">${typeof Icons !== 'undefined' ? Icons.render(isConfirm ? 'check' : 'x', 16) : ''}</div>
            <div class="sd-notif-item-body">
              <div class="sd-notif-item-title">${isConfirm ? 'Confirmó su cita' : 'Canceló su cita'}</div>
              <div class="sd-notif-item-name">${esc(item.patient_name)}</div>
              <div class="sd-notif-item-meta">
                <span>${esc(formatScheduled(item.scheduled_at))}</span>
                <span class="sd-notif-item-sep">·</span>
                <span>${esc(relativeTime(item.responded_at))}</span>
              </div>
            </div>
          </div>`;
      }).join('');
      body.innerHTML = html;
      if (footer) footer.hidden = !cached.some(i => !seen.has(i.id));
    }

    function updateBadges() {
      const seen = getSeenSet();
      const unread = cached.filter(i => !seen.has(i.id)).length;
      // Badge del Dock cuando corre en la app nativa de escritorio.
      tauriDockBadge(unread);
      ['sdNotifBadgeDesktop', 'sdNotifBadgeMobile', 'sdNotifBadgeSidebar'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (unread === 0) {
          el.hidden = true;
        } else {
          el.hidden = false;
          el.textContent = unread > 9 ? '9+' : String(unread);
        }
      });
      ['sdNotifBellDesktop', 'sdNotifBellMobile', 'sdNotifBellSidebar'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('has-unread', unread > 0);
      });
      const statusEl = document.getElementById('sdNotifStatusSidebar');
      if (statusEl) {
        if (unread === 0) {
          statusEl.textContent = 'Sin novedades';
        } else if (unread === 1) {
          statusEl.textContent = '1 sin leer';
        } else {
          statusEl.textContent = (unread > 99 ? '99+' : unread) + ' sin leer';
        }
      }
    }

    function openPanel() {
      const panel = document.getElementById('sdNotifPanel');
      if (!panel) return;
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add('open'));
      panelOpen = true;
      renderPanel();
      // Anchor to the bell that triggered (desktop vs mobile)
      const isMobile = window.matchMedia('(max-width: 860px)').matches;
      panel.classList.toggle('sd-notif-panel--mobile', isMobile);
    }
    function closePanel() {
      const panel = document.getElementById('sdNotifPanel');
      if (!panel) return;
      panel.classList.remove('open');
      panelOpen = false;
      setTimeout(() => { if (!panelOpen) panel.hidden = true; }, 220);
    }
    function togglePanel() { panelOpen ? closePanel() : openPanel(); }

    function markAllAsRead() {
      const seen = getSeenSet();
      cached.forEach(i => seen.add(i.id));
      persistSeenSet(seen);
      renderPanel();
      updateBadges();
    }

    async function poll() {
      try {
        const list = await api('/api/confirmations/notifications');
        const items = Array.isArray(list) ? list : [];
        const prevIds = new Set(cached.map(i => i.id));
        cached = items;

        if (firstLoad) {
          // On first load: don't fire sound/popup for pre-existing items —
          // mark them as seen so the user doesn't get a flood.
          const seen = getSeenSet();
          items.forEach(i => seen.add(i.id));
          persistSeenSet(seen);
          firstLoad = false;
        } else {
          const newOnes = items.filter(i => !prevIds.has(i.id));
          if (newOnes.length) {
            playChime();
            newOnes.forEach(item => {
              fireBrowserNotification(item);
              showToast(item);
            });
          }
        }
        renderPanel();
        updateBadges();
      } catch (e) {
        // Silent — keep polling; show no error UI to avoid noise
        console.warn('[notif] poll failed', e && e.message);
      }
    }

    function wireBellHandlers() {
      const desk = document.getElementById('sdNotifBellDesktop');
      const mob = document.getElementById('sdNotifBellMobile');
      const side = document.getElementById('sdNotifBellSidebar');
      const closeBtn = document.getElementById('sdNotifPanelClose');
      const clearBtn = document.getElementById('sdNotifClear');
      const panel = document.getElementById('sdNotifPanel');

      [desk, mob].forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          ensureNotifPermission();
          // Resume audio context on user gesture (autoplay policy)
          if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
          togglePanel();
        });
      });
      // Sidebar entry: close the hamburger drawer first, then open the panel
      if (side) {
        side.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          ensureNotifPermission();
          if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
          const mobSidebar = document.getElementById('mobileSidebar');
          const mobOverlay = document.getElementById('mobileSidebarOverlay');
          const hamb = document.getElementById('mobileMenuToggle');
          if (mobSidebar) mobSidebar.classList.remove('active');
          // Mismo cierre acompañado que el del botón: sin .closing el scrim
          // desaparecería de golpe y se vería el corte mientras el cajón sale.
          if (mobOverlay && mobOverlay.classList.contains('active')) {
            mobOverlay.classList.remove('active');
            mobOverlay.classList.add('closing');
            setTimeout(() => mobOverlay.classList.remove('closing'), 350);
          }
          document.body.style.overflow = '';
          if (hamb) {
            const hi = hamb.querySelector('.hamburger-icon');
            const ci = hamb.querySelector('.close-icon');
            if (hi) hi.style.display = 'block';
            if (ci) ci.style.display = 'none';
          }
          setTimeout(openPanel, 200);
        });
      }
      if (closeBtn) closeBtn.addEventListener('click', closePanel);
      if (clearBtn) clearBtn.addEventListener('click', markAllAsRead);

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (!panelOpen) return;
        if (panel && (panel.contains(e.target))) return;
        if (e.target.closest('#sdNotifBellDesktop, #sdNotifBellMobile, #sdNotifBellSidebar')) return;
        closePanel();
      });
      // Close on Esc
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panelOpen) closePanel();
      });
    }

    function start() {
      const ready = document.getElementById('sdNotifPanel');
      if (!ready) { setTimeout(start, 100); return; }
      wireBellHandlers();
      ensureNotifPermission();
      poll();
      pollTimer = setInterval(poll, POLL_MS);
      // El sondeo se DETIENE con la pestaña oculta y se reanuda al volver. Antes
      // solo se re-sondeaba al volver, pero el intervalo nunca paraba: una pestaña
      // olvidada en segundo plano seguía pidiendo notificaciones cada 20 s durante
      // días. Ojo: "oculta" es pestaña tapada o app minimizada — una pantalla de
      // recepción encendida en otro monitor sigue contando como visible.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (!pollTimer) pollTimer = setInterval(poll, POLL_MS);
          poll(); // al volver, datos frescos ya
        } else if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      });
    }

    start();
  }

  // Page transition animations
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');

    // Skip: empty href, anchors, javascript, new tab, download, external
    if (!href || href.startsWith('#') || href.startsWith('javascript') ||
        link.target === '_blank' || link.hasAttribute('download') ||
        href.startsWith('http')) return;

    e.preventDefault();
    var main = document.querySelector('.layout-main');
    if (main) {
      main.classList.add('page-exit');
      setTimeout(function() { window.location.href = href; }, 150);
    } else {
      window.location.href = href;
    }
  });
})();

// ── Modo solo lectura por suscripción (frontend) ──
// El servidor es quien manda: sin plan activo deja pasar las lecturas y responde
// 402 a cualquier escritura. Aquí va la parte visible de ese estado:
//   · los botones que ESCRIBEN (nuevo paciente, guardar consulta, agendar…)
//     quedan apagados y no abren nada: al pulsarlos sale el aviso. Sin esto el
//     usuario rellenaba un formulario entero para chocar con el muro al final.
//   · window.sdPaywall(msg) — ese aviso, que además dispara common.js si alguna
//     escritura se cuela igual y vuelve con 402. No navega: el formulario queda
//     intacto.
//   · una cinta permanente avisando de que la cuenta está en solo lectura, para
//     que nadie descubra el límite recién al guardar.
// El estado se cachea 60s en sessionStorage para no consultarlo en cada
// navegación.
(function () {
  var GATED_ROLES = ['clinic_admin', 'doctor', 'receptionist'];
  var CACHE_KEY = 'sd_billing_ok_until';
  var path = window.location.pathname;
  var ESTILOS_ID = 'sdReadonlyStyles';

  // Colores propios, sin heredar --card/--text: muchas páginas redefinen esas
  // variables en su propio <style> (que va DESPUÉS de theme-dark.css en la
  // cascada), así que en oscuro la cinta salía blanca. Aquí se declaran los dos
  // temas a mano y no depende de nadie.
  function inyectarEstilos() {
    if (document.getElementById(ESTILOS_ID)) return;
    var s = document.createElement('style');
    s.id = ESTILOS_ID;
    s.textContent = [
      // Flotante y fuera del flujo: metida dentro de <main> se convertía en
      // celda del grid de páginas como /patients.html y les descolocaba las
      // columnas. Así no toca la maquetación de ninguna pantalla.
      '.sd-ro-bar{position:fixed;z-index:1100;left:50%;transform:translateX(-50%);',
      'bottom:calc(14px + env(safe-area-inset-bottom, 0px));',
      'width:max-content;max-width:min(560px, calc(100vw - 24px));',
      'display:flex;align-items:center;gap:.7rem;',
      'padding:.5rem .5rem .5rem .95rem;border-radius:999px;',
      'background:#fff;border:1px solid #e2e8f0;box-shadow:0 10px 30px rgba(15,23,42,.16)}',
      '.sd-ro-bar .sd-ro-dot{width:7px;height:7px;border-radius:50%;background:#0891b2;flex:none}',
      '.sd-ro-bar .sd-ro-txt{font-size:.82rem;line-height:1.35;color:#0f172a}',
      '.sd-ro-bar .sd-ro-txt b{font-weight:600}',
      '.sd-ro-bar .sd-ro-txt span{color:#64748b}',
      '.sd-ro-bar .sd-ro-cta{flex:none;padding:.42rem .85rem;border-radius:999px;border:0;cursor:pointer;',
      'background:#0891b2;color:#fff;font:inherit;font-size:.78rem;font-weight:600;',
      'text-decoration:none;display:inline-block;white-space:nowrap}',
      '.sd-ro-bar .sd-ro-cta:hover{background:#0e7490}',
      '@media (max-width:600px){.sd-ro-bar .sd-ro-txt span{display:none}}',
      'html[data-theme="dark"] .sd-ro-bar{background:rgba(20,20,22,.82);',
      '-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);',
      'border-color:rgba(255,255,255,.1);box-shadow:0 10px 30px rgba(0,0,0,.45)}',
      'html[data-theme="dark"] .sd-ro-bar .sd-ro-dot{background:#06b6d4}',
      'html[data-theme="dark"] .sd-ro-bar .sd-ro-txt{color:#f1f5f9}',
      'html[data-theme="dark"] .sd-ro-bar .sd-ro-txt span{color:#94a3b8}',
      'html[data-theme="dark"] .sd-ro-bar .sd-ro-cta{background:#06b6d4;color:#04191e}',
      'html[data-theme="dark"] .sd-ro-bar .sd-ro-cta:hover{background:#22d3ee}',

      '.sd-pw-scrim{position:fixed;inset:0;z-index:9998;background:rgba(15,23,42,.45);',
      'display:flex;align-items:center;justify-content:center;padding:1.25rem}',
      'html[data-theme="dark"] .sd-pw-scrim{background:rgba(0,0,0,.62)}',
      '.sd-pw-card{width:100%;max-width:400px;background:#fff;color:#0f172a;',
      'border:1px solid #e2e8f0;border-radius:16px;padding:1.5rem;',
      'box-shadow:0 24px 60px rgba(15,23,42,.22)}',
      '.sd-pw-card h3{margin:0 0 .5rem;font-size:1.05rem;font-weight:650}',
      '.sd-pw-card p{margin:0 0 1.25rem;font-size:.875rem;line-height:1.55;color:#64748b}',
      '.sd-pw-actions{display:flex;gap:.6rem;justify-content:flex-end;flex-wrap:wrap}',
      '.sd-pw-actions button,.sd-pw-actions a{padding:.55rem 1rem;border-radius:9px;font:inherit;',
      'font-size:.85rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}',
      '.sd-pw-ghost{background:transparent;border:1px solid #e2e8f0;color:#0f172a}',
      '.sd-pw-solid{background:#0891b2;border:1px solid #0891b2;color:#fff}',
      '.sd-pw-solid:hover{background:#0e7490}',
      'html[data-theme="dark"] .sd-pw-card{background:#141416;color:#f1f5f9;',
      'border-color:rgba(255,255,255,.09);box-shadow:0 24px 60px rgba(0,0,0,.5)}',
      'html[data-theme="dark"] .sd-pw-card p{color:#94a3b8}',
      'html[data-theme="dark"] .sd-pw-ghost{border-color:rgba(255,255,255,.14);color:#cbd5e1}',
      'html[data-theme="dark"] .sd-pw-solid{background:#06b6d4;border-color:#06b6d4;color:#04191e}',
      'html[data-theme="dark"] .sd-pw-solid:hover{background:#22d3ee;border-color:#22d3ee}',

      // Acción bloqueada: se ve apagada (gris, sin sombra) pero SIGUE recibiendo
      // el clic —de ahí `pointer-events` intacto y `disabled` sin poner—, porque
      // el clic es lo que abre la explicación. Los hijos sí quedan inertes para
      // que el evento llegue siempre al propio botón y no a un <span> interior.
      'html.sd-readonly .sd-gated{opacity:.45;filter:grayscale(.9);cursor:not-allowed;',
      'box-shadow:none!important;transform:none!important}',
      'html.sd-readonly .sd-gated:hover{opacity:.45;filter:grayscale(.9);transform:none!important}',
      'html.sd-readonly .sd-gated *{pointer-events:none}'
    ].join('');
    document.head.appendChild(s);
  }

  // Aviso de escritura bloqueada. Se define ya mismo (no espera al fetch de
  // estado) porque el usuario puede pulsar "Guardar" antes de que resuelva.
  window.sdPaywall = function (mensaje) {
    if (document.querySelector('.sd-pw-scrim')) return; // ya hay uno abierto
    inyectarEstilos();
    var scrim = document.createElement('div');
    scrim.className = 'sd-pw-scrim';
    scrim.innerHTML =
      '<div class="sd-pw-card" role="dialog" aria-modal="true" aria-label="Suscripción requerida">' +
        '<h3>Activa tu suscripción para guardar</h3>' +
        '<p></p>' +
        '<div class="sd-pw-actions">' +
          '<button type="button" class="sd-pw-ghost">Seguir explorando</button>' +
          '<a class="sd-pw-solid" href="/plan.html">Ver suscripción</a>' +
        '</div>' +
      '</div>';
    scrim.querySelector('p').textContent = mensaje ||
      'Tu cuenta está en modo solo lectura: puedes recorrer la plataforma, pero para registrar pacientes, citas o consultas necesitas el plan activo.';
    function cerrar() { scrim.remove(); }
    scrim.querySelector('.sd-pw-ghost').addEventListener('click', cerrar);
    scrim.addEventListener('click', function (e) { if (e.target === scrim) cerrar(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', esc); }
    });
    document.body.appendChild(scrim);
  };

  function pintarCinta(puedeGestionar) {
    if (document.querySelector('.sd-ro-bar')) return;
    inyectarEstilos();
    var bar = document.createElement('div');
    bar.className = 'sd-ro-bar';
    bar.innerHTML =
      '<span class="sd-ro-dot"></span>' +
      '<div class="sd-ro-txt"><b>Modo solo lectura.</b> ' +
      '<span>Aún no se guardan cambios.</span></div>' +
      (puedeGestionar ? '<a class="sd-ro-cta" href="/plan.html">Activar</a>' : '');
    document.body.appendChild(bar);
  }

  // ── Bloqueo de las acciones que escriben ──
  // No hay un inventario de botones que mantener al día: se reconocen por su
  // etiqueta (el verbo con el que empiezan) y por eso funciona igual en las
  // pantallas que pintan sus botones desde JS o React. Dos escapes para cuando
  // la heurística no acierta, ambos vía atributo en el HTML y heredables (valen
  // para todo lo que haya dentro del elemento que los lleva):
  //   data-sd-gate      → bloquea esto sí o sí (etiqueta rara, icono sin texto)
  //   data-sd-gate="off"→ nunca lo bloquees
  var CONTROLES = 'button, a[href], input[type="submit"], input[type="button"], [role="button"], label[for]';
  var SELECTOR = CONTROLES + ', [data-sd-gate]';

  // Verbos con los que arranca una acción que guarda algo. Anclado al principio
  // a propósito: "Agenda y disponibilidad" (una pestaña) no puede caer por
  // contener "agenda", y "Iniciar sesión" no puede caer por "iniciar".
  var VERBOS_DE_ESCRITURA = new RegExp('^(?:' + [
    'nuev[oa]', 'a[ñn]adir', 'agregar', 'crear', 'guardar', 'registrar',
    'agendar', 'reagendar', 'programar', 'reprogramar', 'reservar',
    'firmar', 'confirmar firma', 'confirmar cita',
    'iniciar consulta', 'iniciar conversaci', 'iniciar expediente',
    'invitar', 'dar de alta', 'dar de baja', 'enviar', 'reenviar', 'subir', 'importar',
    'editar', 'modificar', 'eliminar', 'borrar', 'archivar', 'desarchivar',
    'marcar', 'finalizar', 'cobrar', 'facturar', 'duplicar', 'asignar', 'liberar',
    'cancelar cita', 'anular'
  ].join('|') + ')', 'i');

  function esEscritura(texto) {
    if (!texto) return false;
    // Fuera lo que no sea letra al principio ("＋ Nueva cita", "✓ Marcar…"): así
    // el ancla no se rompe por un icono. Un "+" pelado queda en cadena vacía y
    // no dispara nada — los +/− de cantidad son locales, no escriben.
    var t = String(texto).replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/, '').trim();
    return !!t && VERBOS_DE_ESCRITURA.test(t);
  }

  function estaBloqueada(el) {
    if (!el || el.nodeType !== 1 || !el.closest) return false;
    // Un <label> entra solo si lo piden a mano (el de subir foto, que abre el
    // selector de archivos): hay etiquetas de campo que empiezan por verbo
    // —"Nueva contraseña"— y no son ninguna acción.
    if (el.tagName === 'LABEL' && el.getAttribute('data-sd-gate') === null) return false;
    // El atributo manda, y se hereda: puesto en un contenedor vale para todo lo
    // que hay dentro (una zona entera de la pantalla que escribe), y el "off" de
    // más adentro gana sobre el bloqueo de más afuera.
    var portador = el.closest('[data-sd-gate]');
    if (portador) {
      var marca = portador.getAttribute('data-sd-gate');
      return !(marca === 'off' || marca === 'false');
    }
    if (el.closest('.sd-ro-bar, .sd-pw-scrim')) return false;
    if (el.tagName === 'A') {
      var href = el.getAttribute('href') || '';
      // La salida (pagar, salir, escribirnos) nunca se bloquea a sí misma.
      if (/^(?:mailto:|tel:|https?:)/i.test(href) || /plan\.html|login\.html/i.test(href)) return false;
    }
    return esEscritura(el.getAttribute('aria-label')) ||
           esEscritura(el.getAttribute('title')) ||
           esEscritura((el.textContent || '').slice(0, 60));
  }

  function apagar(el) {
    if (el.classList.contains('sd-gated')) return;
    el.classList.add('sd-gated');
    el.setAttribute('aria-disabled', 'true');
    // El title solo si no había: es una de las fuentes de la etiqueta y
    // pisarlo dejaría al botón sin lo que lo identificaba.
    if (!el.getAttribute('title')) {
      el.setAttribute('title', 'Necesitas la suscripción activa para guardar cambios');
    }
  }

  var observador = null;
  var repaso = null;

  function repasar() {
    // Solo se apagan los controles: si el atributo va en un contenedor, lo que
    // se ve gris son los botones de dentro, no la caja entera (y así tampoco se
    // acumulan dos opacidades sobre el mismo botón).
    var nodos = document.querySelectorAll(CONTROLES);
    for (var i = 0; i < nodos.length; i++) {
      if (estaBloqueada(nodos[i])) apagar(nodos[i]);
    }
    // Descarta las mutaciones que acabamos de provocar nosotros mismos: sin
    // esto, marcar dispararía otro repaso en bucle.
    if (observador) observador.takeRecords();
  }

  function programarRepaso() {
    if (repaso) return;
    repaso = setTimeout(function () { repaso = null; repasar(); }, 80);
  }

  function bloquearAcciones() {
    // Captura, no burbuja: hay que llegar antes que el onclick del propio botón
    // (y antes que el handler de transición de página) para poder cancelarlo.
    document.addEventListener('click', function (e) {
      if (!window.SD_READONLY) return;
      var origen = e.target;
      if (!origen || !origen.closest) return;
      var el = origen.closest(SELECTOR);
      if (!el || !estaBloqueada(el)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      apagar(el);
      window.sdPaywall();
    }, true);

    // Enviar con Enter en un formulario sin botón de submit visible: el clic
    // sintético no siempre existe, así que el submit se ataja aparte.
    document.addEventListener('submit', function (e) {
      if (!window.SD_READONLY) return;
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      if (form.closest('.sd-pw-scrim')) return;
      var portador = form.closest('[data-sd-gate]');
      var marcado = !!portador && portador.getAttribute('data-sd-gate') !== 'off' &&
                    portador.getAttribute('data-sd-gate') !== 'false';
      var disparador = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
      if (!marcado && !(disparador && estaBloqueada(disparador))) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      window.sdPaywall();
    }, true);

    repasar();
    // Media app pinta sus botones después (fetch, React, modales): hay que
    // seguir mirando. Solo corre en cuentas sin plan, que son la excepción.
    if (window.MutationObserver) {
      observador = new MutationObserver(programarRepaso);
      observador.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['title', 'aria-label', 'data-sd-gate', 'href', 'class']
      });
    }
  }

  if (path === '/plan.html' || path === '/login.html' || path === '/registro.html' ||
      path === '/landing.html' || path === '/accept-invitation.html' ||
      path === '/' || path === '/index.html') return;
  try {
    if (GATED_ROLES.indexOf(localStorage.getItem('sd_role')) === -1) return;
    var okUntil = parseInt(sessionStorage.getItem(CACHE_KEY) || '0', 10);
    if (okUntil && Date.now() < okUntil) return; // verificado hace poco
  } catch (_) { return; }

  fetch('/api/billing/status', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.access) return;
      if (data.access.active) {
        try { sessionStorage.setItem(CACHE_KEY, String(Date.now() + 60000)); } catch (_) {}
        return;
      }
      try { sessionStorage.removeItem(CACHE_KEY); } catch (_) {}
      window.SD_READONLY = true;
      document.documentElement.classList.add('sd-readonly');
      inyectarEstilos();
      var pintar = function () { pintarCinta(!!data.can_manage); bloquearAcciones(); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintar);
      else pintar();
    })
    .catch(function () { /* sin red: que decida el servidor en la próxima llamada */ });
})();

// ── App nativa de escritorio (Tauri): enlaces externos en el navegador ──
// Dentro de la app de Mac, los enlaces a OTROS dominios y los esquemas
// especiales (mailto/tel/WhatsApp) no deben navegar el webview (dejarían al
// usuario "atrapado" fuera de la plataforma): se abren en el navegador del
// sistema. Los enlaces internos (mismo host) siguen navegando dentro de la app.
(function () {
  if (!(window.__TAURI__ || window.__TAURI_INTERNALS__)) return;
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var raw = a.getAttribute('href');
    if (!raw || raw.charAt(0) === '#' || raw.indexOf('javascript:') === 0) return;
    var u;
    try { u = new URL(raw, window.location.href); } catch (_) { return; }
    var sameApp = (u.host === window.location.host) || /(^|\.)onrender\.com$/i.test(u.host);
    var external = (u.protocol === 'http:' || u.protocol === 'https:') && !sameApp;
    var special = /^(mailto|tel|sms|whatsapp|facetime):/i.test(u.protocol);
    if (!external && !special) return; // interno → navega dentro de la app
    e.preventDefault();
    e.stopPropagation();
    try {
      var core = window.__TAURI__ && window.__TAURI__.core;
      if (core && typeof core.invoke === 'function') {
        core.invoke('plugin:opener|open_url', { url: u.href }).catch(function () {});
      }
    } catch (_) {}
  }, true);
})();

// ── Aceptación legal pendiente (frontend) ──
//
// El servidor ya bloquea las escrituras con 451 cuando falta aceptar la versión
// vigente de los documentos. Aquí va la parte amable: preguntarlo al entrar y
// abrir el modal, para que nadie descubra que hay términos nuevos justo cuando
// intentaba guardar una consulta.
//
// El modal vive en legal-consent.js, que se carga bajo demanda: es un archivo
// que solo hace falta cuando hay algo pendiente o cuando alguien abre un
// documento, así que no se le cuelga a todas las páginas por defecto.
(function () {
  var SIN_MODAL = [
    '/login.html', '/registro.html', '/landing.html', '/accept-invitation.html',
    '/legal.html', '/plan.html', '/', '/index.html', '/offline.html'
  ];
  var ROLES = ['clinic_admin', 'doctor', 'receptionist'];

  // ── La versión del despliegue, sacada de la propia página ──
  //
  // El servidor reescribe cada <script src> y <link href> del HTML añadiéndoles
  // ?v=<commit>, y así el navegador se trae el archivo nuevo tras cada deploy.
  // Un script inyectado por JS NO pasa por esa reescritura: se pedía
  // /legal-consent.js a secas, que viaja con Cache-Control de un día y encima
  // lo guarda el service worker. Resultado: el modal legal de la app seguía
  // siendo el de hace un día aunque el servidor ya sirviera otro.
  // Se copia la versión de cualquier recurso que ya la traiga.
  function versionDeAssets() {
    var el = document.querySelector('script[src*="?v="], link[href*="?v="]');
    if (!el) return '';
    var url = el.getAttribute('src') || el.getAttribute('href') || '';
    var m = /[?&]v=([^&#]+)/.exec(url);
    return m ? m[1] : '';
  }

  window.sdCargarLegal = function () {
    if (window.SDLegal) return Promise.resolve(window.SDLegal);
    if (window.__sdLegalCargando) return window.__sdLegalCargando;
    window.__sdLegalCargando = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      var v = versionDeAssets();
      s.src = '/legal-consent.js' + (v ? '?v=' + encodeURIComponent(v) : '');
      s.onload = function () { resolve(window.SDLegal); };
      s.onerror = function () { reject(new Error('No se pudo cargar el visor legal.')); };
      document.head.appendChild(s);
    });
    return window.__sdLegalCargando;
  };

  if (SIN_MODAL.indexOf(window.location.pathname) !== -1) return;
  try {
    if (ROLES.indexOf(localStorage.getItem('sd_role')) === -1) return;
  } catch (_) { return; }

  // Una sola consulta por carga de página. Es barata (el servidor la cachea 60 s
  // por usuario) y es la única forma de enterarse de una versión nueva sin
  // esperar a que el usuario intente guardar algo.
  fetch('/api/legal/pending', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.pending || d.pending.length === 0) return;
      return window.sdCargarLegal().then(function (SDL) {
        var abrir = function () { SDL.comprobarPendientes(); };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', abrir);
        else abrir();
      });
    })
    .catch(function () { /* sin red: el servidor lo exigirá en la próxima escritura */ });
})();
