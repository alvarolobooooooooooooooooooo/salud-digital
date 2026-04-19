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
    '/finanzas.html': 'finanzas',
    '/doctors.html': 'doctors',
    '/consultation.html': '',
    '/view-consultation.html': '',
    '/clinical-record.html': '',
    '/medical-record.html': '',
    '/admin.html': 'admin'
  };
  const activePage = activeMap[path] || '';

  // Determine if super_admin
  const role = localStorage.getItem('sd_role');
  const isSuperAdmin = role === 'super_admin';

  function buildSidebarHTML() {
    let items = [];

    if (isSuperAdmin) {
      // Super admin sidebar
      items = [
        { href: '/admin.html', key: 'admin', iconName: 'settings', label: 'Administración' }
      ];
    } else {
      // clinic_admin / doctor sidebar
      items = [
        { href: '/dashboard.html', key: 'dashboard', iconName: 'home', label: 'Inicio' },
        { href: '/citas.html', key: 'citas', iconName: 'calendar', label: 'Citas' },
        { href: '/patients.html', key: 'patients', iconName: 'users', label: 'Pacientes' },
        { href: '/finanzas.html', key: 'finanzas', iconName: 'wallet', label: 'Finanzas' }
      ];
    }

    const navItems = items.map(item => {
      const isActive = item.key === activePage ? 'active' : '';
      return `<a href="${item.href}" class="sb-item ${isActive}" data-icon="${item.iconName}">
        <span class="sb-icon"></span>
        <span>${item.label}</span>
      </a>`;
    }).join('');

    // Mobile menu items (same items as sidebar)
    const mobileMenuItems = items.map(item => {
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
            <div class="sidebar-label">Notificaciones</div>
            <div class="notification-item" id="notificationPanel">
              <div style="text-align: center; padding: 1.5rem; color: #94a3b8;">
                <div id="notificationIcon" style="margin-bottom: 0.5rem; opacity: 0.6;"></div>
                <p style="font-size: 0.85rem;">Sin notificaciones</p>
              </div>
            </div>
          </div>

          <div class="sidebar-section">
            <div class="sidebar-label">Sesión</div>
            <button class="sidebar-logout-btn" onclick="logout()">
              <span id="logoutIcon"></span>
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>`;

    return `
      <aside id="sidebar">
        <div class="sb-logo" id="sbLogoIcon">
          <span></span>
          <span>SaludDigital</span>
        </div>

        <div class="sb-profile">
          <div class="sb-avatar" id="sbAvatar">?</div>
          <div class="sb-user-name" id="sbName">—</div>
          <div class="sb-clinic" id="sbClinic">—</div>
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
        ${mobileMenuItems}
        ${hamburgerMenu}
      </nav>
      ${mobileSidebar}
    `;
  }

  function injectSidebar() {
    console.log('[layout.js] injectSidebar called');
    // Remove old nav if exists
    const oldNav = document.querySelector('nav');
    if (oldNav && oldNav.id !== 'mobileNav') oldNav.remove();

    // Create and insert sidebar + mobile nav
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildSidebarHTML();

    // Get all elements (desktop sidebar, mobile nav, mobile overlay, mobile sidebar)
    const sidebarEl = wrapper.querySelector('aside#sidebar');
    const mobileNavEl = wrapper.querySelector('nav#mobileNav');
    const mobileOverlayEl = wrapper.querySelector('.mobile-sidebar-overlay');
    const mobileSidebarEl = wrapper.querySelector('aside.mobile-sidebar');

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

    // Renderizar iconos
    setTimeout(() => {
      if (typeof Icons !== 'undefined') {
        // Logo icon
        const logoIcon = document.querySelector('#sbLogoIcon span:first-child');
        if (logoIcon) logoIcon.innerHTML = Icons.render('stethoscope', 20);

        // Sidebar nav icons
        document.querySelectorAll('.sb-item[data-icon]').forEach(item => {
          const icon = item.querySelector('.sb-icon');
          if (icon) icon.innerHTML = Icons.render(item.dataset.icon, 16);
        });

        // Mobile nav icons
        document.querySelectorAll('.mobile-nav-item[data-icon]').forEach(item => {
          const icon = item.querySelector('.mobile-icon');
          if (icon) icon.innerHTML = Icons.render(item.dataset.icon, 16);
        });

        // Logout icons
        const sidebarLogout = document.querySelector('#sidebarLogoutIcon');
        if (sidebarLogout) sidebarLogout.innerHTML = Icons.render('logOut', 16);

        const mobileLogout = document.querySelector('#logoutIcon');
        if (mobileLogout) mobileLogout.innerHTML = Icons.render('logOut', 16);

        // Toggle icon
        const toggleIcon = document.querySelector('#toggleIcon');
        if (toggleIcon) toggleIcon.innerHTML = Icons.render('chevronRight', 16);

        // Hamburger and close icons
        const hamburgerIcon = document.querySelector('#hamburgerIcon');
        const closeIcon = document.querySelector('#closeIcon');
        if (hamburgerIcon) hamburgerIcon.innerHTML = Icons.render('menu', 20);
        if (closeIcon) closeIcon.innerHTML = Icons.render('x', 20);

        // Close sidebar button icon
        const closeSidebarBtn = document.querySelector('#closeSidebarBtn');
        if (closeSidebarBtn) closeSidebarBtn.innerHTML = Icons.render('x', 18);

        // Notification icon
        const notificationIcon = document.querySelector('#notificationIcon');
        if (notificationIcon) notificationIcon.innerHTML = Icons.render('bell', 24);
      }
    }, 50);

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
      const me = await api('/api/auth/me');
      const displayName = me.role === 'doctor'
        ? `Dr. ${me.name || me.email.split('@')[0]}`
        : (me.name || me.email.split('@')[0]);
      const initials = displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

      const avatarEl = document.getElementById('sbAvatar');
      const nameEl = document.getElementById('sbName');
      const clinicEl = document.getElementById('sbClinic');

      if (avatarEl) avatarEl.textContent = initials;
      if (nameEl) nameEl.textContent = displayName;
      if (clinicEl) clinicEl.textContent = me.clinic_name || '';
    } catch (e) {
      console.error('Error loading user profile:', e);
    }
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
