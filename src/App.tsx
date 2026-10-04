import { useEffect, useRef, useState } from 'react'
import './App.css'
import { demoVoiceRecognitionService } from './services/voiceRecognitionService'
import { roundtableApi, type Feedback, type Profile, type Room, type TranscriptEntry } from './services/roundtableApi'
import { authApi } from './services/authApi'

type IconName = 'grid' | 'users' | 'clock' | 'settings' | 'search' | 'more' | 'mic' | 'wave' | 'message' | 'chevron'

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.42 1.42-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.42-1.42.06-.06A1.7 1.7 0 0 0 9.4 15a1.7 1.7 0 0 0-1.56-1.03H7v-2h.84A1.7 1.7 0 0 0 9.4 11a1.7 1.7 0 0 0-.34-1.88L9 9.06l1.42-1.42.06.06A1.7 1.7 0 0 0 12.36 8a1.7 1.7 0 0 0 1.03-1.56V6h2v.09A1.7 1.7 0 0 0 16.42 7.65a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.42 1.42-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03H22v2h-.09A1.7 1.7 0 0 0 19.4 15Z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 21v-4M8 21h8" /></>,
    wave: <path d="M3 12h2l2-7 4 14 3-10 2 6 2-3h3" />,
    message: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.6 8.6 0 0 1-3.5-.8L4 20l1.8-3.7A7.2 7.2 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const defaultParticipants = [
  { name: 'Maya Chen', initials: 'MC', color: 'purple', role: 'Host', status: 'Speaking' },
  { name: 'Jordan Lee', initials: 'JL', color: 'blue', role: 'Participant', status: 'Listening' },
  { name: 'Ravi Patel', initials: 'RP', color: 'orange', role: 'Participant', status: 'Listening' },
  { name: 'Sofia Kim', initials: 'SK', color: 'green', role: 'Participant', status: 'Listening' },
]

const productTranscript: TranscriptEntry[] = [
  { time: '10:31:04', name: 'Maya Chen', initials: 'MC', color: 'purple', text: 'I think we have a clear opportunity to simplify the onboarding flow.', confidence: '98%', current: true },
  { time: '10:31:18', name: 'Jordan Lee', initials: 'JL', color: 'blue', text: 'Agreed. The first experience should make the value obvious within a few seconds.', confidence: '96%' },
  { time: '10:31:32', name: 'Ravi Patel', initials: 'RP', color: 'orange', text: 'What if we bring the live room preview into that first step?', confidence: '93%' },
  { time: '10:31:49', name: 'Sofia Kim', initials: 'SK', color: 'green', text: 'That could work well, especially for teams joining from multiple devices.', confidence: '97%' },
]

type SetupStep = 'create' | 'room' | 'identity' | 'voice' | 'waiting'
type VoiceState = 'idle' | 'requesting-microphone' | 'recording' | 'processing' | 'success' | 'error' | 'permission-denied'
type WorkspaceTab = 'Overview' | 'People' | 'Meeting history' | 'Meeting assistant' | 'Live room'

function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'signup') await authApi.signUp(name.trim(), email.trim(), password)
      else await authApi.signIn(email.trim(), password)
      localStorage.setItem('roundtable-authenticated', 'true')
      onAuthenticated()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not authenticate. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  const googleSignIn = async () => {
    setError('')
    setLoading(true)
    try {
      await authApi.signInWithGoogle()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Google sign-in is unavailable right now.')
      setLoading(false)
    }
  }
  return <main className="auth-shell"><section className="auth-card"><div className="brand auth-brand"><span className="brand-mark"><span /></span><span>roundtable</span></div><div className="flow-kicker">{mode === 'signup' ? 'GET STARTED' : 'WELCOME BACK'}</div><h1>{mode === 'signup' ? 'Create your account' : 'Sign in to Roundtable'}</h1><p>{mode === 'signup' ? 'Bring your conversations together in one place.' : 'Continue to your conversations and rooms.'}</p><form className="auth-form" onSubmit={submit}>{mode === 'signup' && <label>Username<input autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Your name" required /></label>}<label>Gmail or email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@gmail.com" required /></label><label>Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" minLength={8} required /></label>{error && <p className="error-text auth-error">{error}</p>}<button className="primary-button auth-submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button></form><div className="auth-divider"><span>or</span></div><button className="google-button" onClick={() => void googleSignIn()} disabled={loading}><span>G</span> Continue with Google (choose account)</button><p className="auth-switch">{mode === 'signup' ? 'Already have an account?' : 'New to Roundtable?'} <button onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError('') }}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button></p></section></main>
}

const initialRooms: Room[] = [
  { id: 'room-product-sync', name: 'Product sync · Q3', type: 'Meeting', description: 'A focused conversation about the next quarter.', createdAt: 'Today', participantCount: 4, status: 'active', participants: defaultParticipants, transcript: productTranscript },
  { id: 'room-classroom-demo', name: 'Classroom demo', type: 'Classroom', description: '', createdAt: 'Yesterday', participantCount: 0, status: 'waiting', participants: [], transcript: [] },
]

