// ── layout.js — Global Sidebar & Header Injection ──

(function() {
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
        { href: '/admin.html', key: 'admin', icon: '⚙️', label: 'Administración' }
      ];
    } else {
      // clinic_admin / doctor sidebar
      items = [
        { href: '/dashboard.html', key: 'dashboard', icon: '📊', label: 'Inicio' },
        { href: '/citas.html', key: 'citas', icon: '📅', label: 'Citas' },
        { href: '/patients.html', key: 'patients', icon: '👥', label: 'Pacientes' },
        { href: '/finanzas.html', key: 'finanzas', icon: '💰', label: 'Finanzas' }
      ];
    }

    const navItems = items.map(item => {
      const isActive = item.key === activePage ? 'active' : '';
      return `<a href="${item.href}" class="sb-item ${isActive}">
        <span style="font-size: 1.1rem;">${item.icon}</span>
        <span>${item.label}</span>
      </a>`;
    }).join('');

    // Mobile menu items (same items as sidebar)
    const mobileMenuItems = items.map(item => {
      const isActive = item.key === activePage ? 'active' : '';
      return `<a href="${item.href}" class="mobile-nav-item ${isActive}">
        <span>${item.icon}</span>
        <span>${item.label}</span>
      </a>`;
    }).join('');

    return `
      <aside id="sidebar">
        <div class="sb-logo">
          <svg fill="#0891b2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L7.5 7H9.5V15H14.5V7H16.5L12 2M4 17H20V18H4V17Z"/>
          </svg>
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
          <svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Cerrar Sesión</span>
        </button>

        <button class="sb-toggle" id="sidebarToggle" title="Expandir/contraer">
          <svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </aside>

      <nav id="mobileNav" class="mobile-nav">
        ${mobileMenuItems}
      </nav>
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
    // Get the aside element (skip text nodes)
    const sidebarEl = wrapper.querySelector('aside');
    const mobileNavEl = wrapper.querySelector('nav#mobileNav');
    console.log('[layout.js] Sidebar element:', sidebarEl);
    if (sidebarEl) {
      document.body.insertBefore(sidebarEl, document.body.firstChild);
      console.log('[layout.js] Sidebar injected');
    }
    if (mobileNavEl) {
      document.body.insertBefore(mobileNavEl, document.body.firstChild);
      console.log('[layout.js] Mobile nav injected');
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
