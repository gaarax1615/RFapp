import type {
  HardwareConnectionState,
  HardwareStatus,
  SpectrumConfig,
  SpectrumFrame,
  SpectrumSource,
} from '@/types/spectrum'
import { decodePcm16Base64 } from '@/hardware/audio/PcmPlayer'
import { localSdrWsUrl } from '@/utils/constants'

export type RemotePreferDevice = 'auto' | 'rtl-sdr' | 'hackrf'

export type RemoteSpectrumOptions = {
  endpoint?: string
  preferDevice?: RemotePreferDevice
  serial?: string
}

type ServerStatus = {
  type: 'status'
  state?: HardwareConnectionState
  deviceName?: string | null
  message?: string
  serial?: string | null
  mode?: string
}

type ServerFrame = {
  type: 'frame'
  timestamp: number
  startFrequencyMhz: number
  endFrequencyMhz: number
  binWidthMhz: number
  powerDb: number[]
  hopStartMhz?: number
  hopEndMhz?: number
  hopIndex?: number
  hopCount?: number
  passIndex?: number
}

type ServerError = {
  type: 'error'
  message?: string
}

type ServerAudio = {
  type: 'audio'
  sampleRate: number
  pcm: string
}

type ServerMessage = ServerStatus | ServerFrame | ServerError | ServerAudio

/**
 * Cliente del backend Python local (`Backend`).
 * La UI no habla con USB: solo consume frames por WebSocket.
 */
export class RemoteSpectrumSource implements SpectrumSource {
  readonly id: string
  readonly label: string

  private readonly endpoint: string
  private readonly preferDevice: RemotePreferDevice
  private readonly serial?: string

  private ws: WebSocket | null = null
  private lastConfig: SpectrumConfig | null = null
  private shouldRun = false
  private reconnectTimer: number | null = null
  private listeners = new Set<(frame: SpectrumFrame) => void>()
  private audioListeners = new Set<(samples: Float32Array, sampleRate: number) => void>()
  private status: HardwareStatus = {
    state: 'disconnected',
    deviceName: null,
    message: 'Backend local detenido',
  }

  constructor(options: RemoteSpectrumOptions = {}) {
    this.endpoint = options.endpoint ?? localSdrWsUrl()
    this.preferDevice = options.preferDevice ?? 'auto'
    this.serial = options.serial
    this.id = this.preferDevice === 'rtl-sdr' ? 'rtl-sdr' : 'remote-spectrum'
    this.label =
      this.preferDevice === 'rtl-sdr' ? 'RTL-SDR (backend local)' : 'Backend local'
  }

