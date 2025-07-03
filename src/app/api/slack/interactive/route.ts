// src/app/api/slack/interactive/route.ts
import { NextResponse } from 'next/server';
import { WebClient, KnownBlock } from '@slack/web-api';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const channelId = process.env.SLACK_CHANNEL_ID!;

export async function POST(req: Request) {
  const payload = await req.json();
  const action = payload.actions?.[0];
  if (!action) {
    return NextResponse.json({ error: 'No action' }, { status: 400 });
  }

  const session_id = action.value as string;
  const newStatus = action.action_id === 'resolve_thread' ? 'resolved' : 'unresolved';

  // 1) Оновлюємо статус і отримуємо slack_ts та job_id
  const { data: thread, error: thErr } = await supabaseAdmin
    .from('chat_threads')
    .update({
      status: newStatus,
      resolved_by: payload.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', session_id)
    .select('slack_ts, job_id')
    .single();
  if (thErr || !thread) {
    console.error('Error updating thread:', thErr);
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
  }

  // 2) Підтягуємо дані замовлення
  const { data: job, error: jobErr } = await supabaseAdmin
    .from('Jobs')
    .select('job_id, customer_name, email, phone1_number')
    .eq('job_id', thread.job_id)
    .single();
  if (jobErr || !job) {
    console.error('Error fetching job:', jobErr);
    return NextResponse.json({ error: 'Job fetch failed' }, { status: 500 });
  }

  // 3) Формуємо текст шапки
  const headerText =
    `*Status:* ${newStatus.toUpperCase()}\n` +
    `*Job #${job.job_id}*\n` +
    `• Customer: ${job.customer_name}\n` +
    `• Email: ${job.email}\n` +
    `• Phone1: ${job.phone1_number}`;

  // 4) Один блок: section з accessory-кнопкою
  const headerBlock: KnownBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: headerText,
    },
    accessory: {
      type: 'button',
      text: {
        type: 'plain_text',
        text: newStatus === 'resolved' ? 'Mark as Unresolved' : 'Mark as Resolved',
      },
      style: newStatus === 'resolved' ? 'danger' : 'primary',
      action_id: newStatus === 'resolved' ? 'unresolve_thread' : 'resolve_thread',
      value: session_id,
    },
  };

  // 5) Оновлюємо повідомлення в Slack
  await slack.chat.update({
    channel: channelId,
    ts: thread.slack_ts,
    text: headerText, // fallback
    blocks: [headerBlock],
  });

  return NextResponse.json({ ok: true });
}
