const API_URL = import.meta.env.VITE_NEON_FUNCTION_API_BASE_URL as string | undefined
import { authApi } from './authApi'

export type Profile = { name: string; birthdate: string; email: string; phone: string; imageUrl: string }
export type RoomParticipant = { name: string; initials: string; color: string; role: string; status: string }
export type TranscriptEntry = { time: string; name: string; initials: string; color: string; text: string; confidence: string; current?: boolean }
export type Room = { id: string; name: string; type: string; description: string; createdAt: string; participantCount: number; status: 'waiting' | 'active' | 'ended'; participants: RoomParticipant[]; transcript: TranscriptEntry[] }
export type Feedback = { name: string; email: string; message: string }

function normalizeProfile(profile: Profile): Profile {
  return { ...profile, birthdate: profile.birthdate ? profile.birthdate.slice(0, 10) : '' }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error('Neon API URL is not configured.')
  const token = await authApi.getAuthToken()
  if (!token) throw new Error('Your authentication session has expired. Please sign in again.')
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init?.headers } })
  if (!response.ok) throw new Error(await response.text() || `Request failed with ${response.status}.`)
  return response.json() as Promise<T>
}

export const roundtableApi = {
  getRooms: async () => (await request<Partial<Room>[]>('/rooms')).map(room => ({ ...room, participants: room.participants || [], transcript: room.transcript || [], status: room.status || 'waiting' } as Room)),
  createRoom: (room: Pick<Room, 'id' | 'name' | 'type' | 'description'>) => request<Room>('/rooms', { method: 'POST', body: JSON.stringify(room) }),
  addParticipant: (roomId: string, participant: Pick<RoomParticipant, 'name' | 'initials' | 'color'>) => request<{ ok: true }>('/rooms/participants', { method: 'POST', body: JSON.stringify({ roomId, ...participant }) }),
  addTranscriptEntry: (roomId: string, entry: Omit<TranscriptEntry, 'current'> & { current?: boolean }) => request<{ ok: true }>('/rooms/transcript', { method: 'POST', body: JSON.stringify({ roomId, ...entry }) }),
  updateRoomStatus: (roomId: string, status: Room['status']) => request<{ ok: true }>('/rooms/status', { method: 'POST', body: JSON.stringify({ roomId, status }) }),
  getProfile: async () => normalizeProfile(await request<Profile>('/profile')),
  updateProfile: async (profile: Profile) => normalizeProfile(await request<Profile>('/profile', { method: 'POST', body: JSON.stringify(profile) })),
  deleteRoom: (roomId: string) => request<{ ok: true }>('/rooms/delete', { method: 'POST', body: JSON.stringify({ roomId }) }),
  submitFeedback: (feedback: Feedback) => request<{ ok: true }>('/feedback', { method: 'POST', body: JSON.stringify(feedback) }),
  askChatbot: (question: string, room: { id: string; name: string; type: string; participantCount: number }) => request<{ answer: string }>('/chat', { method: 'POST', body: JSON.stringify({ question, roomId: room.id, roomName: room.name, roomType: room.type, participantCount: room.participantCount }) }),
}
