import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { email, name } = await req.json();

    // Prevent changing self if it removes admin access or email
    if (id === (session?.user as any)?.id && !email) {
      return NextResponse.json({ error: 'Cannot remove your own email' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(email && { email }),
        ...(name !== undefined && { name }),
      },
      select: { id: true, email: true, name: true, createdAt: true }
    });

    return NextResponse.json({ admin: updatedUser });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Prevent removing yourself
    if (id === (session?.user as any)?.id) {
      return NextResponse.json({ error: 'Cannot remove your own admin access' }, { status: 400 });
    }

    // Downgrade to customer instead of deleting the user to preserve order history if any
    await prisma.user.update({
      where: { id },
      data: { role: 'customer' },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
