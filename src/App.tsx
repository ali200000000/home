import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import './styles.css';
import { supabase, type SharedAppData } from './supabase';
import InspirationGrid from './InspirationGrid';

type Recipe = {
  id: number;
  name: string;
  emoji: string;
  color: string;
  imageUrl?: string;
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
const BrandLogo = () => <img className="brand-logo" src={`${import.meta.env.BASE_URL}mealy-logo.png`} alt="mealy" />;
type ViewId = 'plan' | 'recipes' | 'inspiration' | 'shopping';
const NavIcon = ({ view }: { view: ViewId }) => <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  {view === 'plan' && <><rect x="3.5" y="5.5" width="17" height="15" rx="2" /><path d="M7.5 3.5v4M16.5 3.5v4M3.5 9.5h17M7.5 13h.01M12 13h.01M16.5 13h.01M7.5 16.5h.01M12 16.5h.01" /></>}
  {view === 'recipes' && <><path d="M6 3.5v7M3.5 3.5v4a2.5 2.5 0 0 0 5 0v-4M6 10v10.5M15.5 3.5c-2 2.2-3 4.5-3 7v1h6v-1c0-2.5-1-4.8-3-7ZM15.5 11.5v9" /></>}
  {view === 'shopping' && <><path d="m3.5 6 1.5 1.5L7.5 5M10 6h10M3.5 12l1.5 1.5L7.5 11M10 12h10M3.5 18l1.5 1.5L7.5 17M10 18h10" /></>}
  {view === 'inspiration' && <><path d="m12 2.5 2.3 6.2 6.2 2.3-6.2 2.3-2.3 6.2-2.3-6.2-6.2-2.3 6.2-2.3L12 2.5Z"/><path d="m19 16 .9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z"/></>}
</svg>;
const PencilIcon = () => <svg className="pencil-icon" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><rect x="5.5" y="10" width="24" height="24" rx="3.5" fill="none" stroke="currentColor" strokeWidth="3.2" /><path d="m19 21 13-13 4 4-13 13-5 1z" fill="currentColor" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="m29.5 7.5 4 4" stroke="#fff" strokeWidth="1.5" /></svg>;
const PhotoIcon = () => <svg className="camera-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>;
const initial = <T,>(key: string, fallback: T): T => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
};
const dateText = (date: Date) => `${date.getDate()}. ${monthShort[date.getMonth()]}`;
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const normalizeSearch = (value: string) => value.trim().toLocaleLowerCase('de-DE').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
const sameValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
function mergeRecord<T extends Record<string, unknown>>(base: T | undefined, local: T | undefined, remote: T | undefined): T | undefined {
  if (sameValue(local, base)) return remote;
  if (sameValue(remote, base) || sameValue(local, remote)) return local;
  if (!local || !remote) return local;
  const merged: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(base || {}), ...Object.keys(local), ...Object.keys(remote)]);
  for (const key of keys) {
    const b = base?.[key]; const l = local[key]; const r = remote[key];
    const chosen = sameValue(l, b) ? r : sameValue(r, b) || sameValue(l, r) ? l : l;
    if (chosen !== undefined) merged[key] = chosen;
  }
  return merged as T;
}
function mergeKeyedArrays<T extends Record<string, unknown>>(base: T[], local: T[], remote: T[], keyOf: (item: T, index: number) => string): T[] {
  const toMap = (items: T[]) => new Map(items.map((item, index) => [keyOf(item, index), item]));
  const b = toMap(base); const l = toMap(local); const r = toMap(remote);
  const keys = new Set([...r.keys(), ...l.keys(), ...b.keys()]);
  const result: T[] = [];
  for (const key of keys) {
    const value = mergeRecord(b.get(key), l.get(key), r.get(key));
    if (value) result.push(value);
  }
  return result;
}
function mergePlans(base: Record<string, number[]>, local: Record<string, number[]>, remote: Record<string, number[]>): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const date of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
    const b = base[date] || []; const l = local[date] || []; const r = remote[date] || [];
    const ids = new Set([...r, ...l, ...b]);
    const merged = [...ids].filter(id => l.includes(id) !== b.includes(id) ? l.includes(id) : r.includes(id));
    if (merged.length) result[date] = merged;
  }
  return result;
}
function mergeSharedData(base: SharedAppData, local: SharedAppData, remote: SharedAppData): SharedAppData {
  return {
    recipes: mergeKeyedArrays(base.recipes as Record<string, unknown>[], local.recipes as Record<string, unknown>[], remote.recipes as Record<string, unknown>[], recipe => String(recipe.id)),
    plans: mergePlans(base.plans, local.plans, remote.plans),
    items: mergeKeyedArrays(base.items as unknown as Record<string, unknown>[], local.items as unknown as Record<string, unknown>[], remote.items as unknown as Record<string, unknown>[], (item, index) => String(item.key || `legacy:${item.name}:${index}`)) as unknown as Item[],
  };
}

