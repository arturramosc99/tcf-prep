import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { keyStatus, saveKey, testKey, type Provider } from '@/lib/settings';

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json({ anthropic: await keyStatus('anthropic'), openai: await keyStatus('openai') });
}

// { provider, key } saves after testing; { provider, key: null } deletes.
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const { provider, key } = (await req.json()) as { provider: Provider; key: string | null };
  if (provider !== 'anthropic' && provider !== 'openai') return NextResponse.json({ error: 'Unknown provider.' }, { status: 400 });
  if (key) {
    const err = await testKey(provider, key.trim());
    if (err) return NextResponse.json({ error: `The key did not work: ${err}` }, { status: 400 });
  }
  await saveKey(provider, key);
  return NextResponse.json(await keyStatus(provider));
}
