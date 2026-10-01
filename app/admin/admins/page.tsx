'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Input } from '@/app/components/ui/Input';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add/Edit State
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/admins');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAdmins(data.admins || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formEmail) return alert('Email is required');
    try {
      if (editingId) {
        // Update
        const res = await fetch(`/api/admin/admins/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formEmail, name: formName }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        // Create
        const res = await fetch('/api/admin/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formEmail, name: formName }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      
      setIsAdding(false);
      setEditingId(null);
      setFormEmail('');
      setFormName('');
      fetchAdmins();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Are you sure you want to remove admin access for this user?')) return;
    try {
      const res = await fetch(`/api/admin/admins/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      fetchAdmins();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-charcoal">Admin Users</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            Manage who has access to this admin dashboard. Only these emails can sign in.
          </p>
        </div>
        <Button onClick={() => {
          setIsAdding(true);
          setEditingId(null);
          setFormEmail('');
          setFormName('');
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Admin
        </Button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">{error}</div>}

      {(isAdding || editingId) && (
        <Card className="p-5 border-2 border-accent/20">
          <h3 className="font-display font-bold text-lg mb-4">{editingId ? 'Edit Admin' : 'Add New Admin'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-charcoal-muted mb-1 uppercase tracking-wider">Email Address</label>
              <Input
                value={formEmail}
                onChange={e => setFormEmail(e.target.value)}
                placeholder="admin@example.com"
                type="email"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-charcoal-muted mb-1 uppercase tracking-wider">Name (Optional)</label>
              <Input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Admin Name"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setIsAdding(false); setEditingId(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingId ? 'Save Changes' : 'Add Admin'}
            </Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-charcoal-muted text-sm">Loading admins...</div>
        ) : admins.length === 0 ? (
          <div className="py-16 text-center text-charcoal-muted text-sm">No admins found in the database.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-border bg-cream-light">
                  <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Email</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Name</th>
                  <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Added On</th>
                  <th className="text-right px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-border/50">
                {admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-cream-light/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-charcoal flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-accent" />
                      {admin.email}
                    </td>
                    <td className="px-5 py-4 text-charcoal-muted">{admin.name || '—'}</td>
                    <td className="px-5 py-4 text-charcoal-muted">{new Date(admin.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setIsAdding(false);
                            setEditingId(admin.id);
                            setFormEmail(admin.email);
                            setFormName(admin.name || '');
                          }}
                          className="p-2 rounded-lg text-charcoal-muted hover:text-accent hover:bg-accent/10 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(admin.id)}
                          className="p-2 rounded-lg text-charcoal-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
