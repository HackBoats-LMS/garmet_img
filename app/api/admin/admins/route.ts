import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true, email: true, name: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ admins });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, name } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      if (existingUser.role === 'admin') {
        return NextResponse.json({ error: 'User is already an admin' }, { status: 400 });
      }
      
      // Upgrade existing user to admin
      const upgradedUser = await prisma.user.update({
        where: { email },
        data: { role: 'admin' },
        select: { id: true, email: true, name: true, createdAt: true }
      });
      return NextResponse.json({ admin: upgradedUser });
    }

    // Create new admin user
    const newAdmin = await prisma.user.create({
      data: {
        email,
        name: name || null,
        role: 'admin',
      },
      select: { id: true, email: true, name: true, createdAt: true }
    });

    return NextResponse.json({ admin: newAdmin });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
