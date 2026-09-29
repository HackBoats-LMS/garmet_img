'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Calendar, Plus, ChevronLeft, ChevronRight, X, Save,
  Sparkles, MapPin, Tag, RefreshCw, Trash2, Edit2,
  PartyPopper, GraduationCap, Star, Heart, Cake,
  Briefcase, Flame, Users, Gift, AlertCircle
} from 'lucide-react';

// ─── TYPES ───

type EventType =
  | 'KITTY_PARTY' | 'PARENT_TEACHER_MEET' | 'FESTIVAL' | 'WEDDING'
  | 'BIRTHDAY' | 'ANNIVERSARY' | 'OFFICE_EVENT' | 'PUJA_CEREMONY'
  | 'FAMILY_FUNCTION' | 'OTHER';

interface CalendarEvent {
  id: string;
  title: string;
  eventType: EventType;
  eventDate: string;
  endDate?: string;
  description?: string;
  suggestedCategories: string[];
  suggestedOccasion?: string;
  messagingTheme?: string;
  messagingNotes?: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  isActive: boolean;
}

// ─── CONFIG ───

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; icon: any; color: string; bg: string; border: string }> = {
  KITTY_PARTY:         { label: 'Kitty Party',          icon: PartyPopper,  color: 'text-pink-700',   bg: 'bg-pink-50',   border: 'border-pink-200' },
  PARENT_TEACHER_MEET: { label: 'Parent-Teacher Meet',  icon: GraduationCap,color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  FESTIVAL:            { label: 'Festival',              icon: Star,         color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  WEDDING:             { label: 'Wedding',               icon: Heart,        color: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-200' },
  BIRTHDAY:            { label: 'Birthday',              icon: Cake,         color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  ANNIVERSARY:         { label: 'Anniversary',           icon: Gift,         color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  OFFICE_EVENT:        { label: 'Office Event',          icon: Briefcase,    color: 'text-slate-700',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  PUJA_CEREMONY:       { label: 'Puja / Ceremony',       icon: Flame,        color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  FAMILY_FUNCTION:     { label: 'Family Function',       icon: Users,        color: 'text-teal-700',   bg: 'bg-teal-50',   border: 'border-teal-200' },
  OTHER:               { label: 'Other',                 icon: Calendar,     color: 'text-charcoal',   bg: 'bg-cream-light',border: 'border-cream-border' },
};

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const GARMENT_CATEGORIES = ['Saree','Kurti','Lehenga','Salwar Suit','Dupatta','Blouse','Dress Material','Gown','Other'];

// ─── EMPTY FORM ───
const emptyForm = (): Omit<CalendarEvent, 'id' | 'isActive'> => ({
  title: '',
  eventType: 'OTHER',
  eventDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  description: '',
  suggestedCategories: [],
  suggestedOccasion: '',
  messagingTheme: '',
  messagingNotes: '',
  isRecurring: false,
  recurrenceRule: '',
});

export default function AdminCalendarPage() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/calendar?month=${monthKey}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const eventsOnDay = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.eventDate.slice(0, 10) === dateStr);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const openCreate = (date?: string) => {
    setEditingId(null);
    setForm({ ...emptyForm(), eventDate: date || emptyForm().eventDate });
    setError(null);
    setShowModal(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setEditingId(event.id);
    setForm({
      title: event.title,
      eventType: event.eventType,
      eventDate: event.eventDate.slice(0, 10),
      endDate: event.endDate ? event.endDate.slice(0, 10) : '',
      description: event.description || '',
      suggestedCategories: event.suggestedCategories || [],
      suggestedOccasion: event.suggestedOccasion || '',
      messagingTheme: event.messagingTheme || '',
      messagingNotes: event.messagingNotes || '',
      isRecurring: event.isRecurring,
      recurrenceRule: event.recurrenceRule || '',
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.eventDate) { setError('Title and date are required'); return; }
    setSaving(true); setError(null);
    try {
      const url = editingId ? `/api/admin/calendar/${editingId}` : '/api/admin/calendar';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, endDate: form.endDate || null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setShowModal(false);
      fetchEvents();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    await fetch(`/api/admin/calendar/${id}`, { method: 'DELETE' });
    setSelectedEvent(null);
    fetchEvents();
  };

  const toggleCategory = (cat: string) => {
    setForm(f => ({
      ...f,
      suggestedCategories: f.suggestedCategories.includes(cat)
        ? f.suggestedCategories.filter(c => c !== cat)
        : [...f.suggestedCategories, cat],
    }));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-charcoal">Marketing Calendar</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            Track customer life events &amp; align your collections + messaging to their world
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent/90 transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Event
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, any][]).map(([type, cfg]) => {
          const Icon = cfg.icon;
          return (
            <span key={type} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
              <Icon className="w-3 h-3" /> {cfg.label}
            </span>
          );
        })}
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl border border-cream-border shadow-sm overflow-hidden">
        {/* Month Nav */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-border bg-cream-light">
          <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-cream-border transition-all cursor-pointer">
            <ChevronLeft className="w-4 h-4 text-charcoal" />
          </button>
          <div className="text-center">
            <h2 className="font-display text-xl font-bold text-charcoal">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h2>
            {loading && <p className="text-[10px] text-charcoal-muted mt-0.5">Loading...</p>}
          </div>
          <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-cream-border transition-all cursor-pointer">
            <ChevronRight className="w-4 h-4 text-charcoal" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-cream-border">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-3 text-center text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="min-h-[80px] bg-cream-light/30 border-b border-r border-cream-border/50" />;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = eventsOnDay(day);
            const isToday = dateStr === todayStr;
            const isSelected = selectedDate === dateStr;

            return (
              <div
                key={day}
                onClick={() => { setSelectedDate(dateStr); setSelectedEvent(null); }}
                className={`min-h-[80px] p-2 border-b border-r border-cream-border/50 cursor-pointer transition-colors group
                  ${isToday ? 'bg-accent-bg' : isSelected ? 'bg-cream-light' : 'hover:bg-cream-light/60'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday ? 'bg-accent text-white' : 'text-charcoal'}`}>
                    {day}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); openCreate(dateStr); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-accent/10 transition-all cursor-pointer"
                    title="Add event"
                  >
                    <Plus className="w-3 h-3 text-accent" />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(evt => {
                    const cfg = EVENT_TYPE_CONFIG[evt.eventType];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={evt.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedDate(dateStr); setSelectedEvent(evt); }}
                        className={`w-full flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold truncate text-left ${cfg.color} ${cfg.bg} border ${cfg.border} hover:opacity-80 transition-opacity cursor-pointer`}
                      >
                        <Icon className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{evt.title}</span>
                      </button>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <p className="text-[9px] text-charcoal-muted text-right">+{dayEvents.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Detail Panel */}
      {selectedEvent && (
        <div className="bg-white rounded-2xl border border-cream-border shadow-sm overflow-hidden">
          <div className={`p-4 flex items-start justify-between border-b border-cream-border ${EVENT_TYPE_CONFIG[selectedEvent.eventType].bg}`}>
            <div className="flex items-center gap-3">
              {(() => {
                const cfg = EVENT_TYPE_CONFIG[selectedEvent.eventType];
                const Icon = cfg.icon;
                return <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.bg} border ${cfg.border}`}><Icon className={`w-5 h-5 ${cfg.color}`} /></div>;
              })()}
              <div>
                <h3 className="font-display text-lg font-bold text-charcoal">{selectedEvent.title}</h3>
                <p className="text-xs text-charcoal-muted">
                  {new Date(selectedEvent.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {selectedEvent.endDate && ` → ${new Date(selectedEvent.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => openEdit(selectedEvent)} className="p-2 rounded-xl hover:bg-white/60 transition-colors cursor-pointer"><Edit2 className="w-4 h-4 text-charcoal" /></button>
              <button onClick={() => handleDelete(selectedEvent.id)} className="p-2 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"><Trash2 className="w-4 h-4 text-red-500" /></button>
              <button onClick={() => setSelectedEvent(null)} className="p-2 rounded-xl hover:bg-white/60 transition-colors cursor-pointer"><X className="w-4 h-4 text-charcoal-muted" /></button>
            </div>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {selectedEvent.description && (
              <div className="sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal-muted mb-1">About</p>
                <p className="text-sm text-charcoal">{selectedEvent.description}</p>
              </div>
            )}
            {selectedEvent.suggestedCategories.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal-muted mb-2">Suggested Garments</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEvent.suggestedCategories.map(c => (
                    <span key={c} className="px-2.5 py-1 rounded-full bg-accent-bg text-accent text-xs font-semibold border border-accent-border">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {selectedEvent.suggestedOccasion && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal-muted mb-1">Occasion Type</p>
                <p className="text-sm font-semibold text-charcoal capitalize">{selectedEvent.suggestedOccasion}</p>
              </div>
            )}
            {selectedEvent.messagingTheme && (
              <div className="sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal-muted mb-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-accent" /> Messaging Theme
                </p>
                <p className="text-sm text-charcoal italic">&ldquo;{selectedEvent.messagingTheme}&rdquo;</p>
              </div>
            )}
            {selectedEvent.messagingNotes && (
              <div className="sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal-muted mb-1">Campaign Notes</p>
                <p className="text-sm text-charcoal">{selectedEvent.messagingNotes}</p>
              </div>
            )}
            {selectedEvent.isRecurring && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal-muted mb-1">Recurrence</p>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                  <RefreshCw className="w-3 h-3" /> {selectedEvent.recurrenceRule || 'Recurring'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-cream-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-display text-lg font-bold text-charcoal">
                {editingId ? 'Edit Event' : 'Add Calendar Event'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-cream-light transition-colors cursor-pointer">
                <X className="w-4 h-4 text-charcoal-muted" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">Event Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Monthly Kitty Party — Anjali's Group"
                  className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-2">Event Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.entries(EVENT_TYPE_CONFIG) as [EventType, any][]).map(([type, cfg]) => {
                    const Icon = cfg.icon;
                    const isSelected = form.eventType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, eventType: type }))}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer
                          ${isSelected ? `${cfg.color} ${cfg.bg} ${cfg.border} ring-2 ring-offset-1` : 'border-cream-border text-charcoal-muted hover:border-accent/30'}`}
                      >
                        <Icon className="w-3.5 h-3.5" /> {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">Event Date *</label>
                  <input
                    type="date"
                    value={form.eventDate}
                    onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">End Date (optional)</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What is this event about? Who attends? What do they wear?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent resize-none"
                />
              </div>

              {/* Suggested Garments */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-2">
                  Suggested Garment Categories <span className="text-charcoal-muted normal-case font-normal">(what they'll need)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {GARMENT_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer
                        ${form.suggestedCategories.includes(cat)
                          ? 'bg-accent text-white border-accent'
                          : 'bg-white text-charcoal-muted border-cream-border hover:border-accent/50'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Occasion */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">Occasion Type</label>
                <select
                  value={form.suggestedOccasion}
                  onChange={e => setForm(f => ({ ...f, suggestedOccasion: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent"
                >
                  <option value="">Select occasion...</option>
                  <option value="festive">Festive</option>
                  <option value="casual">Casual / Everyday</option>
                  <option value="formal">Formal / Office</option>
                  <option value="bridal">Bridal / Wedding</option>
                  <option value="party">Party / Celebration</option>
                  <option value="religious">Religious / Traditional</option>
                  <option value="outdoor">Outdoor / Travel</option>
                </select>
              </div>

              {/* Messaging Theme */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-accent" /> Messaging Theme
                </label>
                <input
                  value={form.messagingTheme}
                  onChange={e => setForm(f => ({ ...f, messagingTheme: e.target.value }))}
                  placeholder="e.g. &ldquo;Shine among your circle — be the most graceful one there&rdquo;"
                  className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent"
                />
              </div>

              {/* Campaign Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">Campaign / Messaging Notes</label>
                <textarea
                  value={form.messagingNotes}
                  onChange={e => setForm(f => ({ ...f, messagingNotes: e.target.value }))}
                  placeholder="WhatsApp blast timing, Instagram story ideas, specific products to push..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent resize-none"
                />
              </div>

              {/* Recurring */}
              <div className="flex items-center gap-3 p-4 rounded-xl border border-cream-border bg-cream-light">
                <input
                  id="recurring"
                  type="checkbox"
                  checked={form.isRecurring}
                  onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))}
                  className="w-4 h-4 accent-accent"
                />
                <label htmlFor="recurring" className="text-sm font-semibold text-charcoal cursor-pointer">
                  Recurring event <span className="text-charcoal-muted font-normal">(happens every year or month)</span>
                </label>
              </div>
              {form.isRecurring && (
                <select
                  value={form.recurrenceRule}
                  onChange={e => setForm(f => ({ ...f, recurrenceRule: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent"
                >
                  <option value="">Select recurrence...</option>
                  <option value="yearly">Yearly</option>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-cream-border px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl border border-cream-border text-sm font-semibold text-charcoal hover:border-charcoal transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent/90 disabled:opacity-60 transition-all cursor-pointer shadow-sm"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Save Changes' : 'Add Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
