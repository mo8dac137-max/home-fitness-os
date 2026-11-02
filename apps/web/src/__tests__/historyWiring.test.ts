import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Architectural guard (Phase "history wiring"): Home/Progress history must be
 * derived from the append-only event log through historyService and handed to
 * the screens from App — not re-derived ad hoc inside components, and not
 * reverted to static mock values.
 */
describe('History Wiring Guard', () => {
  const read = (rel: string): string =>
    fs.readFileSync(path.resolve(__dirname, rel), 'utf-8');

  it('App derives history via historyService and passes it to both screens', () => {
    const app = read('../App.tsx');
    expect(app).toContain('loadHistorySummary(');
    expect(app).toContain('new IndexedDbEventLog()');
    expect(app).toContain('completedWorkoutsCount={history?.completed_sessions_in_window ?? 0}');
    expect(app).toContain('muscleExposure={history?.muscle_exposure}');
    expect(app).toContain('<ProgressScreen history={history} />');
    // Refresh after a session completes so the UI never shows stale history
    expect(app).toContain('loadHistory();');
  });

  it('ProgressScreen consumes the summary and marks real bars as non-estimate', () => {
    const screen = read('../screens/ProgressScreen.tsx');
    expect(screen).toContain('TrainingHistorySummary');
    expect(screen).toContain('rep_target_hit_rate');
    expect(screen).toContain("t('progress.tracked_locally')");
    expect(screen).toContain('estimate={false}');
    // Honest empty state remains for users with no logged sessions
    expect(screen).toContain("{t('progress.collecting_data')}");
  });

  it('HomeScreen renders consistency and exposure labels through i18n only', () => {
    const screen = read('../screens/HomeScreen.tsx');
    expect(screen).toContain("t('home.consistency_progress')");
    expect(screen).toContain("t('home.sets_unit')");
    expect(screen).toContain("t('home.working_sets_unit')");
    expect(screen).toContain("t('home.exercises_count_unit')");
    expect(screen).toContain("t('home.duration_unit')");
    // No hard-coded English leftovers in the wired areas
    expect(screen).not.toContain('sessions done\n');
    expect(screen).not.toContain('working sets</span>');
    expect(screen).not.toContain('exercises\n');
  });
});
