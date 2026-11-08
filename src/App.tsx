import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import './styles.css';
import { supabase, type SharedAppData } from './supabase';

type Recipe = {
  id: number;
  name: string;
  emoji: string;
  color: string;
  time: string;
  tag: string;
  ingredients: [string, string][];
};
type Item = { name: string; done: boolean; qty?: string; cat?: string; auto?: boolean; key?: string };
type ModalMode = 'view' | 'edit' | 'new' | null;

const defaults: Recipe[] = [
  { id: 1, name: 'Zitronen-Ricotta-Pasta', emoji: '', color: '#b5c5e8', time: '25 min', tag: 'Vegetarisch', ingredients: [['Pasta', '300 g'], ['Ricotta', '150 g'], ['Zitrone', '1 Stück'], ['Babyspinat', '100 g'], ['Parmesan', '50 g']] },
  { id: 2, name: 'Crispy Tofu Bowl', emoji: '', color: '#ffb28f', time: '30 min', tag: 'Vegan', ingredients: [['Tofu', '250 g'], ['Jasminreis', '200 g'], ['Avocado', '1 Stück'], ['Gurke', '½ Stück'], ['Sojasauce', '2 EL']] },
  { id: 3, name: 'Ofen-Tomaten & Burrata', emoji: '', color: '#aec8fb', time: '35 min', tag: 'Vegetarisch', ingredients: [['Cherrytomaten', '400 g'], ['Burrata', '1 Stück'], ['Sauerteigbrot', '1 Laib'], ['Basilikum', '1 Bund']] },
  { id: 4, name: 'Grüne Shakshuka', emoji: '', color: '#eca9c4', time: '20 min', tag: 'Einfach', ingredients: [['Eier', '4 Stück'], ['Babyspinat', '150 g'], ['Erbsen', '100 g'], ['Feta', '100 g'], ['Brot', '1 Laib']] },
  { id: 5, name: 'Gnocchi aus der Pfanne', emoji: '', color: '#c9b99f', time: '20 min', tag: 'Comfort food', ingredients: [['Gnocchi', '500 g'], ['Butter', '60 g'], ['Salbei', '1 Bund'], ['Haselnüsse', '40 g']] },
  { id: 6, name: 'Bunte Mezze-Platte', emoji: '', color: '#b4b6c2', time: '15 min', tag: 'Zum Teilen', ingredients: [['Hummus', '200 g'], ['Fladenbrot', '2 Stück'], ['Gurke', '1 Stück'], ['Paprika', '2 Stück'], ['Oliven', '100 g']] },
];
const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const monthShort = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
const colors = ['#b5c5e8', '#ffb28f', '#aec8fb', '#eca9c4', '#c9b99f', '#b4b6c2'];
const initial = <T,>(key: string, fallback: T): T => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
};
const dateText = (date: Date) => `${date.getDate()}. ${monthShort[date.getMonth()]}`;
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const categoryFor = (name: string) => {
  const n = name.toLocaleLowerCase('de-DE');
  if (/zitrone|spinat|avocado|gurke|tomat|basilikum|erbse|paprika|salbei/.test(n)) return 'Obst & Gemüse';
  if (/ricotta|tofu|burrata|feta|butter|parmesan|ei|hummus/.test(n)) return 'Kühlregal';
  if (/pasta|reis|brot|gnocchi|haselnuss|oliv|sojasauce/.test(n)) return 'Vorrat';
  return 'Sonstiges';
};
const parseQuantity = (raw: string) => {
  const match = raw.trim().match(/^(\d+(?:[.,]\d+)?|[¼½¾])\s*(.*)$/);
  if (!match) return null;
  const amount = ({ '¼': 0.25, '½': 0.5, '¾': 0.75 } as Record<string, number>)[match[1]] ?? Number(match[1].replace(',', '.'));
  return { amount, unit: match[2].trim() };
};

