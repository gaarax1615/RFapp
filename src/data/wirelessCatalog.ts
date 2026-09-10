import type { DeviceType } from '@/types/device'

export interface PresetChannel {
  label: string
  mhz: number
}

export interface PresetGroup {
  id: string
  label: string
  channels: PresetChannel[]
}

export interface WirelessModel {
  id: string
  brand: string
  model: string
  bandLabel: string
  type: DeviceType
  startMhz: number
  endMhz: number
  /** How you set frequency on the hardware. */
  tuning: 'blx-group-channel' | 'pll-mhz'
  stepMhz: number
  groups?: PresetGroup[]
  notes: string
}

function ch(label: string, mhz: number): PresetChannel {
  return { label, mhz }
}

function group(id: string, freqs: [string, number][]): PresetGroup {
  return {
    id,
    label: `Grupo ${id}`,
    channels: freqs.map(([label, mhz]) => ch(label, mhz)),
  }
}

/** Grupos Full Range (carta oficial Shure BLX). */
const BLX_H8_GROUPS: PresetGroup[] = [
  group('A', [
    ['0', 540.925], ['1', 518.7], ['2', 533.6], ['3', 520.425], ['4', 534.85],
    ['5', 523.1], ['6', 537.0], ['7', 525.05], ['8', 538.4], ['9', 528.1],
    ['A', 539.925], ['B', 541.775],
  ]),
  group('B', [
    ['0', 520.55], ['1', 518.35], ['2', 530.3], ['3', 540.7], ['4', 536.15],
    ['5', 523.55], ['6', 537.55], ['7', 525.925], ['8', 539.45], ['9', 527.65],
  ]),
  group('C', [
    ['0', 541.45], ['1', 518.15], ['2', 532.025], ['3', 520.2], ['4', 535.675],
    ['5', 523.35], ['6', 537.375], ['7', 525.7], ['8', 540.175], ['9', 527.2],
  ]),
  group('D', [
    ['0', 518.35], ['1', 520.325], ['2', 522.025], ['3', 523.2], ['4', 524.75],
    ['5', 529.725], ['6', 530.675], ['7', 533.825], ['8', 535.975], ['9', 538.5],
  ]),
  group('E', [
    ['0', 541.075], ['1', 518.3], ['2', 528.7], ['3', 520.65], ['4', 533.7],
    ['5', 522.1], ['6', 537.9], ['7', 524.225], ['8', 539.825], ['9', 526.925],
  ]),
]

const BLX_H9_GROUPS: PresetGroup[] = [
  ...BLX_H8_GROUPS,
  group('F', [
    ['0', 512.425], ['1', 535.725], ['2', 517.325], ['3', 513.825], ['4', 522.75],
    ['5', 525.875], ['6', 530.45], ['7', 520.3], ['8', 541.6], ['9', 539.9],
  ]),
]

const BLX_H10_GROUPS: PresetGroup[] = [
  group('A', [
    ['0', 542.55], ['1', 571.675], ['2', 546.425], ['3', 561.175], ['4', 551.575],
    ['5', 554.45], ['6', 549.575], ['7', 563.875], ['8', 567.325], ['9', 569.85],
    ['A', 544.125], ['B', 570.95],
  ]),
  group('B', [
    ['0', 570.6], ['1', 555.9], ['2', 549.1], ['3', 564.075], ['4', 553.25],
    ['5', 545.95], ['6', 562.175], ['7', 551.6], ['8', 567.0], ['9', 569.125],
  ]),
  group('C', [
    ['0', 542.425], ['1', 569.9], ['2', 555.875], ['3', 550.3], ['4', 565.725],
    ['5', 547.325], ['6', 560.45], ['7', 552.75], ['8', 567.275], ['9', 543.825],
  ]),
  group('D', [
    ['0', 542.775], ['1', 544.35], ['2', 545.5], ['3', 547.2], ['4', 548.475],
    ['5', 554.6], ['6', 555.575], ['7', 558.85], ['8', 562.4], ['9', 564.4],
  ]),
  group('E', [
    ['0', 542.125], ['1', 544.075], ['2', 547.025], ['3', 548.775], ['4', 551.3],
    ['5', 554.425], ['6', 556.575], ['7', 565.375], ['8', 568.175], ['9', 570.475],
  ]),
]

