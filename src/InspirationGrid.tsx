import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent, type WheelEvent } from 'react';

export type InspirationRecipe = {
  id: number;
  name: string;
  emoji: string;
  tag: string;
  color: string;
  time: string;
  imageUrl?: string;
  ingredients: [string, string][];
};

type Point = { x: number; y: number };
type Props = { recipes: InspirationRecipe[]; onSelect: (recipe: InspirationRecipe) => void };
type DragStart = { pointerId: number; start: Point; origin: Point; last: Point; lastTime: number; velocity: Point; moved: boolean };

const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;

export default function InspirationGrid({ recipes, onSelect }: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragStart | null>(null);
  const panRef = useRef<Point>({ x: 0, y: 0 });
  const inertiaRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const reduceMotionRef = useRef(false);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [size, setSize] = useState<Point>({ x: 0, y: 0 });
  const [lens, setLens] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const updatePan = (next: Point) => { panRef.current = next; setPan(next); };
  const stopInertia = () => {
    if (inertiaRef.current !== null) cancelAnimationFrame(inertiaRef.current);
    inertiaRef.current = null;
  };

  useEffect(() => {
    const node = surfaceRef.current;
    if (!node) return;
    const measure = () => setSize({ x: node.clientWidth, y: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotionRef.current = query.matches;
    const updateMotionPreference = (event: MediaQueryListEvent) => { reduceMotionRef.current = event.matches; };
    query.addEventListener('change', updateMotionPreference);
    return () => { observer.disconnect(); query.removeEventListener('change', updateMotionPreference); stopInertia(); };
  }, []);

  const tileWidth = (size.x < 560 ? 174 : 224) * zoom;
  const tileHeight = (size.x < 560 ? 208 : 258) * zoom;
  const gap = size.x < 560 ? 10 : 13;
  const strideX = tileWidth + gap;
  const strideY = tileHeight + gap;
  const columns = Math.max(5, Math.ceil(size.x / strideX) + 4);
  const rows = Math.max(5, Math.ceil(size.y / strideY) + 4);
  const centerColumn = Math.floor(columns / 2);
  const centerRow = Math.floor(rows / 2);
  const baseColumn = Math.floor(pan.x / strideX);
  const baseRow = Math.floor(pan.y / strideY);
  const remainderX = pan.x - baseColumn * strideX;
  const remainderY = pan.y - baseRow * strideY;
  const rowStep = recipes.length > 1 ? Array.from({ length: recipes.length }, (_, i) => i + 1).find(step => gcd(step, recipes.length) === 1) || 1 : 1;
  const lensCenter = lens.x || lens.y ? lens : { x: size.x / 2, y: size.y / 2 };

  const tiles = useMemo(() => {
    if (!recipes.length || !size.x || !size.y) return [];
    const result: { recipe: InspirationRecipe; x: number; y: number; scale: number; tiltX: number; tiltY: number; depth: number; key: string }[] = [];
    for (let row = 0; row < rows; row++) {
      const gridRow = row - centerRow;
      for (let column = 0; column < columns; column++) {
        const gridColumn = column - centerColumn;
        const x = gridColumn * strideX - remainderX;
        const y = gridRow * strideY - remainderY;
        const globalRow = gridRow + baseRow;
        const globalColumn = gridColumn + baseColumn;
        const recipeIndex = modulo(globalRow * rowStep + globalColumn, recipes.length);
        const recipe = recipes[recipeIndex];
        const cx = x + tileWidth / 2;
        const cy = y + tileHeight / 2;
        const dx = (cx - lensCenter.x) / Math.max(size.x * 0.58, 1);
        const dy = (cy - lensCenter.y) / Math.max(size.y * 0.58, 1);
        const influence = Math.exp(-(dx * dx + dy * dy) * 2.2);
        const scale = 1 + influence * 0.31;
        const warpedX = lensCenter.x + (cx - lensCenter.x) * (1 + influence * 0.2) - tileWidth / 2;
        const warpedY = lensCenter.y + (cy - lensCenter.y) * (1 + influence * 0.2) - tileHeight / 2;
        result.push({ recipe, x: warpedX, y: warpedY, scale, tiltX: Math.max(-4, Math.min(4, dy * influence * -5)), tiltY: Math.max(-4, Math.min(4, dx * influence * 5)), depth: Math.round(scale * 100), key: `${globalRow}:${globalColumn}:${recipe.id}` });
      }
    }
    return result;
  }, [recipes, size.x, size.y, tileWidth, tileHeight, strideX, strideY, rows, columns, centerRow, centerColumn, baseRow, baseColumn, remainderX, remainderY, rowStep, lensCenter.x, lensCenter.y]);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget === surfaceRef.current && event.target !== event.currentTarget) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    stopInertia();
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (rect) setLens({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    dragRef.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: panRef.current, last: { x: event.clientX, y: event.clientY }, lastTime: performance.now(), velocity: { x: 0, y: 0 }, moved: false };
    setDragging(false);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Keep tap and drag usable where pointer capture is unavailable. */ }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!active || active.pointerId !== event.pointerId) {
      if (rect && event.pointerType !== 'touch') setLens({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      return;
    }
    const dx = event.clientX - active.start.x;
    const dy = event.clientY - active.start.y;
    if (!active.moved && Math.hypot(dx, dy) > 5) { active.moved = true; setDragging(true); }
    if (!active.moved) return;
    event.preventDefault();
    const next = { x: active.origin.x - dx, y: active.origin.y - dy };
    const now = performance.now();
    const elapsed = Math.max(1, now - active.lastTime);
    active.velocity = { x: -(event.clientX - active.last.x) / elapsed, y: -(event.clientY - active.last.y) / elapsed };
    active.last = { x: event.clientX, y: event.clientY };
    active.lastTime = now;
    updatePan(next);
    if (rect) setLens({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  const startInertia = (velocity: Point) => {
    if (reduceMotionRef.current || Math.hypot(velocity.x, velocity.y) < 0.08) return;
    let lastTime = performance.now();
    const step = (now: number) => {
      const elapsed = Math.min(32, now - lastTime);
      lastTime = now;
      const next = { x: panRef.current.x + velocity.x * elapsed, y: panRef.current.y + velocity.y * elapsed };
      updatePan(next);
      const decay = Math.pow(0.92, elapsed / 16);
      velocity = { x: velocity.x * decay, y: velocity.y * decay };
      if (Math.hypot(velocity.x, velocity.y) < 0.012) { inertiaRef.current = null; return; }
      inertiaRef.current = requestAnimationFrame(step);
    };
    inertiaRef.current = requestAnimationFrame(step);
  };

  const finishPointer = (event: PointerEvent<HTMLDivElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (active.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 500);
      startInertia(active.velocity);
    }
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    stopInertia();
    if (event.ctrlKey || event.metaKey) {
      setZoom(current => Math.max(0.65, Math.min(1.65, current * Math.exp(-event.deltaY * 0.004))));
      return;
    }
    updatePan({ x: panRef.current.x + event.deltaX * 0.65, y: panRef.current.y + event.deltaY * 0.65 });
  };


  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const amount = 92;
    const directions: Record<string, Point> = {
      ArrowLeft: { x: -amount, y: 0 }, ArrowRight: { x: amount, y: 0 },
      ArrowUp: { x: 0, y: -amount }, ArrowDown: { x: 0, y: amount },
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault(); stopInertia();
    updatePan({ x: panRef.current.x + direction.x, y: panRef.current.y + direction.y });
  };

  return <div className="inspiration-surface" ref={surfaceRef} tabIndex={0} aria-label="Rezept-Inspiration. Ziehe in beliebige Richtung oder nutze die Pfeiltasten." onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} onWheel={handleWheel} onKeyDown={handleKeyDown} onPointerLeave={() => { if (!dragRef.current) setLens({ x: 0, y: 0 }); }}>
    {!recipes.length ? <div className="inspiration-empty">Füge zuerst Rezepte im Kochbuch hinzu, um hier Inspiration zu entdecken.</div> : <>
      {tiles.map(tile => <button type="button" key={tile.key} className="inspiration-tile" style={{ left: tile.x, top: tile.y, width: tileWidth, height: tileHeight, zIndex: tile.depth, transform: `perspective(850px) rotateX(${tile.tiltX}deg) rotateY(${tile.tiltY}deg) scale(${tile.scale})` }} onPointerDown={handlePointerDown} onClick={event => { if (suppressClickRef.current) { event.preventDefault(); suppressClickRef.current = false; return; } onSelect(tile.recipe); }} aria-label={`${tile.recipe.name} öffnen`}>
        <span className="inspiration-visual" style={{ backgroundColor: tile.recipe.color }}>{tile.recipe.imageUrl ? <img draggable="false" src={tile.recipe.imageUrl} alt="" /> : <span className="inspiration-art-mark" aria-hidden="true"><i/><i/><i/></span>}</span>
        <span className="inspiration-caption"><strong>{tile.recipe.name}</strong></span>
      </button>)}
      <div className={`inspiration-lens ${dragging ? 'is-dragging' : ''}`} aria-hidden="true" />
    </>}
    <div className="inspiration-hint" aria-hidden="true">Ziehen zum Entdecken <span>↕ ↔</span></div>
  </div>;
}