export default function App() {
  const [view, setView] = useState<'plan' | 'recipes' | 'shopping'>('plan');
  const [recipes, setRecipes] = useState<Recipe[]>(() => initial('tellerRecipes', defaults));
  const [plans, setPlans] = useState<Record<string, number[]>>(() => initial('tellerPlans', {}));
  const [items, setItems] = useState<Item[]>(() => initial('tellerList', []));
  const [query, setQuery] = useState('');
  const [newItem, setNewItem] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [targetDay, setTargetDay] = useState<number | null>(null);
  const [dayPickerRecipe, setDayPickerRecipe] = useState<Recipe | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [formName, setFormName] = useState('');
  const [formMinutes, setFormMinutes] = useState('25');
  const [formIngredients, setFormIngredients] = useState<[string, string][]>([['', '']]);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [dataError, setDataError] = useState('');
  const [loaded, setLoaded] = useState(!supabase);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentDataRef = useRef(JSON.stringify({ recipes, plans, items }));

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoaded(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || !session) return;
    let cancelled = false;
    const load = async () => {
      setDataError('');
      setLoadFailed(false);
      const { data, error } = await client.from('app_state').select('payload').eq('id', 1).maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadFailed(true);
        setDataError(`Datenbankzugriff fehlgeschlagen: ${error.message}`);
      } else if (data?.payload) {
        const payload = data.payload as SharedAppData;
        setRecipes(payload.recipes as Recipe[] || defaults);
        setPlans(payload.plans || {});
        setItems(payload.items as Item[] || []);
      }
      setLoaded(true);
    };
    void load();
    const channel = client.channel('shared-app-state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state', filter: 'id=eq.1' }, payload => {
        const next = (payload.new as { payload?: SharedAppData }).payload;
        if (!next || JSON.stringify(next) === currentDataRef.current) return;
        setRecipes(next.recipes as Recipe[] || defaults);
        setPlans(next.plans || {});
        setItems(next.items as Item[] || []);
      })
      .subscribe();
    return () => { cancelled = true; void client.removeChannel(channel); };
  }, [session]);

  useEffect(() => {
    if (!loaded || loadFailed) return;
    const payload: SharedAppData = { recipes, plans, items };
    currentDataRef.current = JSON.stringify(payload);
    const client = supabase;
    if (!client || !session) {
      localStorage.setItem('tellerRecipes', JSON.stringify(recipes));
      localStorage.setItem('tellerPlans', JSON.stringify(plans));
      localStorage.setItem('tellerList', JSON.stringify(items));
      return;
    }
    const timer = window.setTimeout(async () => {
      setSaving(true);
      const { error } = await client.from('app_state').upsert({ id: 1, payload, updated_at: new Date().toISOString() });
      setDataError(error ? `Speichern fehlgeschlagen: ${error.message}` : '');
      setSaving(false);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [recipes, plans, items, session, loaded, loadFailed]);

  useEffect(() => {
    if (!loaded || loadFailed) return;
    const totals = new Map<string, { name: string; unit: string; amount: number | null; raw: string | null }>();
    for (let day = 0; day < 7; day++) {
      const date = weekDate(day);
      for (const recipeId of plans[localDateKey(date)] || []) {
        const recipe = recipes.find(item => item.id === recipeId);
        if (!recipe) continue;
        for (const [name, quantity] of recipe.ingredients) {
          const parsed = parseQuantity(quantity);
          const key = `${name.trim().toLocaleLowerCase('de-DE')}|${parsed?.unit.toLocaleLowerCase('de-DE') || quantity.toLocaleLowerCase('de-DE')}`;
          const current = totals.get(key);
          if (!current) totals.set(key, { name, unit: parsed?.unit || '', amount: parsed?.amount ?? null, raw: parsed ? null : quantity });
          else if (parsed && current.amount !== null) current.amount += parsed.amount;
        }
      }
    }
    setItems(previous => {
      const manual = previous.filter(item => !item.auto);
      const checked = new Map(previous.filter(item => item.auto && item.done).map(item => [item.key, true]));
      const generated: Item[] = [...totals.entries()].map(([key, value]) => ({
        auto: true, key, name: value.name, cat: categoryFor(value.name),
        qty: value.amount === null ? value.raw || '' : `${Number.isInteger(value.amount) ? value.amount : String(Math.round(value.amount * 100) / 100).replace('.', ',')}${value.unit ? ` ${value.unit}` : ''}`,
        done: checked.get(key) || false,
      }));
      const next = [...manual, ...generated];
      return JSON.stringify(next) === JSON.stringify(previous) ? previous : next;
    });
  // The list is derived from plans and recipes; exclude items to prevent a state loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, plans, weekOffset, loaded, loadFailed]);

  const monday = useMemo(() => new Date(2026, 10, 9 + weekOffset * 7), [weekOffset]);
  function weekDate(index: number) { const date = new Date(monday); date.setDate(date.getDate() + index); return date; }
  const visibleRecipes = recipes.filter(recipe => `${recipe.name} ${recipe.ingredients.map(item => item[0]).join(' ')}`.toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE')));
  const currentWeekItems = items;
  const title = view === 'plan' ? 'Was essen wir diese Woche?' : view === 'recipes' ? 'Kochbuch' : 'Einkaufsliste';

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  };
  const addMeal = (recipe: Recipe, day: number) => {
    const key = localDateKey(weekDate(day));
    setPlans(previous => ({ ...previous, [key]: [...(previous[key] || []), recipe.id] }));
    setTargetDay(null);
    setView('plan');
    setDayPickerRecipe(null);
    setModalMode(null);
  };
  const removeMeal = (date: string, index: number) => setPlans(previous => {
    const next = { ...previous, [date]: [...(previous[date] || [])] };
    next[date].splice(index, 1);
    if (!next[date].length) delete next[date];
    return next;
  });
  const openRecipe = (recipe: Recipe) => { setActiveRecipe(recipe); setModalMode('view'); };
  const openDayPicker = (recipe: Recipe) => { setDayPickerRecipe(recipe); setModalMode(null); };
  const openNewRecipe = () => {
    setFormName(''); setFormMinutes('25'); setFormIngredients([['', '']]); setActiveRecipe(null); setModalMode('new');
  };
  const openEditRecipe = (recipe: Recipe) => {
    setActiveRecipe(recipe); setFormName(recipe.name); setFormMinutes(String(parseInt(recipe.time, 10) || 25));
    setFormIngredients(recipe.ingredients.length ? recipe.ingredients.map(item => [...item] as [string, string]) : [['', '']]);
    setModalMode('edit');
  };
  const saveRecipe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = formName.trim();
    if (!name) return;
    const ingredients = formIngredients.map(([ingredient, amount]) => [ingredient.trim(), amount.trim()] as [string, string]).filter(item => item[0]);
    const minutes = Math.max(1, Number(formMinutes) || 25);
    if (modalMode === 'edit' && activeRecipe) {
      const updated = { ...activeRecipe, name, time: `${minutes} min`, ingredients };
      setRecipes(previous => previous.map(recipe => recipe.id === activeRecipe.id ? updated : recipe));
      setActiveRecipe(updated);
      setModalMode('view');
      return;
    }
    const id = Math.max(0, ...recipes.map(recipe => recipe.id)) + 1;
    const created: Recipe = { id, name, emoji: '', color: colors[(id - 1) % colors.length], time: `${minutes} min`, tag: 'Eigenes Rezept', ingredients };
    setRecipes(previous => [...previous, created]);
    if (modalMode === 'new' && targetDay !== null) {
      const dateKey = localDateKey(weekDate(targetDay));
      setPlans(previous => ({ ...previous, [dateKey]: [...(previous[dateKey] || []), created.id] }));
      setTargetDay(null); setView('plan'); setModalMode(null);
    } else {
      setActiveRecipe(created);
      setModalMode('view');
    }
  };
  const deleteRecipe = (recipe: Recipe) => {
    if (!window.confirm(`„${recipe.name}“ wirklich löschen?`)) return;
    setRecipes(previous => previous.filter(item => item.id !== recipe.id));
    setPlans(previous => Object.fromEntries(Object.entries(previous).map(([date, ids]) => [date, ids.filter(id => id !== recipe.id)]).filter(([, ids]) => (ids as number[]).length)));
    setModalMode(null); setActiveRecipe(null);
  };
  const addShoppingItem = () => {
    if (!newItem.trim()) return;
    setItems(previous => [...previous, { name: newItem.trim(), done: false, cat: 'Sonstiges', auto: false }]);
    setNewItem('');
  };
  const toggleItem = (index: number) => setItems(previous => previous.map((item, i) => i === index ? { ...item, done: !item.done } : item));
  const beginAddingForDay = (day: number) => { setTargetDay(day); setView('recipes'); setQuery(''); };

  if (import.meta.env.PROD && !supabase) return <div className="shell"><main className="main"><section className="panel auth-panel">
    <div className="brand"><span className="brandmark">✳</span>teller</div><h1>Supabase noch nicht verbunden</h1>
    <p>Die Live-App braucht ihre Supabase-Projektwerte, bevor Anmeldung und gemeinsame Speicherung verfügbar sind.</p>
    <ol className="setup-steps"><li>Im Repository unter <b>Settings → Secrets and variables → Actions → Variables</b> die Projekt-URL als <code>VITE_SUPABASE_URL</code> eintragen.</li><li>Den Supabase-Publishable-Key als <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> eintragen.</li><li>Den Workflow <b>Deploy to GitHub Pages</b> erneut ausführen.</li></ol>
    <p className="setup-note">Im Client darf nur der Publishable-Key stehen, niemals ein Service-Role-Key.</p>
  </section></main></div>;

  if (supabase && !session) return <div className="shell"><main className="main"><section className="panel auth-panel">
    <div className="brand"><span className="brandmark">✳</span>teller</div><h1>Anmelden</h1>
    <p>Mit eurem Supabase-Konto anmelden, um Wochenplan, Kochbuch und Einkauf gemeinsam zu nutzen. Konten werden vom Haushalts-Admin angelegt.</p>
    <form className="auth-form" onSubmit={signIn}>
      <label>E-Mail-Adresse<input className="search" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label>Passwort<input className="search" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
      <button className="primary" type="submit">Anmelden</button>
    </form>{authError && <p role="alert" className="error-message">{authError}</p>}
  </section></main></div>;
  if (supabase && session && !loaded) return <div className="shell"><main className="main"><section className="panel">Gemeinsame Daten werden geladen …</section></main></div>;

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brandmark">✳</span>teller</div>
      <nav className="nav">
        {(['plan', 'recipes', 'shopping'] as const).map((id, index) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setTargetDay(null); }}>
          <span className="ico">{['▦', '♨', '☷'][index]}</span>{['Wochenplan', 'Rezepte', 'Einkaufsliste'][index]}
        </button>)}
      </nav>
      <div className="household"><div className="avatar">M</div><div><b>Unser Zuhause</b><small>Mit euch geteilt</small></div></div>
    </aside>
    <main className="main">
      <header className="top"><div><h1 id="title">{targetDay !== null && view === 'recipes' ? `Rezept für ${dayNames[targetDay]} wählen` : title}</h1></div>
        <div className="topright"><div className="share"><div className="stack"><span className="avatar">M</span><span className="avatar plus">+</span></div>{supabase ? (saving ? 'Speichert …' : 'Synchronisiert') : 'Lokal gespeichert'}</div>{supabase && <button className="signout" onClick={() => void supabase?.auth.signOut()}>Abmelden</button>}</div>
      </header>
      {dataError && <p role="alert" className="error-message">{dataError}</p>}
      {loadFailed && <section className="panel"><p>Der Zugriff auf die gemeinsame Datenbank ist fehlgeschlagen. Prüfe die Mitgliedschaft in `app_members` und lade die Seite anschließend neu.</p></section>}

      {view === 'plan' && <section className="view visible">
        <div className="weekbar"><span className="weeklabel">Wochenplan · KW {String(Math.ceil((monday.getTime() - new Date(monday.getFullYear(), 0, 4).getTime()) / 604800000) + 1).padStart(2, '0')}</span><button aria-label="Vorherige Woche" onClick={() => setWeekOffset(value => value - 1)}>‹</button><button aria-label="Nächste Woche" onClick={() => setWeekOffset(value => value + 1)}>›</button></div>
        <div className="weekday-grid">{dayNames.map((day, index) => {
          const date = weekDate(index); const key = localDateKey(date); const dayMeals = (plans[key] || []).map(id => recipes.find(recipe => recipe.id === id)).filter((recipe): recipe is Recipe => Boolean(recipe));
          return <article className="weekday-card" key={day}>
            <div className="weekday-title"><strong>{day}</strong><span>{dateText(date)}</span>{weekOffset === 0 && index === 0 && <span className="today-mark">DIESE WOCHE</span>}</div>
            <div className="weekday-row"><div className="weekday-content">{dayMeals.length ? dayMeals.map((recipe, mealIndex) => <div className="weekday-meal" style={{ background: recipe.color }} key={`${recipe.id}-${mealIndex}`}>
              <button className="meal-open" onClick={() => openRecipe(recipe)}>{recipe.name}<small>{recipe.time}</small></button>
              <button className="weekday-remove" aria-label={`${recipe.name} entfernen`} onClick={() => removeMeal(key, mealIndex)}>×</button>
            </div>) : <div className="weekday-empty">Noch nichts geplant</div>}</div>
            {dayMeals.length === 0 && <button className="weekday-add" aria-label={`${day} hinzufügen`} onClick={() => beginAddingForDay(index)}>＋</button>}</div>
          </article>;
        })}</div>
      </section>}

      {view === 'recipes' && <section className="view visible">
        <div className="toolbar"><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Rezept oder Zutat suchen …" /><button className="pill" onClick={openNewRecipe}>＋ Rezept</button></div>
        {targetDay !== null && <p className="eyebrow">Wähle ein Gericht für {dayNames[targetDay]}.</p>}
        <div className="recipegrid">{visibleRecipes.length ? visibleRecipes.map(recipe => <article className="recipe-card" key={recipe.id}>
          <button className="recipe-card-open" onClick={() => targetDay !== null ? addMeal(recipe, targetDay) : openRecipe(recipe)}><div className="recipe-art" style={{ background: recipe.color }}><em>{recipe.time}</em>{recipe.emoji}</div><div className="recipe-copy"><h3>{recipe.name}</h3><p>{recipe.ingredients.length} Zutaten · {recipe.tag}</p></div></button>
          <div className="recipe-actions"><button className="recipe-add" aria-label={`${recipe.name} einplanen`} title="Einplanen" onClick={() => targetDay !== null ? addMeal(recipe, targetDay) : openDayPicker(recipe)}>＋</button><button className="recipe-edit-icon" aria-label={`${recipe.name} bearbeiten`} onClick={() => openEditRecipe(recipe)}>✎</button></div>
        </article>) : <div className="empty">Keine passenden Rezepte gefunden.</div>}</div>
      </section>}

      {view === 'shopping' && <section className="panel full-list">
        <div className="sectionhead"><h2>Aktueller Wocheneinkauf</h2><span className="count">{currentWeekItems.filter(item => item.done).length} / {currentWeekItems.length}</span></div>
        <div className="progress"><i style={{ width: `${currentWeekItems.length ? currentWeekItems.filter(item => item.done).length / currentWeekItems.length * 100 : 0}%` }} /></div>
        {currentWeekItems.length ? [...new Set(currentWeekItems.map(item => item.cat || 'Sonstiges'))].map(category => <div key={category}>
          <div className="cat">{category}</div>{currentWeekItems.map((item, index) => item.cat === category || (!item.cat && category === 'Sonstiges') ? <label className={`item ${item.done ? 'done' : ''}`} key={`${item.key || item.name}-${index}`}>
            <input type="checkbox" checked={item.done} onChange={() => toggleItem(index)} /><span>{item.name}</span><span className="qty">{item.qty || ''}</span>
          </label> : null)}
        </div>) : <div className="empty">Noch keine Einkäufe. Geplante Rezepte ergänzen ihre Zutaten automatisch.</div>}
        <div className="additem"><input value={newItem} onChange={event => setNewItem(event.target.value)} onKeyDown={event => event.key === 'Enter' && addShoppingItem()} placeholder="Noch etwas hinzufügen …" /><button onClick={addShoppingItem}>＋</button></div>
      </section>}
    </main>
    <nav className="mobile-nav">{(['plan', 'recipes', 'shopping'] as const).map((id, index) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setTargetDay(null); }}><b>{['▦', '♨', '☷'][index]}</b>{['Plan', 'Kochbuch', 'Einkauf'][index]}</button>)}</nav>

    {modalMode && <div className="modalback open" onClick={() => setModalMode(null)}><section className="modal" onClick={event => event.stopPropagation()}>
      {modalMode === 'view' && activeRecipe && <>
        <div className="modalhead"><span className="eyebrow">{activeRecipe.time} · {activeRecipe.tag}</span><div className="modal-actions"><button className="recipe-edit-icon" aria-label="Rezept bearbeiten" onClick={() => openEditRecipe(activeRecipe)}>✎</button><button onClick={() => setModalMode(null)} aria-label="Schließen">×</button></div></div>
        <div className="modalart" style={{ background: activeRecipe.color }}>{activeRecipe.emoji}</div><h2>{activeRecipe.name}</h2><h3>Zutaten · 2 Portionen</h3>
        {activeRecipe.ingredients.map(([name, amount]) => <div className="ingredient" key={`${name}-${amount}`}>{name}<span>{amount}</span></div>)}
        <button className="primary" onClick={() => openDayPicker(activeRecipe)}>＋ In den Wochenplan</button>
      </>}
      {(modalMode === 'new' || modalMode === 'edit') && <>
        <div className="modalhead"><h2>{modalMode === 'new' ? 'Neues Rezept' : 'Rezept bearbeiten'}</h2><button onClick={() => setModalMode(null)} aria-label="Schließen">×</button></div>
        <form className="recipe-form" onSubmit={saveRecipe}>
          <label className="eyebrow">NAME<input className="search" required value={formName} onChange={event => setFormName(event.target.value)} placeholder="z. B. Ofengemüse mit Feta" /></label>
          <label className="eyebrow">ZUBEREITUNGSZEIT (MINUTEN)<input className="search" type="number" min="1" value={formMinutes} onChange={event => setFormMinutes(event.target.value)} /></label>
          <div className="eyebrow">ZUTATEN</div>
          <div className="ingredient-edit-list">{formIngredients.map(([name, amount], index) => <div className="ingredient-edit-row" key={index}>
            <input className="ingredient-name" aria-label="Zutat" placeholder="Zutat" value={name} onChange={event => setFormIngredients(previous => previous.map((row, i) => i === index ? [event.target.value, row[1]] : row))} />
            <input className="ingredient-quantity" aria-label="Menge" placeholder="Menge" value={amount} onChange={event => setFormIngredients(previous => previous.map((row, i) => i === index ? [row[0], event.target.value] : row))} />
            <button type="button" aria-label="Zutat entfernen" onClick={() => setFormIngredients(previous => previous.filter((_, i) => i !== index))}>×</button>
          </div>)}</div>
          <button type="button" className="add-ingredient" onClick={() => setFormIngredients(previous => [...previous, ['', '']])}>＋ Zutat hinzufügen</button>
          <button className="primary" type="submit">{modalMode === 'new' ? 'Rezept speichern' : 'Änderungen speichern'}</button>
          {modalMode === 'edit' && activeRecipe && <button type="button" className="delete-recipe" onClick={() => deleteRecipe(activeRecipe)}>Rezept löschen</button>}
        </form>
      </>}
    </section></div>}
    {dayPickerRecipe && <div className="day-picker-backdrop open" onClick={() => setDayPickerRecipe(null)}><section className="day-picker" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}>
      <div className="day-picker-head"><h2>Zu welchem Tag hinzufügen?</h2><button aria-label="Schließen" onClick={() => setDayPickerRecipe(null)}>×</button></div>
      <div className="day-picker-list">{dayNames.map((day, index) => <button className="day-choice" key={day} onClick={() => addMeal(dayPickerRecipe, index)}>{day}<span>{dateText(weekDate(index))}</span></button>)}</div>
    </section></div>}
  </div>;
}
