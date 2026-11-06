import { redirect } from 'next/navigation';
import { isAuthed } from '@/lib/auth';
import { dbProblem } from '@/lib/db';
import { passwordConfigured } from '@/lib/settings';
import { LoginForm } from './LoginForm';

export default async function Login() {
  const problem = await dbProblem();
  if (problem) redirect('/');
  if (await isAuthed()) redirect('/');
  if (!(await passwordConfigured())) redirect('/welcome');
  return <LoginForm create={false} />;
}
