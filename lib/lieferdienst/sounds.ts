// Sound system using Web Audio API for professional notification sounds

type SoundType = 'newOrder' | 'callCustomer' | 'orderReady' | 'warning'

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
}

function exponentialDecayTo(param: AudioParam, value: number, endTime: number) {
  param.exponentialRampToValueAtTime(Math.max(value, 0.0001), endTime)
}

export function playSound(type: SoundType, enabled: boolean = true) {
  if (!enabled || typeof window === 'undefined') return
  
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    
    switch (type) {
      case 'newOrder':
        playBellSound(ctx)
        break
      case 'callCustomer':
        playUrgentAlert(ctx)
        break
      case 'orderReady':
        playSuccessSound(ctx)
        break
      case 'warning':
        playWarningSound(ctx)
        break
    }
  } catch (e) {
    // Silent fail for audio
  }
}

function playBellSound(ctx: AudioContext) {
  const now = ctx.currentTime
  
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(880, now)
  gain1.gain.setValueAtTime(0.4, now)
  exponentialDecayTo(gain1.gain, 0.01, now + 0.5)
  osc1.connect(gain1)
  gain1.connect(ctx.destination)
  osc1.start(now)
  osc1.stop(now + 0.5)
  
  setTimeout(() => {
    const ctx2 = getAudioContext()
    if (!ctx2) return
    const osc2 = ctx2.createOscillator()
    const gain2 = ctx2.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(659.25, ctx2.currentTime)
    gain2.gain.setValueAtTime(0.4, ctx2.currentTime)
    exponentialDecayTo(gain2.gain, 0.01, ctx2.currentTime + 0.6)
    osc2.connect(gain2)
    gain2.connect(ctx2.destination)
    osc2.start(ctx2.currentTime)
    osc2.stop(ctx2.currentTime + 0.6)
  }, 200)
}

function playUrgentAlert(ctx: AudioContext) {
  const now = ctx.currentTime
  
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(800, now + i * 0.15)
    gain.gain.setValueAtTime(0.2, now + i * 0.15)
    exponentialDecayTo(gain.gain, 0.01, now + i * 0.15 + 0.1)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + i * 0.15)
    osc.stop(now + i * 0.15 + 0.1)
  }
}

function playSuccessSound(ctx: AudioContext) {
  const now = ctx.currentTime
  
  const notes = [523.25, 659.25, 783.99]
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + i * 0.1)
    gain.gain.setValueAtTime(0.3, now + i * 0.1)
    exponentialDecayTo(gain.gain, 0.01, now + i * 0.1 + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + i * 0.1)
    osc.stop(now + i * 0.1 + 0.3)
  })
}

function playWarningSound(ctx: AudioContext) {
  const now = ctx.currentTime
  
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(600, now)
  osc.frequency.linearRampToValueAtTime(400, now + 0.2)
  gain.gain.setValueAtTime(0.3, now)
  exponentialDecayTo(gain.gain, 0.01, now + 0.3)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.3)
}
