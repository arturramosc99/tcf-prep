import { NextResponse } from 'next/server';
import { guard } from '@/lib/auth';
import { apiKey, openaiBase } from '@/lib/settings';
import { examinerInstructions, type TacheEO, type TopicsEO } from '@/lib/eo';

// Turn-taking per tâche:
// - T1: the server only detects the end of each speech segment (eagerness low, create_response false); the client
//   decides WHEN the examiner replies, after a real silence — see REPLY in app/(app)/oral/Oral.tsx. With automatic
//   replies, a thinking pause ("euh…") triggered the next question. The candidate's speech doesn't cut the examiner off.
// - T2: the examiner replies quickly on its own (eagerness high), like a real conversation; this works well here.
// - T3: the examiner reads the topic and then stays silent; speech is still transcribed.
const TURN_DETECTION: Record<TacheEO, object> = {
  t1: { type: 'semantic_vad', eagerness: 'low', create_response: false, interrupt_response: false },
  t2: { type: 'semantic_vad', eagerness: 'high' },
  t3: { type: 'semantic_vad', eagerness: 'low', create_response: false, interrupt_response: false },
};

// Issues an ephemeral OpenAI Realtime key for one tâche, with the examiner's instructions built in.
export async function POST(req: Request) {
  const denied = await guard();
  if (denied) return denied;
  const { tache, topics } = (await req.json()) as { tache: TacheEO; topics: TopicsEO };
  const key = await apiKey('openai');
  if (!key) return NextResponse.json({ error: 'OpenAI key not configured. Paste your key in Settings.' }, { status: 400 });
  const r = await fetch(`${openaiBase()}/realtime/client_secrets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: process.env.REALTIME_MODEL || 'gpt-realtime-2.1',
        instructions: examinerInstructions(tache, topics),
        audio: {
          input: {
            transcription: { model: 'gpt-4o-transcribe', language: 'fr' },
            turn_detection: TURN_DETECTION[tache],
          },
          output: { voice: process.env.REALTIME_VOICE || 'marin' },
        },
      },
    }),
  });
  const j = await r.json();
  if (!r.ok) return NextResponse.json({ error: `OpenAI: ${j.error?.message || r.status}` }, { status: 502 });
  return NextResponse.json({ value: j.value });
}
