import type { AppState } from './types';

// Same order as the prototype's BASE list: the order decides each category's colour.
export const BASE_CATEGORIES = [
  'Groceries',
  'Food',
  'Coffee',
  'Clothes',
  'Shoes',
  'Gym',
  'Transportation',
  'Bills',
  'Rent',
  'Nights out',
  'Gaming',
  'Other',
] as const;

/** Needs, not wants (prototype NEC). */
export const NEEDS = ['Groceries', 'Food', 'Transportation', 'Bills', 'Rent', 'Gym', 'Subscription'];

export const INCOME_TYPES = ['Salary', 'Gift'] as const;

export const CATEGORY_COLORS = ['#ffab3d', '#5aa9f0', '#9b4dff', '#ff7eb6', '#22e07a', '#ff6b6b', '#4fd1c5', '#f5d547'];

export function allCategories(s: Pick<AppState, 'cats'>): string[] {
  return [...BASE_CATEGORIES, ...s.cats];
}

export function categoryColor(s: Pick<AppState, 'cats'>, cat: string): string {
  const i = allCategories(s).indexOf(cat);
  return CATEGORY_COLORS[(i < 0 ? 0 : i) % CATEGORY_COLORS.length];
}

export function isNeed(cat: string): boolean {
  return NEEDS.includes(cat);
}
