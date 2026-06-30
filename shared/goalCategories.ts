export type GoalCategory = 'weight_loss' | 'time_based' | 'lift_weight' | 'repetitions' | 'consecutive_days';

export interface GoalCategoryMeta {
  label: string;
  metricUnit: string;
}

export const GOAL_CATEGORIES: Record<GoalCategory, GoalCategoryMeta> = {
  weight_loss: { label: 'Weight management', metricUnit: 'lbs' },
  time_based: { label: 'Time-based (e.g. mile time, plank hold)', metricUnit: 'minutes' },
  lift_weight: { label: 'Lift weight (e.g. bench, squat)', metricUnit: 'lbs' },
  repetitions: { label: 'Repetitions (e.g. pull-ups, push-ups)', metricUnit: 'reps' },
  consecutive_days: { label: 'Consecutive days streak', metricUnit: 'days' },
};

export const GOAL_CATEGORY_OPTIONS: ({ value: GoalCategory } & GoalCategoryMeta)[] = (
  Object.keys(GOAL_CATEGORIES) as GoalCategory[]
).map((value) => ({ value, ...GOAL_CATEGORIES[value] }));
