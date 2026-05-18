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
    '/citas.html': 'citas',
    '/calendario-compartido.html': 'calendario-compartido',
    '/finanzas.html': 'finanzas',
    '/doctors.html': 'doctors',
    '/consentimientos.html': 'consentimientos',
    '/recordatorios.html': 'recordatorios',
    '/confirmaciones.html': 'confirmaciones',
    '/agendar-online.html': 'agendar-online',
    '/plan.html': 'plan',
    '/consultation.html': '',
    '/consultation-nutrition.html': '',
    '/view-consultation.html': '',
    '/clinical-record.html': '',
    '/medical-record.html': '',
    '/admin.html': 'admin',
    '/inventario.html': 'inventario',
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
            { href: '/calendario-compartido.html', key: 'calendario-compartido', iconName: 'calendar', label: 'Calendario Compartido' },
            { href: '/patients.html', key: 'patients', iconName: 'users', label: 'Pacientes' },
            { href: '/finanzas.html', key: 'finanzas', iconName: 'wallet', label: 'Finanzas' }
          ]
        },
        {
          label: 'CLÍNICA',
          items: [
            { href: '/doctors.html', key: 'doctors', iconName: 'staff', label: 'Personal' },
            { href: '/consentimientos.html', key: 'consentimientos', iconName: 'fileText', label: 'Consentimientos' },
            { href: '/recordatorios.html', key: 'recordatorios', iconName: 'bell', label: 'Recordatorios' },
            { href: '/confirmaciones.html', key: 'confirmaciones', iconName: 'check', label: 'Confirmaciones' },
            { href: '/agendar-online.html', key: 'agendar-online', iconName: 'calendar', label: 'Citas Online' }
          ]
        },
        {
          label: 'OPERACIONES',
          items: [
            { href: '/inventario.html', key: 'inventario', iconName: 'package', label: 'Inventario' }
          ]
        },
        {
          label: 'AJUSTES',
          items: [
            { href: '/plan.html', key: 'plan', iconName: 'creditCard', label: 'Mi Plan' },
            { href: '/configuracion.html', key: 'configuracion', iconName: 'settings', label: 'Configuración' }
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
            { href: '/calendario-compartido.html', key: 'calendario-compartido', iconName: 'calendar', label: 'Calendario Compartido' },
            { href: '/patients.html', key: 'patients', iconName: 'users', label: 'Pacientes' },
            { href: '/finanzas.html', key: 'finanzas', iconName: 'wallet', label: 'Finanzas' }
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
            { href: '/configuracion.html', key: 'configuracion', iconName: 'settings', label: 'Configuración' }
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

    // Mobile menu items (exclude Consentimientos, Recordatorios, Citas Online, Mi Plan from mobile sticky menu)
    const mobileMenuItems = allItems.filter(item => item.key !== 'consentimientos' && item.key !== 'recordatorios' && item.key !== 'confirmaciones' && item.key !== 'agendar-online' && item.key !== 'plan' && item.key !== 'inventario' && item.key !== 'configuracion' && item.key !== 'calendario-compartido').map(item => {
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
                  <div class="sb-user-name" id="sbNameMobile">—</div>
                  <div class="sb-clinic" id="sbClinicMobile">—</div>
                </div>
              </div>
              <div class="sb-specialty-badge" id="sbSpecialtyMobile"></div>
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
            <a href="/configuracion.html" class="sidebar-menu-link">
              <span id="configMenuIcon"></span>
              <span>Configuración</span>
            </a>
          </div>` : `<div class="sidebar-section">
            <a href="/calendario-compartido.html" class="sidebar-menu-link">
              <span id="calCompartidoIcon"></span>
              <span>Calendario Compartido</span>
            </a>
            <a href="/agendar-online.html" class="sidebar-menu-link">
              <span id="citasOnlineIcon"></span>
              <span>Citas Online</span>
            </a>
            <a href="/plan.html" class="sidebar-menu-link">
              <span id="planIcon"></span>
              <span>Mi Plan</span>
            </a>
            ${isClinicAdmin ? `<a href="/inventario.html" class="sidebar-menu-link">
              <span id="inventarioMenuIcon"></span>
              <span>Inventario</span>
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
            <a href="/configuracion.html" class="sidebar-menu-link">
              <span id="configMenuIcon"></span>
              <span>Configuración</span>
            </a>
          </div>`}

          <div class="sidebar-section">
            <div class="sidebar-label">Sesión</div>
            <button class="sidebar-logout-btn" onclick="logout()">
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
            <span>SaludDigital</span>
          </div>
          ${desktopBell}
        </div>` : `
        <div class="sb-logo" id="sbLogoIcon">
          <span></span>
          <span>SaludDigital</span>
        </div>`;

    return `
      <aside id="sidebar">
        ${sidebarLogoBlock}

        <div class="sb-profile">
          <div class="sb-profile-row">
            <div class="sb-avatar" id="sbAvatar">?</div>
            <div class="sb-user-block">
              <div class="sb-user-name" id="sbName">—</div>
              <div class="sb-clinic" id="sbClinic">—</div>
            </div>
          </div>
          <div class="sb-specialty-badge" id="sbSpecialty"></div>
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

    // Logo icon
    const logoIcon = document.querySelector('#sbLogoIcon span:first-child');
    if (logoIcon && !logoIcon.innerHTML.trim()) logoIcon.innerHTML = Icons.render('stethoscope', 20);

    // Sidebar nav icons
    document.querySelectorAll('.sb-item[data-icon]').forEach(item => {
      const icon = item.querySelector('.sb-icon');
      if (icon && !icon.innerHTML.trim()) icon.innerHTML = Icons.render(item.dataset.icon, 16);
    });

    // Mobile nav icons
    document.querySelectorAll('.mobile-nav-item[data-icon]').forEach(item => {
      const icon = item.querySelector('.mobile-icon');
      if (icon && !icon.innerHTML.trim()) icon.innerHTML = Icons.render(item.dataset.icon, 22);
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
    const calCompartidoIcon = document.querySelector('#calCompartidoIcon');
    if (calCompartidoIcon && !calCompartidoIcon.innerHTML.trim()) calCompartidoIcon.innerHTML = Icons.render('calendar', 16);

    // Citas Online menu icon
    const citasOnlineIcon = document.querySelector('#citasOnlineIcon');
    if (citasOnlineIcon && !citasOnlineIcon.innerHTML.trim()) citasOnlineIcon.innerHTML = Icons.render('calendar', 16);

    // Mi Plan menu icon
    const planIcon = document.querySelector('#planIcon');
    if (planIcon && !planIcon.innerHTML.trim()) planIcon.innerHTML = Icons.render('creditCard', 16);

    // Consents menu icon
    const consentsIcon = document.querySelector('#consentsIcon');
    if (consentsIcon && !consentsIcon.innerHTML.trim()) consentsIcon.innerHTML = Icons.render('fileText', 16);

    // Reminders menu icon
    const remindersIcon = document.querySelector('#remindersIcon');
    if (remindersIcon && !remindersIcon.innerHTML.trim()) remindersIcon.innerHTML = Icons.render('bell', 16);

    // Confirmations menu icon
    const confirmsIcon = document.querySelector('#confirmsIcon');
    if (confirmsIcon && !confirmsIcon.innerHTML.trim()) confirmsIcon.innerHTML = Icons.render('check', 16);

    // Inventario menu icon
    const inventarioMenuIcon = document.querySelector('#inventarioMenuIcon');
    if (inventarioMenuIcon && !inventarioMenuIcon.innerHTML.trim()) inventarioMenuIcon.innerHTML = Icons.render('package', 16);

    // Configuración menu icon
    const configMenuIcon = document.querySelector('#configMenuIcon');
    if (configMenuIcon && !configMenuIcon.innerHTML.trim()) configMenuIcon.innerHTML = Icons.render('settings', 16);

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
      if (user.photo_url) {
        el.innerHTML = '';
        el.style.backgroundImage = `url("${user.photo_url}")`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.textContent = '';
      } else {
        el.style.backgroundImage = '';
        el.textContent = initials;
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

    function openSidebar() {
      console.log('[layout.js] Opening sidebar');
      sidebar.classList.add('active');
      overlay.classList.add('active');
      if (hamburgerIcon) hamburgerIcon.style.display = 'none';
      if (closeIcon) closeIcon.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
      console.log('[layout.js] Closing sidebar');
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
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

    function fireBrowserNotification(item) {
      try {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;
        const title = item.status === 'confirmed'
          ? 'Cita confirmada'
          : 'Cita cancelada por el paciente';
        const body = `${item.patient_name} · ${formatScheduled(item.scheduled_at)}`;
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
          if (mobOverlay) mobOverlay.classList.remove('active');
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
      // Re-poll when tab regains focus
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') poll();
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