function SetupProgress({ step }: { step: SetupStep }) {
  const current = step === 'create' ? 1 : step === 'room' || step === 'identity' ? 2 : step === 'voice' ? 3 : 4
  return <div className="setup-progress">{['Room', 'Identity', 'Voice profile', 'Join conversation'].map((label, index) => <div className={`setup-progress-step ${index + 1 < current ? 'complete' : ''} ${index + 1 === current ? 'current' : ''}`} key={label}><span>{index + 1 < current ? '✓' : index + 1}</span>{label}</div>)}</div>
}

function ProfilePanel({ profile, onSave, onSignOut }: { profile: Profile; onSave: (profile: Profile) => Promise<void>; onSignOut: () => void }) {
  const [draft, setDraft] = useState(profile)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const save = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); setMessage(''); try { await onSave(draft); setMessage('Profile saved.') } catch { setMessage('Could not save profile. Please try again.') } finally { setSaving(false) } }
  const selectPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setDraft(current => ({ ...current, imageUrl: typeof reader.result === 'string' ? reader.result : '' }))
    reader.readAsDataURL(file)
  }

  return <section className="workspace-panel"><div className="workspace-panel-heading"><div><div className="flow-kicker">ACCOUNT</div><h1>Your profile</h1><p>Update the details people see when you join a Roundtable.</p></div></div><form className="profile-form" onSubmit={save}><div className="profile-photo-row"><div className="profile-photo">{draft.imageUrl ? <img src={draft.imageUrl} alt="Profile" /> : draft.name.split(' ').map(part => part[0]).join('').slice(0, 2)}</div><label className="upload-button">Change photo<input type="file" accept="image/*" onChange={selectPhoto} /></label><span>JPG or PNG, up to 5 MB</span></div><div className="profile-fields"><label>Full name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} required /></label><label>Birthdate<input type="date" value={draft.birthdate} onChange={event => setDraft({ ...draft, birthdate: event.target.value })} /></label><label>Email address<input type="email" value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} /></label><label>Phone number<input type="tel" value={draft.phone} onChange={event => setDraft({ ...draft, phone: event.target.value })} /></label></div><div className="profile-save-row"><span className={message.includes('Could') ? 'error-text' : 'success-text'}>{message}</span><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div></form><button className="sign-out-button" onClick={onSignOut}>Sign out</button></section>
}

function SupportPanel({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [draft, setDraft] = useState<Feedback>({ name: profile.name, email: profile.email, message: '' })
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)
  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.message.trim()) return
    setSending(true)
    setStatus('')
    try {
      await roundtableApi.submitFeedback(draft)
      const whatsappText = `Roundtable feedback%0A%0AName: ${encodeURIComponent(draft.name || 'Anonymous')}%0AEmail: ${encodeURIComponent(draft.email)}%0A%0A${encodeURIComponent(draft.message)}`
      window.open(`https://wa.me/919321604628?text=${whatsappText}`, '_blank', 'noopener,noreferrer')
      setStatus('Saved to the database. WhatsApp is ready to send your feedback.')
      setDraft(current => ({ ...current, message: '' }))
    } catch {
      setStatus('Could not save feedback. Please try again.')
    } finally {
      setSending(false)
    }
  }
  return <div className="modal-backdrop" onClick={onClose}><section className="modal support-modal" onClick={event => event.stopPropagation()}><div className="flow-kicker">SUPPORT</div><h2>Support & feedback</h2><p>Your feedback is saved in the database and opened in WhatsApp for the developer.</p><div className="developer-contact"><a href="https://wa.me/919321604628" target="_blank" rel="noreferrer">WhatsApp: +91 93216 04628</a></div><form onSubmit={send} className="support-form"><label>Your name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label>Your email<input type="email" required value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} /></label><label>Message<textarea required rows={4} value={draft.message} onChange={event => setDraft({ ...draft, message: event.target.value })} placeholder="Tell us what happened or how we can improve..." /></label><span className={status.startsWith('Could') ? 'error-text' : 'success-text'}>{status}</span><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Close</button><button className="primary-button" disabled={sending || !draft.message.trim()}>{sending ? 'Saving…' : 'Save & open WhatsApp'}</button></div></form></section></div>
}

