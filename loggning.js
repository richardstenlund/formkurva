const api = async (path, options = {}) => {
	const response = await fetch(`/api${path}`, {
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/json' },
		...options
	});
	if (!response.ok) {
		const result = await response.json().catch(() => ({ error: 'Serverfel. Försök igen.' }));
		throw new Error(result.error || 'Serverfel. Försök igen.');
	}
	return response.status === 204 ? null : response.json();
};

const today = new Date();
const localDate = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
document.getElementById('measurement-date').value = localDate;
document.getElementById('workout-date').value = localDate;

const authForm = document.getElementById('auth-form');
const authStatus = document.getElementById('auth-status');
const authSubmit = document.getElementById('auth-submit');
const authTitle = document.getElementById('auth-title');
const authPanel = document.getElementById('auth-panel');
const trackerApp = document.getElementById('tracker-app');
let authMode = 'login';
let currentUser = null;
let measurements = [];
let workouts = [];

function setStatus(id, message, isError = false) {
	const status = document.getElementById(id);
	status.textContent = message;
	status.className = `tracker-status${message ? (isError ? ' error' : ' ok') : ''}`;
}

function setAuthMode(mode) {
	authMode = mode;
	const isRegister = mode === 'register';
	authTitle.textContent = isRegister ? 'Skapa ett konto' : 'Logga in';
	authSubmit.textContent = isRegister ? 'Skapa konto' : 'Logga in';
	authForm.elements.password.autocomplete = isRegister ? 'new-password' : 'current-password';
	document.querySelectorAll('[data-auth-mode]').forEach(button => {
		const active = button.dataset.authMode === mode;
		button.classList.toggle('active', active);
		button.setAttribute('aria-pressed', String(active));
	});
	setStatus('auth-status', '');
}

function setSignedIn(user) {
	currentUser = user;
	const signedIn = Boolean(user);
	authPanel.hidden = signedIn;
	trackerApp.hidden = !signedIn;
	document.getElementById('logout-button').hidden = !signedIn;
	const chip = document.getElementById('user-chip');
	chip.style.display = signedIn ? 'inline-flex' : 'none';
	document.getElementById('user-email').textContent = user?.email || '';
	document.getElementById('user-avatar').textContent = user?.email?.[0]?.toUpperCase() || '';
	if (signedIn) {
		const height = user.profile?.height;
		document.getElementById('profile-height').value = height || '';
		document.getElementById('summary-height').textContent = height ? `${height} cm` : 'Inte angiven';
	}
}

function formatDate(value) {
	return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function createEntry(title, details, id, onDelete) {
	const entry = document.createElement('article');
	entry.className = 'tracker-entry';
	const content = document.createElement('div');
	const heading = document.createElement('p');
	heading.className = 'entry-title';
	heading.textContent = title;
	const description = document.createElement('p');
	description.className = 'entry-details';
	description.textContent = details;
	content.append(heading, description);
	const remove = document.createElement('button');
	remove.className = 'entry-delete';
	remove.type = 'button';
	remove.textContent = 'Ta bort';
	remove.setAttribute('aria-label', `Ta bort ${title}`);
	remove.addEventListener('click', onDelete);
	entry.append(content, remove);
	return entry;
}

function renderMeasurements() {
	const list = document.getElementById('measurement-list');
	list.replaceChildren();
	const sorted = [...measurements].sort((a, b) => String(b.date).localeCompare(String(a.date)));
	const latestWeight = sorted.find(item => item.weight !== undefined && item.weight !== null && item.weight !== '');
	document.getElementById('summary-weight').textContent = latestWeight
		? `${latestWeight.weight} kg`
		: '—';
	if (!sorted.length) {
		const empty = document.createElement('p');
		empty.className = 'empty-state';
		empty.textContent = 'Inga kroppsmätningar ännu.';
		list.append(empty);
		return;
	}
	sorted.slice(0, 10).forEach(item => {
		const fields = [
			['Vikt', item.weight, 'kg'],
			['Midja', item.waist, 'cm'],
			['Bröst', item.chest, 'cm'],
			['Överarm', item.arm, 'cm'],
			['Lår', item.thigh, 'cm'],
			['Höft', item.hip, 'cm']
		].filter(([, value]) => value !== undefined && value !== null && value !== '');
		const details = fields.map(([label, value, unit]) => `${label}: ${value} ${unit}`).join(' · ');
		list.append(createEntry(formatDate(item.date), details, item.id, async () => {
			try {
				await api(`/measurements/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
				measurements = measurements.filter(measurement => measurement.id !== item.id);
				renderMeasurements();
				setStatus('measurement-status', 'Mätningen har tagits bort.');
			} catch (error) {
				setStatus('measurement-status', error.message, true);
			}
		}));
	});
}

function renderWorkouts() {
	const list = document.getElementById('workout-list');
	list.replaceChildren();
	const sorted = [...workouts].sort((a, b) => String(b.date).localeCompare(String(a.date)));
	document.getElementById('summary-workouts').textContent = String(workouts.length);
	if (!sorted.length) {
		const empty = document.createElement('p');
		empty.className = 'empty-state';
		empty.textContent = 'Inga träningspass ännu.';
		list.append(empty);
		return;
	}
	sorted.slice(0, 10).forEach(item => {
		const details = `${item.muscle_group} · ${item.sets} × ${item.reps} · ${item.weight} kg${item.notes ? ` · ${item.notes}` : ''}`;
		list.append(createEntry(`${formatDate(item.date)} – ${item.exercise}`, details, item.id, async () => {
			try {
				await api(`/workouts/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
				workouts = workouts.filter(workout => workout.id !== item.id);
				renderWorkouts();
				setStatus('workout-status', 'Träningspasset har tagits bort.');
			} catch (error) {
				setStatus('workout-status', error.message, true);
			}
		}));
	});
}

async function loadData() {
	const [measurementResult, workoutResult] = await Promise.all([api('/measurements'), api('/workouts')]);
	measurements = measurementResult.measurements;
	workouts = workoutResult.workouts;
	renderMeasurements();
	renderWorkouts();
}

document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));

