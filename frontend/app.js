(function() {
  'use strict';

  const LANGUAGES = [
    { code: 'auto', en: 'Auto-detect', native: 'Auto-detect' },
    { code: 'hi-en', en: 'Hindi-English', native: 'हिंदी-English' },
    { code: 'en', en: 'English', native: 'English' },
    { code: 'hi', en: 'Hindi', native: 'हिन्दी' },
    { code: 'pa', en: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
    { code: 'ur', en: 'Urdu', native: 'اردو' },
    { code: 'bn', en: 'Bengali', native: 'বাংলা' },
    { code: 'mr', en: 'Marathi', native: 'मराठी' },
    { code: 'gu', en: 'Gujarati', native: 'ગુજરાતી' },
    { code: 'ta', en: 'Tamil', native: 'தமிழ்' },
    { code: 'te', en: 'Telugu', native: 'తెలుగు' },
    { code: 'ar', en: 'Arabic', native: 'العربية' },
    { code: 'es', en: 'Spanish', native: 'Español' },
    { code: 'fr', en: 'French', native: 'Français' },
    { code: 'kn', en: 'Kannada', native: 'ಕನ್ನಡ' },
    { code: 'ml', en: 'Malayalam', native: 'മലയാളം' },
    { code: 'or', en: 'Odia', native: 'ଓଡ଼ିଆ' },
    { code: 'as', en: 'Assamese', native: 'অসমীয়া' },
    { code: 'mai', en: 'Maithili', native: 'मैथिली' },
    { code: 'sa', en: 'Sanskrit', native: 'संस्कृतम्' },
    { code: 'ne', en: 'Nepali', native: 'नेपाली' },
    { code: 'si', en: 'Sinhala', native: 'සිංහල' },
    { code: 'my', en: 'Burmese', native: 'မြန်မာဘာသာ' },
    { code: 'zh', en: 'Chinese', native: '中文' },
    { code: 'ja', en: 'Japanese', native: '日本語' },
    { code: 'ko', en: 'Korean', native: '한국어' },
    { code: 'de', en: 'German', native: 'Deutsch' },
    { code: 'ru', en: 'Russian', native: 'Русский' },
    { code: 'pt', en: 'Portuguese', native: 'Português' },
    { code: 'it', en: 'Italian', native: 'Italiano' }
  ];

  const RTL_LANGS = new Set(['ar', 'ur', 'he', 'fa']);

  const SPEECH_LANG = {
    auto: 'hi-IN', 'hi-en': 'hi-IN', en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN', ur: 'ur-PK', bn: 'bn-IN',
    mr: 'mr-IN', gu: 'gu-IN', ta: 'ta-IN', te: 'te-IN', ar: 'ar', es: 'es-ES', fr: 'fr-FR',
    kn: 'kn-IN', ml: 'ml-IN', or: 'or-IN', as: 'as-IN', ne: 'ne-NP', zh: 'zh-CN',
    ja: 'ja-JP', ko: 'ko-KR', de: 'de-DE', ru: 'ru-RU', pt: 'pt-BR', it: 'it-IT'
  };

  let currentLang = 'en';
  let currentTheme = 'system';
  let isSidebarOpen = false;
  let isLangDropdownOpen = false;
  let isWelcomeMode = true;
  let messageId = 0;
  let synth = window.speechSynthesis;
  let isSpeaking = false;
  let currentChatId = null;
  let conversation = [];
  let lastQuestion = '';
  let pendingAttachments = [];

  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => document.querySelectorAll(sel);

  const PROFILES_KEY = 'msd_profiles';
  const ACTIVE_KEY = 'msd_active';
  function loadProfiles() {
    try { return JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function saveProfiles(p) { localStorage.setItem(PROFILES_KEY, JSON.stringify(p)); }
  function newSessionId() { return 's-' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function activeName() { return localStorage.getItem(ACTIVE_KEY) || 'User'; }
  function ensureProfile(name) {
    const p = loadProfiles();
    if (!p[name]) { p[name] = newSessionId(); saveProfiles(p); }
    return p[name];
  }
  function profileName() { return activeName(); }
  let SESSION_ID = ensureProfile(activeName());
  let activeController = null;
  const apiFetch = (url, opts) => {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers || {}, { 'X-Session-Id': SESSION_ID });
    return window.fetch(url, Object.assign({}, opts, { headers }));
  };

  function init() {
    loadTheme();
    loadLanguage();
    updateProfileUI();
    renderLangList();
    loadHistory();
    bindEvents();
    initAuth();
    initGoogle();
    autoResizeTextareas();
    checkDarkMode();
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
    }
  }

  function loadTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) {
      currentTheme = saved;
      document.documentElement.setAttribute('data-theme', saved === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : saved);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
    updateThemeIcon();
  }

  function saveTheme() {
    localStorage.setItem('theme', currentTheme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    currentTheme = next;
    document.documentElement.setAttribute('data-theme', next);
    saveTheme();
    updateThemeIcon();
  }

  function updateThemeIcon() {}

  function applyTheme(theme) {
    currentTheme = theme || 'system';
    const resolved = currentTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : currentTheme;
    document.documentElement.setAttribute('data-theme', resolved);
    saveTheme();
    updateThemeIcon();
  }

  // ---------- Profile menu (settings / switch account / logout) ----------
  function updateProfileUI() {
    const name = profileName();
    const nameEl = qs('.profile-name');
    if (nameEl) nameEl.textContent = name;
    const av = qs('#profileRow .avatar');
    if (av) av.textContent = (name.charAt(0) || 'U').toUpperCase();
  }

  function setActiveProfile(name) {
    const n = String(name || 'User').trim().slice(0, 40) || 'User';
    localStorage.setItem(ACTIVE_KEY, n);
    SESSION_ID = ensureProfile(n);
    updateProfileUI();
  }

  function closeProfileMenu() {
    const m = qs('#profileMenu');
    if (m) m.remove();
    const row = qs('#profileRow');
    if (row) row.setAttribute('aria-expanded', 'false');
  }

  function toggleProfileMenu() {
    if (qs('#profileMenu')) { closeProfileMenu(); return; }
    const row = qs('#profileRow');
    const footer = qs('.sidebar-footer');
    if (!row || !footer) return;
    row.setAttribute('aria-expanded', 'true');
    const name = profileName();
    const menu = document.createElement('div');
    menu.id = 'profileMenu';
    menu.className = 'profile-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <div class="profile-menu-head">
        <div class="avatar">${escapeHtml((name.charAt(0) || 'U').toUpperCase())}</div>
        <div class="profile-menu-info">
          <span class="profile-menu-name">${escapeHtml(name)}</span>
          <span class="profile-menu-plan">${t('planFree')}</span>
        </div>
      </div>
      <button type="button" class="profile-menu-item" data-profile-action="settings" role="menuitem">
        <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        <span>${t('profileSettings')}</span>
      </button>
      <button type="button" class="profile-menu-item" data-profile-action="switch" role="menuitem">
        <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"></path><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><path d="M7 23l-4-4 4-4"></path><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
        <span>${t('switchAccount')}</span>
      </button>
      <div class="profile-menu-sep"></div>
      <button type="button" class="profile-menu-item danger" data-profile-action="logout" role="menuitem">
        <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
        <span>${t('logout')}</span>
      </button>`;
    footer.appendChild(menu);
    menu.querySelectorAll('[data-profile-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.profileAction;
        closeProfileMenu();
        if (action === 'settings') openSettings();
        else if (action === 'switch') openSwitchAccount();
        else if (action === 'logout') openLogout();
      });
    });
  }

  // ---------- Generic app modal ----------
  function closeAppModal() {
    const m = qs('#appModal');
    if (m) m.remove();
  }

  function openAppModal(opts) {
    closeAppModal();
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.id = 'appModal';
    const cancelBtn = opts.hideCancel ? '' :
      '<button type="button" class="btn-secondary" data-appmodal-close>' + t('cancelBtn') + '</button>';
    const confirmBtn = opts.confirmLabel === null ? '' :
      '<button type="button" class="btn-primary" id="appModalConfirm">' + (opts.confirmLabel || t('saveBtn')) + '</button>';
    ov.innerHTML = `
      <div class="modal" role="document">
        <div class="modal-header">
          <h2>${escapeHtml(opts.title || '')}</h2>
          <button class="icon-btn" data-appmodal-close aria-label="Close"><svg class="icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>
        <div class="modal-body">${opts.html || ''}</div>
        <div class="modal-footer">${cancelBtn}${confirmBtn}</div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelectorAll('[data-appmodal-close]').forEach(b => b.addEventListener('click', closeAppModal));
    ov.addEventListener('click', (e) => { if (e.target === ov) closeAppModal(); });
    const confirm = ov.querySelector('#appModalConfirm');
    if (confirm && opts.onConfirm) {
      confirm.addEventListener('click', () => {
        const keep = opts.onConfirm(ov);
        if (keep !== false) closeAppModal();
      });
    }
    if (opts.onMount) opts.onMount(ov);
    return ov;
  }

  function openSettings() {
    const theme = currentTheme || 'system';
    const level = localStorage.getItem('answer_level') || 'normal';
    const voice = localStorage.getItem('always_speak') === '1';
    openAppModal({
      title: t('settingsTitle'),
      confirmLabel: t('saveBtn'),
      html: `
        <div class="settings-list">
          <label class="settings-row">
            <span class="settings-label">${t('settingsTheme')}</span>
            <select id="setTheme">
              <option value="light">${t('themeLight')}</option>
              <option value="dark">${t('themeDark')}</option>
              <option value="system">${t('themeSystem')}</option>
            </select>
          </label>
          <label class="settings-row">
            <span class="settings-label">${t('settingsLevel')}</span>
            <select id="setLevel">
              <option value="simple">${t('levelSimple')}</option>
              <option value="normal">${t('levelNormal')}</option>
              <option value="detailed">${t('levelDetailed')}</option>
            </select>
          </label>
          <label class="settings-row">
            <span class="settings-label">${t('settingsVoice')}</span>
            <input type="checkbox" id="setVoice">
          </label>
          <div class="settings-note">${t('settingsNote')}</div>
        </div>`,
      onMount(ov) {
        ov.querySelector('#setTheme').value = theme;
        ov.querySelector('#setLevel').value = level;
        ov.querySelector('#setVoice').checked = voice;
      },
      onConfirm(ov) {
        applyTheme(ov.querySelector('#setTheme').value);
        localStorage.setItem('answer_level', ov.querySelector('#setLevel').value);
        localStorage.setItem('always_speak', ov.querySelector('#setVoice').checked ? '1' : '0');
        showToast(t('settingsSaved'));
      },
    });
  }

  function openSwitchAccount() {
    openAppModal({
      title: t('switchTitle'),
      confirmLabel: t('switchAction'),
      html: `
        <div class="field">
          <label for="switchName">${t('switchNameLabel')}</label>
          <input id="switchName" type="text" maxlength="40" placeholder="${t('switchNamePh')}" autocomplete="off">
        </div>
        <div class="settings-note">${t('switchNote')}</div>`,
      onMount(ov) {
        const input = ov.querySelector('#switchName');
        input.value = profileName() === 'Guest' ? '' : profileName();
        input.focus();
        input.select();
      },
      onConfirm(ov) {
        const n = ov.querySelector('#switchName').value.trim();
        if (!n) { showToast(t('switchNamePh')); return false; }
        setActiveProfile(n);
        newChat();
        loadHistory();
        showToast(t('switchedTo') + ' ' + n);
      },
    });
  }

  function openLogout() {
    openAppModal({
      title: t('logoutTitle'),
      confirmLabel: t('logoutAction'),
      html: '<div class="settings-note">' + t('logoutMsg') + '</div>',
      onConfirm() {
        try { localStorage.removeItem('msd_logged_in'); } catch (e) {}
        newChat();
        showLoginScreen();
        showToast(t('loggedOut'));
      },
    });
  }

  // ---------- Login / auth (local demo) ----------
  function isLoggedIn() { return localStorage.getItem('msd_logged_in') === '1'; }

  function showLoginScreen() {
    const l = qs('#loginScreen');
    if (l) l.hidden = false;
  }

  function hideLoginScreen() {
    const l = qs('#loginScreen');
    if (l) l.hidden = true;
  }

  function doLogin(name, email) {
    const n = (String(name || '').trim() || (email || '').split('@')[0] || 'User').slice(0, 40) || 'User';
    try {
      localStorage.setItem('msd_logged_in', '1');
      if (email) localStorage.setItem('msd_user_email', email);
    } catch (e) {}
    setActiveProfile(n);
    hideLoginScreen();
    newChat();
    loadHistory();
    showToast(t('loggedInToast').replace('{name}', n));
  }

  function initAuth() {
    if (isLoggedIn()) hideLoginScreen();
    else showLoginScreen();
  }

  function googleLogin() {
    // Local demo: instant Google sign-in (used only when GOOGLE_CLIENT_ID is not set).
    doLogin('Rashi', 'rashi@gmail.com');
  }

  let googleClientId = '';

  function loadGoogleScript() {
    return new Promise((resolve) => {
      if (window.google && window.google.accounts && window.google.accounts.id) { resolve(true); return; }
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  async function initGoogle() {
    try {
      const res = await apiFetch('/api/config');
      const cfg = await res.json();
      googleClientId = cfg.googleClientId || '';
    } catch (e) { googleClientId = ''; }
    if (!googleClientId) return; // no client id -> keep demo button
    const ok = await loadGoogleScript();
    if (!ok || !window.google || !window.google.accounts || !window.google.accounts.id) return;
    try {
      window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleGoogleCredential });
      const container = document.getElementById('googleBtnContainer');
      const customBtn = document.getElementById('googleLoginBtn');
      if (container && customBtn) {
        container.hidden = false;
        customBtn.style.display = 'none';
        window.google.accounts.id.renderButton(container, {
          theme: 'outline', size: 'large', shape: 'pill',
          text: 'continue_with', width: Math.min(300, container.clientWidth || 300),
        });
      }
    } catch (e) {}
  }

  function handleGoogleCredential(response) {
    if (!response || !response.credential) return;
    apiFetch('/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
    })
      .then(res => res.json().then(d => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) { showToast((d && d.detail) || 'Google login failed'); return; }
        doLogin(d.name, d.email);
      })
      .catch(() => showToast('Google login failed'));
  }

  let languageTouched = false;

  function loadLanguage() {
    const saved = localStorage.getItem('language');
    if (saved && LANGUAGES.find(l => l.code === saved)) {
      currentLang = saved;
    } else {
      currentLang = 'auto';
    }
    updateLangButton();
    applyRTL();
    if (window.applyI18n) window.applyI18n(currentLang);
  }

  function getApiLang() {
    return languageTouched ? (currentLang || 'auto') : 'auto';
  }

  function applyRTL() {
    const lang = LANGUAGES.find(l => l.code === currentLang);
    const isRTL = lang && RTL_LANGS.has(lang.code);
    document.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang === 'auto' ? 'en' : currentLang;
  }

  function updateLangButton() {
    const lang = languageTouched ? (LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0]) : LANGUAGES[0];
    const btnText = qs('#langBtnText');
    if (btnText) btnText.textContent = lang.en;
  }

  function renderLangList() {
    const list = qs('#langList');
    const search = qs('#langSearch');
    if (!list) return;

    list.innerHTML = LANGUAGES.map(lang => `
      <button class="lang-option${lang.code === currentLang ? ' selected' : ''}" data-code="${lang.code}" role="option" aria-selected="${lang.code === currentLang}">
        <span class="lang-en">${lang.en}</span>
        ${lang.code !== 'auto' ? `<span class="lang-native">${lang.native}</span>` : ''}
      </button>
    `).join('');

    list.querySelectorAll('.lang-option').forEach(btn => {
      btn.addEventListener('click', () => selectLanguage(btn.dataset.code));
    });

    if (search) {
      search.addEventListener('input', () => {
        const term = search.value.toLowerCase().trim();
        list.querySelectorAll('.lang-option').forEach(btn => {
          const en = btn.querySelector('.lang-en').textContent.toLowerCase();
          const native = btn.querySelector('.lang-native')?.textContent.toLowerCase() || '';
          btn.style.display = (en.includes(term) || native.includes(term)) ? 'flex' : 'none';
        });
      });
    }
  }

  function selectLanguage(code) {
    currentLang = code;
    languageTouched = true;
    localStorage.setItem('language', code);
    updateLangButton();
    applyRTL();
    closeLangDropdown();
    renderLangList();
    if (window.applyI18n) window.applyI18n(currentLang);
    loadHistory();
  }

  function openLangDropdown() {
    isLangDropdownOpen = true;
    qs('#langDropdown').hidden = false;
    qs('#langBtn').setAttribute('aria-expanded', 'true');
    qs('#langSelector').classList.add('open');
    qs('#langSearch').focus();
  }

  function closeLangDropdown() {
    isLangDropdownOpen = false;
    qs('#langDropdown').hidden = true;
    qs('#langBtn').setAttribute('aria-expanded', 'false');
    qs('#langSelector').classList.remove('open');
    qs('#langSearch').value = '';
    qs('#langList').querySelectorAll('.lang-option').forEach(btn => btn.style.display = 'flex');
  }

  function toggleLangDropdown() {
    if (isLangDropdownOpen) closeLangDropdown();
    else openLangDropdown();
  }

  function timeLabel(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function groupKey(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return 'week';
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'today';
    return (now - d) / 86400000 <= 7 ? 'week' : 'older';
  }

  function historyItemHtml(chat) {
    const id = escapeHtml(chat.id);
    const title = escapeHtml(chat.title || 'New Chat');
    return `
      <li class="history-item" role="option" data-id="${id}" tabindex="0" aria-label="${title}">
        <svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span class="history-title">${title}</span>
        <span class="history-time">${escapeHtml(timeLabel(chat.updatedAt || chat.createdAt))}</span>
        <button class="history-delete" data-delete-id="${id}" aria-label="${t('ariaDeleteChat')}" title="${t('ariaDeleteChat')}">
          <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </li>
    `;
  }

  async function loadHistory() {
    const todayList = qs('#historyToday');
    const weekList = qs('#historyWeek');
    const olderList = qs('#historyOlder');
    if (!todayList || !weekList || !olderList) return;

    try {
      const res = await apiFetch('/api/chats');
      const chats = res.ok ? await res.json() : [];
      const groups = { today: [], week: [], older: [] };
      chats.forEach(c => groups[groupKey(c.updatedAt || c.createdAt)].push(c));

      todayList.innerHTML = groups.today.length
        ? groups.today.map(historyItemHtml).join('')
        : '<li class="history-empty">' + t('emptyToday') + '</li>';
      weekList.innerHTML = groups.week.map(historyItemHtml).join('') || '<li class="history-empty">' + t('emptyWeek') + '</li>';
      olderList.innerHTML = groups.older.map(historyItemHtml).join('') || '<li class="history-empty">' + t('emptyOlder') + '</li>';
    } catch (e) {
      todayList.innerHTML = '';
      weekList.innerHTML = '';
      olderList.innerHTML = '';
    }
  }

  async function openChat(id) {
    try {
      const res = await apiFetch('/api/chats/' + encodeURIComponent(id));
      if (!res.ok) { showToast(t('toastChatMissing')); return; }
      const chat = await res.json();
      currentChatId = chat.id;
      conversation = (chat.messages || []).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content || '',
        sources: m.sources || []
      }));
      lastQuestion = ([...conversation].reverse().find(m => m.role === 'user') || {}).content || '';
      qs('#chatMessages').innerHTML = '';
      switchToChatMode();
      conversation.forEach(m => addMessage(m.role, m.content, false, m.sources, m.attachments));
      closeSidebar();
    } catch (e) {
      showToast(t('toastChatLoad'));
    }
  }

  async function deleteChat(id) {
    try {
      await apiFetch('/api/chats/' + encodeURIComponent(id), { method: 'DELETE' });
      if (currentChatId === id) newChat();
      loadHistory();
    } catch (e) {
      showToast(t('toastChatDelete'));
    }
  }

  async function persistStandalone(messages, title) {
    try {
      const res = await apiFetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: (title || 'New Chat').slice(0, 48), board: '', class: '', subject: '', language: getApiLang() })
      });
      const data = await res.json();
      await apiFetch('/api/chats/' + encodeURIComponent(data.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });
      loadHistory();
    } catch (e) {
      // ignore persistence errors for orphaned requests
    }
  }

  async function persistConversation() {
    try {
      if (!currentChatId) {
        const title = (lastQuestion || 'New Chat').slice(0, 48);
        const res = await apiFetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, board: '', class: '', subject: '', language: getApiLang() })
        });
        const data = await res.json();
        currentChatId = data.id;
      }
      await apiFetch('/api/chats/' + encodeURIComponent(currentChatId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation })
      });
      loadHistory();
    } catch (e) {
      // persistence failure should not block the chat itself
    }
  }

  function bindEvents() {
    qs('#hamburger')?.addEventListener('click', toggleSidebar);
    qs('#scrim')?.addEventListener('click', closeSidebar);
    qs('#backBtn')?.addEventListener('click', newChat);
    qs('#newChatBtn')?.addEventListener('click', newChat);
    qs('#themeToggle')?.addEventListener('click', toggleTheme);
    qs('#profileRow')?.addEventListener('click', (e) => { e.stopPropagation(); toggleProfileMenu(); });
    qs('#googleLoginBtn')?.addEventListener('click', googleLogin);
    qs('#emailLoginForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = qs('#loginName').value.trim();
      const email = qs('#loginEmail').value.trim();
      if (!email || email.indexOf('@') < 0) { showToast(t('loginEmail')); return; }
      doLogin(name || email.split('@')[0], email);
    });
    qs('#langBtn')?.addEventListener('click', toggleLangDropdown);
    qs('#langSearch')?.addEventListener('click', e => e.stopPropagation());

    qs('.chat-history')?.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.history-delete');
      if (delBtn) {
        e.stopPropagation();
        deleteChat(delBtn.dataset.deleteId);
        return;
      }
      const item = e.target.closest('.history-item');
      if (item && item.dataset.id) openChat(item.dataset.id);
    });

    qs('.chat-history')?.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('history-item')) {
        e.preventDefault();
        openChat(e.target.dataset.id);
      }
    });

    document.addEventListener('click', (e) => {
      if (isLangDropdownOpen && !qs('#langSelector').contains(e.target)) {
        closeLangDropdown();
      }
      const menu = qs('#attachMenu');
      if (menu && !menu.hidden && !e.target.closest('#attachMenu') && !e.target.closest('#attachBtn') && !e.target.closest('#attachBtnBottom')) {
        closeAttachMenu();
      }
      const pm = qs('#profileMenu');
      if (pm && !e.target.closest('#profileMenu') && !e.target.closest('#profileRow')) {
        closeProfileMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (qs('#lightbox')) { closeLightbox(); return; }
        if (activePanel) { closeOptionModal(); return; }
        if (qs('#appModal')) { closeAppModal(); return; }
        closeProfileMenu();
        closeAttachMenu();
        if (isSidebarOpen) closeSidebar();
        if (isLangDropdownOpen) closeLangDropdown();
      }
    });

    qsa('.card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.dataset.card) { openOptionModal(card.dataset.card); return; }
        const prompt = card.dataset.prompt;
        if (prompt) {
          switchToChatMode();
          setComposerValue(prompt);
          sendMessage(prompt);
        }
      });
    });

    qs('#modalClose')?.addEventListener('click', closeOptionModal);
    qs('#modalCancel')?.addEventListener('click', closeOptionModal);
    qs('#modalSubmit')?.addEventListener('click', submitOptionModal);
    qs('#optionModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeOptionModal();
    });
    qs('#modalBody')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice');
      if (!btn) return;
      const group = btn.closest('.choice-group');
      if (group) {
        group.querySelectorAll('.choice').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        if (group.id === 'npSource') {
          const wrap = qs('#npMaterialWrap');
          if (wrap) wrap.hidden = btn.dataset.value !== 'material';
        }
      }
    });
    qs('#modalBody')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        submitOptionModal();
      }
    });

    qsa('.composer-textarea, .composer-bottom-textarea').forEach(ta => {
      ta.addEventListener('input', autoResizeTextareas);
      ta.addEventListener('input', updateSendButton);
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          sendMessage(ta.value.trim());
        }
      });
    });

    qs('#composerCard')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const ta = qs('#composerTextarea');
      sendMessage(ta.value.trim());
    });

    qs('#composerBottom')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const ta = qs('#composerBottomTextarea');
      sendMessage(ta.value.trim());
    });

    qs('#sendBtn')?.addEventListener('click', () => {
      const ta = qs('#composerTextarea');
      sendMessage(ta.value.trim());
    });

    qs('#sendBtnBottom')?.addEventListener('click', () => {
      const ta = qs('#composerBottomTextarea');
      sendMessage(ta.value.trim());
    });

    qs('#fileInput')?.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      if (files.length) uploadFiles(files);
    });

    qs('#attachBtn')?.addEventListener('click', (e) => toggleAttachMenu(e.currentTarget));
    qs('#attachBtnBottom')?.addEventListener('click', (e) => toggleAttachMenu(e.currentTarget));
    qs('#attachMenu')?.addEventListener('click', (e) => {
      const item = e.target.closest('[data-attach-action]');
      if (!item) return;
      const action = item.dataset.attachAction;
      closeAttachMenu();
      if (action === 'file') qs('#fileInput')?.click();
      else if (action === 'screenshot') captureScreenShot();
    });

    document.addEventListener('paste', handlePaste);

    document.addEventListener('click', (e) => {
      const img = e.target.closest('img.msg-image, .attach-chip img');
      if (img && img.src) { e.preventDefault(); openLightbox(img.src); }
    });

    qs('#micBtn')?.addEventListener('click', handleMicClick);
    qs('#micBtnBottom')?.addEventListener('click', handleMicClick);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', checkDarkMode);
  }

  function checkDarkMode() {
    if (currentTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      updateThemeIcon();
    }
  }

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
    qs('#sidebar').classList.toggle('open', isSidebarOpen);
    qs('#scrim').classList.toggle('visible', isSidebarOpen);
    qs('#hamburger').setAttribute('aria-expanded', isSidebarOpen);
    document.body.style.overflow = isSidebarOpen ? 'hidden' : '';
  }

  function closeSidebar() {
    if (isSidebarOpen) {
      isSidebarOpen = false;
      qs('#sidebar').classList.remove('open');
      qs('#scrim').classList.remove('visible');
      qs('#hamburger').setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  }

  function newChat() {
    isWelcomeMode = true;
    currentChatId = null;
    conversation = [];
    lastQuestion = '';
    pendingAttachments = [];
    renderAttachPreview();
    qs('#welcomeScreen').hidden = false;
    qs('#chatMessages').hidden = true;
    qs('#chatComposer').hidden = true;
    qs('#backBtn').hidden = true;
    qs('#chatMessages').innerHTML = '';
    qs('#composerTextarea').value = '';
    qs('#composerBottomTextarea').value = '';
    autoResizeTextareas();
    updateSendButton();
    closeSidebar();
  }

  function switchToChatMode() {
    if (isWelcomeMode) {
      isWelcomeMode = false;
      qs('#welcomeScreen').hidden = true;
      qs('#chatMessages').hidden = false;
      qs('#chatComposer').hidden = false;
      qs('#backBtn').hidden = false;
      qs('#composerTextarea').focus();
    } else {
      qs('#backBtn').hidden = false;
    }
  }

  function setComposerValue(val) {
    qs('#composerTextarea').value = val;
    qs('#composerBottomTextarea').value = val;
    autoResizeTextareas();
    updateSendButton();
  }

  function updateSendButton() {
    const val1 = qs('#composerTextarea').value.trim();
    const val2 = qs('#composerBottomTextarea').value.trim();
    const hasVal = val1 || val2 || pendingAttachments.length > 0;
    qs('#sendBtn').disabled = !hasVal;
    qs('#sendBtnBottom').disabled = !hasVal;
  }

  function autoResizeTextareas() {
    qsa('.composer-textarea, .composer-bottom-textarea').forEach(ta => {
      ta.style.height = 'auto';
      const h = Math.min(ta.scrollHeight, 180);
      ta.style.height = h + 'px';
    });
  }

  function sendMessage(text) {
    const atts = pendingAttachments.slice();
    let question = (text || '').trim();
    if (!question && atts.length) {
      question = atts.some(a => a.kind === 'image') ? 'Is image ko analyze karke batao.' : 'Is file ko analyze karke summary dein.';
    }
    if (!question) return;
    switchToChatMode();
    lastQuestion = question;
    const attMeta = atts.map(a => ({ name: a.name, kind: a.kind }));
    addMessage('user', question, false, [], atts);
    conversation.push({ role: 'user', content: question, attachments: attMeta });
    const convoRef = conversation;
    pendingAttachments = [];
    renderAttachPreview();
    qs('#composerTextarea').value = '';
    qs('#composerBottomTextarea').value = '';
    autoResizeTextareas();
    updateSendButton();

    const sendAtts = atts.map(a => a.kind === 'image'
      ? { name: a.name, kind: 'image', data: a.data }
      : { name: a.name, kind: 'text', text: a.text });

    streamChat(question, sendAtts, convoRef);
  }

  function createAssistantShell() {
    const el = document.createElement('div');
    el.className = 'message assistant';
    el.innerHTML = `
      <div class="message-avatar"><img src="assets/logo.png" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover"></div>
      <div class="message-bubble"></div>
      <button class="action-btn action-stop" data-action="stop" aria-label="Stop" style="display:none;align-self:flex-start;margin-top:6px">
        <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>
        <span>Stop</span>
      </button>
      <div class="message-actions" style="display:none">
        <button class="action-btn" data-action="copy" aria-label="Copy"><svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
        <button class="action-btn" data-action="listen" aria-label="Suniye"><svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg></button>
        <button class="action-btn" data-action="regenerate" aria-label="Regenerate"><svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg></button>
      </div>
      <div class="message-sources" style="display:none"></div>
      <div class="voice-prompt" style="display:none">
        <span class="voice-prompt-text">${t('voicePrompt')}</span>
        <div class="voice-prompt-buttons">
          <button class="voice-btn voice-btn-yes" data-action="speak-yes">${t('voiceYes')}</button>
          <button class="voice-btn voice-btn-no" data-action="speak-no">${t('voiceNo')}</button>
        </div>
      </div>
    `;
    qs('#chatMessages').appendChild(el);
    scrollToBottom();
    el.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, el, el.dataset.content || ''));
    });
    return el;
  }

  function setBubble(el, text) {
    const bubble = el.querySelector('.message-bubble');
    if (!bubble) return;
    bubble.innerHTML = renderMarkdown(text);
    el.dataset.content = text;
    scrollToBottom();
  }

  function finalizeAssistant(el, text, sources, showVoice) {
    setBubble(el, text);
    const stopBtn = el.querySelector('.action-stop');
    const actions = el.querySelector('.message-actions');
    const srcEl = el.querySelector('.message-sources');
    const vp = el.querySelector('.voice-prompt');
    if (stopBtn) stopBtn.style.display = 'none';
    if (actions) actions.style.display = '';
    if (srcEl) {
      if (sources && sources.length) { srcEl.innerHTML = sourcesHtml(sources); srcEl.style.display = ''; }
      else { srcEl.style.display = 'none'; }
    }
    if (vp) vp.style.display = showVoice ? '' : 'none';
    if (showVoice && text && localStorage.getItem('always_speak') === '1') {
      try { speakText(text); } catch (e) {}
    }
  }

  function recordAssistant(convoRef, question, reply, sources) {
    const assistantMsg = { role: 'assistant', content: reply, sources: sources || [] };
    if (conversation === convoRef) {
      conversation.push(assistantMsg);
      persistConversation();
    } else {
      persistStandalone([...convoRef, assistantMsg], question);
    }
  }

  async function streamChat(question, attachments, convoRef) {
    const controller = new AbortController();
    activeController = controller;
    const isFirstReply = !convoRef.some(m => m && m.role === 'assistant');
    const history = convoRef.slice(0, -1).filter(m => m && m.content).slice(-12)
      .map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
    const el = createAssistantShell();
    const stopBtn = el.querySelector('.action-stop');
    const bubble = el.querySelector('.message-bubble');
    if (stopBtn) stopBtn.style.display = '';
    bubble.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';

    let acc = '';
    let sources = [];
    let raf = null;
    const flush = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = null; setBubble(el, acc); });
    };

    try {
      const res = await apiFetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, language: getApiLang(), attachments, level: localStorage.getItem('answer_level') || 'normal', history })
      });
      if (!res.ok || !res.body) throw new Error('stream failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const chunkRaw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = chunkRaw.split('\n').find(l => l.indexOf('data:') === 0);
          if (!line) continue;
          let evt;
          try { evt = JSON.parse(line.slice(5).trim()); } catch (e) { continue; }
          if (evt.event === 'start') { if (evt.sources) sources = evt.sources; }
          else if (evt.event === 'delta') { acc += evt.text || ''; flush(); }
          else if (evt.event === 'done') { if (evt.sources) sources = evt.sources; }
        }
      }
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      finalizeAssistant(el, acc || t('assistantNoReply'), sources, isFirstReply);
      recordAssistant(convoRef, question, acc, sources);
    } catch (e) {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      if (e && e.name === 'AbortError') {
        finalizeAssistant(el, acc || '_Stopped._', sources, isFirstReply);
        recordAssistant(convoRef, question, acc, sources);
      } else {
        finalizeAssistant(el, acc || t('assistantError'), sources, false);
      }
    } finally {
      activeController = null;
      if (stopBtn) stopBtn.style.display = 'none';
    }
  }

  function showTyping() {
    const id = 'typing-' + Date.now();
    const el = document.createElement('div');
    el.id = id;
    el.className = 'message assistant typing';
    el.innerHTML = `
      <div class="message-avatar"><img src="assets/logo.png" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover"></div>
      <div class="message-bubble typing-bubble">
        <span class="typing-dots"><span></span><span></span><span></span></span>
      </div>
    `;
    qs('#chatMessages').appendChild(el);
    scrollToBottom();
    return id;
  }

  function hideTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function legacyRenderMarkdown(src) {
    let t = escapeHtml(String(src == null ? '' : src));
    t = t.replace(/```([\s\S]*?)```/g, (m, code) => '<pre><code>' + code.replace(/^\n+|\n+$/g, '') + '</code></pre>');
    t = t.replace(/(?:^|\n)((?:\|[^\n]*\|\n?){2,})/g, (m, block) => {
      const rows = block.trim().split('\n').filter(l => l.trim() && !/^\|[\s\-:|]+\|$/.test(l.trim()));
      if (!rows.length) return block;
      const cells = rows.map(l => l.trim().split('|').slice(1, -1).map(c => c.trim()));
      const head = cells[0];
      const body = cells.slice(1);
      return '\n<table><thead><tr>' + head.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' +
        body.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') +
        '</tbody></table>\n';
    });
    t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    t = t.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
    t = t.replace(/^###\s+(.*)$/gm, '<h4>$1</h4>');
    t = t.replace(/^##\s+(.*)$/gm, '<h3>$1</h3>');
    t = t.replace(/^#\s+(.*)$/gm, '<h2>$1</h2>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    t = t.replace(/(?:^|\n)((?:- [^\n]*(?:\n|$))+)/g, (m, block) =>
      '\n<ul>' + block.trim().split('\n').map(l => '<li>' + l.replace(/^- /, '') + '</li>').join('') + '</ul>\n');
    t = t.replace(/(?:^|\n)((?:\d+\. [^\n]*(?:\n|$))+)/g, (m, block) =>
      '\n<ol>' + block.trim().split('\n').map(l => '<li>' + l.replace(/^\d+\. /, '') + '</li>').join('') + '</ol>\n');
    t = t.replace(/\n/g, '<br>');
    return t;
  }

  function renderMathHtml(html, math) {
    if (!window.katex) return html;
    return html.replace(/@@MATH(\d+)@@/g, (m, i) => {
      const item = math[+i];
      if (!item) return m;
      try {
        return window.katex.renderToString(item.tex, { displayMode: item.display, throwOnError: false });
      } catch (e) { return escapeHtml(item.tex); }
    });
  }

  function renderMarkdown(src) {
    const text = String(src == null ? '' : src);
    if (window.marked) {
      const math = [];
      let prep = text.replace(/\$\$([\s\S]+?)\$\$/g, (m, g) => { const i = math.push({ tex: g, display: true }) - 1; return '@@MATH' + i + '@@'; });
      prep = prep.replace(/(?<!\\)\$(?!\s)([^\n$]+?)(?<!\s)\$(?!\$)/g, (m, g) => { const i = math.push({ tex: g, display: false }) - 1; return '@@MATH' + i + '@@'; });
      let html;
      try { html = window.marked.parse(prep, { breaks: true, gfm: true }); }
      catch (e) { html = escapeHtml(prep); }
      if (window.DOMPurify) { try { html = window.DOMPurify.sanitize(html); } catch (e) {} }
      return renderMathHtml(html, math);
    }
    return legacyRenderMarkdown(text);
  }

  // ---------- Option modal (card panels) ----------
  const CLASS_OPTS = (() => {
    let s = '';
    for (let i = 1; i <= 12; i++) s += `<option>Class ${i}</option>`;
    s += '<option>College</option>';
    return s;
  })();

  const TRANSLATE_TARGETS = ['Hindi', 'English', 'Urdu', 'Punjabi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Malayalam', 'Kannada', 'Odia', 'Sanskrit', 'Arabic', 'Nepali', 'French', 'Spanish', 'German'];

  const PANELS = {
    notes: {
      titleKey: 'modalNotesTitle',
      submitKey: 'modalNotesSubmit',
      html: (t) => `
        <div class="field">
          <label for="npTopic">${t('fieldTopic')}</label>
          <input id="npTopic" type="text" placeholder="${t('fieldTopicPh')}" autocomplete="off" maxlength="300">
        </div>
        <div class="field">
          <label>${t('fieldMaterialHow')}</label>
          <div class="choice-group" id="npSource">
            <button type="button" class="choice active" data-value="ai">
              <span class="choice-title">${t('aiNotesTitle')}</span>
              <span class="choice-desc">${t('aiNotesDesc')}</span>
            </button>
            <button type="button" class="choice" data-value="material">
              <span class="choice-title">${t('ownMaterialTitle')}</span>
              <span class="choice-desc">${t('ownMaterialDesc')}</span>
            </button>
          </div>
        </div>
        <div class="field" id="npMaterialWrap" hidden>
          <label for="npMaterial">${t('pasteMaterialLabel')}</label>
          <textarea id="npMaterial" maxlength="8000" placeholder="${t('pasteMaterialPh')}"></textarea>
          <button type="button" class="btn-file" id="npFileBtn">${t('uploadFileBtn')}</button>
          <input type="file" id="npFile" accept=".txt,.md,.csv,.pdf" hidden>
          <span class="field-hint">${t('uploadFileHint')}</span>
        </div>
        <div class="field">
          <label for="npFormat">${t('notesTypeLabel')}</label>
          <select id="npFormat">
            <option value="short">${t('notesShort')}</option>
            <option value="detailed" selected>${t('notesDetailed')}</option>
            <option value="points">${t('notesPoints')}</option>
          </select>
        </div>`,
      mount(body) {
        const textarea = body.querySelector('#npMaterial');
        const fileInput = body.querySelector('#npFile');
        body.querySelector('#npFileBtn').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
          const f = fileInput.files && fileInput.files[0];
          if (!f) return;
          if (/\.pdf$/i.test(f.name)) {
            const data = new FormData();
            data.append('file', f, f.name);
            apiFetch('/api/upload', { method: 'POST', body: data })
              .then(res => res.json().then(d => ({ ok: res.ok, d })))
              .then(({ ok, d }) => {
                if (!ok) { showToast(d.detail || t('toastFileReadError')); return; }
                textarea.value = (d.text || '').slice(0, 8000);
              })
              .catch(() => showToast(t('toastUploadError')));
          } else {
            f.text().then(text => { textarea.value = text.slice(0, 8000); }).catch(() => showToast(t('toastFileReadError')));
          }
        });
      },
      build(body) {
        const topic = body.querySelector('#npTopic').value.trim();
        if (!topic) return null;
        const active = body.querySelector('#npSource .choice.active');
        const source = (active && active.dataset && active.dataset.value) || 'ai';
        const fmtKey = body.querySelector('#npFormat').value;
        const fmt = { short: 'short notes (1 page)', detailed: 'detailed notes', points: 'bullet-point revision notes' }[fmtKey] || 'detailed notes';
        if (source === 'material') {
          const material = body.querySelector('#npMaterial').value.trim();
          if (!material) return null;
          return `Niche diye gaye material ke adhar par "${topic}" ke ${fmt} banao. Easy language me, important points highlight karke.\n\nMaterial:\n${material}`;
        }
        return `"${topic}" ke ${fmt} banao. Easy language me, exam ke liye useful points ke saath.`;
      }
    },
    presentation: {
      titleKey: 'modalPptTitle',
      submitKey: 'modalPptSubmit',
      html: (t) => `
        <div class="field">
          <label for="ppTopic">${t('pptTopicLabel')}</label>
          <input id="ppTopic" type="text" placeholder="${t('pptTopicPh')}" autocomplete="off" maxlength="300">
        </div>
        <div class="modal-row">
          <div class="field">
            <label for="ppSlides">${t('slidesCountLabel')}</label>
            <input id="ppSlides" type="number" min="3" max="20" value="8">
          </div>
          <div class="field">
            <label for="ppStyle">${t('pptStyleLabel')}</label>
            <select id="ppStyle">
              <option>${t('styleSimple')}</option>
              <option>${t('styleProf')}</option>
              <option>${t('styleFun')}</option>
            </select>
          </div>
        </div>`,
      build(body) {
        const topic = body.querySelector('#ppTopic').value.trim();
        if (!topic) return null;
        let slides = parseInt(body.querySelector('#ppSlides').value, 10);
        if (!(slides >= 3)) slides = 3; if (slides > 20) slides = 20;
        const style = body.querySelector('#ppStyle').value;
        return `"${topic}" par ${slides} slides ki presentation banayein. Style: ${style}. Har slide ka clear title, 3-5 short bullet points aur last mein ek summary slide.`;
      }
    },
    maths: {
      titleKey: 'modalMathsTitle',
      submitKey: 'modalMathsSubmit',
      html: (t) => `
        <div class="field">
          <label for="mqProblem">${t('problemLabel')}</label>
          <textarea id="mqProblem" placeholder="${t('problemPh')}"></textarea>
        </div>
        <div class="field">
          <label for="mqClass">${t('classOptionalLabel')}</label>
          <select id="mqClass">
            <option value="">${t('classGeneral')}</option>
            ${CLASS_OPTS}
          </select>
        </div>`,
      build(body) {
        const problem = body.querySelector('#mqProblem').value.trim();
        if (!problem) return null;
        const klass = body.querySelector('#mqClass').value;
        return `"${problem}" ko step-by-step hal karo, har step explain karke.${klass ? ` Yeh ${klass} ka sawal hai.` : ''}`;
      }
    },
    writing: {
      titleKey: 'modalWritingTitle',
      submitKey: 'modalWritingSubmit',
      html: (t) => `
        <div class="field">
          <label for="wrType">${t('writingTypeLabel')}</label>
          <select id="wrType">
            <option>Email</option>
            <option>Letter</option>
            <option>Application</option>
            <option>Social post / Caption</option>
          </select>
        </div>
        <div class="field">
          <label for="wrDetails">${t('writingDetailsLabel')}</label>
          <textarea id="wrDetails" placeholder="${t('writingDetailsPh')}"></textarea>
        </div>`,
      build(body) {
        const details = body.querySelector('#wrDetails').value.trim();
        if (!details) return null;
        const type = body.querySelector('#wrType').value;
        return `Mere liye ${type.toLowerCase()} draft karo. Details: ${details}`;
      }
    },
    translate: {
      titleKey: 'modalTranslateTitle',
      submitKey: 'modalTranslateSubmit',
      html: (t) => `
        <div class="field">
          <label for="trText">${t('translateTextLabel')}</label>
          <textarea id="trText" placeholder="${t('translateTextPh')}"></textarea>
        </div>
        <div class="field">
          <label for="trTarget">${t('translateTargetLabel')}</label>
          <select id="trTarget">
            ${TRANSLATE_TARGETS.map(l => `<option>${l}</option>`).join('')}
          </select>
        </div>`,
      build(body) {
        const text = body.querySelector('#trText').value.trim();
        if (!text) return null;
        const target = body.querySelector('#trTarget').value;
        return `Is text ko ${target} me translate karo (source language auto-detect karein):\n\n${text}`;
      }
    },
    syllabus: {
      titleKey: 'modalSyllabusTitle',
      submitKey: 'modalSyllabusSubmit',
      html: (t) => `
        <div class="modal-row">
          <div class="field">
            <label for="syBoard">${t('boardLabel')}</label>
            <select id="syBoard">
              <option>CBSE</option>
              <option>ICSE</option>
              <option>HBSE / BSEH</option>
              <option>State Board</option>
              <option>Other / College</option>
            </select>
          </div>
          <div class="field">
            <label for="syClass">${t('classLabel')}</label>
            <select id="syClass">${CLASS_OPTS}</select>
          </div>
        </div>
        <div class="field">
          <label for="sySubject">${t('subjectLabel')}</label>
          <input id="sySubject" type="text" placeholder="${t('subjectPh')}" autocomplete="off" maxlength="100">
        </div>`,
      build(body) {
        const subject = body.querySelector('#sySubject').value.trim();
        if (!subject) return null;
        const board = body.querySelector('#syBoard').value;
        const klass = body.querySelector('#syClass').value;
        return `${board} board, ${klass}, ${subject} ka complete syllabus dikhao — important chapters aur exam weightage bhi batao.`;
      }
    }
  };

  let activePanel = null;

  function openOptionModal(type) {
    const cfg = PANELS[type];
    if (!cfg) return;
    const t = window.t || (k => k);
    activePanel = { type, lastFocus: document.activeElement };
    qs('#modalTitle').textContent = t(cfg.titleKey);
    qs('#modalSubmit').textContent = t(cfg.submitKey);
    const body = qs('#modalBody');
    body.innerHTML = cfg.html(t);
    qs('#optionModal').hidden = false;
    document.body.style.overflow = 'hidden';
    if (cfg.mount) cfg.mount(body);
    const first = body.querySelector('input, select, textarea');
    (first || qs('#modalSubmit')).focus();
  }

  function closeOptionModal() {
    qs('#optionModal').hidden = true;
    qs('#modalBody').innerHTML = '';
    document.body.style.overflow = '';
    if (activePanel && activePanel.lastFocus && activePanel.lastFocus.focus) activePanel.lastFocus.focus();
    activePanel = null;
  }

  function submitOptionModal() {
    if (!activePanel) return;
    const cfg = PANELS[activePanel.type];
    const prompt = cfg.build(qs('#modalBody'));
    if (!prompt) {
      showToast(t('fillRequired'));
      return;
    }
    closeOptionModal();
    switchToChatMode();
    setComposerValue(prompt);
    sendMessage(prompt);
  }

  function shortenUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      const path = u.pathname.length > 24 ? u.pathname.slice(0, 24) + '…' : u.pathname;
      return host + (path === '/' ? '' : path);
    } catch (e) {
      return url.length > 50 ? url.slice(0, 50) + '…' : url;
    }
  }

  function sourcesHtml(sources) {
    if (!sources || !sources.length) return '';
    const items = sources.slice(0, 5).map(s => {
      const safe = escapeHtml(String(s));
      if (/^https?:\/\//i.test(s)) {
        return `<a class="source-item" href="${safe}" target="_blank" rel="noopener noreferrer">${escapeHtml(shortenUrl(String(s)))}</a>`;
      }
      return `<span class="source-item">${safe}</span>`;
    }).join('');
    return `<div class="message-sources"><span class="sources-label">' + t('sourcesLabel') + '</span>${items}</div>`;
  }

  function attachmentsHtml(attachments) {
    if (!attachments || !attachments.length) return '';
    const imgs = [];
    const files = [];
    attachments.forEach(a => {
      const name = escapeHtml(a.name || 'file');
      if (a.kind === 'image' && a.data) {
        imgs.push(`<img class="msg-image" src="${escapeHtml(a.data)}" alt="${name}">`);
      } else {
        files.push(`<span class="msg-attach-chip"><svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>${name}</span>`);
      }
    });
    return imgs.join('') + (files.length ? `<span class="msg-attach">${files.join('')}</span>` : '');
  }

  function addMessage(role, content, showVoicePrompt = false, sources = [], attachments = []) {
    const id = 'msg-' + (++messageId);
    const el = document.createElement('div');
    el.id = id;
    el.dataset.content = content == null ? '' : String(content);
    el.className = 'message ' + role;

    if (role === 'user') {
      el.innerHTML = `
        <div class="message-bubble">${attachmentsHtml(attachments)}${escapeHtml(content)}</div>
      `;
    } else {
      el.innerHTML = `
        <div class="message-avatar"><img src="assets/logo.png" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover"></div>
        <div class="message-bubble">${renderMarkdown(content)}</div>
        <div class="message-actions">
          <button class="action-btn" data-action="copy" aria-label="Copy"><svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
          <button class="action-btn" data-action="listen" aria-label="Suniye"><svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg></button>
          <button class="action-btn" data-action="regenerate" aria-label="Regenerate"><svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg></button>
        </div>
        ${sourcesHtml(sources)}
        ${showVoicePrompt ? `
        <div class="voice-prompt">
          <span class="voice-prompt-text">${t('voicePrompt')}</span>
          <div class="voice-prompt-buttons">
            <button class="voice-btn voice-btn-yes" data-action="speak-yes">${t('voiceYes')}</button>
            <button class="voice-btn voice-btn-no" data-action="speak-no">${t('voiceNo')}</button>
          </div>
        </div>
        ` : ''}
      `;
    }

    qs('#chatMessages').appendChild(el);
    scrollToBottom();

    el.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleAction(btn.dataset.action, el, content));
    });
  }

  function handleAction(action, msgEl, content) {
    content = (msgEl && msgEl.dataset && msgEl.dataset.content != null) ? msgEl.dataset.content : content;
    const bubble = msgEl.querySelector('.message-bubble');
    switch (action) {
      case 'stop':
        if (activeController) activeController.abort();
        break;
      case 'copy':
        navigator.clipboard.writeText(content).then(() => {
          showToast(t('toastCopied'));
        });
        break;
      case 'listen':
        speakText(content);
        break;
      case 'regenerate':
        regenerateAnswer(msgEl);
        break;
      case 'speak-yes':
        speakText(content);
        msgEl.querySelector('.voice-prompt')?.remove();
        break;
      case 'speak-no':
        msgEl.querySelector('.voice-prompt')?.remove();
        break;
    }
  }

  async function regenerateAnswer(msgEl) {
    if (!lastQuestion) return;
    const oldSources = msgEl.querySelector('.message-sources');
    const bubble = msgEl.querySelector('.message-bubble');
    bubble.textContent = t('regenerating');
    try {
      const res = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: lastQuestion, language: getApiLang() })
      });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      const reply = data.answer || t('regenFail');
      bubble.innerHTML = renderMarkdown(reply);
      if (oldSources) oldSources.remove();
      const sources = Array.isArray(data.sources) ? data.sources : [];
      if (sources.length) {
        const tmp = document.createElement('div');
        tmp.innerHTML = sourcesHtml(sources);
        msgEl.querySelector('.message-actions').after(tmp.firstElementChild);
      }
      for (let i = conversation.length - 1; i >= 0; i--) {
        if (conversation[i].role === 'assistant') {
          conversation[i] = { role: 'assistant', content: reply, sources };
          break;
        }
      }
      persistConversation();
    } catch (e) {
      bubble.textContent = t('regenFail');
    }
  }

  function hideSpeakStop() {
    const b = document.getElementById('speakStopBtn');
    if (b) b.remove();
  }

  function showSpeakStop() {
    hideSpeakStop();
    const b = document.createElement('button');
    b.id = 'speakStopBtn';
    b.className = 'speak-stop-btn';
    b.setAttribute('aria-label', 'Stop reading');
    b.innerHTML = '<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg><span>' + t('stopReading') + '</span>';
    b.addEventListener('click', () => {
      if (synth) synth.cancel();
      isSpeaking = false;
      hideSpeakStop();
    });
    document.body.appendChild(b);
  }

  function speakText(text) {
    if (!synth) return;
    if (isSpeaking) {
      synth.cancel();
      isSpeaking = false;
      hideSpeakStop();
      return;
    }

    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\$\$.*?\$\$/g, 'formula')
      .replace(/\$.*?\$/g, 'formula')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const lang = LANGUAGES.find(l => l.code === currentLang);
    const fallback = SPEECH_LANG[currentLang] || 'en-IN';
    utterance.lang = lang ? (lang.code === 'auto' ? 'hi-IN' : (lang.code + '-IN')) : fallback;
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => { isSpeaking = true; showSpeakStop(); };
    utterance.onend = () => { isSpeaking = false; hideSpeakStop(); };
    utterance.onerror = () => { isSpeaking = false; hideSpeakStop(); };

    synth.speak(utterance);
  }

  function closeLightbox() {
    const l = qs('#lightbox');
    if (l) l.remove();
  }

  function openLightbox(src) {
    closeLightbox();
    if (!src) return;
    const ov = document.createElement('div');
    ov.className = 'lightbox';
    ov.id = 'lightbox';
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'preview';
    ov.appendChild(img);
    ov.addEventListener('click', closeLightbox);
    document.body.appendChild(ov);
  }

  function showToast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: var(--color-text); color: var(--color-white);
      padding: 12px 24px; border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg); z-index: 1000;
      animation: slideUp 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideUp 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function scrollToBottom() {
    const area = qs('#chatMessages');
    if (area) area.scrollTop = area.scrollHeight;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function renderAttachPreview() {
    const containers = [qs('#attachPreview'), qs('#attachPreviewBottom')];
    const html = pendingAttachments.map(a => `
      <span class="attach-chip">
        ${a.kind === 'image' && a.data
          ? `<img src="${escapeHtml(a.data)}" alt="${escapeHtml(a.name)}">`
          : `<span class="attach-chip-icon"><svg class="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></span>`}
        <span class="name">${escapeHtml(a.name)}</span>
        <button type="button" class="attach-chip-remove" data-remove-idx="${pendingAttachments.indexOf(a)}" aria-label="Remove ${escapeHtml(a.name)}">
          <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </span>
    `).join('');
    containers.forEach(c => { if (c) { c.innerHTML = html; } });
    qsa('.attach-chip-remove').forEach(btn => btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.removeIdx, 10);
      if (!isNaN(idx)) { pendingAttachments.splice(idx, 1); renderAttachPreview(); updateSendButton(); }
    }));
  }

  async function uploadFiles(files) {
    for (const file of files) {
      const data = new FormData();
      data.append('file', file, file.name);
      try {
        const res = await apiFetch('/api/upload', { method: 'POST', body: data });
        const d = await res.json();
        if (!res.ok) { showToast(d.detail || t('toastFileFailed')); continue; }
        pendingAttachments.push({ name: d.name || file.name, kind: d.kind, data: d.data || '', text: d.text || '', size: d.size || file.size });
      } catch (e) {
        showToast(t('toastUploadError'));
      }
    }
    if (pendingAttachments.length > 6) pendingAttachments = pendingAttachments.slice(-6);
    renderAttachPreview();
    updateSendButton();
  }

  function handlePaste(e) {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    const files = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) files.push(new File([f], f.name || ('paste-' + Date.now() + '.png'), { type: f.type || 'image/png' }));
      }
    }
    if (files.length) {
      e.preventDefault();
      uploadFiles(files);
      showToast(t('toastImageAttached'));
    }
  }

  async function captureScreenShot() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      showToast(t('toastScreenshotUnsupported'));
      return;
    }
    let stream = null;
    let videoEl = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' }, audio: false });
      videoEl = document.createElement('video');
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.srcObject = stream;
      videoEl.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;';
      document.body.appendChild(videoEl);
      await videoEl.play();
      await new Promise(r => setTimeout(r, 300));
      const track = stream.getVideoTracks()[0];
      const settings = (track && track.getSettings) ? track.getSettings() : {};
      const canvas = document.createElement('canvas');
      canvas.width = settings.width || videoEl.videoWidth || 1280;
      canvas.height = settings.height || videoEl.videoHeight || 720;
      canvas.getContext('2d').drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) { showToast(t('toastScreenshotFailed')); return; }
      const file = new File([blob], 'screenshot-' + Date.now() + '.png', { type: 'image/png' });
      await uploadFiles([file]);
      showToast(t('toastScreenshotAttached'));
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) showToast(t('toastScreenshotCancelled'));
      else showToast(t('toastScreenshotFailed'));
    } finally {
      if (stream) { try { stream.getTracks().forEach(t => t.stop()); } catch (e) {} }
      if (videoEl) { try { videoEl.remove(); } catch (e) {} }
    }
  }

  function toggleAttachMenu(btn) {
    const menu = qs('#attachMenu');
    if (!menu) return;
    if (menu.hidden) {
      const rect = btn.getBoundingClientRect();
      menu.style.left = Math.max(8, Math.min(window.innerWidth - 270, rect.left)) + 'px';
      menu.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
      menu.style.top = 'auto';
      menu.hidden = false;
    } else {
      closeAttachMenu();
    }
  }

  function closeAttachMenu() {
    const menu = qs('#attachMenu');
    if (menu) menu.hidden = true;
  }

  function handleMicClick() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      showToast(t('voiceUnsupported'));
      return;
    }
    try {
      const rec = new SR();
      rec.lang = SPEECH_LANG[currentLang] || 'hi-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      showToast(t('listening'));
      rec.onresult = (e) => {
        const transcript = (e.results && e.results[0] && e.results[0][0].transcript) || '';
        const text = transcript.trim();
        if (text) sendMessage(text);
        else showToast(t('voiceNotHeard'));
      };
      rec.onerror = () => showToast(t('voiceError'));
      rec.start();
    } catch (e) {
      showToast(t('voiceError'));
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .typing-bubble { display: flex; align-items: center; gap: 4px; padding: 8px 12px; }
    .typing-dots { display: flex; gap: 4px; }
    .typing-dots span { width: 8px; height: 8px; background: var(--color-accent); border-radius: 50%; animation: bounce 1.4s ease-in-out infinite both; }
    .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%, 80%, 100% { transform: scale(0.8); } 40% { transform: scale(1.2); } }
    .history-time { font-size: 11px; color: var(--color-text-muted); margin-left: auto; white-space: nowrap; }
    [dir="rtl"] .history-time { margin-left: 0; margin-right: auto; }
    .history-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .history-delete { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: var(--radius-sm); color: var(--color-text-muted); opacity: 0; flex-shrink: 0; transition: opacity var(--transition-fast), background var(--transition-fast), color var(--transition-fast); }
    .history-delete:hover { background: var(--color-chips); color: var(--color-text); }
    .history-item:hover .history-delete, .history-item:focus-within .history-delete { opacity: 1; }
    @media (max-width: 1023px) { .history-delete { opacity: 1; } }
    .history-empty { font-size: 12px; color: var(--color-text-muted); padding: 6px 12px; }
    .message-sources { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; margin-top: 8px; padding-left: 42px; font-size: 12px; color: var(--color-text-muted); }
    .message-sources .sources-label { font-weight: 600; }
    .message-sources .source-item { color: var(--color-accent); }
    a.source-item:hover { text-decoration: underline; }
    [dir="rtl"] .message-sources { padding-left: 0; padding-right: 42px; }
    @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(16px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