export default function App() {
  const [view, setView] = useState<ViewId>('plan');
  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 850px)');
    const keepMobileOnAvailableView = () => {
      if (mobileQuery.matches) setView(current => current === 'inspiration' ? 'plan' : current);
    };
    keepMobileOnAvailableView();
    mobileQuery.addEventListener('change', keepMobileOnAvailableView);
    return () => mobileQuery.removeEventListener('change', keepMobileOnAvailableView);
  }, []);
  const [recipes, setRecipes] = useState<Recipe[]>(() => initial('tellerRecipes', defaults));
  const [plans, setPlans] = useState<Record<string, number[]>>(() => initial('tellerPlans', {}));
  const [items, setItems] = useState<Item[]>(() => initial('tellerList', []));
  const [query, setQuery] = useState('');
  const [recipeFilter, setRecipeFilter] = useState('Alle');
  const [filterOpen, setFilterOpen] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDirection, setWeekDirection] = useState<1 | -1>(1);
  const weekSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const monday = useMemo(() => new Date(2026, 10, 9 + weekOffset * 7), [weekOffset]);
  const shoppingMonday = useMemo(() => new Date(2026, 10, 9), []);
  function weekDate(index: number) { const date = new Date(monday); date.setDate(date.getDate() + index); return date; }
  const [targetDay, setTargetDay] = useState<number | null>(null);
  const [scheduleNotice, setScheduleNotice] = useState('');
  const [dayPickerRecipe, setDayPickerRecipe] = useState<Recipe | null>(null);
  const [dragRecipe, setDragRecipe] = useState<Recipe | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [dragAnchor, setDragAnchor] = useState<{ x: number; y: number } | null>(null);
  const [dragDay, setDragDay] = useState<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const holdPointerRef = useRef<{ id: number; x: number; y: number; recipe: Recipe; element: HTMLElement } | null>(null);
  const [dayMenuIndex, setDayMenuIndex] = useState<number | null>(null);
  const [dayMenuCenter, setDayMenuCenter] = useState<{ left: number; top: number } | null>(null);
  const dayHoldTimerRef = useRef<number | null>(null);
  const dayHoldPointerRef = useRef<{ id: number; x: number; y: number; index: number; element: HTMLElement } | null>(null);
  const [dayActionHover, setDayActionHover] = useState(false);
  const dayActionActiveRef = useRef(false);
  const suppressDayMealClickRef = useRef(false);
  const holdActiveRef = useRef(false);
  const suppressRecipeClickRef = useRef(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [formName, setFormName] = useState('');
  const [formTimeLevel, setFormTimeLevel] = useState(1);
  const [formIngredients, setFormIngredients] = useState<[string, string][]>([['', '']]);
  const [formImage, setFormImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [recipeSaving, setRecipeSaving] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<{ id: string; name: string }[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [dataError, setDataError] = useState('');
  const [loaded, setLoaded] = useState(!supabase);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const syncTriggerRef = useRef<HTMLButtonElement>(null);
  const syncMenuRef = useRef<HTMLDivElement>(null);
  const currentDataRef = useRef(JSON.stringify({ recipes, plans, items }));
  const persistedDataRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSavesRef = useRef(0);

  useEffect(() => {
    if (!scheduleNotice) return;
    const timeout = window.setTimeout(() => setScheduleNotice(''), 2800);
    return () => window.clearTimeout(timeout);
  }, [scheduleNotice]);

  useEffect(() => {
    if (syncMenuOpen) requestAnimationFrame(() => syncMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
  }, [syncMenuOpen]);

  const handleSyncMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const menuItems = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      setSyncMenuOpen(false);
      syncTriggerRef.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      menuItems[(currentIndex + direction + menuItems.length) % menuItems.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault(); menuItems[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault(); menuItems.at(-1)?.focus();
    }
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setDisplayName(String(data.session?.user.user_metadata?.display_name || ''));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setDisplayName(String(nextSession?.user.user_metadata?.display_name || ''));
      setLoaded(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || !session) { setOnlineUsers([]); return; }
    const name = displayName.trim() || session.user.email?.split('@')[0] || 'Mitglied';
    const channel = client.channel('mealy-online-household', { config: { presence: { key: session.user.id } } });
    const refresh = () => {
      const state = channel.presenceState<{ display_name?: string }>();
      const users = Object.entries(state).flatMap(([id, presences]) => {
        const current = presences[presences.length - 1];
        return current ? [{ id, name: current.display_name || 'Mitglied' }] : [];
      });
      setOnlineUsers(users);
    };
    channel.on('presence', { event: 'sync' }, refresh)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') void channel.track({ display_name: name });
      });
    return () => { void client.removeChannel(channel); };
  }, [session, displayName]);

  useEffect(() => {
    const client = supabase;
    if (!client || !session) return;
    let cancelled = false;
    const abortController = new AbortController();
    const timeout = window.setTimeout(() => abortController.abort(), 10000);
    setLoaded(false);
    const load = async () => {
      setDataError('');
      setLoadFailed(false);
      try {
        const { data, error } = await client.from('app_state').select('payload').eq('id', 1).abortSignal(abortController.signal).maybeSingle();
        if (cancelled) return;
        if (error) {
          setLoadFailed(true);
          setDataError(abortController.signal.aborted ? 'Supabase antwortet gerade nicht. Prüfe die Verbindung und versuche es erneut.' : `Datenbankzugriff fehlgeschlagen: ${error.message}`);
        } else if (data?.payload) {
          const payload = data.payload as SharedAppData;
          const nextRecipes = payload.recipes as Recipe[] || defaults;
          const nextPlans = payload.plans || {};
          const nextItems = payload.items as Item[] || [];
          persistedDataRef.current = JSON.stringify({ recipes: nextRecipes, plans: nextPlans, items: nextItems });
          currentDataRef.current = persistedDataRef.current;
          setRecipes(nextRecipes);
          setPlans(nextPlans);
          setItems(nextItems);
        } else {
          persistedDataRef.current = JSON.stringify({ recipes: defaults, plans: {}, items: [] });
        }
      } catch (error) {
        if (cancelled) return;
        setLoadFailed(true);
        setDataError(abortController.signal.aborted ? 'Supabase antwortet gerade nicht. Prüfe die Verbindung und versuche es erneut.' : `Datenbankzugriff fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Netzwerkfehler'}`);
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled) setLoaded(true);
      }
    };
    void load();
    const channel = client.channel('shared-app-state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state', filter: 'id=eq.1' }, payload => {
        const next = (payload.new as { payload?: SharedAppData }).payload;
        if (!next) return;
        const incoming: SharedAppData = {
          recipes: Array.isArray(next.recipes) ? next.recipes : defaults,
          plans: next.plans || {},
          items: Array.isArray(next.items) ? next.items : [],
        };
        const current = JSON.parse(currentDataRef.current) as SharedAppData;
        const previous = persistedDataRef.current ? JSON.parse(persistedDataRef.current) as SharedAppData : incoming;
        const merged = mergeSharedData(previous, current, incoming);
        persistedDataRef.current = JSON.stringify(incoming);
        currentDataRef.current = JSON.stringify(merged);
        setRecipes(merged.recipes as Recipe[]);
        setPlans(merged.plans);
        setItems(merged.items as Item[]);
      })
      .subscribe();
    return () => { cancelled = true; window.clearTimeout(timeout); abortController.abort(); void client.removeChannel(channel); };
  }, [session, loadAttempt]);

  useEffect(() => {
    if (!loaded || loadFailed) return;
    const snapshot: SharedAppData = { recipes, plans, items };
    const serialized = JSON.stringify(snapshot);
    currentDataRef.current = serialized;
    const client = supabase;
    if (!client || !session) {
      localStorage.setItem('tellerRecipes', JSON.stringify(recipes));
      localStorage.setItem('tellerPlans', JSON.stringify(plans));
      localStorage.setItem('tellerList', JSON.stringify(items));
      return;
    }
    if (persistedDataRef.current === null) {
      persistedDataRef.current = serialized;
      return;
    }
    if (serialized === persistedDataRef.current) return;
    const timer = window.setTimeout(() => {
      pendingSavesRef.current += 1;
      setSaving(true);
      const saveLatest = async () => {
        try {
          const latest = JSON.parse(currentDataRef.current) as SharedAppData;
          const latestSerialized = JSON.stringify(latest);
          if (latestSerialized === persistedDataRef.current) return;
          const { error } = await client.from('app_state').upsert({ id: 1, payload: latest, updated_at: new Date().toISOString() });
          setDataError(error ? `Speichern fehlgeschlagen: ${error.message}` : '');
          if (!error) persistedDataRef.current = latestSerialized;
        } finally {
          pendingSavesRef.current -= 1;
          setSaving(pendingSavesRef.current > 0);
        }
      };
      saveQueueRef.current = saveQueueRef.current.then(saveLatest, saveLatest);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [recipes, plans, items, session, loaded, loadFailed]);

  useEffect(() => {
    if (!loaded || loadFailed) return;
    const totals = new Map<string, { name: string; unit: string; amount: number | null; raw: string | null }>();
    const currentWeekKeys = new Set(Array.from({ length: 7 }, (_, day) => {
      const date = new Date(shoppingMonday); date.setDate(date.getDate() + day); return localDateKey(date);
    }));
    const historicalRecipeIngredients = new Set<string>();
    for (const [dateKey, recipeIds] of Object.entries(plans)) {
      if (currentWeekKeys.has(dateKey)) continue;
      for (const recipeId of recipeIds) {
        const recipe = recipes.find(item => item.id === recipeId);
        recipe?.ingredients.forEach(([name]) => historicalRecipeIngredients.add(normalizeSearch(name)));
      }
    }
    for (let day = 0; day < 7; day++) {
      const date = new Date(shoppingMonday); date.setDate(date.getDate() + day);
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
      const manual = previous.filter(item => !item.auto && !(item.qty !== undefined && historicalRecipeIngredients.has(normalizeSearch(item.name))));
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
  }, [recipes, plans, shoppingMonday, loaded, loadFailed]);

  const normalizedQuery = normalizeSearch(query);
  const recipeFilters = ['Alle', 'schnell', 'mittel', 'lang'];
  const visibleRecipes = recipes.filter(recipe => normalizeSearch([recipe.name, ...recipe.ingredients.flatMap(([name, amount]) => [name, amount])].join(' ')).includes(normalizedQuery) && (recipeFilter === 'Alle' || recipe.time.toLocaleLowerCase('de-DE') === recipeFilter));
  const currentWeekItems = items;
  const userInitial = (displayName.trim().charAt(0) || session?.user.email?.trim().charAt(0) || '?').toLocaleUpperCase('de-DE');
  const title = view === 'plan' ? 'Wochenplan' : view === 'recipes' ? 'Kochbuch' : view === 'inspiration' ? 'Inspiration' : 'Einkaufsliste';
  const weekRadialCenter = dragAnchor ? {
    left: Math.max(160, Math.min(dragAnchor.x, window.innerWidth - 160)),
    top: Math.max(42, Math.min(dragAnchor.y - 66, window.innerHeight - 42)),
  } : null;

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setAuthError(error.message); return; }
    const chosenName = displayName.trim();
    if (chosenName) {
      const { error: profileError } = await supabase.auth.updateUser({ data: { display_name: chosenName } });
      if (profileError) setDataError(`Name konnte nicht gespeichert werden: ${profileError.message}`);
      else localStorage.setItem(`komiDisplayName:${email.trim().toLocaleLowerCase('de-DE')}`, chosenName);
    }
  };
  const addMeal = (recipe: Recipe, day: number) => {
    const key = localDateKey(weekDate(day));
    setPlans(previous => {
      const dayPlans = previous[key] || [];
      return dayPlans.includes(recipe.id) ? previous : { ...previous, [key]: [...dayPlans, recipe.id] };
    });
    setScheduleNotice(`„${recipe.name}“ wurde für ${dayNames[day]} eingeplant.`);
    setTargetDay(null);
    setDayPickerRecipe(null);
    setDragRecipe(null); setDragPoint(null); setDragAnchor(null); setDragDay(null);
    setModalMode(null);
  };
  const removeMeal = (date: string, index: number) => setPlans(previous => {
    const next = { ...previous, [date]: [...(previous[date] || [])] };
    const removedRecipeId = next[date][index];
    if (removedRecipeId === undefined) return previous;
    next[date] = next[date].filter(recipeId => recipeId !== removedRecipeId);
    if (!next[date].length) delete next[date];
    return next;
  });
  const openRecipe = (recipe: Recipe) => { setActiveRecipe(recipe); setModalMode('view'); };
  const openDayPicker = (recipe: Recipe) => { setDayPickerRecipe(recipe); setModalMode(null); };
  const startDayHold = (event: ReactPointerEvent<HTMLElement>, index: number) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('.weekday-remove')) return;
    if (target.closest('.weekday-add')) return;
    if (dayHoldTimerRef.current !== null) window.clearTimeout(dayHoldTimerRef.current);
    dayHoldPointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, index, element: event.currentTarget };
    dayHoldTimerRef.current = window.setTimeout(() => {
      const pointer = dayHoldPointerRef.current;
      if (!pointer || pointer.id !== event.pointerId) return;
      try { pointer.element.setPointerCapture(pointer.id); } catch { /* Pointer capture can be unavailable in older Safari versions. */ }
      setDayMenuIndex(index);
      setDayMenuCenter({ left: Math.max(160, Math.min(event.clientX, window.innerWidth - 160)), top: Math.max(42, Math.min(event.clientY - 66, window.innerHeight - 42)) });
      dayActionActiveRef.current = true;
      suppressDayMealClickRef.current = true;
      window.setTimeout(() => { suppressDayMealClickRef.current = false; }, 700);
      if (navigator.vibrate) navigator.vibrate(18);
    }, 480);
  };
  const moveDayHold = (event: ReactPointerEvent<HTMLElement>) => {
    const pointer = dayHoldPointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (dayActionActiveRef.current) {
      event.preventDefault();
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-day-action]');
      const action = target?.dataset.dayAction;
      setDayActionHover(action === 'random');
      return;
    }
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 12 && dayMenuIndex === null) {
      if (dayHoldTimerRef.current !== null) window.clearTimeout(dayHoldTimerRef.current);
      dayHoldTimerRef.current = null; dayHoldPointerRef.current = null;
    }
  };
  const endDayHold = (event: ReactPointerEvent<HTMLElement>) => {
    if (dayHoldPointerRef.current?.id !== event.pointerId) return;
    if (dayHoldTimerRef.current !== null) window.clearTimeout(dayHoldTimerRef.current);
    const active = dayActionActiveRef.current;
    const target = active ? document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-day-action]') : null;
    const action = target?.dataset.dayAction === 'random' || dayActionHover ? 'random' : null;
    const index = dayHoldPointerRef.current.index;
    dayHoldPointerRef.current = null;
    dayHoldTimerRef.current = null;
    if (action === 'random') randomizeDay(index);
    else if (active) closeDayMenu();
  };
  const closeDayMenu = () => { setDayMenuIndex(null); setDayMenuCenter(null); setDayActionHover(false); dayActionActiveRef.current = false; };
  const randomizeDay = (index: number) => {
    if (recipes.length) addMeal(recipes[Math.floor(Math.random() * recipes.length)], index);
    closeDayMenu();
  };
  const clearHoldTimer = () => { if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current); holdTimerRef.current = null; };
  const startRecipeHold = (event: ReactPointerEvent<HTMLElement>, recipe: Recipe) => {
    if (targetDay !== null) return;
    if ((event.target as HTMLElement).closest('.recipe-actions button')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    clearHoldTimer();
    holdActiveRef.current = false;
    holdPointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, recipe, element: event.currentTarget };
    holdTimerRef.current = window.setTimeout(() => {
      const pointer = holdPointerRef.current;
      if (!pointer || pointer.id !== event.pointerId) return;
      holdActiveRef.current = true;
      try { pointer.element.setPointerCapture(pointer.id); } catch { /* Pointer capture can be unavailable in older Safari versions. */ }
      setDragRecipe(recipe); setDragDay(null); setDragPoint({ x: event.clientX, y: event.clientY }); setDragAnchor({ x: event.clientX, y: event.clientY });
      if (navigator.vibrate) navigator.vibrate(18);
    }, 480);
  };
  const moveRecipeHold = (event: ReactPointerEvent<HTMLElement>) => {
    const pointer = holdPointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!holdActiveRef.current && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 12) {
      clearHoldTimer(); holdPointerRef.current = null; return;
    }
    if (!holdActiveRef.current) return;
    event.preventDefault();
    setDragPoint({ x: event.clientX, y: event.clientY });
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-drop-day]');
    setDragDay(target ? Number(target.dataset.dropDay) : null);
  };
  const endRecipeHold = (event: ReactPointerEvent<HTMLElement>) => {
    const pointer = holdPointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    clearHoldTimer();
    if (holdActiveRef.current) {
      suppressRecipeClickRef.current = true;
      window.setTimeout(() => { suppressRecipeClickRef.current = false; }, 700);
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-drop-day]');
      const day = target ? Number(target.dataset.dropDay) : null;
      setDragPoint(null); setDragDay(day);
      if (day !== null && day >= 0 && day < dayNames.length) addMeal(pointer.recipe, day);
      else { setDragRecipe(null); setDragAnchor(null); setDragDay(null); }
    }
    holdActiveRef.current = false;
    holdPointerRef.current = null;
  };
  const cancelRecipeHold = (event: ReactPointerEvent<HTMLElement>) => {
    if (holdPointerRef.current?.id !== event.pointerId) return;
    clearHoldTimer(); holdPointerRef.current = null; holdActiveRef.current = false; setDragPoint(null); setDragAnchor(null); setDragRecipe(null); setDragDay(null);
  };
  const closeDragSheet = () => { clearHoldTimer(); holdPointerRef.current = null; holdActiveRef.current = false; setDragRecipe(null); setDragPoint(null); setDragAnchor(null); setDragDay(null); };
  const dragPointerActive = Boolean(dragRecipe && dragPoint);
  useEffect(() => {
    if (!dragPointerActive) return;
    const stopPageScroll = (event: TouchEvent) => event.preventDefault();
    document.addEventListener('touchmove', stopPageScroll, { passive: false });
    return () => document.removeEventListener('touchmove', stopPageScroll);
  }, [dragPointerActive]);
  const openNewRecipe = () => {
    setFormName(''); setFormTimeLevel(1); setFormIngredients([['', '']]); setFormImage(null); setImagePreview(''); setActiveRecipe(null); setModalMode('new');
  };
  const openEditRecipe = (recipe: Recipe) => {
    setActiveRecipe(recipe); setFormName(recipe.name); setFormTimeLevel(['schnell', 'mittel', 'lang'].indexOf(recipe.time.toLocaleLowerCase('de-DE')) >= 0 ? ['schnell', 'mittel', 'lang'].indexOf(recipe.time.toLocaleLowerCase('de-DE')) : (parseInt(recipe.time, 10) || 25) <= 20 ? 0 : (parseInt(recipe.time, 10) || 25) <= 35 ? 1 : 2);
    setFormIngredients(recipe.ingredients.length ? recipe.ingredients.map(item => [...item] as [string, string]) : [['', '']]);
    setFormImage(null); setImagePreview(recipe.imageUrl || '');
    setModalMode('edit');
  };
  const saveRecipe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = formName.trim();
    if (!name) return;
    const ingredients = formIngredients.map(([ingredient, amount]) => [ingredient.trim(), amount.trim()] as [string, string]).filter(item => item[0]);
    const timeLabel = (['schnell', 'mittel', 'lang'] as const)[formTimeLevel];
    const id = modalMode === 'edit' && activeRecipe ? activeRecipe.id : Date.now() * 1000 + Math.floor(Math.random() * 1000);
    let imageUrl = modalMode === 'edit' && activeRecipe ? activeRecipe.imageUrl : undefined;
    setRecipeSaving(true);
    try {
      if (formImage && (!supabase || !session)) throw new Error('Bitte melde dich an, um ein Rezeptfoto hochzuladen.');
      if (formImage && supabase && session) {
        const extension = formImage.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = `${session.user.id}/${id}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('recipe-images').upload(path, formImage, { contentType: formImage.type, upsert: false });
        if (uploadError) throw new Error(`Bild-Upload fehlgeschlagen: ${uploadError.message}. Prüfe, ob das SQL-Setup für den Bucket „recipe-images“ ausgeführt wurde.`);
        imageUrl = supabase.storage.from('recipe-images').getPublicUrl(path).data.publicUrl;
      }
      let nextRecipes: Recipe[];
      let savedRecipe: Recipe;
      if (modalMode === 'edit' && activeRecipe) {
        savedRecipe = { ...activeRecipe, name, time: timeLabel, ingredients, imageUrl };
        nextRecipes = recipes.map(recipe => recipe.id === activeRecipe.id ? savedRecipe : recipe);
      } else {
        savedRecipe = { id, name, emoji: '', color: colors[(id - 1) % colors.length], time: timeLabel, tag: 'Eigenes Rezept', ingredients, imageUrl };
        nextRecipes = [...recipes, savedRecipe];
      }
      if (supabase && session) {
        const current = JSON.parse(currentDataRef.current) as SharedAppData;
        const payload: SharedAppData = { ...current, recipes: nextRecipes };
        const serialized = JSON.stringify(payload);
        const { error } = await supabase.from('app_state').upsert({ id: 1, payload, updated_at: new Date().toISOString() });
        if (error) throw new Error(`Rezept konnte nicht in der Datenbank gespeichert werden: ${error.message}`);
        currentDataRef.current = serialized;
        persistedDataRef.current = serialized;
      }
      setDataError('');
      setRecipes(nextRecipes);
      if (modalMode === 'edit') { setActiveRecipe(savedRecipe); setModalMode('view'); }
      else if (targetDay !== null) {
        const dateKey = localDateKey(weekDate(targetDay));
        setPlans(previous => ({ ...previous, [dateKey]: [...(previous[dateKey] || []), savedRecipe.id] }));
        setScheduleNotice(`„${savedRecipe.name}“ wurde für ${dayNames[targetDay]} eingeplant.`);
        setTargetDay(null); setModalMode(null);
      } else { setActiveRecipe(savedRecipe); setModalMode('view'); }
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Rezept oder Foto konnte nicht gespeichert werden.');
    } finally { setRecipeSaving(false); }
  };
  const deleteRecipe = (recipe: Recipe) => {
    if (!window.confirm(`„${recipe.name}“ wirklich löschen?`)) return;
    setRecipes(previous => previous.filter(item => item.id !== recipe.id));
    setPlans(previous => Object.fromEntries(Object.entries(previous).map(([date, ids]) => [date, ids.filter(id => id !== recipe.id)]).filter(([, ids]) => (ids as number[]).length)));
    setModalMode(null); setActiveRecipe(null);
  };
  const addShoppingItem = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const name = newItem.trim();
    if (!name) return;
    const key = `manual:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    setItems(previous => [...previous, { name, done: false, cat: categoryFor(name), auto: false, key }]);
    setNewItem('');
  };
  const toggleItem = (index: number) => setItems(previous => previous.map((item, i) => i === index ? { ...item, done: !item.done } : item));
  const beginAddingForDay = (day: number) => { setTargetDay(day); setView('recipes'); setQuery(''); };
  const changeWeek = (direction: 1 | -1) => {
    setWeekDirection(direction);
    setWeekOffset(value => value + direction);
  };
  const startWeekSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) || (event.target as HTMLElement).closest('button,input')) return;
    weekSwipeStartRef.current = { x: event.clientX, y: event.clientY };
  };
  const finishWeekSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = weekSwipeStartRef.current;
    weekSwipeStartRef.current = null;
    if (!start || (event.target as HTMLElement).closest('button,input')) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) changeWeek(deltaX < 0 ? 1 : -1);
  };
  const handleDockPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.currentTarget.querySelectorAll<HTMLElement>('.mobile-nav-item').forEach(item => {
      const rect = item.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const distance = Math.abs(event.clientX - center);
      const influence = Math.max(0, 1 - distance / 190);
      item.style.setProperty('--dock-scale', String(1 + influence * 0.18));
      item.style.setProperty('--dock-y', `${-influence * 5}px`);
      item.style.zIndex = String(2 + Math.round(influence * 3));
    });
  };
  const resetDockPointer = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.querySelectorAll<HTMLElement>('.mobile-nav-item').forEach(item => {
      item.style.setProperty('--dock-scale', '1');
      item.style.setProperty('--dock-y', '0px');
      item.style.zIndex = '';
    });
  };

  if (import.meta.env.PROD && !supabase) return <div className="shell"><main className="main"><section className="panel auth-panel">
    <div className="brand"><BrandLogo /></div><h1>Supabase noch nicht verbunden</h1>
    <p>Die Live-App braucht ihre Supabase-Projektwerte, bevor Anmeldung und gemeinsame Speicherung verfügbar sind.</p>
    <ol className="setup-steps"><li>Im Repository unter <b>Settings → Secrets and variables → Actions → Variables</b> die Projekt-URL als <code>VITE_SUPABASE_URL</code> eintragen.</li><li>Den Supabase-Publishable-Key als <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> eintragen.</li><li>Den Workflow <b>Deploy to GitHub Pages</b> erneut ausführen.</li></ol>
    <p className="setup-note">Im Client darf nur der Publishable-Key stehen, niemals ein Service-Role-Key.</p>
  </section></main></div>;

  if (supabase && !session) return <div className="shell auth-shell"><main className="main auth-main"><section className="auth-panel login-panel">
    <div className="brand login-brand"><img className="login-app-icon" src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} alt="" /><span>mealy</span></div><h1>Hello!</h1>
    <p>Hier Mail und Passwort eintragen - dann geht´s los!</p>
    <form className="auth-form" onSubmit={signIn}>
      <label>Dein Name<input type="text" autoComplete="nickname" maxLength={40} required value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="z. B. Alex" /></label>
      <label>E-Mail-Adresse<input type="email" autoComplete="username" required value={email} onChange={event => { const value = event.target.value; setEmail(value); const savedName = localStorage.getItem(`komiDisplayName:${value.trim().toLocaleLowerCase('de-DE')}`); if (savedName) setDisplayName(savedName); }} /></label>
      <label>Passwort<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
      <button className="login-submit" type="submit" aria-label="Anmelden"><span aria-hidden="true">→</span></button>
    </form>{authError && <p role="alert" className="error-message">{authError}</p>}
  </section></main></div>;
  if (supabase && session && !loaded) return <div className="shell"><main className="main"><section className="panel">Gemeinsame Daten werden geladen …</section></main></div>;

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><BrandLogo /></div>
      <nav className="nav">
        {(['plan', 'recipes', 'inspiration', 'shopping'] as const).map((id, index) => <button key={id} data-view={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setTargetDay(null); }}>
          <span className="ico"><NavIcon view={id} /></span><span className="nav-label">{['Wochenplan', 'Kochbuch', 'Inspiration', 'Einkaufsliste'][index]}</span>
        </button>)}
      </nav>
      <div className="household"><div className="avatar">{session ? userInitial : 'M'}</div><div><b>Unser Zuhause</b><small>Mit euch geteilt</small></div></div>
    </aside>
    <main className="main">
      <header className="top"><div><h1 id="title">{title}</h1></div>
        <div className="topright">{supabase ? <div className="sync-menu-wrap">
          <button ref={syncTriggerRef} className="share sync-trigger" aria-label="Angemeldete Personen und Abmelden" aria-haspopup="menu" aria-expanded={syncMenuOpen} onClick={() => setSyncMenuOpen(open => !open)}>
            <span className="stack"><span className="avatar">{userInitial}</span><span className="avatar plus">+</span></span>
          </button>
          {syncMenuOpen && <button className="sync-dismiss" aria-label="Menü schließen" tabIndex={-1} onClick={() => setSyncMenuOpen(false)} />}
          <div ref={syncMenuRef} className={`sync-popover${syncMenuOpen ? ' is-open' : ''}`} role="menu" aria-label="Konto und Synchronisierung" aria-hidden={!syncMenuOpen} onKeyDown={handleSyncMenuKeyDown}>
            <div className="sync-popover-status" role="group" aria-label="Speicherstatus"><span className="sync-status-dot" />{saving ? 'Änderungen werden gespeichert' : 'Änderungen werden automatisch gespeichert'}</div>
            <div className="sync-people-heading" role="presentation">Angemeldet</div>
            <div className="sync-people">{onlineUsers.length ? onlineUsers.map(person => <div className="sync-person" role="menuitem" aria-disabled="true" tabIndex={-1} key={person.id}><span className="sync-person-avatar">{person.name.trim().charAt(0).toLocaleUpperCase('de-DE')}</span><span>{person.name}</span><i aria-label="Online" /></div>) : <div className="sync-empty" role="presentation">Niemand sonst gerade online</div>}</div>
            <div className="sync-separator" role="separator" />
            <button className="signout" role="menuitem" tabIndex={-1} onClick={() => { setSyncMenuOpen(false); void supabase?.auth.signOut(); }}>Abmelden</button>
          </div>
        </div> : <div className="share"><div className="stack"><span className="avatar">M</span><span className="avatar plus">+</span></div>Lokal gespeichert</div>}</div>
      </header>
      {dataError && <p role="alert" className="error-message">{dataError}</p>}
      {loadFailed && <section className="panel"><p>{dataError || 'Der Zugriff auf die gemeinsame Datenbank ist fehlgeschlagen.'} Prüfe die Verbindung und die Mitgliedschaft in `app_members`.</p><button className="primary" onClick={() => setLoadAttempt(attempt => attempt + 1)}>Erneut versuchen</button></section>}

      {view === 'plan' && <section className="view visible">
        <div className="weekbar"><span className="weeklabel">Wochenplan · KW {String(Math.ceil((monday.getTime() - new Date(monday.getFullYear(), 0, 4).getTime()) / 604800000) + 1).padStart(2, '0')}</span><button aria-label="Vorherige Woche" onClick={() => changeWeek(-1)}>‹</button><button aria-label="Nächste Woche" onClick={() => changeWeek(1)}>›</button></div>
        <div key={weekOffset} className={`weekday-grid week-swipe-in ${weekDirection === 1 ? 'from-next-week' : 'from-previous-week'}`} onPointerDown={startWeekSwipe} onPointerUp={finishWeekSwipe} onPointerCancel={() => { weekSwipeStartRef.current = null; }}>{dayNames.map((day, index) => {
          const date = weekDate(index); const key = localDateKey(date); const dayMeals = (plans[key] || []).map(id => recipes.find(recipe => recipe.id === id)).filter((recipe): recipe is Recipe => Boolean(recipe));
          return <article className="weekday-card" key={day} data-drop-day={index} onPointerDown={event => startDayHold(event, index)} onPointerMove={moveDayHold} onPointerUp={endDayHold} onPointerCancel={endDayHold} onContextMenu={event => event.preventDefault()}>
            <div className="weekday-title"><strong>{day}</strong><span>{dateText(date)}</span>{weekOffset === 0 && index === 0 && <span className="today-mark">DIESE WOCHE</span>}</div>
            <div className="weekday-row"><div className="weekday-content">{dayMeals.length ? dayMeals.map((recipe, mealIndex) => <div className="weekday-meal" style={{ background: recipe.color }} key={`${recipe.id}-${mealIndex}`}>
              <button className="meal-open" onClick={event => { if (suppressDayMealClickRef.current) { event.preventDefault(); suppressDayMealClickRef.current = false; return; } openRecipe(recipe); }}>{recipe.name}</button>
              <button className="weekday-remove" aria-label={`${recipe.name} entfernen`} onClick={() => removeMeal(key, mealIndex)}>×</button>
            </div>) : <div className="weekday-empty">Noch nichts geplant</div>}</div>
            {dayMeals.length === 0 && <button className="weekday-add" aria-label={`${day} hinzufügen`} onClick={() => beginAddingForDay(index)}>＋</button>}</div>
          </article>;
        })}</div>
      </section>}

      {view === 'recipes' && <section className="view visible">
        <div className="toolbar"><input className="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Rezept oder Zutat suchen …" /><div className="recipe-toolbar-actions"><button className="pill recipe-add-button" aria-label="Rezept hinzufügen" onClick={openNewRecipe}>＋</button><div className="recipe-filter-wrap"><button className={`pill recipe-filter-button${filterOpen || recipeFilter !== 'Alle' ? ' is-active' : ''}`} aria-label="Rezepte filtern" aria-expanded={filterOpen} onClick={() => setFilterOpen(open => !open)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 12h10m-7 5h4" /></svg></button>{filterOpen && <div className="recipe-filter-menu" role="group" aria-label="Rezeptkategorie filtern">{recipeFilters.map(filter => <button type="button" key={filter} className={recipeFilter === filter ? 'selected' : ''} onClick={() => { setRecipeFilter(filter); setFilterOpen(false); }}>{filter}{recipeFilter === filter && <span aria-hidden="true">✓</span>}</button>)}</div>}</div></div></div>
        {targetDay !== null && <p className="eyebrow">Wähle ein Gericht für {dayNames[targetDay]}.</p>}
        <div className="recipegrid">{visibleRecipes.length ? visibleRecipes.map(recipe => <article className={`recipe-card ${dragRecipe?.id === recipe.id && dragPoint ? 'long-press-active' : ''}`} key={recipe.id} onPointerDown={event => startRecipeHold(event, recipe)} onPointerMove={moveRecipeHold} onPointerUp={endRecipeHold} onPointerCancel={cancelRecipeHold} onContextMenu={event => event.preventDefault()}>
          <button className="recipe-card-open" onClick={event => { if (suppressRecipeClickRef.current) { event.preventDefault(); suppressRecipeClickRef.current = false; return; } targetDay !== null ? addMeal(recipe, targetDay) : openRecipe(recipe); }}><div className="recipe-art recipe-art-solid" style={{ background: recipe.color }}>{recipe.imageUrl && <img draggable="false" src={recipe.imageUrl} alt={`Foto von ${recipe.name}`} />}<em>{recipe.time}</em></div><div className="recipe-copy"><h3>{recipe.name}</h3><p>{recipe.ingredients.length} Zutaten</p></div></button>
        </article>) : <div className="empty">Keine passenden Rezepte gefunden.</div>}</div>
      </section>}

      {view === 'inspiration' && <section className="view visible inspiration-view"><InspirationGrid recipes={recipes} onSelect={openRecipe} /></section>}

      {view === 'shopping' && <section className="panel full-list">
        <div className="sectionhead"><h2>Aktueller Wocheneinkauf</h2><span className="count">{currentWeekItems.filter(item => item.done).length} / {currentWeekItems.length}</span></div>
        <div className="progress"><i style={{ width: `${currentWeekItems.length ? currentWeekItems.filter(item => item.done).length / currentWeekItems.length * 100 : 0}%` }} /></div>
        {currentWeekItems.length ? [...new Set(currentWeekItems.map(item => item.cat || 'Sonstiges'))].map(category => <div key={category}>
          <div className="cat">{category}</div>{currentWeekItems.map((item, index) => item.cat === category || (!item.cat && category === 'Sonstiges') ? <label className={`item ${item.done ? 'done' : ''}`} key={`${item.key || item.name}-${index}`}>
            <input type="checkbox" checked={item.done} onChange={() => toggleItem(index)} /><span>{item.name}</span><span className="qty">{item.qty || ''}</span>
          </label> : null)}
        </div>) : <div className="empty">Noch keine Einkäufe. Geplante Rezepte ergänzen ihre Zutaten automatisch.</div>}
        <form className="additem" onSubmit={addShoppingItem}><input aria-label="Zutat hinzufügen" value={newItem} onChange={event => setNewItem(event.target.value)} placeholder="Noch etwas hinzufügen …" /><button type="submit" aria-label="Zutat hinzufügen">＋</button></form>
      </section>}
    </main>
    <nav className="mobile-nav" onPointerMove={handleDockPointerMove} onPointerLeave={resetDockPointer}>{(['plan', 'recipes', 'inspiration', 'shopping'] as const).map((id, index) => <button key={id} data-view={id} className={`mobile-nav-item${view === id ? ' active' : ''}`} onClick={() => { setView(id); setTargetDay(null); }}><b className="dock-icon"><NavIcon view={id} /></b>{['Woche', 'Kochbuch', 'Inspiration', 'Liste'][index]}</button>)}</nav>

    {scheduleNotice && <div className="schedule-toast" role="status" aria-live="polite"><span className="schedule-toast-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4.2 4.2L19 6.5" /></svg></span><span>{scheduleNotice}</span></div>}

    {dragRecipe && weekRadialCenter && <div className="week-radial-backdrop" onClick={closeDragSheet}>
      <section className="week-radial" style={weekRadialCenter} role="dialog" aria-modal="true" aria-label={`Wochentag für ${dragRecipe.name} auswählen`} onClick={event => event.stopPropagation()}>
        {dayNames.map((day, index) => {
          const abbreviations = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
          const dayHasRecipe = (plans[localDateKey(weekDate(index))] || []).some(id => recipes.some(recipe => recipe.id === id));
          return <button type="button" className={`week-radial-day${dayHasRecipe ? ' has-recipe' : ''}${dragDay === index ? ' is-selected' : ''}`} data-day-label={day} data-drop-day={index} key={day} aria-label={`${day}, ${dateText(weekDate(index))}${dayHasRecipe ? ', Rezept eingeplant' : ''}`} title={`${day}, ${dateText(weekDate(index))}`} onClick={() => addMeal(dragRecipe, index)}>{abbreviations[index]}</button>;
        })}
      </section>
    </div>}

    {dayMenuIndex !== null && dayMenuCenter && <div className="week-radial-backdrop day-action-backdrop" onClick={closeDayMenu}>
      <section className="week-radial day-action-radial" style={dayMenuCenter} role="dialog" aria-modal="true" aria-label={`Aktionen für ${dayNames[dayMenuIndex]}`} onClick={event => event.stopPropagation()}>
        <button type="button" data-day-action="random" data-day-label="Zufällig" className={`week-radial-day day-action-option${dayActionHover ? ' is-selected' : ''}`} aria-label={`Zufälliges Gericht für ${dayNames[dayMenuIndex]}`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 3.5h13l2.5 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-12l2.5-4Z"/><path d="M3.5 7.5h17M10 5.5h4"/><circle cx="7.5" cy="16.5" r=".8" fill="currentColor"/><circle cx="12" cy="12" r=".8" fill="currentColor"/><circle cx="16.5" cy="9.5" r=".8" fill="currentColor"/><circle cx="16.5" cy="15.5" r=".8" fill="currentColor"/></svg></button>
      </section>
    </div>}

    {modalMode && <div className={`modalback open${modalMode === 'new' || modalMode === 'edit' ? ' editor-modal-backdrop' : ''}`} onClick={() => setModalMode(null)}><section className={`modal${modalMode === 'new' || modalMode === 'edit' ? ' editor-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby={modalMode === 'new' || modalMode === 'edit' ? 'recipe-editor-title' : 'recipe-detail-title'} onClick={event => event.stopPropagation()}><div className="modal-scroll-area">
      {modalMode === 'view' && activeRecipe && <>
        <div className="modalhead"><span className="eyebrow">{activeRecipe.time} · {activeRecipe.ingredients.length} Zutaten</span><div className="modal-actions"><button className="recipe-edit-icon detail-icon-button" aria-label="Rezept bearbeiten" onClick={() => openEditRecipe(activeRecipe)}><PencilIcon /></button><button className="detail-icon-button" onClick={() => setModalMode(null)} aria-label="Schließen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div></div>
        {activeRecipe.imageUrl && <img className="recipe-detail-image" src={activeRecipe.imageUrl} alt={`Foto von ${activeRecipe.name}`} />}
        <h2 id="recipe-detail-title">{activeRecipe.name}</h2><h3>Zutaten</h3>
        {activeRecipe.ingredients.map(([name, amount]) => <div className="ingredient" key={`${name}-${amount}`}>{name}<span>{amount}</span></div>)}
        <button className="primary" onClick={() => openDayPicker(activeRecipe)}>＋ In den Wochenplan</button>
      </>}
      {(modalMode === 'new' || modalMode === 'edit') && <>
        <div className="modalhead"><span id="recipe-editor-title" className="visually-hidden">Rezept</span><button onClick={() => setModalMode(null)} aria-label="Schließen">×</button></div>
        <form className="recipe-form" onSubmit={saveRecipe}>
          <label className="recipe-name-field"><span className="visually-hidden">Rezeptname</span><input className="search recipe-name-input" required value={formName} onChange={event => setFormName(event.target.value)} placeholder="Rezeptname" aria-label="Rezeptname" /></label>
          <label className="eyebrow">REZEPTFOTO<div className={`recipe-photo-frame${imagePreview ? ' has-image' : ''}`}>{imagePreview && <img className="recipe-image-preview" src={imagePreview} alt="Vorschau des Rezeptfotos" />}<span className="recipe-photo-control"><input className="recipe-photo-input" type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) { setDataError('Bitte wähle eine Bilddatei.'); return; } if (file.size > 8 * 1024 * 1024) { setDataError('Das Bild darf höchstens 8 MB groß sein.'); return; } setFormImage(file); setImagePreview(URL.createObjectURL(file)); }} /><span className="recipe-photo-button"><PhotoIcon />Foto auswählen</span></span></div></label>
          <fieldset className="time-slider-field"><legend className="eyebrow">ZUBEREITUNGSZEIT</legend><output className="time-slider-value" aria-live="polite">{(['schnell', 'mittel', 'lang'] as const)[formTimeLevel]}</output><div className={`adaptive-time-slider level-${formTimeLevel}`}><div className="time-slider-dots" aria-hidden="true"><i /><i /><i /></div><input aria-label="Zubereitungszeit" type="range" min="0" max="2" step="1" value={formTimeLevel} onChange={event => setFormTimeLevel(Number(event.target.value))} /><span className="time-slider-thumb" aria-hidden="true" /></div><div className="time-slider-labels" aria-hidden="true"><span>schnell</span><span>mittel</span><span>lang</span></div></fieldset>
          <div className="eyebrow">ZUTATEN</div>
          <div className="ingredient-edit-list">{formIngredients.map(([name, amount], index) => <div className="ingredient-edit-row" key={index}>
            <input className="ingredient-name" aria-label="Zutat" placeholder="Zutat" value={name} onChange={event => setFormIngredients(previous => previous.map((row, i) => i === index ? [event.target.value, row[1]] : row))} />
            <input className="ingredient-quantity" aria-label="Menge" placeholder="Menge" value={amount} onChange={event => setFormIngredients(previous => previous.map((row, i) => i === index ? [row[0], event.target.value] : row))} />
            <button type="button" aria-label="Zutat entfernen" onClick={() => setFormIngredients(previous => previous.filter((_, i) => i !== index))}>×</button>
          </div>)}</div>
          <button type="button" className="add-ingredient" onClick={() => setFormIngredients(previous => [...previous, ['', '']])}>＋ Zutat hinzufügen</button>
          <button className="primary" type="submit" disabled={recipeSaving}>{recipeSaving ? 'Wird gespeichert …' : modalMode === 'new' ? 'Rezept speichern' : 'Änderungen speichern'}</button>
          {modalMode === 'edit' && activeRecipe && <button type="button" className="delete-recipe" onClick={() => deleteRecipe(activeRecipe)}>Rezept löschen</button>}
        </form>
      </>}
    </div></section></div>}
    {dayPickerRecipe && <div className="day-picker-backdrop open" onClick={() => setDayPickerRecipe(null)}><section className="day-picker" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}>
      <div className="day-picker-head"><h2>Zu welchem Tag hinzufügen?</h2><button aria-label="Schließen" onClick={() => setDayPickerRecipe(null)}>×</button></div>
      <div className="day-picker-list">{dayNames.map((day, index) => <button className="day-choice" key={day} onClick={() => addMeal(dayPickerRecipe, index)}>{day}<span>{dateText(weekDate(index))}</span></button>)}</div>
    </section></div>}
  </div>;
}
