// First-run setup guide (/welcome, then /setup/*), page tips and personal settings (timezone, NCLC target).
// Everything is stored in the settings table.
import { cache } from 'react';
import { targetFor, type Target } from './scale';
import { get, set } from './settings';

export { targetFor, type Target };

export type Step = 'claude' | 'openai' | 'start' | 'done';
export const STEPS: Step[] = ['claude', 'openai', 'start', 'done'];
export const nextStep = (s: Step): Step => STEPS[Math.min(STEPS.indexOf(s) + 1, STEPS.length - 1)];

export type Onboarding = { step: Step; tipsDismissed: string[]; timezone: string | undefined; target: Target };

export async function readOnboarding(): Promise<Onboarding> {
  const [step, tips, timezone, target] = await Promise.all([get('onboarding_step'), get('tips_dismissed'), get('timezone'), get('nclc_target')]);
  return {
    step: STEPS.includes(step as Step) ? (step as Step) : 'claude',
    tipsDismissed: tips ? JSON.parse(tips) : [],
    timezone: timezone || undefined,
    target: targetFor(Number(target) || 7),
  };
}

/** Once per request: the layout and the page share it. */
export const getOnboarding = cache(readOnboarding);

/** Finishing a page of the guide moves to the next step; reopening an earlier page never moves back. */
export async function advance(from: Step) {
  const { step } = await readOnboarding();
  if (STEPS.indexOf(from) >= STEPS.indexOf(step)) await set('onboarding_step', nextStep(from));
}

export const tipVisible = (o: Onboarding, id: string) => !o.tipsDismissed.includes('*') && !o.tipsDismissed.includes(id);

export async function dismissTip(id: string) {
  const { tipsDismissed } = await readOnboarding();
  if (!tipsDismissed.includes(id)) await set('tips_dismissed', JSON.stringify([...tipsDismissed, id]));
}
export const resetTips = () => set('tips_dismissed', '[]');

export async function setTarget(nclc: number) {
  if (!Number.isInteger(nclc) || nclc < 4 || nclc > 10) throw new Error('The NCLC target must be between 4 and 10.');
  await set('nclc_target', String(nclc));
}

export async function setTimezone(tz: string) {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz }); } catch { throw new Error(`Unknown timezone: ${tz}`); }
  await set('timezone', tz);
}
