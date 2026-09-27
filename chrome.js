(function () {
	const page = document.body.dataset.page || '';
	const sidebar = document.getElementById('app-sidebar');
	if (sidebar) {
		sidebar.innerHTML = `
			<a class="brand" href="/"><span class="brand-mark">↗</span> Formkurva</a>
			<p class="nav-label">Meny</p>
			<nav>
				<a class="nav-item${page === 'home' ? ' active' : ''}" href="/"><span class="nav-icon">▦</span> Översikt</a>
				<a class="nav-item" href="/#new-measurement"><span class="nav-icon">＋</span> Ny mätning</a>
				<a class="nav-item" href="/#history"><span class="nav-icon">◷</span> Historik</a>
				<a class="nav-item" href="/#goals"><span class="nav-icon">◎</span> Mål & hälsa</a>
				<a class="nav-item${page === 'gym' ? ' active' : ''}" href="/gym.html"><span class="nav-icon">▣</span> Gym & schema</a>
				<a class="nav-item" href="/#profile"><span class="nav-icon">◉</span> Min profil</a>
				<a class="nav-item admin-only" id="admin-nav" href="/admin.html"><span class="nav-icon">⚙</span> Admin</a>
			</nav>
			<div class="sidebar-bottom">Inloggad data sparas på servern.<br>En mätning i taget. En vana i taget.</div>
		`;
	}

	const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
	function applyTheme(preference) {
		const theme = preference || localStorage.getItem('formkurva-theme') || 'system';
		const isDark = theme === 'dark' || (theme === 'system' && systemTheme.matches);
		document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
		const select = document.getElementById('theme-select');
		if (select) select.value = theme;
		return theme;
	}
	applyTheme();
	systemTheme.addEventListener('change', () => {
		const current = document.getElementById('theme-select')?.value || localStorage.getItem('formkurva-theme') || 'system';
		if (current === 'system') applyTheme('system');
	});

	window.FormkurvaChrome = {
		applyTheme,
		showAdmin(isAdmin) {
			const nav = document.getElementById('admin-nav');
			if (nav) nav.style.display = isAdmin ? 'flex' : 'none';
		},
		setUser(user) {
			const chip = document.getElementById('user-chip');
			const nameEl = document.getElementById('user-name');
			const avatar = document.getElementById('user-avatar');
			if (!chip) return;
			if (!user) {
				chip.style.display = 'none';
				return;
			}
			const displayName = user.profile?.name || user.email.split('@')[0];
			if (nameEl) nameEl.textContent = displayName;
			if (avatar) avatar.textContent = displayName[0]?.toUpperCase() || '?';
			chip.style.display = 'flex';
		}
	};
})();
