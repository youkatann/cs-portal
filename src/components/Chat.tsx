'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
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
   const [status, setStatus] = useState<'resolved' | 'unresolved'>('unresolved');
  // завантажуємо історію
  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) console.error('Fetch error:', error)
    else setMessages(data || [])
  }, [sessionId])

  useEffect(() => {
    supabase
      .from('chat_threads')
      .select('status')
      .eq('session_id', sessionId)
      setStatus(status);
  }, [sessionId, status]);
 
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
          setStatus(payload.new.status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
 }, [sessionId]);

  useEffect(() => {
    // Завантажуємо історію
    (async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setMessages(data);
      }
    })();

    // Підписка на нові INSERT-и
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
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
          console.log('New message:', payload.new);
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchMessages]);
  const sendMessage = async () => {
    if (!newText.trim()) return

    const res = await fetch('/api/chat/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        user_id: userId,
        text: newText,
        job,               // передаємо job щоб route міг створити шапку
      }),
    })

    if (!res.ok) {
      console.error('send Message error', await res.json())
    } else {
      setNewText('')
    }
    fetchMessages();
  }
  

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(m => (
          <div key={m.id} className="flex space-x-2">
            <span className="font-semibold">{m.user_id}</span>
            <span>{m.text}</span>
          </div>
        ))}
      </div>
      <div className="p-4 border-t flex space-x-2">
        <input
          type="text"
          className="flex-1 border rounded px-2 py-1"
          placeholder="Type your message…"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              sendMessage()
            }
          }}
        />
        <button
          className="bg-blue-600 text-white px-4 rounded"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </div>
  )
}
