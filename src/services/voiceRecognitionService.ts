export interface VoiceEnrollmentResult {
  success: boolean
  profileId: string
  confidence: number
}

export interface VoiceRecognitionService {
  enrollVoice(audio: Blob, userId: string): Promise<VoiceEnrollmentResult>
}

/**
 * Frontend-only adapter. Replace this implementation with the real enrollment
 * client without changing the setup UI or its recording lifecycle.
 */
export const demoVoiceRecognitionService: VoiceRecognitionService = {
  async enrollVoice(audio, userId) {
    if (!audio.size || !userId.trim()) {
      throw new Error('A voice sample and username are required.')
    }
    await new Promise((resolve) => window.setTimeout(resolve, 700))
    return { success: true, profileId: `demo-profile-${Date.now()}`, confidence: 1 }
  },
}
