import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/admin/calendar — list events
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const month = searchParams.get('month'); // "2026-09"
    const type = searchParams.get('type') || '';

    const where: any = { isActive: true };
    if (type) where.eventType = type;

    if (month) {
      const [year, m] = month.split('-').map(Number);
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 0, 23, 59, 59);
      where.eventDate = { gte: start, lte: end };
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: { eventDate: 'asc' },
    });

    return NextResponse.json({ events });
  } catch (error: any) {
    console.error('[Calendar GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/calendar — create event
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      title, eventType, eventDate, endDate, description,
      suggestedCategories, suggestedOccasion,
      messagingTheme, messagingNotes,
      isRecurring, recurrenceRule,
    } = body;

    if (!title || !eventDate) {
      return NextResponse.json({ error: 'title and eventDate are required' }, { status: 400 });
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title,
        eventType: eventType || 'OTHER',
        eventDate: new Date(eventDate),
        endDate: endDate ? new Date(endDate) : null,
        description: description || null,
        suggestedCategories: suggestedCategories || [],
        suggestedOccasion: suggestedOccasion || null,
        messagingTheme: messagingTheme || null,
        messagingNotes: messagingNotes || null,
        isRecurring: isRecurring || false,
        recurrenceRule: recurrenceRule || null,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error: any) {
    console.error('[Calendar POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
