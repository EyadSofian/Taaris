import { useEffect, useRef, useState } from 'react'

type Msg = { id: number; role: 'user' | 'assistant' | 'sys'; text: string }

const API_BASE = 'http://localhost:8000'

export default function App() {
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  
  const idRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const push = (role: Msg['role'], text: string) =>
    setMessages((m) => [...m, { id: ++idRef.current, role, text }])

  // Health check polling
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`)
        setConnected(res.ok)
      } catch {
        setConnected(false)
      }
    }
    checkHealth()
    const interval = setInterval(checkHealth, 3000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const playTTS = async (text: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      if (!res.ok) throw new Error('TTS failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      await audio.play()
    } catch (err) {
      console.error('TTS Playback Error:', err)
    }
  }

  const sendMessage = async (text: string, expectVoiceReply = false) => {
    if (!text.trim() || isLoading) return
    
    // Optimistic UI update
    push('user', text)
    setInput('')
    setIsLoading(true)

    // Build chat history for API
    const history = messages
      .filter((m) => m.role !== 'sys')
      .map((m) => ({ role: m.role, content: m.text }))
    
    history.push({ role: 'user', content: text })

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, persona: 'jarvis' })
      })
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      
      const data = await res.json()
      push('assistant', data.reply)
      
      if (expectVoiceReply) {
        playTTS(data.reply)
      }
    } catch (err) {
      console.error(err)
      push('sys', 'تعذر الاتصال بالمحرك الخلفي (Backend)')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      
      mr.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          setIsLoading(true)
          const formData = new FormData()
          formData.append('file', e.data, 'audio.webm')
          
          try {
            const res = await fetch(`${API_BASE}/api/stt`, {
              method: 'POST',
              body: formData
            })
            if (!res.ok) throw new Error(`STT HTTP ${res.status}`)
            
            const data = await res.json()
            if (data.text) {
              await sendMessage(data.text, true) // Play voice back
            } else {
              push('sys', 'لم يتم التقاط أي صوت بوضوح.')
              setIsLoading(false)
            }
          } catch (err) {
            console.error('STT Error:', err)
            push('sys', 'حدث خطأ أثناء معالجة الصوت.')
            setIsLoading(false)
          }
        }
      }
      
      mr.start()
      mediaRecorderRef.current = mr
      setIsRecording(true)
    } catch (err) {
      console.error('Mic Error:', err)
      push('sys', 'الرجاء السماح بالوصول إلى المايكروفون.')
    }
  }

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100 font-sans">
      <header className="flex items-center justify-between border-b border-white/10 bg-neutral-950/50 backdrop-blur px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight text-white drop-shadow-sm">AI Companion</span>
          <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
            Phase 1
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-neutral-400 bg-neutral-900/50 px-3 py-1.5 rounded-full border border-white/5">
          <span
            className={`h-2.5 w-2.5 rounded-full relative ${
              connected ? 'bg-emerald-400' : 'bg-red-400'
            }`}
          >
            {connected && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75"></span>}
          </span>
          {connected ? 'System Online' : 'Offline'}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-8">
        {messages.length === 0 && (
          <div className="m-auto flex flex-col items-center text-center gap-4 opacity-50">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-sm text-neutral-400 max-w-sm">
              مرحباً! السيرفر متصل الآن.
              <br />
              يمكنك كتابة رسالة أو التحدث عبر المايكروفون لسماع الرد الصوتي.
            </p>
          </div>
        )}
        
        {messages.map((m) => (
          <Bubble key={m.id} msg={m} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-neutral-800 text-neutral-400 rounded-2xl px-5 py-3 text-sm flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce delay-75"></span>
                <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce delay-150"></span>
             </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <footer className="border-t border-white/10 bg-neutral-950/80 backdrop-blur p-4 pb-6">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
          
          <button
            onClick={toggleRecording}
            disabled={!connected}
            className={`flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 disabled:opacity-40 ${
              isRecording 
                ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                : 'bg-neutral-900 text-neutral-400 border border-white/10 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-cyan-500/10'
            }`}
          >
            {isRecording ? (
              <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            )}
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage(input, false)}
            placeholder="اكتب رسالتك هنا..."
            className="flex-1 h-12 rounded-xl border border-white/10 bg-neutral-900 px-5 text-sm outline-none placeholder:text-neutral-600 focus:border-cyan-500/50 focus:bg-neutral-900/80 transition-all"
            dir="auto"
          />
          
          <button
            onClick={() => sendMessage(input, false)}
            disabled={!connected || !input.trim() || isLoading}
            className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500 text-neutral-950 transition-all enabled:hover:bg-cyan-400 enabled:hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-40 disabled:grayscale"
          >
            <svg className="w-5 h-5 translate-x-[-1px] translate-y-[1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  )
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.role === 'sys')
    return <div className="text-center text-xs font-medium text-neutral-500 my-4">{msg.text}</div>

  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group animate-in slide-in-from-bottom-2 fade-in duration-300`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3 text-[15px] leading-relaxed whitespace-pre-wrap shadow-sm ${
          isUser 
            ? 'bg-cyan-600 text-white rounded-br-sm' 
            : 'bg-neutral-800 text-neutral-100 rounded-bl-sm border border-white/5'
        }`}
        dir="auto"
      >
        {msg.text}
      </div>
    </div>
  )
}
