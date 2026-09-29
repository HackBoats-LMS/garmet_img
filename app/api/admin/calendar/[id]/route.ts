import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// PATCH /api/admin/calendar/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        title: body.title ?? undefined,
        eventType: body.eventType ?? undefined,
        eventDate: body.eventDate ? new Date(body.eventDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        description: body.description ?? undefined,
        suggestedCategories: body.suggestedCategories ?? undefined,
        suggestedOccasion: body.suggestedOccasion ?? undefined,
        messagingTheme: body.messagingTheme ?? undefined,
        messagingNotes: body.messagingNotes ?? undefined,
        isRecurring: body.isRecurring ?? undefined,
        recurrenceRule: body.recurrenceRule ?? undefined,
        isActive: body.isActive ?? undefined,
      },
    });

    return NextResponse.json({ event });
  } catch (error: any) {
    console.error('[Calendar PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/calendar/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await prisma.calendarEvent.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
