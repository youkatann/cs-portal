// src/app/api/signed-url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Примушуємо цей роут працювати в Node.js runtime
export const runtime = 'nodejs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { filePath } = await req.json() as { filePath: string };
    const bucket = 'contracts';
    // supabase-js очікує ключ без префіксу bucket/
    const key = filePath.startsWith(`${bucket}/`)
      ? filePath.slice(bucket.length + 1)
      : filePath;

    const { data, error } = await supabaseAdmin
      .storage
      .from(bucket)
      .createSignedUrl(key, 60 * 60 * 24); // 24h

    if (error) {
      console.error('[signed-url] createSignedUrl error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ url: data.signedUrl });
} catch (e: unknown) {
  const error = e instanceof Error ? e : new Error('Unknown error');
  console.error('[signed-url] unexpected error:', error);
  return NextResponse.json({ error: error.message }, { status: 500 });
}
}
