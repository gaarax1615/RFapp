import { useState, type FormEvent, type ReactNode } from 'react'
import { useAppStore } from '@/app/store'
import { useServices } from '@/app/AppProviders'
import type { DeviceType, RfDevice } from '@/types/device'
import { createId } from '@/utils/constants'
import { DEVICE_TYPE_LABELS } from '@/utils/i18n'

const DEVICE_TYPES: DeviceType[] = [
  'Microphone',
  'Instrument',
  'IEM',
  'Bodypack',
  'Other',
]

const emptyForm = (): Omit<RfDevice, 'id'> => ({
  name: '',
  channel: '',
  type: 'Microphone',
  brand: '',
  model: '',
  frequencyMhz: 500,
  notes: '',
  enabled: true,
})

interface QuickDeviceFormProps {
  defaultFrequencyMhz?: number
  onCreated?: (device: RfDevice) => void
}

export function QuickDeviceForm({
  defaultFrequencyMhz,
  onCreated,
}: QuickDeviceFormProps) {
  const { devices: deviceService, monitor } = useServices()
  const setDevices = useAppStore((s) => s.setDevices)
  const setSelectedDeviceId = useAppStore((s) => s.setSelectedDeviceId)
  const spectrumRange = useAppStore((s) => s.spectrumRange)

  const [form, setForm] = useState(() => ({
    ...emptyForm(),
    frequencyMhz:
      defaultFrequencyMhz ??
      +((spectrumRange.startMhz + spectrumRange.endMhz) / 2).toFixed(3),
  }))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    if (!Number.isFinite(form.frequencyMhz) || form.frequencyMhz <= 0) {
      setError('Frecuencia inválida')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const device: RfDevice = {
        id: createId('dev'),
        ...form,
        name: form.name.trim(),
        channel: form.channel.trim(),
        brand: form.brand.trim(),
        model: form.model.trim(),
        notes: form.notes.trim(),
      }
      await deviceService.upsert(device)
      const list = await deviceService.list()
      setDevices(list)
      await monitor.start(list.filter((d) => d.enabled).map((d) => d.id))
      setSelectedDeviceId(device.id)
      setForm({
        ...emptyForm(),
        frequencyMhz: device.frequencyMhz,
      })
      onCreated?.(device)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="flex h-full flex-col rounded-xl border border-white/10 bg-[#141414] p-4"
    >
      <div className="mb-3">
        <p className="font-mono text-[10px] tracking-[0.14em] text-slate-400 uppercase">
          Alta rápida
        </p>
        <h3 className="text-sm font-semibold text-rf-text">Nuevo dispositivo RF</h3>
      </div>

      <div className="grid flex-1 content-start gap-2.5">
        <Field label="Nombre">
          <input
            className="field"
            value={form.name}
            placeholder="Vocal 1"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Canal">
            <input
              className="field"
              value={form.channel}
              placeholder="A1"
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            />
          </Field>
          <Field label="Tipo">
            <select
              className="field"
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as DeviceType })
              }
            >
              {DEVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DEVICE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Frecuencia MHz">
          <input
            className="field font-mono"
            type="number"
            step="0.001"
            value={form.frequencyMhz}
            onChange={(e) =>
              setForm({ ...form, frequencyMhz: Number(e.target.value) })
            }
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Marca">
            <input
              className="field"
              value={form.brand}
              placeholder="Shure"
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            />
          </Field>
          <Field label="Modelo">
            <input
              className="field"
              value={form.model}
              placeholder="QLXD"
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </Field>
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="mt-3 w-full rounded-md bg-zinc-400/20 px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-400/30 disabled:opacity-50"
      >
        {saving ? 'Guardando…' : 'Agregar dispositivo'}
      </button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] tracking-wider text-slate-500 uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}
