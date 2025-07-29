'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'

export type RawJobHeader = {
  job_id: number
  customer_name: string
  email: string
  phone1_number: string
}

export type ChatMessage = {
  id: number
  session_id: string
  user_id: string
  text: string
  created_at: string
}

interface ChatProps {
  sessionId: string
  userId: string
  job: RawJobHeader
}

export const Chat: React.FC<ChatProps> = ({ sessionId, userId, job }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newText, setNewText] = useState('')
  const [status, setStatus] = useState<'resolved' | 'unresolved'>('unresolved')
  const [isSending, setIsSending] = useState(false)

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (!error) setMessages(data || [])
  }, [sessionId])

  useEffect(() => {
    supabase
      .from('chat_threads')
      .select('status')
      .eq('session_id', sessionId)
    setStatus(status)
  }, [sessionId, status])

  useEffect(() => {
    const channel = supabase
      .channel(`threads_session_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_threads',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setStatus(payload.new.status)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
      if (!error && data) {
        setMessages(data)
      }
    })()

    const channel = supabase
      .channel('chat_messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage])
          fetchMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, fetchMessages])

  const sendMessage = async () => {
    if (!newText.trim()) return

    setIsSending(true)

    try {
      // 1. Зберігаємо повідомлення користувача
      const res = await fetch('/api/chat/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: userId,
          text: newText,
          job,
        }),
      })

      if (!res.ok) {
        console.error('send Message error', await res.json())
        setIsSending(false)
        return
      }

      // 2. Надсилаємо питання до n8n з session_id
      const aiRes = await fetch(
        'https://n8n.srv857615.hstgr.cloud/webhook/8027e028-cfb4-47d7-b90e-9c2ce810f016',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            job_id: job.job_id,
            question: newText,
          }),
        }
      )

      const aiData = await aiRes.json()

      // 3. Зберігаємо відповідь AI
      await fetch('/api/chat/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: 'AI',
          text: aiData.answer,
          job,
        }),
      })

      setNewText('')
      fetchMessages()
    } catch (err) {
      console.error('AI response error:', err)
    }

    setIsSending(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className="flex space-x-2">
            <span className="font-semibold">{m.user_id}</span>
            <span>{m.text}</span>
          </div>
        ))}
      </div>
      <div className="p-4 border-t flex flex-col md:flex-row gap-4 md:gap-0 space-x-2">
        <textarea
          className="flex-1 border rounded px-2 py-1"
          placeholder="Type your message…"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              sendMessage()
            }
          }}
        />
        <Button
          className="bg-primary text-white px-4 rounded"
          onClick={sendMessage}
          disabled={isSending}
        >
          {isSending ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  )
}
