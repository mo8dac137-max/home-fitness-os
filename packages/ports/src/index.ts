export const PACKAGE_NAME = '@hfos/ports';

export interface Clock {
  now(): Date;
  nowIso(): string;
  nowTimestamp(): number;
}

export interface IdGenerator {
  generateId(): string;
}
