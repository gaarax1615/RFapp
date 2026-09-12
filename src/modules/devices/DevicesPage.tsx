import { useState, type FormEvent, type ReactNode } from 'react'
import { useAppStore } from '@/app/store'
import { useServices } from '@/app/AppProviders'
import type { DeviceType, RfDevice } from '@/types/device'
import { createId, formatFrequencyMhz } from '@/utils/constants'
import { DEVICE_TYPE_LABELS, deviceTypeLabel, formatDeviceChannel } from '@/utils/i18n'

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

export function DevicesPage() {
  const { devices: deviceService, monitor } = useServices()
  const devices = useAppStore((s) => s.devices)
  const setDevices = useAppStore((s) => s.setDevices)
  const selectedDeviceId = useAppStore((s) => s.selectedDeviceId)
  const setSelectedDeviceId = useAppStore((s) => s.setSelectedDeviceId)

  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const refreshMonitor = async (list: RfDevice[]) => {
    const enabledIds = list.filter((d) => d.enabled).map((d) => d.id)
    await monitor.start(enabledIds)
  }

  const startEdit = (device: RfDevice) => {
    setEditingId(device.id)
    setSelectedDeviceId(device.id)
    setForm({
      name: device.name,
      channel: device.channel,
      type: device.type,
      brand: device.brand,
      model: device.model,
      frequencyMhz: device.frequencyMhz,
      notes: device.notes,
      enabled: device.enabled,
    })
    setError(null)
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm())
    setError(null)
  }

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
      const previous = editingId
        ? devices.find((d) => d.id === editingId)
        : undefined
      const device: RfDevice = {
        id: editingId ?? createId('dev'),
        ...form,
        name: form.name.trim(),
        channel: form.channel.trim(),
        brand: form.brand.trim(),
        model: form.model.trim(),
        notes: form.notes.trim(),
        catalogId: previous?.catalogId,
      }
      await deviceService.upsert(device)
      const list = await deviceService.list()
      setDevices(list)
      await refreshMonitor(list)
      setSelectedDeviceId(device.id)
      resetForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const onClearAll = async () => {
    if (!confirm('¿Borrar todos los dispositivos?')) return
    await deviceService.clearAll()
    setDevices([])
    await refreshMonitor([])
    setSelectedDeviceId(null)
    resetForm()
  }

  const onEliminar = async (id: string) => {
    if (!confirm('¿Eliminar este dispositivo?')) return
    await deviceService.remove(id)
    const list = await deviceService.list()
    setDevices(list)
    await refreshMonitor(list)
    if (selectedDeviceId === id) setSelectedDeviceId(null)
    if (editingId === id) resetForm()
  }

  const toggleEnabled = async (device: RfDevice) => {
    const next = { ...device, enabled: !device.enabled }
    await deviceService.upsert(next)
    const list = await deviceService.list()
    setDevices(list)
    await refreshMonitor(list)
  }

  return (
    <div className="flex flex-col gap-6 p-5 md:p-8">
      <header>
        <p className="font-mono text-[11px] tracking-[0.18em] text-rf-muted uppercase">
          Inventario
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Dispositivos</h2>
        <p className="mt-1 text-sm text-rf-muted">
          Inventario vacío para coordinar desde Escaneo · {devices.length} equipos
        </p>
        {devices.length > 0 ? (
          <button
            type="button"
            onClick={() => void onClearAll()}
            className="mt-3 text-xs text-red-400/80 hover:text-red-400"
          >
            Borrar todos
          </button>
        ) : (
          <p className="mt-3 text-sm text-zinc-200/80">
            Ve a <span className="font-medium text-zinc-300">Escaneo</span>, agrega
            tus inalámbricos, calcula y pulsa «Usar esta opción».
          </p>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-lg border border-rf-border bg-rf-panel">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-rf-border bg-rf-bg/40 font-mono text-[11px] tracking-wider text-rf-muted uppercase">
              <tr>
                <th className="px-3 py-2.5 font-medium">Nombre</th>
                <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Canal</th>
                <th className="px-3 py-2.5 font-medium">Frec.</th>
                <th className="hidden px-3 py-2.5 font-medium md:table-cell">Tipo</th>
                <th className="px-3 py-2.5 font-medium">Activo</th>
                <th className="px-3 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rf-border">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-rf-muted">
                    No hay dispositivos. Agrégalos aquí o coordínalos en Escaneo.
                  </td>
                </tr>
              ) : null}
              {devices.map((device) => (
                <tr
                  key={device.id}
                  className={
                    device.id === selectedDeviceId ? 'bg-rf-elevated/50' : undefined
                  }
                >
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      className="text-left font-medium hover:text-rf-cyan"
                      onClick={() => startEdit(device)}
                    >
                      {device.name}
                    </button>
                    <p className="text-xs text-rf-muted">
                      {device.brand} {device.model}
                    </p>
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono text-rf-muted sm:table-cell">
                    {formatDeviceChannel(device.channel)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-rf-cyan">
                    {formatFrequencyMhz(device.frequencyMhz)}
                  </td>
                  <td className="hidden px-3 py-2.5 text-rf-muted md:table-cell">
                    {deviceTypeLabel(device.type)}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => void toggleEnabled(device)}
                      className={[
                        'rounded border px-2 py-0.5 font-mono text-[10px]',
                        device.enabled
                          ? 'border-zinc-400/50 text-zinc-300'
                          : 'border-rf-border text-rf-muted',
                      ].join(' ')}
                    >
                      {device.enabled ? 'SÍ' : 'NO'}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => void onEliminar(device.id)}
                      className="text-xs text-red-400/80 hover:text-red-400"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="h-fit rounded-lg border border-rf-border bg-rf-panel p-4"
        >
          <h3 className="text-sm font-semibold">
            {editingId ? 'Editar dispositivo' : 'Agregar dispositivo'}
          </h3>
          <div className="mt-4 grid gap-3">
            <Field label="Nombre">
              <input
                className="field"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Guitar 1"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Canal">
                <input
                  className="field"
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                  placeholder="C8"
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Marca">
                <input
                  className="field"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="Shure"
                />
              </Field>
              <Field label="Modelo">
                <input
                  className="field"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="GLXD"
                />
              </Field>
            </div>
            <Field label="Frecuencia (MHz)">
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
            <Field label="Notas">
              <textarea
                className="field min-h-16"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-rf-muted">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              Activo / mostrar en el espectro
            </label>
          </div>

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-rf-cyan/20 px-3 py-2 text-sm font-medium text-rf-cyan hover:bg-rf-cyan/30 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : editingId ? 'Actualizar' : 'Agregar'}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-rf-border px-3 py-2 text-sm text-rf-muted"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] tracking-wider text-rf-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}