authForm.addEventListener('submit', async event => {
	event.preventDefault();
	authSubmit.disabled = true;
	setStatus('auth-status', '');
	const credentials = Object.fromEntries(new FormData(authForm));
	try {
		const result = await api(`/auth/${authMode === 'register' ? 'register' : 'login'}`, {
			method: 'POST',
			body: JSON.stringify(credentials)
		});
		setSignedIn(result.user);
		await loadData();
	} catch (error) {
		setStatus('auth-status', error.message, true);
	} finally {
		authSubmit.disabled = false;
	}
});

document.getElementById('logout-button').addEventListener('click', async () => {
	try {
		await api('/auth/logout', { method: 'POST' });
		setSignedIn(null);
		measurements = [];
		workouts = [];
		authForm.reset();
		setAuthMode('login');
	} catch (error) {
		setStatus('page-status', error.message, true);
	}
});

document.getElementById('measurement-form').addEventListener('submit', async event => {
	event.preventDefault();
	const form = event.currentTarget;
	const data = Object.fromEntries(new FormData(form));
	if (!Object.entries(data).some(([key, value]) => key !== 'date' && value !== '')) {
		setStatus('measurement-status', 'Fyll i minst ett kroppsmått.', true);
		return;
	}
	for (const key of ['weight', 'waist', 'chest', 'arm', 'thigh', 'hip']) {
		if (data[key] !== '') data[key] = Number(data[key]);
		else delete data[key];
	}
	try {
		const saved = await api('/measurements', { method: 'POST', body: JSON.stringify(data) });
		measurements.push(saved);
		renderMeasurements();
		form.reset();
		form.elements.date.value = localDate;
		setStatus('measurement-status', 'Kroppsmätningen har sparats.');
	} catch (error) {
		setStatus('measurement-status', error.message, true);
	}
});

document.getElementById('profile-form').addEventListener('submit', async event => {
	event.preventDefault();
	const height = Number(event.currentTarget.elements.height.value);
	try {
		const profile = { ...currentUser.profile, height };
		const result = await api('/profile', { method: 'PUT', body: JSON.stringify(profile) });
		currentUser = { ...currentUser, profile: result.profile };
		document.getElementById('summary-height').textContent = `${height} cm`;
		setStatus('profile-status', 'Längden har sparats i din profil.');
	} catch (error) {
		setStatus('profile-status', error.message, true);
	}
});

document.getElementById('workout-form').addEventListener('submit', async event => {
	event.preventDefault();
	const form = event.currentTarget;
	const data = Object.fromEntries(new FormData(form));
	for (const key of ['sets', 'reps', 'weight']) data[key] = Number(data[key]);
	try {
		const saved = await api('/workouts', { method: 'POST', body: JSON.stringify(data) });
		workouts.unshift(saved);
		renderWorkouts();
		form.reset();
		form.elements.date.value = localDate;
		form.elements.sets.value = '3';
		form.elements.reps.value = '8';
		form.elements.weight.value = '0';
		setStatus('workout-status', 'Träningspasset har sparats.');
	} catch (error) {
		setStatus('workout-status', error.message, true);
	}
});

api('/me').then(async result => {
	setSignedIn(result.user);
	if (result.user) {
		try {
			await loadData();
		} catch (error) {
			setStatus('page-status', error.message, true);
		}
	}
}).catch(error => setStatus('auth-status', error.message, true));
