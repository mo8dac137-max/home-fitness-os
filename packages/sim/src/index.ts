import type { Clock, IdGenerator, AiProvider } from '@hfos/ports';
import type { AiRequest, AiResponse } from '@hfos/contracts';

export const PACKAGE_NAME = '@hfos/sim';

export interface MockUserProfile {
  id: string;
  codename: string;
  fitness_level: number;
  available_equipment: string[];
  physique_priorities: [string, string]; // max two HIGH
}

export const MOCK_USER: MockUserProfile = {
  id: '018f6c38-89c0-7b56-8a5b-9d48b1bfb91d',
  codename: 'mock_athlete_redmi12',
  fitness_level: 3,
  available_equipment: ['bodyweight'],
  physique_priorities: ['chest', 'back'],
};

export class MockClock implements Clock {
  private currentTime: Date;

  constructor(initialTime: string | Date = '2026-10-06T04:00:00Z') {
    this.currentTime = new Date(initialTime);
  }

  public now(): Date {
    return new Date(this.currentTime);
  }

  public nowIso(): string {
    return this.currentTime.toISOString();
  }

  public nowTimestamp(): number {
    return this.currentTime.getTime();
  }

  public advanceMinutes(minutes: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + minutes * 60 * 1000);
  }

  public advanceDays(days: number): void {
    this.advanceMinutes(days * 24 * 60);
  }
}

export class MockIdGenerator implements IdGenerator {
  private counter: number = 0;

  public generateId(): string {
    this.counter += 1;
    // Format conforming to UUID v7 structure
    const hexCounter = this.counter.toString(16).padStart(12, '0');
    return `018f6c38-89c0-7b56-8a5b-${hexCounter}`;
  }
}

/**
 * Deterministic MockAiProvider for testing and offline simulation.
 */
export class MockAiProvider implements AiProvider {
  constructor(
    private preferredCandidateId?: string,
    private shouldFail: boolean = false
  ) {}

  public async generate(request: AiRequest): Promise<AiResponse> {
    if (this.shouldFail) {
      throw new Error('MockAiProvider intentional error');
    }

    const selectedId =
      this.preferredCandidateId && request.candidates.some((c) => c.id === this.preferredCandidateId)
        ? this.preferredCandidateId
        : request.candidates[0]?.id;

    return {
      selected_candidate_id: selectedId,
      ranking_ids: request.candidates.map((c) => c.id),
      rationale_codes: ['stimulus_need', 'schedule_fit'],
      message_draft: `Selected candidate ${selectedId} based on training schedule and stimulus recovery.`,
      tags: ['mock', 'deterministic'],
    };
  }
}

