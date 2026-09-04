/**
 * Polling intervals for TV/tablet views.
 *
 * TODO: When the backend exposes WebSocket or SSE endpoints for real-time
 * alert/task events, replace these polling intervals with event-driven
 * subscriptions. Priority streams: critical alerts and task state changes.
 */
export const TV_REFETCH = {
  /** Critical data: alerts, incidents — fast polling */
  FAST: 15_000,
  /** Operational data: tasks, zone status — normal polling */
  NORMAL: 30_000,
  /** Planning data: shifts, assignments — slower polling */
  SLOW: 60_000,
  /** Background data: weather, quality summary — very slow */
  VERY_SLOW: 5 * 60_000,
  /** Employee/zone catalog — only needs occasional refresh */
  CATALOG: 10 * 60_000,
} as const;

export const TV_STALE = {
  FAST: 10_000,
  NORMAL: 15_000,
  SLOW: 30_000,
  VERY_SLOW: 3 * 60_000,
  CATALOG: 5 * 60_000,
} as const;
