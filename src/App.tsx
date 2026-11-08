import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import './styles.css';
import { supabase, type SharedAppData } from './supabase';

type Recipe = { id: number; name: string; emoji: string; color: string; time: string; tag: string; ingredients: [string, string][] };
const defaults: Recipe[] = [
  { id: 1, name: 'Zitronen-Ricotta-Pasta', emoji: '🍋', color: '#b5c5e8', time: '25 min', tag: 'Vegetarisch', ingredients: [['Pasta', '300 g'], ['Ricotta', '150 g'], ['Zitrone', '1 Stück']] },
  { id: 2, name: 'Crispy Tofu Bowl', emoji: '🥑', color: '#ffb28f', time: '30 min', tag: 'Vegan', ingredients: [['Tofu', '250 g'], ['Jasminreis', '200 g'], ['Avocado', '1 Stück']] },
  { id: 3, name: 'Ofen-Tomaten & Burrata', emoji: '🍅', color: '#aec8fb', time: '35 min', tag: 'Vegetarisch', ingredients: [['Cherrytomaten', '400 g'], ['Burrata', '1 Stück']] },
  { id: 4, name: 'Grüne Shakshuka', emoji: '🍳', color: '#eca9c4', time: '20 min', tag: 'Einfach', ingredients: [['Eier', '4 Stück'], ['Babyspinat', '150 g']] },
  { id: 5, name: 'Gnocchi aus der Pfanne', emoji: '🍝', color: '#c9b99f', time: '20 min', tag: 'Comfort food', ingredients: [['Gnocchi', '500 g'], ['Butter', '60 g']] },
  { id: 6, name: 'Bunte Mezze-Platte', emoji: '🥙', color: '#b4b6c2', time: '15 min', tag: 'Zum Teilen', ingredients: [['Hummus', '200 g'], ['Fladenbrot', '2 Stück']] },
];
const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
type Item = { name: string; done: boolean };