function SearchPanel({ rooms, onOpenRoom, onClose }: { rooms: Room[]; onOpenRoom: (room: Room) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const matchingRooms = rooms.filter(room => !normalizedQuery || `${room.name} ${room.type} ${room.description}`.toLowerCase().includes(normalizedQuery))
  const matchingPeople = rooms.flatMap(room => room.participants.map(person => ({ ...person, room }))).filter(person => !normalizedQuery || `${person.name} ${person.role} ${person.room.name}`.toLowerCase().includes(normalizedQuery))
  return <div className="modal-backdrop" onClick={onClose}><section className="modal search-modal" onClick={event => event.stopPropagation()}><div className="search-modal-heading"><div><div className="flow-kicker">SEARCH</div><h2>Find a person or room</h2></div><button className="flow-close" onClick={onClose} aria-label="Close search">×</button></div><div className="search-input-wrap"><Icon name="search" size={18} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people or rooms..." aria-label="Search people or rooms" /></div><div className="search-results"><strong>Rooms</strong>{matchingRooms.map(room => <button className="search-result" key={room.id} onClick={() => onOpenRoom(room)}><span className={`room-status-dot ${room.status}`} /><span><b>{room.name}</b><small>{room.type} · {room.participantCount} participants</small></span></button>)}{!matchingRooms.length && <p className="search-empty">No rooms found.</p>}<strong>People</strong>{matchingPeople.map(person => <button className="search-result" key={`${person.room.id}-${person.name}`} onClick={() => onOpenRoom(person.room)}><span className={`speaker-avatar ${person.color}`}>{person.initials}</span><span><b>{person.name}</b><small>{person.role} · {person.room.name}</small></span></button>)}{!matchingPeople.length && <p className="search-empty">No people found.</p>}</div></section></div>
}

function ChatPanel({ room }: { room: Room }) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([{ role: 'assistant', text: 'Ask me anything about this meeting. I can help find decisions, action items, and speaker contributions.' }])
  const [loading, setLoading] = useState(false)
  const ask = async (event: React.FormEvent) => { event.preventDefault(); if (!question.trim()) return; const asked = question.trim(); setQuestion(''); setMessages(current => [...current, { role: 'user', text: asked }]); setLoading(true); try { const result = await roundtableApi.askChatbot(asked, room); setMessages(current => [...current, { role: 'assistant', text: result.answer }]) } catch { setMessages(current => [...current, { role: 'assistant', text: `The assistant could not load context for ${room.name}. Please try again.` }]) } finally { setLoading(false) } }
  return <section className="workspace-panel chatbot-panel"><div className="workspace-panel-heading"><div><div className="flow-kicker">MEETING INTELLIGENCE</div><h1>Ask about this meeting</h1><p>Questions are scoped to <strong>{room.name}</strong> and its transcript, decisions, and speaker activity.</p></div><span className="meeting-context-badge">● {room.status === 'active' ? 'Live meeting' : 'Waiting room'}</span></div><div className="chat-context"><Icon name="message" size={16} /><span>{room.name}</span><small>{room.type} · {room.participantCount} participants</small></div><div className="chat-messages">{messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><span className="chat-avatar">{message.role === 'assistant' ? '✦' : 'MC'}</span><p>{message.text}</p></div>)}{loading && <div className="chat-message assistant"><span className="chat-avatar">✦</span><p>Thinking about {room.name}…</p></div>}</div><form className="chat-composer" onSubmit={ask}><input value={question} onChange={event => setQuestion(event.target.value)} placeholder={`Ask about ${room.name}...`} aria-label={`Ask about ${room.name}`} /><button className="primary-button" disabled={loading || !question.trim()}>Ask</button></form></section>
}

