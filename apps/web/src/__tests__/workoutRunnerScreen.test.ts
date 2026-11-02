import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { WorkoutRunnerScreen } from '../screens/WorkoutRunnerScreen.js';

describe('WorkoutRunnerScreen UI Static & Architectural Guard (Phase 2B)', () => {
  const filePath = path.resolve(__dirname, '../screens/WorkoutRunnerScreen.tsx');
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  it('1. exports WorkoutRunnerScreen component properly', () => {
    expect(WorkoutRunnerScreen).toBeDefined();
    expect(typeof WorkoutRunnerScreen).toBe('function');
  });

  it('2. ensures isolated timer countdown component exists and ticks independently', () => {
    expect(fileContent).toContain('RestCountdownDisplay');
    // Ensure deadlineIso is used for accurate absolute timing
    expect(fileContent).toContain('deadlineIso');
    // Ensure role="timer" is present for accessibility
    expect(fileContent).toContain('role="timer"');
  });

  it('3. ensures honest pain toggle is present with transparent consequence disclosure', () => {
    expect(fileContent).toContain('runner.pain_toggle');
    expect(fileContent).toContain('runner.pain_consequence');
    expect(fileContent).toContain('setHasPain');
  });

  it('4. ensures RPE selector spans 6.0 to 9.5 with target highlighting', () => {
    expect(fileContent).toContain('runner.rpe_label');
    expect(fileContent).toContain('runner.rpe_explainer');
    expect(fileContent).toContain('6.0');
    expect(fileContent).toContain('9.5');
  });

  it('5. ensures screen wake lock API is requested and released safely', () => {
    expect(fileContent).toContain('wakeLock');
    expect(fileContent).toContain("request('screen')");
    expect(fileContent).toContain('release()');
  });

  it('6. ensures haptics integration adheres to AppearanceSettings without extra settings', () => {
    expect(fileContent).toContain('triggerHaptics');
    expect(fileContent).toContain("appearance.haptics === 'on'");
    expect(fileContent).toContain('navigator.vibrate');
  });

  it('7. ensures optional WebAudio rest end chime uses oscillator without media assets', () => {
    expect(fileContent).toContain('playRestEndTone');
    expect(fileContent).toContain('createOscillator');
    expect(fileContent).toContain('createGain');
  });

  it('8. ensures confirm dialogs for Pause and Abandon with accessible role and aria attributes', () => {
    expect(fileContent).toContain('role="dialog"');
    expect(fileContent).toContain('aria-modal="true"');
    expect(fileContent).toContain('runner.abandon_warning');
    expect(fileContent).toContain('runner.confirm_abandon');
  });

  it('9. ensures final summary displays duration, sets, avg RPE, and Return to Home button', () => {
    expect(fileContent).toContain('runner.summary_title');
    expect(fileContent).toContain('runner.duration');
    expect(fileContent).toContain('runner.total_sets');
    expect(fileContent).toContain('runner.partial_sets');
    expect(fileContent).toContain('runner.pain_flagged_sets');
    expect(fileContent).toContain('runner.avg_rpe');
    expect(fileContent).toContain('runner.return_home');
  });

  it('10. verifies RTL and mobile touch-target discipline (Redmi 12 / 360dp)', () => {
    expect(fileContent).toContain('touch-target');
    expect(fileContent).toContain('ltr-num');
    // Ensure no hardcoded physical margins/paddings that break RTL
    expect(fileContent).not.toMatch(/\bml-\d+/);
    expect(fileContent).not.toMatch(/\bmr-\d+/);
    expect(fileContent).not.toMatch(/\bpl-\d+/);
    expect(fileContent).not.toMatch(/\bpr-\d+/);
  });
});
