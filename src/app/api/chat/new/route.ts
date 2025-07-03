// app/api/chat/new/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { WebClient, KnownBlock } from '@slack/web-api';

export async function POST(req: NextRequest) {
  const { session_id, user_id, text, job } = await req.json();

  if (!session_id || !user_id || !text || !job) {
    return NextResponse.json(
      { error: 'Missing session_id, user_id, text or job' },
      { status: 400 }
    );
  }

  // 1. Дістаємо або створюємо тред у БД
  const { data: existingThreads, error: fetchThreadsErr } = await supabaseAdmin
    .from('chat_threads')
    .select('*')
    .eq('session_id', session_id);

  if (fetchThreadsErr) {
    console.error('[chat/new] fetch threads error', fetchThreadsErr);
    return NextResponse.json({ error: fetchThreadsErr.message }, { status: 500 });
  }

  let thread = existingThreads?.[0];
  const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

  // 2. Якщо немає – створюємо тред + шапку
  if (!thread) {
    // статус за замовчуванням
    const status = 'unresolved';

    // будуємо блоки для шапки
    const headerBlocks: KnownBlock[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Chat for Order #${job.job_id}*`
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Status:*\n${status}` },
          { type: 'mrkdwn', text: `*Customer:*\n${job.customer_name}` },
          { type: 'mrkdwn', text: `*Email:*\n${job.email}` },
          { type: 'mrkdwn', text: `*Phone:*\n${job.phone1_number}` }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Change status' },
            style: 'primary',
            value: session_id,
            action_id: 'resolve_thread'
          }
        ]
      }
    ];

    // публікуємо
    const slackHeader = await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID!,
      blocks: headerBlocks
    });

    const threadTs = slackHeader.ts!;
    const { data: insertedThread, error: threadErr } = await supabaseAdmin
      .from('chat_threads')
      .insert({
        session_id,
        slack_ts: threadTs,
        status,
        resolved_by: null,
        job_id: job.job_id
      })
      .select()
      .single();

    if (threadErr) {
      console.error('[chat/new] insert thread error', threadErr);
      return NextResponse.json({ error: threadErr.message }, { status: 500 });
    }

    thread = insertedThread;
  }

  // 3. Інсертуємо повідомлення в БД
  const { data: msg, error: msgErr } = await supabaseAdmin
    .from('chat_messages')
    .insert({ session_id, user_id, text })
    .select()
    .single();

  if (msgErr) {
    console.error('[chat/new] insert message error', msgErr);
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  // 4. Шлемо повідомлення в Slack у рамках треду
  await slack.chat.postMessage({
    channel: process.env.SLACK_CHANNEL_ID!,
    thread_ts: thread.slack_ts,
    text: `<@${user_id}>: ${text}`
  });

  return NextResponse.json({ message: msg, thread });
}
