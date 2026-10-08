import type { AiRequest, AiResponse } from '@hfos/contracts';

export const PACKAGE_NAME = '@hfos/ports';

export interface Clock {
  now(): Date;
  nowIso(): string;
  nowTimestamp(): number;
}

export interface IdGenerator {
  generateId(): string;
}

export interface AvailabilityWindow {
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
  duration_minutes: number;
  source: string;
}

export interface ScheduleProvider {
  getAvailability(range: { startDate: string; endDate: string }): Promise<AvailabilityWindow[]> | AvailabilityWindow[];
}

export interface UserWeeklyWindow {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  start: string; // HH:mm
  end: string; // HH:mm
  duration_minutes: number;
}

/**
 * In-memory schedule provider built from user-declared weekly windows.
 */
export class LocalScheduleProvider implements ScheduleProvider {
  constructor(
    private weeklyWindows: UserWeeklyWindow[],
    private source: string = 'user_declared'
  ) {}

  public getAvailability(range: { startDate: string; endDate: string }): AvailabilityWindow[] {
    const results: AvailabilityWindow[] = [];
    const start = new Date(`${range.startDate}T00:00:00Z`);
    const end = new Date(`${range.endDate}T00:00:00Z`);

    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      const dayOfWeek = current.getUTCDay();

      const matchingWindows = this.weeklyWindows.filter((w) => w.dayOfWeek === dayOfWeek);
      for (const w of matchingWindows) {
        results.push({
          date: dateStr,
          start: w.start,
          end: w.end,
          duration_minutes: w.duration_minutes,
          source: this.source,
        });
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return results;
  }
}

export interface AiProvider {
  generate(request: AiRequest): Promise<AiResponse>;
}

