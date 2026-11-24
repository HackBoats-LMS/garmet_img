import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const rateCheck = checkRateLimit('api:auth:signup', ip, { windowMs: 15 * 60 * 1000, max: 15 });
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 });
    }

    const { name, email, phone, password } = await req.json();

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    if (password.length > 128) {
      return NextResponse.json(
        { error: 'Password is too long (maximum 128 characters)' },
        { status: 400 }
      );
    }

    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Email or phone number is required' },
        { status: 400 }
      );
    }

    const cleanEmail = email && typeof email === 'string' ? email.trim().toLowerCase() : undefined;
    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return NextResponse.json({ error: 'Invalid email address format' }, { status: 400 });
      }
    }

    const cleanPhone = phone && typeof phone === 'string' ? phone.trim() : undefined;

    // Check for existing user
    if (cleanEmail) {
      const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existing) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        );
      }
    }

    if (cleanPhone) {
      const existing = await prisma.user.findUnique({ where: { phone: cleanPhone } });
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
        name: name ? String(name).trim() : undefined,
        email: cleanEmail,
        phone: cleanPhone,
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
