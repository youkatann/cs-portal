// /app/api/chat/new/route.ts
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { WebClient as SlackWebClient } from '@slack/web-api'

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN!
const SLACK_CHANNEL = process.env.SLACK_CHANNEL_ID!

export async function POST(req: Request) {
  try {
    const { session_id, user_id, text, job } = await req.json()

    if (!session_id || !user_id || !text || !job) {
      return NextResponse.json(
        { error: 'Missing session_id, user_id, text or job' },
        { status: 400 },
      )
    }

    // 1) Шукаємо існуючий тред
    const { data: existingThread } = await supabaseAdmin
      .from('chat_threads')
      .select('*')
      .eq('session_id', session_id)
      .single()

    let channelId: string
    let threadTs: string
    const slack = new SlackWebClient(SLACK_TOKEN)

    if (!existingThread) {
      // 2) Створюємо заголовок треду в Slack
      const headerText = `*Звернення до замовлення #${job.job_id}*  
*Клієнт:* ${job.customer_name}  
*Email:* ${job.email}  
*Телефон:* ${job.phone1_number}`

      const post = await slack.chat.postMessage({
        channel: SLACK_CHANNEL,
        text: headerText,
      })

      channelId = post.channel!
      threadTs  = post.ts!

      // 3) Зберігаємо в БД
      await supabaseAdmin.from('chat_threads').insert({
        session_id,
        channel_id: channelId,
        slack_ts: threadTs,
        status: 'unresolved',
        job_id: job.job_id,
      })
    } else {
      channelId = existingThread.channel_id!
      threadTs  = existingThread.slack_ts!
    }

    // 4) Додаємо повідомлення в БД
    const { error: msgErr } = await supabaseAdmin
      .from('chat_messages')
      .insert({ session_id, user_id, text })
    if (msgErr) {
      console.error('[chat/new] insert msg error', msgErr)
      return NextResponse.json({ error: msgErr.message }, { status: 500 })
    }

    // 5) Шлемо в Slack у рамках треду
    await slack.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text: `<@${user_id}>: ${text}`,
    })

    return NextResponse.json({ ok: true })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      console.error('[chat/new] unexpected error', e)
      return NextResponse.json({ error: message }, { status: 500 })
    }
}