  async start(config: SpectrumConfig): Promise<void> {
    this.lastConfig = config
    this.shouldRun = true
    this.clearReconnect()
    const live = this.ws
    if (live && live.readyState === WebSocket.OPEN) {
      live.send(this.startPayload(config, 'config'))
      return
    }

    if (live && live.readyState === WebSocket.CONNECTING) {
      return
    }

    await this.stop()
    this.status = {
      state: 'connecting',
      deviceName: null,
      message: `Conectando a ${this.endpoint}`,
    }

    const ws = new WebSocket(this.endpoint)
    this.ws = ws

    await new Promise<void>((resolve, reject) => {
      let settled = false
      const timer = window.setTimeout(() => {
        if (settled) return
        settled = true
        ws.close()
        reject(new Error('Timeout al conectar con el backend local (:8787)'))
      }, 5000)

      const finishOk = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve()
      }

      const finishErr = (message: string) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        if (this.ws === ws) this.ws = null
        try {
          ws.close()
        } catch {
          /* ignore */
        }
        this.status = { state: 'error', deviceName: null, message }
        reject(new Error(message))
      }

      ws.addEventListener('open', () => {
        ws.send(this.startPayload(config, 'start'))
      })

      ws.addEventListener('message', (ev) => {
        const msg = parseMessage(ev.data)
        if (!msg) return
        if (msg.type === 'error') {
          const message = msg.message || 'Error del backend local'
          this.status = {
            state: 'error',
            deviceName: this.status.deviceName,
            message,
          }
          finishErr(message)
          return
        }
        if (msg.type === 'status') {
          this.applyStatus(msg)
          if (msg.state === 'error') {
            finishErr(msg.message || 'El backend local reportó error')
            return
          }
          if (msg.state === 'connected' || msg.state === 'simulated') {
            finishOk()
          }
          return
        }
        if (msg.type === 'frame') {
          this.emitFrame(msg)
          finishOk()
          return
        }
        if (msg.type === 'audio') {
          this.emitAudio(msg)
        }
      })

      ws.addEventListener('error', () => {
        finishErr(
          'No se pudo abrir el WebSocket. Arranca ./start.sh (Backend en :8787).',
        )
      })

      ws.addEventListener('close', () => {
        if (this.ws === ws) this.ws = null
        if (!settled) {
          finishErr('El backend local cerró la conexión')
          return
        }
        if (this.status.state === 'connected' || this.status.state === 'simulated') {
          this.status = {
            state: 'disconnected',
            deviceName: null,
            message: 'Backend local desconectado',
          }
        }
        this.scheduleReconnect()
      })
    })
  }

  async stop(): Promise<void> {
    this.shouldRun = false
    this.clearReconnect()
    const ws = this.ws
    this.ws = null
    if (!ws) {
      this.status = {
        state: 'disconnected',
        deviceName: null,
        message: 'Backend local detenido',
      }
      return
    }
    try {
      ws.close()
    } catch {
      /* ignore */
    }
    this.status = {
      state: 'disconnected',
      deviceName: null,
      message: 'Backend local detenido',
    }
  }

  async listen(
    band: { startMhz: number; endMhz: number },
    demod: 'nfm' | 'wfm' | 'am' = 'nfm',
  ): Promise<void> {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('El backend local no está conectado. Elige RTL-SDR en Ajustes.')
    }
    ws.send(
      JSON.stringify({
        type: 'listen',
        startFrequencyMhz: band.startMhz,
        endFrequencyMhz: band.endMhz,
        demod,
      }),
    )
  }

  async stopListen(): Promise<void> {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'listenStop' }))
  }

  subscribe(listener: (frame: SpectrumFrame) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  subscribeAudio(
    listener: (samples: Float32Array, sampleRate: number) => void,
  ): () => void {
    this.audioListeners.add(listener)
    return () => this.audioListeners.delete(listener)
  }

  getStatus(): HardwareStatus {
    return { ...this.status }
  }

  private clearReconnect(): void {
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun || this.lastConfig == null || this.reconnectTimer != null) return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      const config = this.lastConfig
      if (!this.shouldRun || !config) return
      void this.start(config).catch(() => this.scheduleReconnect())
    }, 800)
  }

  private startPayload(config: SpectrumConfig, type: 'start' | 'config'): string {
    return JSON.stringify({
      type,
      startFrequencyMhz: config.startFrequencyMhz,
      endFrequencyMhz: config.endFrequencyMhz,
      binCount: config.binCount,
      updateRateHz: config.updateRateHz,
      preferDevice: this.preferDevice,
      serial: this.serial ?? null,
    })
  }

  private applyStatus(msg: ServerStatus): void {
    const state = normalizeState(msg.state, msg.mode)
    this.status = {
      state,
      deviceName: msg.deviceName ?? null,
      message: msg.message,
      lastFrameAt: this.status.lastFrameAt,
    }
  }

  private emitFrame(msg: ServerFrame): void {
    const powerDb = Float32Array.from(msg.powerDb)
    const frame: SpectrumFrame = {
      timestamp: msg.timestamp,
      startFrequencyMhz: msg.startFrequencyMhz,
      endFrequencyMhz: msg.endFrequencyMhz,
      binWidthMhz: msg.binWidthMhz,
      powerDb,
      hopStartMhz: msg.hopStartMhz,
      hopEndMhz: msg.hopEndMhz,
      hopIndex: msg.hopIndex,
      hopCount: msg.hopCount,
      passIndex: msg.passIndex,
    }
    this.status = {
      ...this.status,
      lastFrameAt: msg.timestamp,
    }
    for (const listener of this.listeners) listener(frame)
  }

  private emitAudio(msg: ServerAudio): void {
    if (this.audioListeners.size === 0) return
    const samples = decodePcm16Base64(msg.pcm)
    for (const listener of this.audioListeners) listener(samples, msg.sampleRate)
  }
}

function normalizeState(
  state: HardwareConnectionState | undefined,
  mode?: string,
): HardwareConnectionState {
  if (state) return state
  if (mode === 'mock') return 'simulated'
  if (mode === 'rtl-sdr') return 'connected'
  return 'connecting'
}

function parseMessage(data: unknown): ServerMessage | null {
  if (typeof data !== 'string') return null
  try {
    const parsed = JSON.parse(data) as ServerMessage
    if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) return null
    return parsed
  } catch {
    return null
  }
}