function InvitePanel({ rooms, initialRoom, onClose }: { rooms: Room[]; initialRoom: Room | null; onClose: () => void }) {
  const [roomId, setRoomId] = useState(initialRoom?.id || rooms[0]?.id || '')
  const room = rooms.find(item => item.id === roomId) || null
  const link = room ? `${window.location.origin}/join/${room.id}` : ''
  return <div className="modal-backdrop" onClick={onClose}><div className="modal invite-modal" onClick={event => event.stopPropagation()}><div className="flow-kicker">INVITE PEOPLE</div><h2>Choose a room to invite people to</h2><p>Each invitation is tied to one room, so participants only join the conversation you select.</p><label>Existing room<select value={roomId} onChange={event => setRoomId(event.target.value)}>{rooms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{room && <div className="invite-link"><strong>{room.name}</strong><span>{link}</span><button className="secondary-button" onClick={() => void navigator.clipboard?.writeText(link)}>Copy link</button></div>}<div className="modal-actions"><button className="secondary-button" onClick={onClose}>Done</button></div></div></div>
}

function WorkspacePanel({ tab, rooms, activeRoom, onInvite, onViewLiveRoom }: { tab: Exclude<WorkspaceTab, 'Live room'>; rooms: Room[]; activeRoom: Room; onInvite: () => void; onViewLiveRoom: () => void }) {
  if (tab === 'Meeting assistant') return <ChatPanel room={activeRoom} />
  if (tab === 'People') {
    const people = activeRoom.participants
    return <section className="workspace-panel"><div className="workspace-panel-heading"><div><div className="flow-kicker">WORKSPACE</div><h1>People</h1><p>People in the selected room. Choose an existing room before inviting anyone.</p></div><button className="primary-button" onClick={onInvite}>Invite people</button></div><div className="people-room-picker"><label>Room<select value={activeRoom.id} onChange={() => undefined} aria-label="Selected room"><option>{activeRoom.name}</option></select></label><span>{people.length} participant{people.length === 1 ? '' : 's'} in this room</span></div><div className="people-grid">{people.map(person => <div className="person-card" key={person.name}><div className={`speaker-avatar ${person.color}`}>{person.initials}</div><strong>{person.name}</strong><span>{person.role}</span><small>{person.status}</small></div>)}{people.length === 0 && <div className="empty-state">No participants have joined this room yet.</div>}</div></section>
  }
  if (tab === 'Meeting history')   return <section className="workspace-panel"><div className="workspace-panel-heading"><div><div className="flow-kicker">WORKSPACE</div><h1>Meeting history</h1><p>Review rooms and return to conversations you have hosted.</p></div></div><div className="history-list">{rooms.map(room => <div className="history-row" key={room.id}><div className={`room-status-dot ${room.status}`} /><div><strong>{room.name}</strong><span>{room.type} · {room.createdAt}</span></div><small>{room.status === 'active' ? 'Live now' : room.status === 'ended' ? 'Ended' : 'Waiting'}</small></div>)}</div></section>
  return <section className="workspace-panel"><div className="workspace-panel-heading"><div><div className="flow-kicker">WORKSPACE</div><h1>Overview</h1><p>Your Roundtable workspace at a glance.</p></div><button className="primary-button" onClick={onViewLiveRoom} disabled={!rooms.length}>View live room</button></div><div className="overview-cards"><div><span>Total rooms</span><strong>{rooms.length}</strong></div><div><span>Connected people</span><strong>{rooms.reduce((total, room) => total + room.participantCount, 0)}</strong></div><div><span>Minutes captured</span><strong>24</strong></div></div><div className="overview-note"><Icon name="wave" size={20} /><div><strong>Everything is ready for your next conversation.</strong><p>Create a room or select one from the sidebar to get started.</p></div></div></section>
}

function RoomFlow({ step, room, onStep, onCreate, onClose, onEnterRoom, username, setUsername, onVoiceComplete, voiceProfileId }: { step: SetupStep; room: Room | null; onStep: (step: SetupStep) => void; onCreate: (room: Room) => void; onClose: () => void; onEnterRoom: () => void; username: string; setUsername: (value: string) => void; onVoiceComplete: (profileId: string) => void; voiceProfileId: string | null }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('Meeting')
  const [description, setDescription] = useState('')
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => () => { streamRef.current?.getTracks().forEach(track => track.stop()); recorderRef.current?.stop() }, [])
  useEffect(() => {
    if (voiceState !== 'recording') return
    const timer = window.setInterval(() => setRecordingSeconds(seconds => seconds + 1), 1000)
    return () => window.clearInterval(timer)
  }, [voiceState])

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setVoiceState('error'); return }
    setVoiceState('requesting-microphone')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data) }
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }))
        setVoiceState('success')
        stream.getTracks().forEach(track => track.stop())
      }
      recorderRef.current = recorder
      setRecordingSeconds(0)
      setVoiceState('recording')
      recorder.start()
    } catch (error) {
      setVoiceState((error as DOMException).name === 'NotAllowedError' ? 'permission-denied' : 'error')
    }
  }
  const stopRecording = () => { if (recorderRef.current?.state === 'recording') recorderRef.current.stop() }
  const continueWithVoice = async () => {
    if (!audioBlob || !username.trim()) return
    setVoiceState('processing')
    try {
      const result = await demoVoiceRecognitionService.enrollVoice(audioBlob, username)
      onVoiceComplete(result.profileId)
    } catch { setVoiceState('error') }
  }

  return <div className="flow-backdrop"><div className="flow-shell">
    <header className="flow-header"><div className="brand"><span className="brand-mark"><span /></span><span>roundtable</span></div><button className="flow-close" onClick={onClose} aria-label="Close setup">×</button></header>
    <div className="flow-body"><SetupProgress step={step} />
      {step === 'create' && <div className="flow-card"><div className="flow-kicker">NEW ROOM</div><h1>Create a Roundtable</h1><p className="flow-description">Start a focused conversation and invite people to join from nearby devices.</p><label>Room / meeting name<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="AI Hackathon Planning" /></label><label>Meeting type<select value={type} onChange={event => setType(event.target.value)}>{['Meeting', 'Classroom', 'Discussion', 'Interview', 'Conference', 'Custom'].map(option => <option key={option}>{option}</option>)}</select></label><label>Description <span className="optional">Optional</span><textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="What will this conversation be about?" rows={3} /></label><div className="flow-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!name.trim()} onClick={() => onCreate({ id: `room-${Date.now()}`, name: name.trim(), type, description: description.trim(), createdAt: 'Just now', participantCount: 0, status: 'waiting', participants: [], transcript: [] })}>Create room</button></div></div>}
      {step === 'room' && room && <div className="flow-card room-setup-card"><div className="flow-kicker">ROOM SETUP</div><h1>{room.name}</h1><p className="flow-description">{room.description || 'Your Roundtable is ready for participants.'}</p><div className="room-details"><div><span>Room ID</span><strong>{room.id.toUpperCase()}</strong></div><div><span>Type</span><strong>{room.type}</strong></div><div className="qr-placeholder"><div className="qr-pattern">▦</div><span>QR placeholder</span></div></div><div className="share-link"><span>{window.location.origin}/join/{room.id}</span><button onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}/join/${room.id}`)}>Copy link</button></div><div className="flow-actions"><button className="secondary-button" onClick={() => onStep('create')}>Back</button><button className="primary-button" onClick={() => onStep('identity')}>Continue</button></div></div>}
      {step === 'identity' && <div className="flow-card"><div className="flow-kicker">STEP 1 · IDENTITY</div><h1>How should we identify you?</h1><p className="flow-description">Your name will be displayed alongside your speech in the live transcript.</p><label>Your name<input autoFocus value={username} onChange={event => setUsername(event.target.value)} placeholder="Enter your name" /></label><div className="flow-actions"><button className="secondary-button" onClick={() => onStep('room')}>Back</button><button className="primary-button" disabled={!username.trim()} onClick={() => onStep('voice')}>Continue</button></div></div>}
      {step === 'voice' && <div className="flow-card voice-card"><div className="flow-kicker">STEP 2 · VOICE PROFILE</div><h1>Create your voice profile</h1><p className="flow-description">Roundtable prepares an audio sample so a future speaker model can associate speech with your name. Nothing is uploaded in this demo.</p><div className="voice-sentence">“Roundtable connects every device to create a clearer conversation.”</div>{voiceState === 'idle' && <><div className="mic-orb"><Icon name="mic" size={28} /></div><button className="primary-button centered-button" onClick={startRecording}><Icon name="mic" size={16} /> Start voice setup</button></>}{voiceState === 'requesting-microphone' && <div className="voice-status"><div className="spinner" /><strong>Requesting microphone...</strong><p>Allow microphone access in your browser.</p></div>}{voiceState === 'recording' && <div className="voice-status recording-status"><div className="recording-pulse"><span /></div><strong>Listening...</strong><p><span className="recording-dot" /> Recording · 00:{String(recordingSeconds).padStart(2, '0')}</p><div className="simple-wave"><i /><i /><i /><i /><i /><i /><i /></div><button className="end-button centered-button" onClick={stopRecording}>Stop recording</button></div>}{voiceState === 'processing' && <div className="voice-status"><div className="spinner" /><strong>Preparing your voice profile...</strong><p>Please wait while the demo enrollment adapter runs.</p></div>}{voiceState === 'success' && <div className="voice-status success-status"><div className="success-check">✓</div><strong>Voice sample captured</strong><p>Your sample is ready for the future speaker model.</p><div className="flow-actions"><button className="secondary-button" onClick={() => { setAudioBlob(null); setVoiceState('idle'); setRecordingSeconds(0) }}>Record again</button><button className="primary-button" onClick={continueWithVoice}>Continue</button></div></div>}{(voiceState === 'permission-denied' || voiceState === 'error') && <div className="voice-status error-status"><div className="error-symbol">!</div><strong>{voiceState === 'permission-denied' ? 'Microphone access is required' : 'We could not capture a clear sample'}</strong><p>{voiceState === 'permission-denied' ? 'Allow microphone access in your browser, then try again.' : 'Check your microphone and try again. Your audio stays in memory.'}</p><button className="primary-button centered-button" onClick={() => setVoiceState('idle')}>Try again</button></div>}</div>}
      {step === 'waiting' && room && <div className="flow-card waiting-card"><div className="flow-kicker">STEP 3 · READY TO JOIN</div><h1>Waiting room</h1><p className="flow-description">{room.name} is ready. Share the room with nearby devices before entering the live conversation.</p><div className="waiting-summary"><div className="qr-placeholder large"><div className="qr-pattern">▦</div><span>QR placeholder</span></div><div><strong>{username || 'You'}</strong><span>Voice profile ready for this session</span><span className="connected-status">● Microphone ready</span>{voiceProfileId && <small className="profile-id">Demo profile ready</small>}</div></div><div className="flow-actions"><button className="secondary-button" onClick={() => onStep('voice')}>Back</button><button className="primary-button" onClick={onEnterRoom}>Enter meeting room</button></div></div>}
    </div>
  </div></div>
}

function App() {
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem('roundtable-authenticated') === 'true')
  const [authChecking, setAuthChecking] = useState(true)
  const [activeNav, setActiveNav] = useState<WorkspaceTab>('Live room')
  const [isPaused, setIsPaused] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [flowStep, setFlowStep] = useState<SetupStep | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [username, setUsername] = useState('')
  const [voiceProfileId, setVoiceProfileId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile>({ name: '', birthdate: '', email: '', phone: '', imageUrl: '' })
  const [showProfile, setShowProfile] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null)
  const [assistantRoom, setAssistantRoom] = useState<Room | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showSupport, setShowSupport] = useState(false)
  const [dataError, setDataError] = useState('')
  useEffect(() => {
    void authApi.getSession().then(session => {
      if (session?.user && session.user.emailVerified !== false) {
        localStorage.setItem('roundtable-authenticated', 'true')
        setAuthenticated(true)
      } else { localStorage.removeItem('roundtable-authenticated'); setAuthenticated(false) }
    }).catch(() => undefined).finally(() => {
      if (new URLSearchParams(window.location.search).has('neon_auth_session_verifier')) {
        window.history.replaceState({}, document.title, window.location.pathname)
      }
      setAuthChecking(false)
    })
  }, [authenticated])
  useEffect(() => {
    if (!authenticated) return
    void Promise.all([roundtableApi.getProfile(), roundtableApi.getRooms()])
      .then(([loadedProfile, loadedRooms]) => {
        setProfile(loadedProfile)
        setRooms(loadedRooms)
      })
      .catch(error => setDataError(error instanceof Error ? error.message : 'Unable to load Roundtable data. Please try again.'))
  }, [authenticated])

  const openRoom = (room: Room) => { setSelectedRoom(room); setFlowStep('room') }
  const createRoom = (room: Room) => {
    setDataError('')
    void roundtableApi.createRoom(room).then(savedRoom => {
      setRooms(current => [savedRoom, ...current.filter(existing => existing.id !== savedRoom.id)])
      setSelectedRoom(savedRoom)
      setFlowStep('room')
    }).catch(error => setDataError(error instanceof Error ? error.message : 'Unable to save the room. Please try again.'))
  }
  const currentRoom = selectedRoom || rooms.find(room => room.status === 'active') || rooms[0] || null
  const enterMeetingRoom = async () => {
    if (!selectedRoom) return
    const newParticipant = { name: username.trim() || profile.name, initials: (username.trim() || profile.name).split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(), color: 'purple', role: 'Host', status: 'Speaking' }
    const participantsForRoom = selectedRoom.participants.some(participant => participant.name === newParticipant.name) ? selectedRoom.participants : [...selectedRoom.participants, newParticipant]
    const liveRoom = { ...selectedRoom, participants: participantsForRoom, status: 'active' as const, participantCount: participantsForRoom.length }
    setDataError('')
    try {
      await roundtableApi.addParticipant(selectedRoom.id, newParticipant)
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Unable to save the participant. Please try again.')
      return
    }
    setRooms(current => current.map(room => room.id === liveRoom.id ? liveRoom : room))
    setSelectedRoom(liveRoom)
    setAssistantRoom(liveRoom)
    setActiveNav('Live room')
    setFlowStep(null)
    setVoiceProfileId(null)
  }
  const saveProfile = async (nextProfile: Profile) => {
    setDataError('')
    try {
      const saved = await roundtableApi.updateProfile(nextProfile)
      setProfile(saved)
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Unable to save your profile. Please try again.')
      throw error
    }
  }
  const signOut = async () => {
    try { await authApi.signOut() } catch { /* The local session still needs to be cleared if the network is unavailable. */ }
    localStorage.removeItem('roundtable-authenticated')
    setAuthenticated(false)
  }
  const endMeeting = async () => {
    if (!currentRoom) return
    const endedRoom = { ...currentRoom, status: 'ended' as const }
    try {
      await roundtableApi.updateRoomStatus(currentRoom.id, 'ended')
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Unable to update the meeting. Please try again.')
      return
    }
    setRooms(current => current.map(room => room.id === endedRoom.id ? endedRoom : room))
    setSelectedRoom(endedRoom)
    setShowEndModal(false)
  }
  const deleteRoom = async (room: Room) => {
    setDataError('')
    try {
      await roundtableApi.deleteRoom(room.id)
      setRooms(current => current.filter(item => item.id !== room.id))
      if (selectedRoom?.id === room.id) setSelectedRoom(null)
      setDeleteTarget(null)
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Unable to delete the room. Please try again.')
    }
  }

  if (authChecking) return <main className="auth-shell"><section className="auth-card"><div className="brand auth-brand"><span className="brand-mark"><span /></span><span>roundtable</span></div><p>Loading your session…</p></section></main>
  if (!authenticated) return <AuthScreen onAuthenticated={() => setAuthenticated(true)} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><span /></span><span>roundtable</span></div>
        <nav className="nav">
          <p className="nav-label">Workspace</p>
          {[
            ['grid', 'Overview'], ['users', 'People'], ['clock', 'Meeting history'], ['message', 'Meeting assistant'],
          ].map(([icon, label]) => <button className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => setActiveNav(label as WorkspaceTab)} key={label}><Icon name={icon as IconName} /><span>{label}</span></button>)}
          <p className="nav-label room-label">Rooms <button className="add-room-button" onClick={() => setFlowStep('create')}>+ Add room</button></p>
          <div className="room-list">{rooms.map(room => <div className={`room-nav-item ${room.status === 'active' ? 'selected' : ''}`} key={room.id}><button className="room-open-button" onClick={() => openRoom(room)}><span className={`room-status-dot ${room.status}`} /><span>{room.name}</span><small>{room.status === 'active' ? 'Live' : room.status === 'ended' ? 'Ended' : 'Waiting'}</small></button><button className="room-delete-button" onClick={() => setDeleteTarget(room)} aria-label={`Delete ${room.name}`}>×</button></div>)}</div>
          <p className="nav-label room-label">Current room</p>
          <button className={`nav-item ${activeNav === 'Live room' ? 'active' : ''}`} onClick={() => { setActiveNav('Live room'); setSelectedRoom(currentRoom) }}><span className="live-dot" /><span>{currentRoom?.name || 'Live room'}</span><span className="nav-count">{currentRoom?.participantCount || 0}</span></button>
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setShowProfile(true)}><Icon name="settings" /><span>Profile & settings</span></button>
          <button className="profile profile-button" onClick={() => setShowProfile(true)}><span className="profile-avatar">{profile.imageUrl ? <img src={profile.imageUrl} alt="" /> : profile.name.split(' ').map(part => part[0]).join('').slice(0, 2)}</span><div><strong>{profile.name}</strong><small>Admin</small></div><Icon name="more" size={16} /></button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb"><span>Rooms</span><b>/</b><strong>{currentRoom?.name || 'Live room'}</strong></div>
          <div className="top-actions"><button className="icon-button" onClick={() => setShowSearch(true)} aria-label="Search people or rooms"><Icon name="search" /></button><button className="help-button" onClick={() => setShowSupport(true)} aria-label="Support and feedback">?</button><button className="avatar-small" onClick={() => setShowProfile(true)} aria-label="Open profile and settings">{profile.imageUrl ? <img src={profile.imageUrl} alt="" /> : profile.name.split(' ').map(part => part[0]).join('').slice(0, 2)}</button></div>
        </header>
        <div className="content">
          {dataError && <p className="error-text data-error">{dataError}</p>}
          {showProfile ? <ProfilePanel profile={profile} onSave={saveProfile} onSignOut={() => void signOut()} /> : activeNav !== 'Live room' ? <WorkspacePanel tab={activeNav} rooms={rooms} activeRoom={assistantRoom || currentRoom || initialRooms[0]} onInvite={() => setShowInvite(true)} onViewLiveRoom={() => { setActiveNav('Live room'); setSelectedRoom(currentRoom) }} /> : <>
          <div className="room-heading">
            <div><div className="eyebrow">{currentRoom?.status === 'active' ? <><span className="live-pulse" /> LIVE NOW <span className="heading-time">Started 10:28 AM · 24 min</span></> : currentRoom?.status === 'ended' ? 'MEETING ENDED' : 'WAITING ROOM'}</div><h1>{currentRoom?.name || 'Live room'}</h1><p className="subheading">{currentRoom?.description || (currentRoom?.status === 'waiting' ? 'No live conversation has started in this room.' : 'This meeting has ended.')}</p></div>
            <div className="heading-actions"><button className="secondary-button"><Icon name="users" size={16} /> Invite</button><button className="secondary-button"><Icon name="more" size={16} /></button>{currentRoom?.status === 'active' && <button className="end-button" onClick={() => setShowEndModal(true)}>End meeting</button>}</div>
          </div>

          <section className="stat-row">
            <div className="stat-card"><div className="stat-icon purple-bg"><Icon name="users" size={17} /></div><div><span>Participants</span><strong>{currentRoom?.participantCount || 0} <small>/ {currentRoom?.participantCount || 0} connected</small></strong></div><div className="mini-avatars">{(currentRoom?.participants || []).map(p => <span className={`mini-avatar ${p.color}`} key={p.initials}>{p.initials.slice(0, 1)}</span>)}</div></div>
            <div className="stat-card"><div className="stat-icon green-bg"><Icon name="wave" size={17} /></div><div><span>Audio quality</span><strong>Excellent <small className="green-text">· 12ms avg</small></strong></div><div className="signal-bars"><i /><i /><i /><i /></div></div>
            <div className="stat-card"><div className="stat-icon yellow-bg"><Icon name="clock" size={17} /></div><div><span>Speaking time</span><strong>24 <small>min</small></strong></div><div className="speaking-bar"><i /></div></div>
          </section>

          <div className="dashboard-grid">
            <section className="transcript-panel panel">
              <div className="panel-header"><div><h2>{currentRoom?.status === 'active' ? 'Live transcript' : 'Meeting transcript'} {currentRoom?.status === 'active' && <span className="live-tag">● Recording</span>}</h2><p>{currentRoom?.status === 'active' ? 'Captions appear as people speak' : currentRoom?.transcript.length ? 'Transcript from this meeting' : 'No transcript is available for this room.'}</p></div></div>
              <div className="transcript-list">
                {currentRoom?.transcript.map(item => <article className={`transcript-entry ${item.current && currentRoom.status === 'active' ? 'current' : ''}`} key={item.time}><time>{item.time}</time><div className={`speaker-avatar ${item.color}`}>{item.initials}</div><div className="transcript-copy"><div className="speaker-line"><strong>{item.name}</strong>{item.current && currentRoom.status === 'active' && <span className="speaking-label"><span /> Speaking</span>}<span className="confidence">Confidence {item.confidence}</span></div><p>{item.text}</p></div></article>)}{!currentRoom?.transcript.length && <div className="empty-state">No live transcript is running in this room.</div>}
              </div>
              {currentRoom?.status === 'active' && <div className="transcript-footer"><span><span className="listening-dot" /> Listening for speech...</span><button className="scroll-button">Jump to latest <span>↓</span></button></div>}
            </section>

            <div className="right-column">
              <section className="panel participants-panel"><div className="panel-header compact"><div><h2>Participants <span className="count-badge">{currentRoom?.participantCount || 0}</span></h2></div><button className="text-button" onClick={() => setActiveNav('People')}>Manage</button></div><div className="participant-list">{(currentRoom?.participants || []).map(p => <div className="participant" key={p.name}><div className={`speaker-avatar ${p.color}`}>{p.initials}</div><div className="participant-name"><strong>{p.name}</strong><span>{p.role}</span></div>{p.status === 'Speaking' ? <span className="status-speaking"><span /> Speaking</span> : <span className="status-listening">Listening</span>}<button className="more-small"><Icon name="more" size={15} /></button></div>)}{!currentRoom?.participants.length && <div className="empty-state">No participants yet.</div>}</div><div className="device-summary"><span className="check-circle">✓</span><span><strong>{currentRoom?.participantCount || 0} devices connected</strong><small>Room-specific audio streams</small></span><Icon name="chevron" size={15} /></div></section>
              <section className="panel activity-panel"><div className="panel-header compact"><div><h2>Speaker activity</h2><p>Contribution in this meeting</p></div><button className="text-button">Details</button></div><div className="activity-list">{(currentRoom?.participants || []).map((p, i) => <div className="activity-row" key={p.name}><span>{p.name.split(' ')[0]}</span><div className="activity-track"><i className={p.color} style={{ width: `${Math.max(20, 78 - i * 15)}%` }} /></div><b>{Math.max(10, 38 - i * 7)}%</b></div>)}</div><div className="activity-legend"><span><i className="purple" />Speaking now</span><span>Last 24 min</span></div></section>
            </div>
          </div>

          {currentRoom?.status === 'active' && <section className="bottom-row"><div className="overlap-alert"><div className="alert-icon">◈</div><div><strong>Everything is captured</strong><p>Roundtable is listening across {currentRoom.participantCount} devices. Overlapping speech will be marked automatically.</p></div><button className="close-alert">×</button></div><div className="meeting-controls"><button className={`pause-button ${isPaused ? 'paused' : ''}`} onClick={() => setIsPaused(!isPaused)}><Icon name={isPaused ? 'wave' : 'mic'} size={16} /> {isPaused ? 'Resume' : 'Pause'} transcription</button><button className="chat-button" onClick={() => { setAssistantRoom(currentRoom); setActiveNav('Meeting assistant') }}><Icon name="message" size={17} /> Ask about this meeting</button></div></section>}
          </>}
        </div>
      </main>

      {showEndModal && <div className="modal-backdrop" onClick={() => setShowEndModal(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-icon">!</div><h2>End this meeting?</h2><p>The transcript will be saved and this room will no longer appear as live.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setShowEndModal(false)}>Keep meeting</button><button className="end-button" onClick={() => void endMeeting()}>End meeting</button></div></div></div>}
      {deleteTarget && <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}><div className="modal" onClick={event => event.stopPropagation()}><div className="modal-icon">!</div><h2>Delete this room?</h2><p>This removes <strong>{deleteTarget.name}</strong> from your workspace. Meeting history for this demo room will no longer be available.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setDeleteTarget(null)}>Cancel</button><button className="end-button" onClick={() => void deleteRoom(deleteTarget)}>Delete room</button></div></div></div>}
      {showProfile && <button className="profile-close-overlay" onClick={() => setShowProfile(false)} aria-label="Close profile">×</button>}
      {showSearch && <SearchPanel rooms={rooms} onClose={() => setShowSearch(false)} onOpenRoom={room => { setSelectedRoom(room); setActiveNav('Live room'); setShowSearch(false) }} />}
      {showSupport && <SupportPanel profile={profile} onClose={() => setShowSupport(false)} />}
      {showInvite && <InvitePanel rooms={rooms} initialRoom={currentRoom} onClose={() => setShowInvite(false)} />}
      {flowStep && <RoomFlow step={flowStep} room={selectedRoom} onStep={setFlowStep} onCreate={createRoom} onClose={() => { setFlowStep(null); setVoiceProfileId(null) }} onEnterRoom={enterMeetingRoom} username={username} setUsername={setUsername} voiceProfileId={voiceProfileId} onVoiceComplete={profileId => { setVoiceProfileId(profileId); setFlowStep('waiting') }} />}
    </div>
  )
}

export default App
