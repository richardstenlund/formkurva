(() => {
	'use strict';

	const storageKey = 'formkurva-vardag-v1-guest';
	const types = {
		notes: { title: 'Anteckningar', singular: 'anteckning', icon: '✎', description: 'Tankar, mått och små saker du vill komma ihåg.', categories: ['Idéer', 'Hemma', 'Jobb', 'Övrigt'], fields: { detail: 'Anteckning' } },
		recipes: { title: 'Recept', singular: 'recept', icon: '♨', description: 'Samla favoriterna och slipp leta efter den där goda rätten.', categories: ['Middag', 'Lunch', 'Frukost', 'Fika', 'Övrigt'], fields: { ingredients: 'Ingredienser, en per rad', detail: 'Så gör du', quantity: 'Tid / portioner' } },
		tasks: { title: 'Att göra', singular: 'uppgift', icon: '✓', description: 'Fånga upp det som behöver bli gjort, i din egen takt.', categories: ['Hemma', 'Jobb', 'Personligt', 'Övrigt'], checklist: true, fields: { detail: 'Anteckning', due: 'Datum' } },
		meals: { title: 'Veckans måltider', singular: 'måltid', icon: '♨', description: 'Planera veckans mat, knyt ihop med dina favoritrecept och samla ingredienser till inköpen.', categories: ['Frukost', 'Lunch', 'Middag', 'Mellanmål', 'Fika'], fields: { mealType: 'Måltid', due: 'Datum', detail: 'Anteckning', recipe: 'Sparat recept' } },
		shopping: { title: 'Inköpslista', singular: 'vara', icon: '🛒', description: 'Samla allt på ett ställe och bocka av när du handlar.', categories: ['Frukt & grönt', 'Mejeri', 'Kött & fisk', 'Skafferi', 'Frys', 'Städ', 'Badrum', 'Djur', 'Övrigt'], checklist: true, fields: { quantity: 'Mängd', detail: 'Märke eller anteckning' } },
		inventory: { title: 'Vad vi har hemma', singular: 'sak', icon: '▤', description: 'Håll koll på mat, städartiklar, verktyg och allt annat — med plats, mängd och bäst före.', categories: ['Skafferi', 'Kyl & frys', 'Städ', 'Badrum', 'Djurmat', 'Djurvård', 'Verktyg', 'Förråd', 'Kontor', 'Övrigt'], fields: { quantity: 'Mängd hemma', unit: 'Enhet', minimum: 'Fyll på när mängden är under', expiry: 'Bäst före', detail: 'Var finns den? Anteckning' } },
		pets: { title: 'Djur & omsorg', singular: 'djur', icon: '♡', description: 'Samla djurens rutiner, mat, vård, försäkring och veterinärbesök.', categories: ['Hund', 'Katt', 'Kanin', 'Fågel', 'Fisk', 'Annat djur'], fields: {} },
		chores: { title: 'Sysslor & rutiner', singular: 'syssla', icon: '✓', description: 'Få koll på vardagsstädning, tvätt och andra återkommande rutiner — klart är klart.', categories: ['Kök', 'Badrum', 'Tvätt', 'Städning', 'Sopor & återvinning', 'Växter', 'Husdjur', 'Övrigt'], checklist: true, fields: { due: 'Nästa gång', repeat: 'Upprepa', detail: 'Anteckning' } },
		maintenance: { title: 'Hemunderhåll', singular: 'påminnelse', icon: '⌂', description: 'Håll reda på återkommande skötsel så att inget faller mellan stolarna.', categories: ['Brandvarnare', 'Filter & ventilation', 'Värme & vatten', 'Vitvaror', 'El & säkerhet', 'Bil & cykel', 'Trädgård', 'Annat'], fields: { quantity: 'Intervall / modell', due: 'Nästa kontroll', repeat: 'Upprepa', detail: 'Plats, instruktion eller anteckning' } },
		bills: { title: 'Räkningar & avtal', singular: 'räkning', icon: '¤', description: 'Samla kommande betalningar, abonnemang, belopp och förfallodatum.', categories: ['Boende', 'El & vatten', 'Försäkring', 'Telefon & internet', 'Abonnemang', 'Transport', 'Hälsa', 'Övrigt'], checklist: true, fields: { amount: 'Belopp (kr)', due: 'Förfallodatum', repeat: 'Upprepa', detail: 'Mottagare, OCR eller anteckning' } },
		important: { title: 'Viktigt att veta', singular: 'uppgift', icon: '★', description: 'Spara sådant som är bra att hitta snabbt: garantier, modeller, kontakter och manualer.', categories: ['Vitvaror & elektronik', 'Försäkring & avtal', 'Viktiga kontakter', 'Manualer & garantier', 'Hem & adresser', 'Övrigt'], fields: { reference: 'Modell / serienummer / kontakt', due: 'Garanti går ut / datum', detail: 'Anteckning eller var dokumentet finns' } },
		packing: { title: 'Packlistor', singular: 'sak', icon: '♧', description: 'Kom ihåg allt från tandborste till badkläder.', categories: ['Resa', 'Utflykt', 'Träning', 'Övernattning', 'Övrigt'], checklist: true, fields: { quantity: 'Mängd', detail: 'Anteckning' } },
		errands: { title: 'Ärenden & ute', singular: 'ärende', icon: '↗', description: 'Samla saker att fixa både hemma och på språng.', categories: ['Ärende', 'Hemma', 'Utomhus', 'Telefon', 'Övrigt'], checklist: true, fields: { detail: 'Plats eller anteckning', due: 'Datum' } },
		expenses: { title: 'Hushållsbudget', singular: 'utgift', icon: 'kr', description: 'Följ hushållets utgifter månad för månad.', categories: ['Mat', 'Boende', 'Transport', 'Hälsa', 'Barn & djur', 'Fritid', 'Övrigt'], fields: { amount: 'Belopp (kr)', due: 'Datum', detail: 'Anteckning' } },
		documents: { title: 'Dokument & länkar', singular: 'länk', icon: '↗', description: 'Samla länkar till manualer, garantier och viktiga dokument.', categories: ['Manualer & garantier', 'Försäkring & avtal', 'Viktiga kontakter', 'Hem & adresser', 'Övrigt'], fields: { reference: 'Länk (https://...)', detail: 'Anteckning' } },
		calendar: { title: 'Kalender', singular: 'händelse', icon: '▦', description: 'Se kommande datum från hushållets listor.', categories: [], fields: {} }
	};
	const animalKinds = [
		['dog', 'Hund'], ['cat', 'Katt'], ['rabbit', 'Kanin'], ['bird', 'Fågel'],
		['fish', 'Fisk'], ['reptile', 'Reptil'], ['rodent', 'Gnagare'], ['horse', 'Häst'], ['other', 'Annat djur']
	];
	const animalCare = {
		dog: { routine: 'Promenader och aktivering', placeholder: 'Promenader, rastning, träning eller favoritaktiviteter...' },
		cat: { routine: 'Kattlåda och utevistelse', placeholder: 'Kattlåda, pälsvård, utevistelse eller favoritgömställe...' },
		rabbit: { routine: 'Hö, strö och motion', placeholder: 'Hö, strö, kloklippning och tid utanför buren...' },
		bird: { routine: 'Bur och aktivering', placeholder: 'Bur, vattenbyte, rengöring och leksaker...' },
		fish: { routine: 'Akvarium och vatten', placeholder: 'Akvarium, temperatur, vattenbyte och matning...' },
		reptile: { routine: 'Terrarium och värme', placeholder: 'Terrarium, temperatur, UV-ljus och matning...' },
		rodent: { routine: 'Bur och berikning', placeholder: 'Bur, strö, motion och aktivering...' },
		horse: { routine: 'Utevistelse och skötsel', placeholder: 'Utevistelse, motion, hovvård och utrustning...' },
		other: { routine: 'Skötsel och rutiner', placeholder: 'Skriv ner det som är viktigt för just ditt djur...' }
	};
	const views = { home: { title: 'Översikt', eyebrow: 'SÖNDAGSKOLL', description: 'Samla små och stora saker på ett ställe — hemma och ute.' }, ...Object.fromEntries(Object.entries(types).map(([key, value]) => [key, value])) };
	const emptyData = () => Object.fromEntries(Object.keys(types).map(key => [key, []]));
	let data = emptyData();
	let activeView = 'home';
	let activeFilter = 'all';
	let currentUser = null;
	let accountReady = false;
	let householdInfo = null;
	let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
	let editingId = null;
	let authMode = 'login';
	let toastTimer;
	let saveQueue = Promise.resolve();
	const $ = selector => document.querySelector(selector);
	const createId = () => globalThis.crypto?.randomUUID
		? globalThis.crypto.randomUUID()
		: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

	function escapeHtml(value) {
		return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
	}
	function safeExternalUrl(value) {
		try {
			const url = new URL(value);
			return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
		} catch {
			return '';
		}
	}
	function animalName(item) {
		const kind = animalKinds.find(([key]) => key === item.animalType);
		return item.customSpecies || kind?.[1] || item.category || 'Annat djur';
	}

	function petKind(item) {
		if (item?.animalType && animalKinds.some(([key]) => key === item.animalType)) return item.animalType;
		return animalKinds.find(([, label]) => label === item?.category)?.[0] || 'other';
	}

	function categoriesFor(type) {
		const categories = [...types[type].categories];
		if (type === 'inventory') {
			for (const pet of data.pets) {
				categories.push(`Mat till ${pet.title}`, `Vård till ${pet.title}`);
			}
		}
		return [...new Set(categories)];
	}
	function normaliseData(value) {
		const clean = emptyData();
		if (!value || typeof value !== 'object' || Array.isArray(value)) return clean;
		for (const key of Object.keys(types)) {
			if (!Array.isArray(value[key])) continue;
			clean[key] = value[key].filter(item => item && typeof item === 'object' && typeof item.title === 'string').map(item => ({
				id: String(item.id || createId()),
				title: item.title.slice(0, 120),
				detail: typeof item.detail === 'string' ? item.detail.slice(0, 12000) : '',
				category: typeof item.category === 'string' ? item.category.slice(0, 60) : 'Övrigt',
				quantity: typeof item.quantity === 'string' ? item.quantity.slice(0, 100) : '',
				unit: typeof item.unit === 'string' ? item.unit.slice(0, 30) : '',
				minimum: typeof item.minimum === 'string' ? item.minimum.slice(0, 30) : '',
				expiry: typeof item.expiry === 'string' ? item.expiry.slice(0, 10) : '',
				reference: typeof item.reference === 'string' ? item.reference.slice(0, 500) : '',
				due: typeof item.due === 'string' ? item.due.slice(0, 10) : '',
				sourceInventoryId: typeof item.sourceInventoryId === 'string' ? item.sourceInventoryId.slice(0, 80) : '',
				animalType: typeof item.animalType === 'string' ? item.animalType.slice(0, 40) : '',
				customSpecies: typeof item.customSpecies === 'string' ? item.customSpecies.slice(0, 80) : '',
				food: typeof item.food === 'string' ? item.food.slice(0, 200) : '',
				routine: typeof item.routine === 'string' ? item.routine.slice(0, 2000) : '',
				medical: typeof item.medical === 'string' ? item.medical.slice(0, 2000) : '',
				ingredients: typeof item.ingredients === 'string' ? item.ingredients.slice(0, 6000) : '',
				petId: typeof item.petId === 'string' ? item.petId.slice(0, 80) : '',
				mealType: typeof item.mealType === 'string' ? item.mealType.slice(0, 30) : '',
				recipeId: typeof item.recipeId === 'string' ? item.recipeId.slice(0, 80) : '',
				repeat: typeof item.repeat === 'string' ? item.repeat.slice(0, 20) : 'none',
				amount: typeof item.amount === 'string' ? item.amount.slice(0, 30) : '',
				lastDone: typeof item.lastDone === 'string' ? item.lastDone.slice(0, 10) : '',
				lastPaid: typeof item.lastPaid === 'string' ? item.lastPaid.slice(0, 10) : '',
				templateKey: typeof item.templateKey === 'string' ? item.templateKey.slice(0, 40) : '',
				completed: Boolean(item.completed),
				pinned: Boolean(item.pinned),
				createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString()
			}));
		}
		return clean;
	}

	function readLocalData() {
		try {
			const stored = localStorage.getItem(storageKey);
			return stored ? normaliseData(JSON.parse(stored)) : emptyData();
		} catch (error) {
			showToast('Kunde inte läsa sparade listor från den här webbläsaren.');
			return emptyData();
		}
	}

	function mergeData(primary, secondary) {
		const merged = emptyData();
		for (const key of Object.keys(types)) {
			const byId = new Map();
			for (const item of [...(primary[key] || []), ...(secondary[key] || [])]) byId.set(item.id, item);
			merged[key] = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
		}
		return merged;
	}

	async function api(path, options = {}) {
		const response = await fetch(`/api${path}`, {
			...options,
			headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
		});
		if (!response.ok) {
			const body = await response.json().catch(() => ({}));
			throw new Error(body.error || 'Det gick inte att spara. Försök igen.');
		}
		return response.status === 204 ? null : response.json();
	}

	function persist() {
		if (!currentUser || !accountReady) {
			try {
				localStorage.setItem(storageKey, JSON.stringify(data));
			} catch (error) {
				showToast('Webbläsaren kunde inte spara dina listor. Kontrollera ledigt lagringsutrymme.');
			}
		}
		if (currentUser && accountReady) {
			$('#save-status').textContent = householdInfo ? 'Sparar i hushållet…' : 'Sparar på ditt konto…';
			const snapshot = JSON.stringify(data);
			saveQueue = saveQueue.then(() => api('/household', { method: 'PUT', body: JSON.stringify({ data: JSON.parse(snapshot) }) }))
				.then(() => { $('#save-status').textContent = householdInfo ? 'Sparat i hushållet' : 'Sparat på ditt konto'; })
				.catch(error => {
					$('#save-status').textContent = 'Kunde inte synka';
					showToast(error.message);
				});
		} else {
			$('#save-status').textContent = 'Sparas på den här enheten';
		}
	}

	function showToast(message) {
		const toast = $('#toast');
		toast.textContent = message;
		toast.classList.add('show');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
	}

	function setView(view) {
		if (!views[view]) return;
		activeView = view;
		$('#add-picker').hidden = true;
		$('#add-button').setAttribute('aria-expanded', 'false');
		activeFilter = 'all';
		$('#search-input').value = '';
		$('#dashboard').hidden = view !== 'home';
		$('#list-view').hidden = view === 'home' || view === 'calendar';
		$('#calendar-view').hidden = view !== 'calendar';
		$('.add-control').hidden = view === 'calendar';
		$('#page-eyebrow').textContent = view === 'home' ? 'SÖNDAGSKOLL' : 'DIN VARDAG, SAMLAD';
		$('#page-title').textContent = view === 'home' ? 'Bra att ha hemma' : views[view].title;
		$('#page-description').textContent = view === 'pets' && data.pets.length
			? `Anpassat för ${[...new Set(data.pets.map(animalName))].join(', ')} — samla mat, rutiner och vårddatum per djur.`
			: views[view].description;
		if (view === 'home') {
			$('#page-description').textContent = data.pets.length
				? `Håll koll på hemmet och ${data.pets.map(item => item.title).join(', ')} — allt samlat på ett ställe.`
				: 'Håll koll på vad som finns, vad som behövs och allt som gör hemmet till ditt.';
		}
		$('#add-button-label').textContent = view === 'home' ? 'Lägg till nytt' : `Lägg till ${types[view].singular}`;
		document.querySelectorAll('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.view === view));
		$('#filter-group').innerHTML = view !== 'home' && types[view].checklist
			? `<button class="filter-button active" data-filter="all" type="button">Alla</button><button class="filter-button" data-filter="open" type="button">Kvar</button><button class="filter-button" data-filter="completed" type="button">Klara</button>`
			: '';
		render();
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function itemCard(item, type) {
		const config = types[type];
		const completed = item.completed ? ' completed' : '';
		const petDetail = type === 'pets'
			? [item.quantity && `Ålder / vikt: ${item.quantity}`, item.food && `Mat: ${item.food}`, item.routine && `${animalCare[petKind(item)]?.routine || 'Rutiner'}: ${item.routine}`, item.medical && `Hälsa: ${item.medical}`].filter(Boolean).join('\n')
			: '';
		const detailText = type === 'pets'
			? petDetail
			: type === 'recipes' ? [item.ingredients && `Ingredienser:\n${item.ingredients}`, item.detail && `Så gör du:\n${item.detail}`].filter(Boolean).join('\n\n')
			: item.detail;
		const detail = detailText ? `<p class="item-detail">${escapeHtml(detailText)}</p>` : '';
		let footer = '';
		if (config.checklist) {
			const repeats = ['chores', 'maintenance', 'bills'].includes(type) && item.repeat && item.repeat !== 'none';
			footer = repeats
				? `<button class="complete-button" data-action="complete-repeat" data-type="${type}" data-id="${escapeHtml(item.id)}" type="button">${type === 'bills' ? '✓ Betald' : '✓ Klar idag'}</button>${item.lastDone ? `<span class="preview-meta">Senast ${escapeHtml(formatDate(item.lastDone))}</span>` : ''}`
				: `<label class="item-check"><input type="checkbox" data-action="toggle" data-type="${type}" data-id="${escapeHtml(item.id)}" ${item.completed ? 'checked' : ''}> ${item.completed ? 'Klart' : 'Markera klar'}</label>`;
		} else if (item.quantity) {
			footer = `<span>${escapeHtml(item.quantity)}</span>`;
		} else if (item.due) {
			footer = `<span>${escapeHtml(formatDate(item.due))}</span>`;
		} else {
			footer = `<span>${escapeHtml(formatDate(item.createdAt.slice(0, 10)))}</span>`;
		}
		const restock = type === 'inventory' ? `<button class="restock-button" data-action="restock" data-id="${escapeHtml(item.id)}" type="button">＋ Köp mer</button>` : '';
		const stock = type === 'inventory' && isLowStock(item) ? '<span class="stock-warning">Lågt lager</span>' : '';
		const date = item.expiry ? `<span class="${isExpiring(item.expiry) ? 'expiry-warning' : ''}">${expiryLabel(item.expiry)} ${escapeHtml(formatDate(item.expiry))}</span>` : item.due ? `<span>${escapeHtml(formatDate(item.due))}</span>` : '';
		const amount = item.quantity ? `${escapeHtml(item.quantity)}${item.unit ? ` ${escapeHtml(item.unit)}` : ''}` : '';
		const pin = type === 'notes' && item.pinned ? '<span class="preview-meta">Fäst</span>' : '';
		const category = type === 'pets' ? animalName(item) : item.category;
		const petFood = type === 'pets' ? `<button class="restock-button" data-action="pet-food" data-id="${escapeHtml(item.id)}" type="button">＋ Lägg in mat</button>` : '';
		const dueDate = type === 'meals' ? (item.due ? escapeHtml(formatDate(item.due)) : '') : date;
		const billAmount = type === 'bills' && item.amount ? `${Number(item.amount).toLocaleString('sv-SE')} kr` : '';
		const expenseAmount = type === 'expenses' && item.amount ? `${Number(item.amount).toLocaleString('sv-SE')} kr` : '';
		const summary = type === 'pets' ? escapeHtml(item.due ? `Nästa vård: ${formatDate(item.due)}` : 'Djurprofil')
			: type === 'bills' || type === 'expenses' ? `${billAmount || expenseAmount}${(billAmount || expenseAmount) && footer ? ' · ' : ''}${footer}`
				: stock || pin || amount || footer;
		const recipeActions = type === 'recipes' ? `<button class="restock-button" data-action="recipe-shopping" data-id="${escapeHtml(item.id)}" type="button">＋ Ingredienser</button><button class="restock-button" data-action="recipe-meal" data-id="${escapeHtml(item.id)}" type="button">＋ Planera</button>` : '';
		return `<article class="item-card${completed}" data-id="${escapeHtml(item.id)}">
			<div class="item-card-top"><span class="category-pill">${escapeHtml(category)}</span><div class="item-actions"><button class="icon-button" data-action="edit" data-type="${type}" data-id="${escapeHtml(item.id)}" type="button" aria-label="Redigera ${escapeHtml(item.title)}">✎</button><button class="icon-button" data-action="delete" data-type="${type}" data-id="${escapeHtml(item.id)}" type="button" aria-label="Ta bort ${escapeHtml(item.title)}">×</button></div></div>
			<h3 class="item-title">${escapeHtml(item.title)}</h3>${item.reference ? `<p class="item-reference">${type === 'documents' && safeExternalUrl(item.reference) ? `<a href="${escapeHtml(safeExternalUrl(item.reference))}" target="_blank" rel="noopener noreferrer">Öppna länk ↗</a>` : escapeHtml(item.reference)}</p>` : ''}${type === 'meals' && item.recipeId ? `<p class="item-reference">Recept: ${escapeHtml(data.recipes.find(recipe => recipe.id === item.recipeId)?.title || item.title)}</p>` : ''}${detail}
			<div class="item-bottom"><span>${summary}</span><span class="item-bottom-actions">${dueDate}${restock}${petFood}${recipeActions}</span></div>
		</article>`;
	}

	function formatDate(value) {
		if (!value) return '';
		const date = new Date(`${value}T12:00:00`);
		return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(date);
	}

	function dateKey(date = new Date()) {
		const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
		return localDate.toISOString().slice(0, 10);
	}

	function advanceDate(value, repeat) {
		const next = new Date(`${value || dateKey()}T12:00:00`);
		const day = next.getDate();
		if (repeat === 'daily') next.setDate(next.getDate() + 1);
		else if (repeat === 'weekly') next.setDate(next.getDate() + 7);
		else if (repeat === 'biweekly') next.setDate(next.getDate() + 14);
		else if (repeat === 'monthly' || repeat === 'yearly') {
			next.setDate(1);
			next.setMonth(next.getMonth() + (repeat === 'monthly' ? 1 : 12));
			next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
		}
		return dateKey(next);
	}

	function completeRepeatedItem(item, type) {
		item.lastDone = dateKey();
		let nextDue = advanceDate(item.due || dateKey(), item.repeat);
		for (let step = 0; step < 120 && nextDue <= dateKey(); step += 1) nextDue = advanceDate(nextDue, item.repeat);
		item.due = nextDue;
		if (type === 'bills') item.lastPaid = item.lastDone;
		item.completed = false;
		persist();
		render();
		showToast(type === 'bills' ? 'Betalningen är markerad som klar.' : 'Sysslan är avklarad. Nästa datum är uppdaterat.');
	}

	function previewRow(item, type, checkable = false) {
		const repeats = ['chores', 'maintenance', 'bills'].includes(type) && item.repeat && item.repeat !== 'none';
		const meta = type === 'pets'
			? [item.food, item.due && formatDate(item.due)].filter(Boolean).join(' · ') || animalName(item)
			: type === 'meals' ? `${item.mealType || 'Måltid'}${item.due ? ` · ${formatDate(item.due)}` : ''}`
			: type === 'bills' ? `${item.amount ? `${Number(item.amount).toLocaleString('sv-SE')} kr · ` : ''}${item.due ? formatDate(item.due) : ''}`
			: ['chores', 'maintenance'].includes(type) ? `${item.category || ''}${item.due ? ` · ${formatDate(item.due)}` : ''}`
			: item.quantity || item.category || '';
		const leading = checkable && repeats
			? `<button class="mini-complete" data-action="complete-repeat" data-type="${type}" data-id="${escapeHtml(item.id)}" type="button" aria-label="${type === 'bills' ? 'Markera som betald' : 'Markera som klar'}">✓</button>`
			: checkable
				? `<input class="mini-check" type="checkbox" data-action="toggle" data-type="${type}" data-id="${escapeHtml(item.id)}" ${item.completed ? 'checked' : ''} aria-label="Markera ${escapeHtml(item.title)} som klar">`
				: `<span>${types[type].icon}</span>`;
		return `<div class="preview-row">${leading}<span>${escapeHtml(item.title)}</span><span class="preview-meta">${escapeHtml(meta)}</span></div>`;
	}

	function renderDashboard() {
		const tasks = data.tasks.filter(item => !item.completed);
		const shopping = data.shopping.filter(item => !item.completed);
		const attentionStock = data.inventory.filter(item => isLowStock(item) || isExpiring(item.expiry));
		const today = dateKey();
		const upcomingMeals = data.meals.filter(item => !item.completed && (!item.due || item.due >= today)).sort((a, b) => (a.due || '').localeCompare(b.due || ''));
		const upcomingChores = [...data.chores, ...data.maintenance].filter(item => item.due && item.due <= advanceDate(today, 'weekly')).sort((a, b) => a.due.localeCompare(b.due));
		const upcomingBills = data.bills.filter(item => !item.completed).sort((a, b) => (a.due || '').localeCompare(b.due || ''));
		const dueMaintenance = [...data.maintenance, ...data.pets.filter(item => item.due).map(item => ({ ...item, reminderKind: animalName(item) }))]
			.filter(item => item.due).sort((a, b) => a.due.localeCompare(b.due));
		$('#stat-grid').innerHTML = [
			['✓', tasks.length, 'Saker kvar', 'mint'],
			['🛒', shopping.length, 'På inköpslistan', 'peach'],
			['▤', data.inventory.length, 'Saker hemma', 'yellow'],
			['♡', data.pets.length, 'Djur & vård', 'lavender'],
			['¤', data.bills.filter(item => !item.completed).length, 'Räkningar', 'peach']
		].map(([icon, count, label, tone]) => `<article class="stat-card"><span class="stat-icon ${tone}">${icon}</span><span><strong class="stat-number">${count}</strong><small class="stat-label">${label}</small></span></article>`).join('');
		$('#agenda-list').innerHTML = tasks.length ? `<div class="preview-list">${tasks.slice(0, 4).map(item => previewRow(item, 'tasks', true)).join('')}</div>` : '<p class="preview-empty">Allt klart för stunden. Lägg till en sak när den dyker upp.</p>';
		$('#meals-preview').innerHTML = upcomingMeals.length ? `<div class="preview-list">${upcomingMeals.slice(0, 4).map(item => previewRow(item, 'meals')).join('')}</div>` : '<p class="preview-empty">Planera veckans middagar och koppla dem till dina recept.</p>';
		$('#chores-preview').innerHTML = upcomingChores.length ? `<div class="preview-list">${upcomingChores.slice(0, 4).map(item => previewRow(item, item.category && data.chores.includes(item) ? 'chores' : 'maintenance', true)).join('')}</div>` : '<p class="preview-empty">En påminnelse om tvätt, återvinning eller växter kan ge en lugnare vecka.</p>';
		$('#shopping-preview').innerHTML = shopping.length ? `<div class="preview-list">${shopping.slice(0, 4).map(item => previewRow(item, 'shopping', true)).join('')}</div>` : '<p class="preview-empty">Inget på listan än. Lägg till när något tar slut.</p>';
		$('#bills-preview').innerHTML = upcomingBills.length ? `<div class="preview-list">${upcomingBills.slice(0, 4).map(item => previewRow(item, 'bills', true)).join('')}</div>` : '<p class="preview-empty">Samla abonnemang och kommande betalningar här.</p>';
		const recipes = data.recipes.slice(0, 3);
		$('#recipe-preview').innerHTML = recipes.length ? `<div class="preview-list">${recipes.map(item => previewRow(item, 'recipes')).join('')}</div>` : '<p class="preview-empty">Spara receptet du alltid vill hitta igen.</p>';
		$('#inventory-preview').innerHTML = attentionStock.length
			? `<div class="preview-list">${attentionStock.slice(0, 4).map(item => `<div class="preview-row"><span>${isLowStock(item) ? '!' : '◷'}</span><span>${escapeHtml(item.title)}</span>${isLowStock(item) ? `<button class="restock-button" data-action="restock" data-id="${escapeHtml(item.id)}" type="button">＋ Köp</button>` : item.expiry >= today && ['Skafferi', 'Kyl & frys'].includes(item.category) ? `<button class="restock-button" data-action="use-expiring" data-id="${escapeHtml(item.id)}" type="button">Planera</button>` : `<span class="preview-meta">${expiryLabel(item.expiry)}</span>`}</div>`).join('')}</div>`
			: '<p class="preview-empty">Inget behöver fyllas på eller användas snart.</p>';
		$('#pets-preview').innerHTML = data.pets.length
			? `<div class="preview-list">${data.pets.slice(0, 4).map(item => `<div class="preview-row"><span>${escapeHtml(animalName(item))}</span><span>${escapeHtml(item.title)}</span><span class="preview-meta">${escapeHtml([item.food, item.due && formatDate(item.due)].filter(Boolean).join(' · '))}</span></div>`).join('')}</div>`
			: '<p class="preview-empty">Välj vilka djur som bor hemma så anpassas omsorg och inköpskategorier efter dem.</p>';
		$('#maintenance-preview').innerHTML = dueMaintenance.length
			? `<div class="preview-list">${dueMaintenance.slice(0, 4).map(item => `<div class="preview-row"><span>${item.reminderKind ? '♡' : '⌂'}</span><span>${escapeHtml(item.reminderKind ? `${item.title} · ${item.reminderKind}` : item.title)}</span><span class="preview-meta">${escapeHtml(formatDate(item.due))}</span></div>`).join('')}</div>`
			: '<p class="preview-empty">Lägg till filterbyten, brandvarnare eller annat du vill komma ihåg.</p>';
		const month = today.slice(0, 7);
		const monthExpenses = data.expenses.filter(item => item.due?.startsWith(month));
		const paidBills = data.bills.filter(item => item.lastPaid?.startsWith(month) && item.amount);
		const monthlyItems = [...monthExpenses, ...paidBills];
		const expenseTotal = monthlyItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
		const totalsByCategory = new Map();
		for (const item of monthlyItems) totalsByCategory.set(item.category || 'Övrigt', (totalsByCategory.get(item.category || 'Övrigt') || 0) + (Number(item.amount) || 0));
		const expenseBreakdown = [...totalsByCategory].sort((a, b) => b[1] - a[1]).slice(0, 3)
			.map(([category, amount]) => `<span class="preview-meta">${escapeHtml(category)} ${amount.toLocaleString('sv-SE')} kr</span>`).join(' · ');
		$('#budget-preview').innerHTML = `<p class="budget-total">${expenseTotal.toLocaleString('sv-SE')} kr <span>registrerat hittills</span></p>${expenseBreakdown ? `<p class="preview-empty">${expenseBreakdown}</p>` : ''}<p class="preview-empty">${monthExpenses.length} utgifter${paidBills.length ? ` · ${paidBills.length} betalda räkningar` : ''}. Lägg in faktiska kostnader för att följa budgeten.</p>`;
		const calendarEvents = getCalendarEvents().filter(item => item.due >= today).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3);
		$('#calendar-preview').innerHTML = calendarEvents.length
			? `<div class="preview-list">${calendarEvents.map(item => `<div class="preview-row"><span>${escapeHtml(item.icon)}</span><span>${escapeHtml(item.title)}</span><span class="preview-meta">${escapeHtml(formatDate(item.due))}</span></div>`).join('')}</div>`
			: '<p class="preview-empty">Datum från dina listor samlas här.</p>';
	}

	function isLowStock(item) {
		const current = Number.parseFloat(item.quantity);
		const minimum = Number.parseFloat(item.minimum);
		return Number.isFinite(current) && Number.isFinite(minimum) && current < minimum;
	}

	function isExpiring(value) {
		if (!value) return false;
		const days = (new Date(`${value}T00:00:00`) - new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`)) / 86400000;
		return Number.isFinite(days) && days <= 30;
	}

	function expiryLabel(value) {
		const days = (new Date(`${value}T00:00:00`) - new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`)) / 86400000;
		if (days < 0) return 'Passerat bäst före';
		if (days <= 7) return 'Snart bäst före';
		return 'Bäst före';
	}

	function renderList() {
		if (activeView === 'calendar') return renderCalendar();
		const list = data[activeView] || [];
		const search = $('#search-input').value.trim().toLocaleLowerCase('sv');
		const filtered = list.filter(item => {
			const matchesSearch = `${item.title} ${item.detail} ${item.ingredients} ${item.category} ${item.quantity} ${item.unit} ${item.reference} ${item.food} ${item.routine} ${item.medical}`.toLocaleLowerCase('sv').includes(search);
			const matchesFilter = activeFilter === 'all' || (activeFilter === 'open' && !item.completed) || (activeFilter === 'completed' && item.completed);
			return matchesSearch && matchesFilter;
		}).sort((a, b) => {
			if (['meals', 'chores', 'maintenance', 'bills'].includes(activeView)) {
				const dueSort = (a.due || '9999-12-31').localeCompare(b.due || '9999-12-31');
				if (dueSort) return dueSort;
			}
			return Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt);
		});
		$('#item-grid').innerHTML = filtered.length
			? filtered.map(item => itemCard(item, activeView)).join('')
			: `<div class="empty-state"><div class="empty-illustration">${types[activeView].icon}</div><h2>${search ? 'Inget hittades' : 'Här börjar din lista'}</h2><p>${search ? 'Prova ett annat sökord.' : `Lägg till din första ${types[activeView].singular} så har du den samlad här.`}</p>${search ? '' : '<button class="primary-button" data-action="empty-add" type="button">＋ Lägg till</button>'}</div>`;
	}

	function render() {
		if (activeView === 'home') renderDashboard();
		else if (activeView === 'calendar') renderCalendar();
		else renderList();
	}

	const checklistTemplates = {
		'weekly-clean': {
			label: 'Veckostädning',
			items: [
				['chores', 'Dammsuga', 'Städning', 'weekly'], ['chores', 'Städa badrummet', 'Badrum', 'weekly'],
				['chores', 'Byta lakan', 'Tvätt', 'weekly'], ['chores', 'Tömma sopor', 'Sopor & återvinning', 'weekly']
			]
		},
		moving: {
			label: 'Flytt',
			items: [
				['tasks', 'Boka flyttbil', 'Hemma'], ['tasks', 'Adressändra', 'Personligt'],
				['tasks', 'Packa och märka kartonger', 'Hemma'], ['tasks', 'Avsluta eller flytta abonnemang', 'Hemma'],
				['tasks', 'Läsa av el och vatten', 'Hemma'], ['tasks', 'Städa ur bostaden', 'Hemma']
			]
		},
		trip: {
			label: 'Resa',
			items: [
				['packing', 'Legitimation och biljetter', 'Resa'], ['packing', 'Laddare', 'Resa'],
				['packing', 'Toalettartiklar', 'Resa'], ['packing', 'Kläder efter väder', 'Resa'],
				['packing', 'Medicin', 'Resa'], ['packing', 'Nycklar och plånbok', 'Resa']
			]
		},
		'weekly-shop': {
			label: 'Veckohandling',
			items: [
				['shopping', 'Frukt och grönsaker', 'Frukt & grönt'], ['shopping', 'Mjölk eller växtdryck', 'Mejeri'],
				['shopping', 'Bröd', 'Skafferi'], ['shopping', 'Ägg', 'Mejeri'], ['shopping', 'Något till matlådor', 'Övrigt']
			]
		}
	};

	function applyChecklistTemplate(key) {
		const template = checklistTemplates[key];
		if (!template) return;
		let added = 0;
		for (const [type, title, category, repeat] of template.items) {
			if (data[type].some(item => item.templateKey === key && item.title === title && !item.completed)) continue;
			data[type].unshift({
				id: createId(), title, category, detail: '', quantity: '', unit: '', minimum: '', expiry: '',
				reference: '', due: dateKey(), sourceInventoryId: '', animalType: '', customSpecies: '',
				food: '', routine: '', medical: '', ingredients: '', petId: '', mealType: '', recipeId: '',
				repeat: repeat || 'none', amount: '', lastDone: '', lastPaid: '', completed: false,
				pinned: false, templateKey: key, createdAt: new Date().toISOString()
			});
			added += 1;
		}
		if (!added) {
			showToast(`${template.label} finns redan i dina listor.`);
			return;
		}
		persist();
		render();
		showToast(`${template.label}: ${added} saker har lagts till.`);
	}

	function renderShareContent() {
		const content = $('#share-content');
		if (!currentUser) {
			content.innerHTML = '<p class="preview-empty">Logga in eller skapa ett konto för att dela hushållets listor.</p><button class="primary-button full-button" data-action="share-login" type="button">Logga in</button>';
			return;
		}
		if (householdInfo) {
			content.innerHTML = `<p class="modal-description">Hushåll: <strong>${escapeHtml(householdInfo.name)}</strong> · ${householdInfo.members.length}/10 personer</p><ul class="member-list">${householdInfo.members.map(member => `<li>${escapeHtml(member.email)}${member.role === 'owner' ? ' · ägare' : ''}</li>`).join('')}</ul>${householdInfo.inviteCode ? `<label class="form-field">Inbjudningskod<input id="invite-code" readonly value="${escapeHtml(householdInfo.inviteCode)}"></label><button class="primary-button full-button" data-action="copy-invite" type="button">Kopiera kod</button>` : '<p class="preview-empty">Be hushållets ägare om en inbjudningskod.</p>'}`;
			return;
		}
		content.innerHTML = `<form id="create-household-form"><label class="form-field">Namn på hushållet<input name="name" maxlength="80" value="Mitt hushåll" required></label><button class="primary-button full-button" type="submit">Skapa delat hushåll</button></form><div class="share-divider">eller gå med i ett hushåll</div><form id="join-household-form"><label class="form-field">Inbjudningskod<input name="code" minlength="12" maxlength="12" pattern="[A-Fa-f0-9]{12}" required placeholder="12 tecken"></label><button class="secondary-button full-button" type="submit">Gå med</button></form><p class="preview-empty">Dina privata listor följer med in i hushållet.</p>`;
	}

	async function submitHouseholdForm(event) {
		const form = event.target;
		if (!['create-household-form', 'join-household-form'].includes(form.id)) return;
		event.preventDefault();
		const formData = new FormData(form);
		try {
			const result = await api(form.id === 'create-household-form' ? '/household/create' : '/household/join', {
				method: 'POST',
				body: JSON.stringify(form.id === 'create-household-form' ? { name: formData.get('name') } : { code: formData.get('code') })
			});
			data = normaliseData(result.data);
			householdInfo = result.household;
			accountReady = true;
			$('#save-status').textContent = 'Sparat i det delade hushållet';
			renderShareContent();
			render();
			showToast(form.id === 'create-household-form' ? 'Hushållet är skapat. Dela koden med de andra.' : 'Du har gått med i hushållet.');
		} catch (error) {
			showToast(error.message);
		}
	}

	function checkDueNotifications() {
		if (!('Notification' in window) || Notification.permission !== 'granted') return;
		const today = dateKey();
		const tomorrow = advanceDate(today, 'daily');
		const due = getCalendarEvents().filter(item => item.due >= today && item.due <= tomorrow);
		let sent = [];
		try {
			sent = JSON.parse(localStorage.getItem(`${storageKey}-notified`) || '[]');
			if (!Array.isArray(sent)) sent = [];
		} catch (error) {
			showToast('Påminnelsehistoriken kunde inte läsas.');
		}
		const sentSet = new Set(sent);
		for (const item of due) {
			const key = `${item.type}:${item.id}:${item.due}`;
			if (sentSet.has(key)) continue;
			new Notification(`Påminnelse: ${item.title}`, { body: `Förfaller ${item.due === today ? 'idag' : 'i morgon'} · ${types[item.type].title}` });
			sentSet.add(key);
		}
		try {
			localStorage.setItem(`${storageKey}-notified`, JSON.stringify([...sentSet].slice(-200)));
		} catch (error) {
			showToast('Påminnelsehistoriken kunde inte sparas.');
		}
	}

	async function enableNotifications() {
		if (!('Notification' in window)) {
			showToast('Den här webbläsaren stöder inte aviseringar.');
			return;
		}
		try {
			const permission = await Notification.requestPermission();
			$('#reminders-status').textContent = permission === 'granted'
				? 'Aviseringar aktiverade på den här enheten. Sidan behöver vara öppen.'
				: 'Aviseringar är inte tillåtna. Du kan ändra det i webbläsarens inställningar.';
			$('#reminders-button').textContent = permission === 'granted' ? 'Aktiverad' : 'Försök igen';
			if (permission === 'granted') checkDueNotifications();
		} catch (error) {
			showToast('Webbläsaren kunde inte aktivera aviseringar.');
		}
	}

	function getCalendarEvents() {
		const sources = [
			['tasks', '✓'], ['meals', '☼'], ['chores', '↻'], ['maintenance', '⌂'],
			['bills', '¤'], ['pets', '♡'], ['errands', '↗'], ['expenses', 'kr']
		];
		return sources.flatMap(([type, icon]) => data[type].filter(item => item.due && !item.completed)
			.map(item => ({ ...item, type, icon })));
	}

	function renderCalendar() {
		const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
		const firstMondayOffset = (first.getDay() + 6) % 7;
		const start = new Date(first);
		start.setDate(first.getDate() - firstMondayOffset);
		const selected = $('#calendar-view').dataset.selectedDate || dateKey(new Date());
		const events = getCalendarEvents();
		$('#calendar-month-title').textContent = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' }).format(first);
		const cells = [];
		for (let index = 0; index < 42; index += 1) {
			const day = new Date(start);
			day.setDate(start.getDate() + index);
			const key = dateKey(day);
			const dayEvents = events.filter(event => event.due === key);
			cells.push(`<button class="calendar-day${day.getMonth() === first.getMonth() ? '' : ' other-month'}${key === selected ? ' selected' : ''}${key === dateKey() ? ' today' : ''}" data-action="calendar-day" data-date="${key}" type="button"><span>${day.getDate()}</span>${dayEvents.length ? `<i>${dayEvents.length}</i>` : ''}</button>`);
		}
		$('#calendar-grid').innerHTML = ['Må', 'Ti', 'On', 'To', 'Fr', 'Lö', 'Sö'].map(day => `<span class="calendar-weekday">${day}</span>`).join('') + cells.join('');
		const selectedEvents = events.filter(event => event.due === selected);
		$('#calendar-day-title').textContent = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${selected}T12:00:00`));
		$('#calendar-day-items').innerHTML = selectedEvents.length
			? `<div class="preview-list">${selectedEvents.map(event => `<div class="preview-row"><span>${escapeHtml(event.icon)}</span><span>${escapeHtml(event.title)}</span><button class="text-button" data-goto="${event.type}" type="button">Öppna →</button></div>`).join('')}</div>`
			: '<p class="preview-empty">Inget inlagt den här dagen.</p>';
	}

	function field(label, name, value = '', options = {}) {
		const escaped = escapeHtml(value);
		if (options.select) {
			const optionValues = options.select.map(option => typeof option === 'string' ? option : option.value);
			const list = [...options.select];
			if (value && !optionValues.includes(value)) list.unshift(value);
			return `<label class="form-field">${label}<select name="${name}">${list.map(option => {
				const optionValue = typeof option === 'string' ? option : option.value;
				const optionLabel = typeof option === 'string' ? option : option.label;
				return `<option value="${escapeHtml(optionValue)}" ${optionValue === value ? 'selected' : ''}>${escapeHtml(optionLabel)}</option>`;
			}).join('')}</select></label>`;
		}
		if (options.textarea) return `<label class="form-field">${label}<textarea name="${name}" rows="${options.rows || 4}" placeholder="${escapeHtml(options.placeholder || '')}">${escaped}</textarea></label>`;
		const constraints = options.type === 'number' ? `min="${options.min ?? 0}" step="${options.step || 'any'}"` : `maxlength="${options.maxlength || 120}"`;
		return `<label class="form-field">${label}<input name="${name}" type="${options.type || 'text'}" value="${escaped}" placeholder="${escapeHtml(options.placeholder || '')}" ${options.required ? 'required' : ''} ${constraints}></label>`;
	}

	function petProfileFields(item, defaults) {
		const kind = item ? petKind(item) : 'dog';
		const kinds = [...animalKinds];
		const selectedLabel = animalKinds.find(([key]) => key === kind)?.[1] || 'Annat djur';
		const animalField = field('Vilken sorts djur?', 'animalType', kind, { select: kinds.map(([key, label]) => ({ value: key, label })) });
		const species = item?.customSpecies || defaults?.customSpecies || '';
		const speciesLabel = `<label class="form-field pet-custom-field" id="pet-custom-wrap" ${kind === 'other' ? '' : 'hidden'}>Eget djurslag<input name="customSpecies" id="pet-custom-species" value="${escapeHtml(species)}" placeholder="Till exempel sköldpadda" maxlength="80"></label>`;
		const care = animalCare[kind] || animalCare.other;
		const foodPrompts = {
			dog: 'Hundmat, märke eller portionsstorlek...',
			cat: 'Torrfoder, blötmat eller favoritmärke...',
			rabbit: 'Hö, pellets eller grönt...',
			bird: 'Fröblandning, pellets eller färskmat...',
			fish: 'Foder för art och akvarium...',
			reptile: 'Foder som passar djurets art...',
			rodent: 'Hö, fröer eller annan mat...',
			horse: 'Grovfoder, kraftfoder eller tillskott...',
			other: 'Vad äter djuret? Märke eller mängd...'
		};
		const hint = `<p class="pet-care-hint" id="pet-care-hint">${escapeHtml(selectedLabel)}: ${escapeHtml(care.routine.toLocaleLowerCase('sv'))} och matningsrutiner.</p>`;
		const age = field('Ålder, födelsedatum eller vikt', 'quantity', item?.quantity || defaults?.quantity || '', { placeholder: 'Valfritt' });
		const food = field('Mat / foder', 'food', item?.food || defaults?.food || '', { placeholder: foodPrompts[kind] || foodPrompts.other });
		const routine = `<label class="form-field" id="pet-routine-label">${escapeHtml(care.routine)}<textarea name="routine" rows="3" placeholder="${escapeHtml(care.placeholder)}">${escapeHtml(item?.routine || defaults?.routine || '')}</textarea></label>`;
		const medical = `<label class="form-field">Allergier, medicin eller annat viktigt<textarea name="medical" rows="3" placeholder="Skriv bara sådant du vill komma ihåg...">${escapeHtml(item?.medical || defaults?.medical || '')}</textarea></label>`;
		const due = field('Nästa veterinärbesök / vårddatum', 'due', item?.due || defaults?.due || '', { type: 'date' });
		return `${animalField}${speciesLabel}${hint}${field('Djurens namn', 'title', item?.title || defaults.title || '', { required: true })}${age}${food}${routine}${medical}${due}`;
	}

	function updatePetFields() {
		const select = $('#form-fields select[name="animalType"]');
		if (!select) return;
		const kind = animalCare[select.value] ? select.value : 'other';
		const care = animalCare[kind];
		const selectedLabel = animalKinds.find(([key]) => key === kind)?.[1] || 'Annat djur';
		const foodPrompts = {
			dog: 'Hundmat, märke eller portionsstorlek...',
			cat: 'Torrfoder, blötmat eller favoritmärke...',
			rabbit: 'Hö, pellets eller grönt...',
			bird: 'Fröblandning, pellets eller färskmat...',
			fish: 'Foder för art och akvarium...',
			reptile: 'Foder som passar djurets art...',
			rodent: 'Hö, fröer eller annan mat...',
			horse: 'Grovfoder, kraftfoder eller tillskott...',
			other: 'Vad äter djuret? Märke eller mängd...'
		};
		$('#pet-custom-wrap').hidden = kind !== 'other';
		$('#form-fields input[name="food"]').placeholder = foodPrompts[kind];
		$('#pet-care-hint').textContent = `${selectedLabel}: ${care.routine.toLocaleLowerCase('sv')} och matningsrutiner.`;
		const routineLabel = $('#pet-routine-label');
		routineLabel.firstChild.textContent = care.routine;
		routineLabel.querySelector('textarea').placeholder = care.placeholder;
	}

	function openItemModal(type, item = null, defaults = {}) {
		if (!types[type]) return;
		editingId = item?.id || null;
		$('#item-modal').dataset.type = type;
		$('#item-modal').dataset.petId = defaults.petId || item?.petId || '';
		const config = types[type];
		$('#modal-eyebrow').textContent = item ? 'ÄNDRA I DIN VARDAG' : 'NYTT I DIN VARDAG';
		$('#modal-title').textContent = item ? 'Redigera' : `Ny ${config.singular}`;
		$('#save-item').textContent = item ? 'Spara ändring' : 'Spara';
		const fields = [];
		if (type === 'pets') {
			fields.push(petProfileFields(item, defaults));
		} else {
			fields.push(field('Namn eller rubrik', 'title', item?.title || defaults.title || '', { required: true }));
			if (config.fields.quantity) fields.push(field(config.fields.quantity, 'quantity', item?.quantity || defaults.quantity || '', { type: type === 'inventory' ? 'number' : 'text', placeholder: type === 'inventory' ? 'Till exempel 2' : 'Till exempel 2 st', min: 0, step: 'any' }));
			if (config.fields.unit) fields.push(field(config.fields.unit, 'unit', item?.unit || defaults.unit || 'st', { select: ['st', 'paket', 'burk', 'flaska', 'liter', 'kg', 'påse', 'rulle', 'annat'] }));
			if (config.fields.minimum) fields.push(field(config.fields.minimum, 'minimum', item?.minimum || defaults.minimum || '', { type: 'number', placeholder: 'Till exempel 1', min: 0, step: 'any' }));
			if (config.fields.due) fields.push(field(config.fields.due, 'due', item?.due || defaults.due || '', { type: 'date' }));
			if (config.fields.expiry) fields.push(field(config.fields.expiry, 'expiry', item?.expiry || defaults.expiry || '', { type: 'date' }));
			if (config.fields.reference) fields.push(field(config.fields.reference, 'reference', item?.reference || defaults.reference || '', type === 'documents' ? { type: 'url', maxlength: 500, placeholder: 'https://...' } : { maxlength: 200 }));
			if (config.fields.amount) fields.push(field(config.fields.amount, 'amount', item?.amount || defaults.amount || '', { type: 'number', min: 0, step: 'any', placeholder: 'Till exempel 249' }));
			if (config.fields.mealType) fields.push(field(config.fields.mealType, 'mealType', item?.mealType || defaults.mealType || config.categories[0], { select: config.categories }));
			if (config.fields.recipe) fields.push(field(config.fields.recipe, 'recipeId', item?.recipeId || defaults.recipeId || '', { select: [{ value: '', label: 'Välj senare eller skriv själv' }, ...data.recipes.map(recipe => ({ value: recipe.id, label: recipe.title }))] }));
			if (config.fields.repeat) fields.push(field(config.fields.repeat, 'repeat', item?.repeat || defaults.repeat || 'none', { select: [{ value: 'none', label: 'Upprepa inte' }, { value: 'daily', label: 'Varje dag' }, { value: 'weekly', label: 'Varje vecka' }, { value: 'biweekly', label: 'Varannan vecka' }, { value: 'monthly', label: 'Varje månad' }, { value: 'yearly', label: 'Varje år' }] }));
			if (config.fields.ingredients) fields.push(field(config.fields.ingredients, 'ingredients', item?.ingredients || defaults.ingredients || '', { textarea: true, rows: 5, placeholder: 'Till exempel:\n2 morötter\n1 gul lök\n3 dl linser' }));
			if (config.fields.detail) fields.push(field(config.fields.detail, 'detail', item?.detail || defaults.detail || '', { textarea: true, rows: type === 'recipes' ? 6 : 4, placeholder: type === 'recipes' ? 'Ingredienser och steg, en rad i taget...' : 'Skriv en liten anteckning...' }));
			if (!config.fields.mealType) fields.splice(1, 0, field('Kategori', 'category', item?.category || defaults.category || config.categories[0], { select: categoriesFor(type) }));
		}
		if (type === 'notes') fields.push(`<label class="checkbox-field"><input type="checkbox" name="pinned" ${item?.pinned ? 'checked' : ''}> Fäst överst</label>`);
		$('#form-fields').innerHTML = fields.join('');
		if (type === 'pets') updatePetFields();
		$('#item-modal').hidden = false;
		$('#form-fields input[name="title"]').focus();
	}

	function closeModal(id) {
		$(`#${id}`).hidden = true;
	}

	function saveItem(event) {
		event.preventDefault();
		const type = $('#item-modal').dataset.type;
		const formData = new FormData(event.currentTarget);
		const title = String(formData.get('title') || '').trim();
		if (!types[type] || !title) return;
		const previous = editingId ? data[type].find(item => item.id === editingId) : null;
		if (type === 'inventory' && formData.get('quantity') && !Number.isFinite(Number(formData.get('quantity')))) {
			showToast('Ange mängden som en siffra.');
			return;
		}
		if (type === 'inventory' && formData.get('minimum') && !Number.isFinite(Number(formData.get('minimum')))) {
			showToast('Ange lagernivån som en siffra.');
			return;
		}
		const animalType = String(formData.get('animalType') || '');
		const item = {
			id: editingId || createId(),
			title,
			detail: String(formData.get('detail') || '').trim(),
			category: type === 'pets'
				? animalKinds.find(([key]) => key === animalType)?.[1] || 'Annat djur'
				: String(formData.get('category') || types[type].categories[0]),
			quantity: String(formData.get('quantity') || '').trim(),
			unit: String(formData.get('unit') || previous?.unit || ''),
			minimum: String(formData.get('minimum') || '').trim(),
			expiry: String(formData.get('expiry') || ''),
			reference: String(formData.get('reference') || '').trim(),
			due: String(formData.get('due') || ''),
			sourceInventoryId: previous?.sourceInventoryId || '',
			animalType,
			customSpecies: String(formData.get('customSpecies') || '').trim(),
			food: String(formData.get('food') || '').trim(),
			routine: String(formData.get('routine') || '').trim(),
			medical: String(formData.get('medical') || '').trim(),
			ingredients: String(formData.get('ingredients') || '').trim(),
			petId: type === 'inventory' ? ($('#item-modal').dataset.petId || previous?.petId || '') : '',
			mealType: String(formData.get('mealType') || ''),
			recipeId: String(formData.get('recipeId') || ''),
			repeat: String(formData.get('repeat') || 'none'),
			amount: String(formData.get('amount') || '').trim(),
			lastDone: previous?.lastDone || '',
			lastPaid: previous?.lastPaid || '',
			completed: Boolean(previous?.completed),
			pinned: Boolean(formData.get('pinned')),
			templateKey: previous?.templateKey || '',
			createdAt: previous?.createdAt || new Date().toISOString()
		};
		if (type === 'documents' && item.reference && !safeExternalUrl(item.reference)) {
			showToast('Ange en giltig länk som börjar med https:// eller http://.');
			return;
		}
		if (previous) data[type] = data[type].map(entry => entry.id === editingId ? item : entry);
		else data[type].unshift(item);
		closeModal('item-modal');
		persist();
		render();
		showToast(previous ? 'Ändringen är sparad.' : 'Tillagt i din lista.');
	}

	function addItem(type, item = null, defaults = {}) {
		if (type === 'meals') defaults = { due: dateKey(), mealType: 'Middag', ...defaults };
		$('#item-modal').dataset.type = type;
		openItemModal(type, item, defaults);
	}

	function ingredientCategory(name) {
		const value = name.toLocaleLowerCase('sv');
		if (/mjölk|grädde|ost|smör|yoghurt|ägg|kvarg/.test(value)) return 'Mejeri';
		if (/kyckling|kött|färs|bacon|korv|lax|fisk|räkor/.test(value)) return 'Kött & fisk';
		if (/frukt|äpple|banan|citron|lime|päron|apelsin/.test(value)) return 'Frukt & grönt';
		if (/lök|morot|tomat|gurka|potatis|paprika|sallad|broccoli|vitlök|svamp/.test(value)) return 'Frukt & grönt';
		if (/fryst|frys/.test(value)) return 'Frys';
		return 'Skafferi';
	}

	function addRecipeIngredients(recipe) {
		const lines = String(recipe.ingredients || '').split(/\r?\n/).map(line => line.trim())
			.filter(line => line && !/^(ingredienser|ingredient|du behöver)\s*:?\s*$/i.test(line));
		if (!lines.length) {
			showToast('Lägg in ingredienserna som en rad per vara i receptet först.');
			return;
		}
		let added = 0;
		for (const line of lines) {
			const cleaned = line.replace(/^(?:[-*•]|\d+[.)])\s*/, '').trim();
			const match = cleaned.match(/^(\d+(?:[.,]\d+)?\s*(?:st|g|kg|mg|ml|cl|dl|l|tsk|msk|krm|burk|paket|förp\.?)?)\s+(.+)$/i);
			const quantity = match ? match[1] : '';
			const title = match ? match[2].trim() : cleaned;
			if (!title || data.shopping.some(item => !item.completed && item.title.toLocaleLowerCase('sv') === title.toLocaleLowerCase('sv'))) continue;
			data.shopping.unshift({
				id: createId(), title, detail: `Till receptet ${recipe.title}`, category: ingredientCategory(title),
				quantity, unit: '', minimum: '', expiry: '', reference: '', due: '', sourceInventoryId: '',
				animalType: '', customSpecies: '', food: '', routine: '', medical: '', ingredients: '', petId: '',
				mealType: '', recipeId: '', repeat: 'none', amount: '', lastDone: '', lastPaid: '',
				completed: false, pinned: false, createdAt: new Date().toISOString()
			});
			added += 1;
		}
		persist();
		if (added) {
			setView('shopping');
			showToast(added === 1 ? '1 ingrediens tillagd på inköpslistan.' : `${added} ingredienser tillagda på inköpslistan.`);
		} else {
			showToast('Ingredienserna fanns redan på inköpslistan.');
		}
	}

	async function restoreBackup(event) {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;
		try {
			if (file.size > 5 * 1024 * 1024) throw new Error('Säkerhetskopian får vara högst 5 MB.');
			const backup = JSON.parse(await file.text());
			if (!backup || typeof backup !== 'object' || backup.format !== 'formkurva-vardag-v1' || !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
				throw new Error('Filen känns inte igen som en säkerhetskopia från Hem & vardag.');
			}
			if (!window.confirm('Återställ säkerhetskopian och slå ihop dess listor med det som redan finns?')) return;
			data = mergeData(data, normaliseData(backup.data));
			persist();
			render();
			showToast('Säkerhetskopian är återställd och hopslagen med dina listor.');
		} catch (error) {
			showToast(error instanceof SyntaxError ? 'Säkerhetskopian innehåller ogiltig JSON.' : error.message);
		}
	}

	function handleClick(event) {
		const button = event.target.closest('button');
		if (!button) return;
		if (!button.closest('#add-picker') && button.id !== 'add-button') {
			$('#add-picker').hidden = true;
			$('#add-button').setAttribute('aria-expanded', 'false');
		}
		if (button.matches('.nav-link')) return setView(button.dataset.view);
		if (button.dataset.goto) return setView(button.dataset.goto);
		if (button.id === 'add-button') {
			if (activeView === 'home') {
				$('#add-picker').hidden = !$('#add-picker').hidden;
				button.setAttribute('aria-expanded', String(!$('#add-picker').hidden));
				return;
			}
			return addItem(activeView);
		}
		if (button.dataset.filter) {
			activeFilter = button.dataset.filter;
			document.querySelectorAll('.filter-button').forEach(item => item.classList.toggle('active', item === button));
			return renderList();
		}
		if (button.dataset.action === 'quick-add') return addItem(button.dataset.type);
		if (button.dataset.action === 'quick-type') return addItem(button.dataset.type);
		if (button.dataset.action === 'empty-add') return addItem(activeView);
		if (button.dataset.action === 'close-modal') return closeModal('item-modal');
		if (button.dataset.action === 'close-auth') return closeModal('auth-modal');
		if (button.dataset.action === 'close-share') return closeModal('share-modal');
		if (button.dataset.action === 'calendar-prev' || button.dataset.action === 'calendar-next') {
			calendarMonth.setMonth(calendarMonth.getMonth() + (button.dataset.action === 'calendar-prev' ? -1 : 1));
			$('#calendar-view').dataset.selectedDate = dateKey(calendarMonth);
			return renderCalendar();
		}
		if (button.dataset.action === 'calendar-day') {
			$('#calendar-view').dataset.selectedDate = button.dataset.date;
			return renderCalendar();
		}
		if (button.dataset.action === 'template') return applyChecklistTemplate(button.dataset.template);
		if (button.dataset.action === 'share-login') {
			closeModal('share-modal');
			return openAuthModal();
		}
		if (button.dataset.action === 'copy-invite') {
			navigator.clipboard.writeText(householdInfo.inviteCode).then(() => showToast('Inbjudningskoden är kopierad.')).catch(() => showToast('Kunde inte kopiera koden. Markera och kopiera den manuellt.'));
			return;
		}
		if (button.dataset.action === 'edit') {
			const item = data[button.dataset.type].find(entry => entry.id === button.dataset.id);
			if (item) { $('#item-modal').dataset.type = button.dataset.type; openItemModal(button.dataset.type, item); }
		}
		if (button.dataset.action === 'delete') {
			const type = button.dataset.type;
			data[type] = data[type].filter(item => item.id !== button.dataset.id);
			persist(); render(); showToast('Borttaget.');
		}
		if (button.dataset.action === 'restock') {
			const item = data.inventory.find(entry => entry.id === button.dataset.id);
			if (item) {
				if (data.shopping.some(entry => !entry.completed && entry.sourceInventoryId === item.id)) {
					showToast(`${item.title} finns redan på inköpslistan.`);
					return;
				}
				const shopCategory = { 'Skafferi': 'Skafferi', 'Kyl & frys': 'Frys', 'Städ': 'Städ', 'Badrum': 'Badrum', 'Djurmat': 'Djur', 'Djurvård': 'Djur' }[item.category] || 'Övrigt';
				data.shopping.unshift({
					id: createId(),
					title: item.title,
					detail: item.detail ? `Hemma: ${item.detail}` : '',
					category: item.petId ? `Djur` : shopCategory,
					quantity: item.minimum || '1',
					unit: item.unit || '',
					minimum: '',
					expiry: '',
					reference: '',
					due: '',
					completed: false,
					pinned: false,
					sourceInventoryId: item.id,
					createdAt: new Date().toISOString()
				});
				persist(); render(); showToast('Tillagt på inköpslistan.');
			}
		}
		if (button.dataset.action === 'use-expiring') {
			const item = data.inventory.find(entry => entry.id === button.dataset.id);
			if (item && !data.tasks.some(task => task.sourceInventoryId === item.id && !task.completed)) {
				data.tasks.unshift({
					id: createId(), title: `Använd snart: ${item.title}`,
					detail: `Finns i ${item.category}. Bäst före ${formatDate(item.expiry)}.`,
					category: 'Hemma', quantity: '', unit: '', minimum: '', expiry: '', reference: '',
					due: item.expiry, sourceInventoryId: item.id, animalType: '', customSpecies: '',
					food: '', routine: '', medical: '', ingredients: '', petId: '', mealType: '',
					recipeId: '', repeat: 'none', amount: '', lastDone: '', lastPaid: '',
					completed: false, pinned: false, createdAt: new Date().toISOString()
				});
				persist();
				render();
				showToast('En påminnelse har lagts till i Att göra.');
			} else {
				showToast(item ? 'Du har redan en påminnelse om den varan.' : 'Varan hittades inte i inventariet.');
			}
			return;
		}
		if (button.dataset.action === 'pet-food') {
			const pet = data.pets.find(item => item.id === button.dataset.id);
			if (pet) {
				const category = `Mat till ${pet.title}`;
				const existing = data.inventory.find(item => item.petId === pet.id && item.category === category);
				addItem('inventory', existing, {
					title: pet.food || '',
					category,
					quantity: existing?.quantity || '1',
					unit: existing?.unit || 'påse',
					minimum: existing?.minimum || '1',
					detail: `Mat till ${pet.title}`,
					petId: pet.id
				});
			}
		}
		if (button.dataset.action === 'recipe-meal') {
			const recipe = data.recipes.find(item => item.id === button.dataset.id);
			if (recipe) addItem('meals', null, { title: recipe.title, recipeId: recipe.id, due: dateKey(), mealType: 'Middag' });
		}
		if (button.dataset.action === 'recipe-shopping') {
			const recipe = data.recipes.find(item => item.id === button.dataset.id);
			if (recipe) addRecipeIngredients(recipe);
		}
		if (button.dataset.action === 'complete-repeat') {
			const type = button.dataset.type;
			const item = data[type]?.find(entry => entry.id === button.dataset.id);
			if (item && item.repeat && item.repeat !== 'none') completeRepeatedItem(item, type);
			return;
		}
		if (button.id === 'export-button') {
			try {
				const blob = new Blob([JSON.stringify({ format: 'formkurva-vardag-v1', exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = url;
				link.download = `vardag-backup-${new Date().toISOString().slice(0, 10)}.json`;
				link.click();
				URL.revokeObjectURL(url);
				showToast('Säkerhetskopian är nedladdad.');
			} catch (error) {
				showToast('Kunde inte skapa en säkerhetskopia.');
			}
		}
		if (button.id === 'import-button') $('#import-file').click();
		if (button.id === 'share-button') {
			renderShareContent();
			$('#share-modal').hidden = false;
		}
		if (button.id === 'reminders-button') enableNotifications();
		if (button.id === 'account-button') {
			if (currentUser) logout();
			else openAuthModal();
		}
		if (button.id === 'theme-toggle') {
			const dark = document.documentElement.dataset.theme !== 'dark';
			document.documentElement.dataset.theme = dark ? 'dark' : 'light';
			try {
				localStorage.setItem(`${storageKey}-theme`, dark ? 'dark' : 'light');
			} catch (error) {
				showToast('Temat kunde inte sparas i webbläsaren.');
			}
		}
		if (button.parentElement?.id === 'auth-switch') {
			authMode = authMode === 'login' ? 'register' : 'login';
			updateAuthMode();
		}
	}

	function handleChange(event) {
		const checkbox = event.target;
		if (checkbox.name === 'animalType') {
			updatePetFields();
			return;
		}
		if (checkbox.dataset.action !== 'toggle') return;
		const item = data[checkbox.dataset.type].find(entry => entry.id === checkbox.dataset.id);
		if (!item) return;
		const type = checkbox.dataset.type;
		item.completed = checkbox.checked;
		if (item.completed && type === 'shopping' && item.sourceInventoryId) {
			const stockItem = data.inventory.find(entry => entry.id === item.sourceInventoryId);
			if (stockItem) stockItem.quantity = item.quantity || stockItem.minimum || stockItem.quantity;
			item.sourceInventoryId = '';
		}
		persist();
		render();
	}

	function updateAuthMode() {
		const registering = authMode === 'register';
		$('#auth-title').textContent = registering ? 'Skapa ditt konto' : 'Spara på ditt konto';
		$('#auth-submit').textContent = registering ? 'Skapa konto' : 'Logga in';
		$('#auth-switch').innerHTML = registering ? 'Har du redan ett konto? <button type="button">Logga in</button>' : 'Nytt konto? <button type="button">Skapa ett här</button>';
		$('#auth-form input[name="password"]').autocomplete = registering ? 'new-password' : 'current-password';
		$('#auth-error').textContent = '';
	}

	function openAuthModal() {
		authMode = 'login';
		updateAuthMode();
		$('#auth-modal').hidden = false;
		$('#auth-form input[name="email"]').focus();
	}

	async function loadAccountData(guestData) {
		const result = await api('/household');
		const remote = normaliseData(result.data);
		householdInfo = result.household;
		data = mergeData(remote, guestData);
		if (Object.values(guestData).some(items => items.length)) {
			await api('/household', { method: 'PUT', body: JSON.stringify({ data }) });
			try {
				localStorage.removeItem(storageKey);
			} catch (error) {
				showToast('Listorna synkades, men webbläsarens lokala kopia kunde inte rensas.');
			}
		}
		accountReady = true;
		$('#save-status').textContent = householdInfo ? 'Sparat i hushållet' : 'Sparat på ditt konto';
		$('#share-button').hidden = false;
		render();
	}

	async function syncSharedHousehold() {
		if (!currentUser || !accountReady || !householdInfo) return;
		try {
			await saveQueue;
			const result = await api('/household');
			if (!result.household) return;
			data = normaliseData(result.data);
			householdInfo = result.household;
			$('#save-status').textContent = 'Synkat med hushållet';
			render();
		} catch (error) {
			$('#save-status').textContent = 'Hushållet kunde inte synkas';
		}
	}

	async function handleAuth(event) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const button = $('#auth-submit');
		button.disabled = true;
		$('#auth-error').textContent = '';
		try {
			const guestData = readLocalData();
			await api(authMode === 'register' ? '/auth/register' : '/auth/login', {
				method: 'POST',
				body: JSON.stringify({ email: form.get('email'), password: form.get('password') })
			});
			const result = await api('/me');
			currentUser = result.user;
			accountReady = false;
			$('#account-button').textContent = 'Logga ut';
			$('#share-button').hidden = false;
			closeModal('auth-modal');
			await loadAccountData(guestData);
			showToast('Listorna är nu kopplade till ditt konto.');
		} catch (error) {
			$('#auth-error').textContent = error.message;
			if (currentUser) $('#account-button').textContent = 'Logga ut';
		} finally {
			button.disabled = false;
		}
	}

	async function logout() {
		try {
			await api('/auth/logout', { method: 'POST' });
			currentUser = null;
			accountReady = false;
			householdInfo = null;
			data = readLocalData();
			$('#account-button').textContent = 'Logga in';
			$('#share-button').hidden = true;
			$('#save-status').textContent = 'Sparas på den här enheten';
			render();
			showToast('Du är utloggad. Kontots listor finns kvar när du loggar in igen.');
		} catch (error) {
			showToast(error.message);
		}
	}

	async function initialise() {
		data = readLocalData();
		let theme = '';
		try {
			theme = localStorage.getItem(`${storageKey}-theme`);
		} catch (error) {
			showToast('Färgtemat kunde inte läsas från webbläsaren.');
		}
		document.documentElement.dataset.theme = theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
		$('#footer-date').textContent = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
		$('#item-form').addEventListener('submit', saveItem);
		$('#auth-form').addEventListener('submit', handleAuth);
		document.addEventListener('submit', submitHouseholdForm);
		$('#import-file').addEventListener('change', restoreBackup);
		$('#search-input').addEventListener('input', renderList);
		document.addEventListener('click', handleClick);
		document.addEventListener('change', handleChange);
		document.addEventListener('keydown', event => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				if (!$('#list-view').hidden) $('#search-input').focus();
			}
			if (event.key === 'Escape') { closeModal('item-modal'); closeModal('auth-modal'); }
		});
		try {
			const result = await api('/me');
			if (result.user) {
				currentUser = result.user;
				accountReady = false;
				$('#account-button').textContent = 'Logga ut';
				await loadAccountData(data);
			}
		} catch (error) {
			currentUser = null;
			accountReady = false;
			$('#account-button').textContent = 'Logga in';
			$('#share-button').hidden = true;
			$('#save-status').textContent = 'Sparat lokalt på enheten';
		}
		const remindersEnabled = 'Notification' in window && Notification.permission === 'granted';
		$('#reminders-status').textContent = remindersEnabled
			? 'Aviseringar aktiverade på den här enheten. Sidan behöver vara öppen.'
			: 'Aviseringar visas medan Hem & vardag är öppet på den här enheten.';
		$('#reminders-button').textContent = remindersEnabled ? 'Aktiverad' : 'Aktivera';
		if (remindersEnabled) {
			checkDueNotifications();
			window.setInterval(checkDueNotifications, 30 * 60 * 1000);
		}
		window.setInterval(syncSharedHousehold, 20 * 1000);
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) syncSharedHousehold();
		});
		render();
	}

	initialise();
})();
