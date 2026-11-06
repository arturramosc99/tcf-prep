// Status rule for error patterns (no database dependency, safe on the client).
export type Status = 'critique' | 'actif' | 'observation' | 'controle' | 'resolu';

export const STATUS_LABEL: Record<Status, string> = {
  critique: 'Critical',
  actif: 'Active',
  observation: 'Watching',
  controle: 'Under control',
  resolu: 'Resolved',
};

export const STATUS_HELP: Record<Status, string> = {
  critique: '2+ occurrences in the last 3 sessions',
  actif: 'appeared in the last session',
  observation: 'appeared recently, not enough history yet to say it is gone',
  controle: 'frequent in the past, absent from the last 3 sessions',
  resolu: 'absent from the last 6 sessions',
};

export const ORDER: Status[] = ['critique', 'actif', 'observation', 'controle', 'resolu'];

export function statusOf(occSessions: number[], sessionsDesc: number[]): Status {
  const total = occSessions.length;
  const inWin = (n: number) => occSessions.filter((s) => sessionsDesc.slice(0, n).includes(s)).length;
  const last3 = inWin(3);
  if (last3 >= 2) return 'critique';
  if (sessionsDesc.length && occSessions.includes(sessionsDesc[0])) return 'actif';
  if (total > 0 && inWin(6) === 0 && sessionsDesc.length >= 6) return 'resolu';
  if (last3 === 0 && total >= 3) return 'controle';
  return 'observation';
}

