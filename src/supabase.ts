import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && publishableKey
  ? createClient(url, publishableKey)
  : null;

export type SharedAppData = {
  recipes: unknown[];
  plans: Record<string, number[]>;
  blockedDays?: string[];
  items: { name: string; done: boolean; key?: string; auto?: boolean; qty?: string; cat?: string }[];
};