export default function App() {
  const [view, setView] = useState<'plan' | 'recipes' | 'shopping'>('plan');
  const [recipes, setRecipes] = useState<Recipe[]>(() => JSON.parse(localStorage.getItem('tellerRecipes') || 'null') || defaults);
  const [plans, setPlans] = useState<Record<string, number[]>>(() => JSON.parse(localStorage.getItem('tellerPlans') || '{}'));
  const [items, setItems] = useState<Item[]>(() => JSON.parse(localStorage.getItem('tellerItems') || '[]'));
  const [query, setQuery] = useState('');
  const [newItem, setNewItem] = useState('');
  const [week, setWeek] = useState(0);
  const [modal, setModal] = useState<Recipe | null>(null);
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
        setRecipes(payload.recipes as Recipe[]);
        setPlans(payload.plans || {});
        setItems(payload.items || []);
      }
      setLoaded(true);
    };
    void load();
    const channel = client.channel('shared-app-state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state', filter: 'id=eq.1' }, payload => {
        const next = (payload.new as { payload?: SharedAppData }).payload;
        if (!next) return;
        if (JSON.stringify(next) === currentDataRef.current) return;
        setRecipes(next.recipes as Recipe[]);
        setPlans(next.plans || {});
        setItems(next.items || []);
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
      localStorage.setItem('tellerItems', JSON.stringify(items));
      return;
    }
    const timer = window.setTimeout(async () => {
      setSaving(true);
      const { error } = await client.from('app_state').upsert({ id: 1, payload, updated_at: new Date().toISOString() });
      setDataError(error ? `Speichern fehlgeschlagen: ${error.message}` : '');
      setSaving(false);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [recipes, plans, items, session, loaded, loadFailed]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  };

  if (supabase && !session) return <div className="shell"><main className="main"><section className="panel auth-panel">
    <div className="brand"><span className="brandmark">✳</span>teller</div>
    <h1>Anmelden</h1><p>Mit Supabase-Konto anmelden, um euren gemeinsamen Essensplan zu öffnen.</p>
    <form className="auth-form" onSubmit={signIn}><label>E-Mail-Adresse<input className="search" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>Passwort<input className="search" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label><button className="primary" type="submit">Anmelden</button></form>
    {authError && <p role="alert" className="error-message">{authError}</p>}
  </section></main></div>;

  if (supabase && session && !loaded) return <div className="shell"><main className="main"><section className="panel">Gemeinsame Daten werden geladen …</section></main></div>;
  const monday = new Date(2026, 10, 9 + week * 7);
  const dateKey = (offset: number) => { const d = new Date(monday); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
  const planned = (offset: number) => (plans[dateKey(offset)] || []).map(id => recipes.find(r => r.id === id)).filter((r): r is Recipe => Boolean(r));
  const addMeal = (recipe: Recipe, day: number) => setPlans(p => ({ ...p, [dateKey(day)]: [...(p[dateKey(day)] || []), recipe.id] }));
  const addShoppingItem = () => { if (newItem.trim()) { setItems(x => [...x, { name: newItem.trim(), done: false }]); setNewItem(''); } };
  const toggleItem = (index: number) => setItems(x => x.map((item, i) => i === index ? { ...item, done: !item.done } : item));
  const visibleRecipes = recipes.filter(r => `${r.name} ${r.ingredients.map(i => i[0]).join(' ')}`.toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE')));
  return <div className="shell">
    <aside className="sidebar"><div className="brand"><span className="brandmark">✳</span>teller</div><nav className="nav">{(['plan', 'recipes', 'shopping'] as const).map((id, i) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><span className="ico">{['▦', '♨', '☷'][i]}</span>{['Wochenplan', 'Rezepte', 'Einkaufsliste'][i]}</button>)}</nav><div className="household"><div className="avatar">M</div><div><b>Unser Zuhause</b><small>Mit Mia geteilt</small></div></div></aside>
    <main className="main"><header className="top"><div><span className="eyebrow">GEMEINSAM GUT ESSEN</span><h1>{view === 'plan' ? 'Was essen wir diese Woche?' : view === 'recipes' ? 'Kochbuch' : 'Einkaufsliste'}</h1></div><div className="share"><span className="avatar">M</span> {supabase ? (saving ? 'Speichert …' : 'Synchronisiert') : 'Nur lokal gespeichert'}</div>{supabase && <button className="signout" onClick={() => void supabase?.auth.signOut()}>Abmelden</button>}</header>
      {dataError && <p role="alert" className="error-message">{dataError}</p>}
      {view === 'plan' && <><div className="weekbar"><span className="weeklabel">Wochenplan</span><button onClick={() => setWeek(w => w - 1)}>‹</button><button onClick={() => setWeek(w => w + 1)}>›</button></div><div className="weekday-grid">{days.map((day, i) => <article className="weekday-card" key={day}><div className="weekday-title"><strong>{day}</strong><span>{new Date(monday.getTime() + i * 86400000).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</span></div>{planned(i).map((r, j) => <button className="weekday-meal" style={{ background: r.color }} key={`${r.id}-${j}`} onClick={() => setModal(r)}>{r.emoji} {r.name}</button>)}<button className="weekday-add" onClick={() => setView('recipes')}>+</button></article>)}</div></>}
      {view === 'recipes' && <><div className="toolbar"><input className="search" placeholder="Rezept oder Zutat suchen …" value={query} onChange={e => setQuery(e.target.value)} /></div><div className="recipegrid">{visibleRecipes.map(r => <article className="recipe-card" key={r.id} onClick={() => setModal(r)}><div className="recipe-art" style={{ background: r.color }}>{r.emoji}<em>{r.time}</em></div><div className="recipe-copy"><h3>{r.name}</h3><p>{r.ingredients.length} Zutaten · {r.tag}</p><button className="recipe-add" onClick={e => { e.stopPropagation(); addMeal(r, 0); setView('plan'); }}>＋ Einplanen</button></div></article>)}</div></>}
      {view === 'shopping' && <section className="panel full-list"><div className="sectionhead"><h2>Einkaufsliste</h2><span className="count">{items.filter(x => x.done).length} / {items.length}</span></div><div className="progress"><i style={{ width: `${items.length ? items.filter(x => x.done).length / items.length * 100 : 0}%` }} /></div>{items.map((item, i) => <label className={`item ${item.done ? 'done' : ''}`} key={`${item.name}-${i}`}><input type="checkbox" checked={item.done} onChange={() => toggleItem(i)} />{item.name}</label>)}<div className="additem"><input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addShoppingItem()} placeholder="Noch etwas hinzufügen …" /><button onClick={addShoppingItem}>+</button></div></section>}
    </main><nav className="mobile-nav">{(['plan', 'recipes', 'shopping'] as const).map((id, i) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><b>{['▦', '♨', '☷'][i]}</b>{['Plan', 'Kochbuch', 'Einkauf'][i]}</button>)}</nav>
    {modal && <div className="modalback open" onClick={() => setModal(null)}><section className="modal" onClick={e => e.stopPropagation()}><div className="modalhead"><span>{modal.time}</span><button onClick={() => setModal(null)}>×</button></div><div className="modalart" style={{ background: modal.color }}>{modal.emoji}</div><h2>{modal.name}</h2><h3>Zutaten</h3>{modal.ingredients.map(([name, amount]) => <div className="ingredient" key={name}>{name}<span>{amount}</span></div>)}<button className="primary" onClick={() => { addMeal(modal, 0); setModal(null); setView('plan'); }}>＋ In den Wochenplan</button></section></div>}
  </div>;
}
