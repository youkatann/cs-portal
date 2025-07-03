// src/app/api/chat/resolve/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  const { session_id, resolved_by } = await req.json();
  if (!session_id || !resolved_by) return NextResponse.json({ error: 'Missing' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('chat_threads')
    .update({ status: 'resolved', resolved_by, updated_at: new Date().toISOString() })
    .eq('session_id', session_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
