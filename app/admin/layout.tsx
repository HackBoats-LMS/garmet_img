import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ClientLayout from './ClientLayout';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return <ClientLayout>{children}</ClientLayout>;
}
