export type Metric = 'food' | 'activity' | 'water' | 'steps' | 'sleep' | 'weight';

export interface DayData {
  food: number;
  protein: number;
  fat: number;
  carbs: number;
  activity: number;
  water: number;
  steps: number;
  training: number;
  sleep: number;
  weight: number | null;
}

export const demoDay = 17;
export const waterInMl = (litres: number): number => Math.round(litres * 1000);
// User-selected demo baseline; independent of the selected day's measurement.
export const weightStart = 60;
export function weightProgress(current: number | null, start: number, goal: number): { level: number; progress: number } | null {
  if (current === null || ![current, start, goal].every(Number.isFinite)) return null;
  if (start === goal) return current === goal ? { level: 1, progress: 1 } : null;
  const clamp = (value: number): number => Math.max(0, Math.min(1, value));
  return {
    level: clamp((current - Math.min(start, goal)) / Math.abs(goal - start)),
    progress: clamp((current - start) / (goal - start)),
  };
}
export const targets = { food: 1800, protein: 93, fat: 48, carbs: 48, activity: 427, water: 2, steps: 10000, sleep: 510, weight: 65 } as const;
export const demoData: DayData = { food: 1235, protein: 12, fat: 9, carbs: 9, activity: 269, water: 0.8, steps: 5301, training: 18, sleep: 378, weight: 60.2 };
export const emptyData: DayData = { food: 0, protein: 0, fat: 0, carbs: 0, activity: 0, water: 0, steps: 0, training: 0, sleep: 0, weight: null };

export type Focus = Exclude<Metric, 'weight'>;
export type DailyFocuses = readonly [Focus, Focus, Focus];
export const focusLabels: Record<Focus, string> = { food: 'питание', activity: 'активность', water: 'вода', steps: 'шаги', sleep: 'сон' };

interface DayRecord {
  data: DayData;
  focuses: DailyFocuses;
  completedFocuses: readonly Focus[];
}

// User-approved fixtures for the calendar's one/two/three completed-focus states.
// Nutrition completion is an explicit outcome of the agreed range, not "eat more".
const completedFood = { food: 1800, protein: 93, fat: 48, carbs: 249 };
const completedActivity = { activity: 427, steps: 8700, training: 30 };
const dayRecords: Partial<Record<number, DayRecord>> = {
  13: { data: { food: 1450, protein: 80, fat: 50, carbs: 170, activity: 180, steps: 6200, training: 12, water: 2, sleep: 390, weight: 60.5 }, focuses: ['water', 'steps', 'sleep'], completedFocuses: ['water'] },
  14: { data: { ...emptyData, ...completedFood, ...completedActivity, water: 1.2, sleep: 405, weight: 60.4 }, focuses: ['food', 'activity', 'water'], completedFocuses: ['food', 'activity'] },
  15: { data: { ...emptyData, ...completedFood, activity: 310, steps: 7600, training: 20, water: 2, sleep: 510, weight: 60.3 }, focuses: ['food', 'water', 'sleep'], completedFocuses: ['food', 'water', 'sleep'] },
  16: { data: { food: 1650, protein: 85, fat: 50, carbs: 215, activity: 427, steps: 7200, training: 30, water: 1.6, sleep: 420, weight: 60.2 }, focuses: ['activity', 'steps', 'sleep'], completedFocuses: ['activity'] },
  [demoDay]: { data: demoData, focuses: ['food', 'activity', 'water'], completedFocuses: [] },
};

export const dayRecord = (day: number): DayRecord | undefined => dayRecords[day];
export const focusesFor = (day: number): DailyFocuses => dayRecords[day]?.focuses ?? (day === 18 ? ['water', 'steps', 'sleep'] : ['food', 'activity', 'sleep']);
export const focusProgressFor = (day: number, focus: Focus): number => Math.min(1, Math.max(0, (dayRecords[day]?.data[focus] ?? 0) / targets[focus]));
export const completedFocuses = (day: number): Focus[] =>
  focusesFor(day).filter(focus => day <= demoDay && dayRecords[day]?.completedFocuses.includes(focus));

// The supplied mockup's weekday labels are retained intentionally.
export const days = [
  { day: 13, label: 'пн' }, { day: 14, label: 'вт' }, { day: 15, label: 'ср' },
  { day: 16, label: 'чт' }, { day: 17, label: 'пт' }, { day: 18, label: 'сб' }, { day: 19, label: 'вс' },
] as const;

export const percent = (value: number, target: number): number => Math.round(value / target * 100);
export const number = (value: number): string => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value);
