export type GoalCategory =
  | 'weight_loss'
  | 'time_based'
  | 'lift_weight'
  | 'repetitions'
  | 'consecutive_days'
  | 'lean_mass'
  | 'daily_habit';

export interface GoalCategoryMeta {
  label: string;
  metricUnit: string;
  goalType: 'progressive' | 'daily_habit';
}

export const GOAL_CATEGORIES: Record<GoalCategory, GoalCategoryMeta> = {
  weight_loss: { label: 'Weight management', metricUnit: 'lbs', goalType: 'progressive' },
  time_based: { label: 'Time-based (e.g. mile time, plank hold)', metricUnit: 'minutes', goalType: 'progressive' },
  lift_weight: { label: 'Lift weight (e.g. bench, squat)', metricUnit: 'lbs', goalType: 'progressive' },
  repetitions: { label: 'Repetitions (e.g. pull-ups, push-ups)', metricUnit: 'reps', goalType: 'progressive' },
  consecutive_days: { label: 'Consecutive days streak', metricUnit: 'days', goalType: 'progressive' },
  lean_mass: { label: 'Lean mass', metricUnit: 'lbs', goalType: 'progressive' },
  daily_habit: { label: 'Daily habit (e.g. steps, protein)', metricUnit: 'count', goalType: 'daily_habit' },
};

export const GOAL_CATEGORY_OPTIONS: ({ value: GoalCategory } & GoalCategoryMeta)[] = (
  Object.keys(GOAL_CATEGORIES) as GoalCategory[]
).map((value) => ({ value, ...GOAL_CATEGORIES[value] }));

export function isGoalCategory(value: unknown): value is GoalCategory {
  return typeof value === 'string' && value in GOAL_CATEGORIES;
}
