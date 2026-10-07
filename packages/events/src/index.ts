export const PACKAGE_NAME = '@hfos/events';

export const EVENT_TYPES = [
  'session.started',
  'session.set_logged',
  'session.interrupted',
  'session.resumed',
  'session.completed',
  'session.abandoned',
  'plan.generated',
  'plan.revised',
  'plan.pinned',
  'plan.unpinned',
  'override.requested',
  'override.accepted',
  'override.accepted_with_warning',
  'override.rejected',
  'readiness.recorded',
  'schedule.changed',
  'environment.updated',
  'setting.change_requested',
  'setting.changed',
  'progression.evaluated',
  'progression.applied',
  'ai.approval.requested',
  'ai.approval.responded',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface EventEnvelope<T = Record<string, unknown>> {
  event_id: string;
  type: EventType | string;
  occurred_at: string;
  device_id: string;
  idempotency_key: string;
  schema_version: number;
  payload: T;
  supersedes_event_id?: string;
}

// ==========================================
// Event Log Interfaces & Implementation
// ==========================================

export interface EventLog {
  append(event: EventEnvelope): Promise<void>;
  getAll(): Promise<EventEnvelope[]>;
  getByType(type: EventType | string): Promise<EventEnvelope[]>;
  getById(id: string): Promise<EventEnvelope | undefined>;
  count(): Promise<number>;
}

export class InMemoryEventLog implements EventLog {
  private events: EventEnvelope[] = [];
  private seenIdempotencyKeys: Set<string> = new Set();

  public async append(event: EventEnvelope): Promise<void> {
    // Duplicate idempotency_key is ignored per brief
    if (this.seenIdempotencyKeys.has(event.idempotency_key)) {
      return;
    }
    this.seenIdempotencyKeys.add(event.idempotency_key);
    this.events.push(event);
  }

  public async getAll(): Promise<EventEnvelope[]> {
    // Ordering: occurred_at, then event_id as tie-breaker
    return [...this.events].sort(compareEvents);
  }

  public async getByType(type: EventType | string): Promise<EventEnvelope[]> {
    const all = await this.getAll();
    return all.filter((e) => e.type === type);
  }

  public async getById(id: string): Promise<EventEnvelope | undefined> {
    return this.events.find((e) => e.event_id === id);
  }

  public async count(): Promise<number> {
    return this.events.length;
  }
}

export function compareEvents(a: EventEnvelope, b: EventEnvelope): number {
  if (a.occurred_at < b.occurred_at) return -1;
  if (a.occurred_at > b.occurred_at) return 1;
  if (a.event_id < b.event_id) return -1;
  if (a.event_id > b.event_id) return 1;
  return 0;
}

// ==========================================
// State and Pure Reducer
// ==========================================

export interface LoggedSet {
  set_number: number;
  reps?: number;
  weight?: number;
  rpe?: number;
  logged_at: string;
}

export interface ActiveSession {
  id: string;
  status: 'active' | 'interrupted' | 'completed' | 'abandoned';
  started_at: string;
  sets: LoggedSet[];
}

export interface CompletedSessionSummary {
  id: string;
  status: 'completed' | 'abandoned';
  started_at: string;
  ended_at: string;
  sets_count: number;
}

export interface ApplicationState {
  active_session: ActiveSession | null;
  session_history: CompletedSessionSummary[];
  plan: {
    id: string;
    version: number;
    is_pinned: boolean;
  } | null;
  readiness_scores: Array<{ score: number; recorded_at: string }>;
  environment_items: Record<string, { status: string; updated_at: string }>;
  settings: Record<string, unknown>;
  overrides: Array<{ id: string; status: string; command: string }>;
  ai_approvals: Array<{ id: string; status: string }>;
  applied_idempotency_keys: string[];
  superseded_event_ids: string[];
  event_history: EventEnvelope[];
}

export function createInitialState(): ApplicationState {
  return {
    active_session: null,
    session_history: [],
    plan: null,
    readiness_scores: [],
    environment_items: {},
    settings: {},
    overrides: [],
    ai_approvals: [],
    applied_idempotency_keys: [],
    superseded_event_ids: [],
    event_history: [],
  };
}

export function reduce(
  state: ApplicationState,
  event: EventEnvelope
): ApplicationState {
  // Idempotency: Duplicate idempotency_key is ignored
  if (state.applied_idempotency_keys.includes(event.idempotency_key)) {
    return state;
  }

  // Handle correction / superseding:
  // If this event supersedes an earlier event, mark it
  let superseded = state.superseded_event_ids;
  if (event.supersedes_event_id && !superseded.includes(event.supersedes_event_id)) {
    superseded = [...superseded, event.supersedes_event_id];
  }

  const nextState: ApplicationState = {
    ...state,
    applied_idempotency_keys: [...state.applied_idempotency_keys, event.idempotency_key],
    superseded_event_ids: superseded,
    event_history: [...state.event_history, event],
  };

  const payload = (event.payload || {}) as Record<string, unknown>;

  switch (event.type) {
    case 'session.started': {
      const sessionId = String(payload.session_id || event.event_id);
      return {
        ...nextState,
        active_session: {
          id: sessionId,
          status: 'active',
          started_at: event.occurred_at,
          sets: [],
        },
      };
    }

    case 'session.set_logged': {
      if (!nextState.active_session) return nextState;
      const setNumber = typeof payload.set_number === 'number' ? payload.set_number : nextState.active_session.sets.length + 1;
      const newSet: LoggedSet = {
        set_number: setNumber,
        reps: typeof payload.reps === 'number' ? payload.reps : undefined,
        weight: typeof payload.weight === 'number' ? payload.weight : undefined,
        rpe: typeof payload.rpe === 'number' ? payload.rpe : undefined,
        logged_at: event.occurred_at,
      };
      return {
        ...nextState,
        active_session: {
          ...nextState.active_session,
          sets: [...nextState.active_session.sets, newSet],
        },
      };
    }

    case 'session.interrupted': {
      if (!nextState.active_session) return nextState;
      return {
        ...nextState,
        active_session: {
          ...nextState.active_session,
          status: 'interrupted',
        },
      };
    }

    case 'session.resumed': {
      if (!nextState.active_session) return nextState;
      return {
        ...nextState,
        active_session: {
          ...nextState.active_session,
          status: 'active',
        },
      };
    }

    case 'session.completed':
    case 'session.abandoned': {
      if (!nextState.active_session) return nextState;
      const summary: CompletedSessionSummary = {
        id: nextState.active_session.id,
        status: event.type === 'session.completed' ? 'completed' : 'abandoned',
        started_at: nextState.active_session.started_at,
        ended_at: event.occurred_at,
        sets_count: nextState.active_session.sets.length,
      };
      return {
        ...nextState,
        active_session: null,
        session_history: [...nextState.session_history, summary],
      };
    }

    case 'plan.generated': {
      return {
        ...nextState,
        plan: {
          id: String(payload.plan_id || event.event_id),
          version: 1,
          is_pinned: false,
        },
      };
    }

    case 'plan.revised': {
      if (!nextState.plan) return nextState;
      return {
        ...nextState,
        plan: {
          ...nextState.plan,
          version: nextState.plan.version + 1,
        },
      };
    }

    case 'plan.pinned': {
      if (!nextState.plan) return nextState;
      return {
        ...nextState,
        plan: {
          ...nextState.plan,
          is_pinned: true,
        },
      };
    }

    case 'plan.unpinned': {
      if (!nextState.plan) return nextState;
      return {
        ...nextState,
        plan: {
          ...nextState.plan,
          is_pinned: false,
        },
      };
    }

    case 'override.requested': {
      return {
        ...nextState,
        overrides: [
          ...nextState.overrides,
          {
            id: String(payload.override_id || event.event_id),
            status: 'pending',
            command: String(payload.command || 'unknown'),
          },
        ],
      };
    }

    case 'override.accepted':
    case 'override.accepted_with_warning':
    case 'override.rejected': {
      const overrideId = String(payload.override_id || '');
      const newStatus =
        event.type === 'override.accepted'
          ? 'accepted'
          : event.type === 'override.accepted_with_warning'
          ? 'accepted_with_warning'
          : 'rejected';
      return {
        ...nextState,
        overrides: nextState.overrides.map((o) =>
          o.id === overrideId ? { ...o, status: newStatus } : o
        ),
      };
    }

    case 'readiness.recorded': {
      const score = typeof payload.score === 'number' ? payload.score : 0;
      return {
        ...nextState,
        readiness_scores: [
          ...nextState.readiness_scores,
          { score, recorded_at: event.occurred_at },
        ],
      };
    }

    case 'environment.updated': {
      const itemId = String(payload.item_id || 'unknown');
      const status = String(payload.status || 'unknown');
      return {
        ...nextState,
        environment_items: {
          ...nextState.environment_items,
          [itemId]: { status, updated_at: event.occurred_at },
        },
      };
    }

    case 'setting.changed': {
      const key = String(payload.key || '');
      if (!key) return nextState;
      return {
        ...nextState,
        settings: {
          ...nextState.settings,
          [key]: payload.value,
        },
      };
    }

    case 'ai.approval.requested': {
      return {
        ...nextState,
        ai_approvals: [
          ...nextState.ai_approvals,
          { id: String(payload.approval_id || event.event_id), status: 'requested' },
        ],
      };
    }

    case 'ai.approval.responded': {
      const approvalId = String(payload.approval_id || '');
      return {
        ...nextState,
        ai_approvals: nextState.ai_approvals.map((a) =>
          a.id === approvalId ? { ...a, status: 'responded' } : a
        ),
      };
    }

    default:
      return nextState;
  }
}

/**
 * Replays an array of events to compute the current state.
 * Events are sorted deterministically (occurred_at then event_id).
 * Events superseded by later correction events are bypassed during state calculation,
 * while the append-only event_history retains the original trace.
 */
export function replay(
  events: EventEnvelope[],
  initialState: ApplicationState = createInitialState()
): ApplicationState {
  const sorted = [...events].sort(compareEvents);

  // Discover all superseded event IDs across the entire stream
  const supersededIds = new Set<string>();
  for (const ev of sorted) {
    if (ev.supersedes_event_id) {
      supersededIds.add(ev.supersedes_event_id);
    }
  }

  let currentState = { ...initialState };
  for (const ev of sorted) {
    // If this event was superseded by a later correction, skip its state mutation
    if (supersededIds.has(ev.event_id)) {
      // Record in event_history and superseded list without applying payload mutations
      currentState = {
        ...currentState,
        applied_idempotency_keys: [
          ...currentState.applied_idempotency_keys,
          ev.idempotency_key,
        ],
        superseded_event_ids: Array.from(
          new Set([...currentState.superseded_event_ids, ev.event_id])
        ),
        event_history: [...currentState.event_history, ev],
      };
      continue;
    }
    currentState = reduce(currentState, ev);
  }

  return currentState;
}
