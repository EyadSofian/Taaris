import { useEffect, useRef, useState } from 'react'

type Msg = { id: number; role: 'me' | 'bot' | 'sys'; text: string }

const WS_URL =
  (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'

export default function App() {
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const idRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  const push = (role: Msg['role'], text: string) =>
    setMessages((m) => [...m, { id: ++idRef.current, role, text }])

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'echo') push('bot', data.text)
        else if (data.type === 'system') push('sys', `— ${data.text} —`)
        else push('bot', String(data.text ?? e.data))
      } catch {
        push('bot', e.data)
      }
    }
    return () => ws.close()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    const text = input.trim()
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return
    push('me', text)
    wsRef.current.send(text)
    setInput('')
  }

  return (
    <div className="flex h-full flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold tracking-tight">AI Companion</span>
          <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-xs text-cyan-300">
            Phase 0
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? 'bg-emerald-400' : 'bg-red-400'
            }`}
          />
          {connected ? 'connected' : 'offline'}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <p className="m-auto text-center text-sm text-neutral-500">
            اكتب رسالة — السيرفر هيرجّعها (echo).
            <br />
            الدماغ الحقيقي + الصوت بييجوا في Phase 1.
          </p>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} msg={m} />
        ))}
        <div ref={bottomRef} />
      </main>

      <footer className="border-t border-white/10 p-4">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="اكتب رسالة…"
            className="flex-1 rounded-xl border border-white/10 bg-neutral-900 px-4 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-cyan-500/50"
          />
          <button
            onClick={send}
            disabled={!connected}
            className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-medium text-neutral-950 transition enabled:hover:bg-cyan-400 disabled:opacity-40"
          >
            إرسال
          </button>
        </div>
      </footer>
    </div>
  )
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.role === 'sys')
    return <div className="text-center text-xs text-neutral-600">{msg.text}</div>

  const me = msg.role === 'me'
  return (
    <div className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          me ? 'bg-cyan-500 text-neutral-950' : 'bg-neutral-800 text-neutral-100'
        }`}
      >
        {msg.text}
      </div>
    </div>
  )
}
