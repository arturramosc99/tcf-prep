import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { advance, dismissTip, readOnboarding, resetTips, setTarget, setTimezone, STEPS, type Step } from '@/lib/onboarding';

/** Setup guide and preferences: { advance: step } | { dismissTip: id } | { resetTips: true } | { timezone } | { target } */
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as { advance?: Step; dismissTip?: string; resetTips?: boolean; timezone?: string; target?: number };
  try {
    if (b.advance !== undefined) {
      if (!STEPS.includes(b.advance)) return NextResponse.json({ error: 'Unknown step.' }, { status: 400 });
      await advance(b.advance);
    }
    if (typeof b.dismissTip === 'string' && /^[a-z-]{1,30}$/.test(b.dismissTip)) await dismissTip(b.dismissTip);
    if (b.resetTips) await resetTips();
    if (b.timezone !== undefined) await setTimezone(String(b.timezone));
    if (b.target !== undefined) await setTarget(Number(b.target));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  return NextResponse.json(await readOnboarding());
}