const BLX_J10_GROUPS: PresetGroup[] = [
  group('A', [
    ['0', 607.05], ['1', 584.4], ['2', 592.4], ['3', 585.7], ['4', 594.025],
    ['5', 587.7], ['6', 594.975], ['7', 589.45], ['8', 604.775], ['9', 590.525],
    ['A', 605.975], ['B', 607.5],
  ]),
  group('B', [
    ['0', 606.7], ['1', 584.35], ['2', 596.3], ['3', 586.55], ['4', 602.15],
    ['5', 589.55], ['6', 603.55], ['7', 591.925], ['8', 605.45], ['9', 593.65],
  ]),
  group('C', [
    ['0', 607.45], ['1', 584.15], ['2', 598.025], ['3', 586.2], ['4', 601.675],
    ['5', 589.35], ['6', 603.375], ['7', 591.7], ['8', 606.175], ['9', 593.2],
  ]),
  group('D', [
    ['0', 584.2], ['1', 585.575], ['2', 586.65], ['3', 589.45], ['4', 591.275],
    ['5', 594.35], ['6', 598.0], ['7', 601.225], ['8', 602.45], ['9', 603.4],
  ]),
  group('E', [
    ['0', 607.075], ['1', 584.3], ['2', 594.7], ['3', 586.65], ['4', 599.7],
    ['5', 588.1], ['6', 603.9], ['7', 590.225], ['8', 605.825], ['9', 592.925],
  ]),
]

export const WIRELESS_CATALOG: WirelessModel[] = [
  {
    id: 'shure-blx4-h8',
    brand: 'Shure',
    model: 'BLX4',
    bandLabel: 'H8',
    type: 'Microphone',
    startMhz: 518,
    endMhz: 542,
    tuning: 'blx-group-channel',
    stepMhz: 0.025,
    groups: BLX_H8_GROUPS,
    notes: 'Receptor BLX4 banda H8. En el equipo elige Grupo y Canal.',
  },
  {
    id: 'shure-blx4-h9',
    brand: 'Shure',
    model: 'BLX4',
    bandLabel: 'H9',
    type: 'Microphone',
    startMhz: 512,
    endMhz: 542,
    tuning: 'blx-group-channel',
    stepMhz: 0.025,
    groups: BLX_H9_GROUPS,
    notes: 'Receptor BLX4 banda H9 (mira la etiqueta: BLX4=-H9).',
  },
  {
    id: 'shure-blx4-h10',
    brand: 'Shure',
    model: 'BLX4',
    bandLabel: 'H10',
    type: 'Microphone',
    startMhz: 542,
    endMhz: 572,
    tuning: 'blx-group-channel',
    stepMhz: 0.025,
    groups: BLX_H10_GROUPS,
    notes: 'Receptor BLX4 banda H10 (etiqueta BLX4=-H10).',
  },
  {
    id: 'shure-blx4-j10',
    brand: 'Shure',
    model: 'BLX4',
    bandLabel: 'J10',
    type: 'Microphone',
    startMhz: 584,
    endMhz: 608,
    tuning: 'blx-group-channel',
    stepMhz: 0.025,
    groups: BLX_J10_GROUPS,
    notes: 'Receptor BLX4 banda J10.',
  },
  {
    id: 'xtuga-iem1200',
    brand: 'Xtuga',
    model: 'IEM1200',
    bandLabel: '550–580',
    type: 'IEM',
    startMhz: 550,
    endMhz: 580,
    tuning: 'pll-mhz',
    stepMhz: 0.25,
    notes: 'In-ears Xtuga IEM1200. Si es de 2 canales, agrégalos como dos equipos.',
  },
  {
    id: 'xtuga-sem200',
    brand: 'Xtuga',
    model: 'SEM200',
    bandLabel: '550–590',
    type: 'IEM',
    startMhz: 550,
    endMhz: 590,
    tuning: 'pll-mhz',
    stepMhz: 0.25,
    notes: 'In-ears Xtuga SEM200 (2×100 frecuencias).',
  },
  {
    id: 'xtuga-bk510',
    brand: 'Xtuga',
    model: 'BK510',
    bandLabel: '572–599',
    type: 'IEM',
    startMhz: 572,
    endMhz: 599,
    tuning: 'pll-mhz',
    stepMhz: 0.25,
    notes: 'In-ears Xtuga BK510 / RW2080.',
  },
  {
    id: 'xtuga-rw2090',
    brand: 'Xtuga',
    model: 'RW2090',
    bandLabel: '550–600',
    type: 'IEM',
    startMhz: 550.1,
    endMhz: 599.85,
    tuning: 'pll-mhz',
    stepMhz: 0.25,
    notes: 'In-ears Xtuga RW2090 (200 presets).',
  },
]

export function getWirelessModel(id: string): WirelessModel | undefined {
  return WIRELESS_CATALOG.find((m) => m.id === id)
}

export function catalogLabel(model: WirelessModel): string {
  return `${model.brand} ${model.model} ${model.bandLabel}`
}
