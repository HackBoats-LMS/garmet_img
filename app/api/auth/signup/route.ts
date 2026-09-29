import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password } = await req.json();

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Email or phone number is required' },
        { status: 400 }
      );
    }

    // Check for existing user
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        );
      }
    }

    if (phone) {
      const existing = await prisma.user.findUnique({ where: { phone } });
      if (existing) {
        return NextResponse.json(
          { error: 'An account with this phone number already exists' },
          { status: 409 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
        passwordHash,
        role: 'customer',
      },
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error: any) {
    console.error('[Signup Error]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}
