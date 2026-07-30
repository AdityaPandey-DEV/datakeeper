import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import { FileBrowser } from '@/components/FileBrowser';
import { LandingPage } from '@/components/LandingPage';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const cookieStore = await cookies();
  const secretCode = cookieStore.get('secret_code')?.value;

  if (session?.user || secretCode) {
    return <FileBrowser initialPath="" />;
  }

  return <LandingPage />;
}
