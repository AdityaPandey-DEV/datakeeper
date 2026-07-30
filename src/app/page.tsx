import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import { LandingPage } from '@/components/LandingPage';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const cookieStore = await cookies();
  const secretCode = cookieStore.get('secret_code')?.value;

  if (session?.user?.email) {
    redirect(`/browse/${session.user.email}`);
  } else if (secretCode) {
    redirect(`/browse/${secretCode}`);
  }

  return <LandingPage />;
}
