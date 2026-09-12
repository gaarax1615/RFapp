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

const BLX_J11_GROUPS: PresetGroup[] = [
  group('A', [
    ['0', 596.15], ['1', 597.2], ['2', 598.75], ['3', 600.875], ['4', 604.025],
    ['5', 605.4], ['6', 607.85], ['7', 614.175], ['8', 615.875], ['9', 615.625],
  ]),
  group('B', [
    ['1', 596.15], ['2', 597.85], ['3', 600.125], ['4', 603.15],
    ['5', 605.0], ['6', 607.575], ['7', 614.425], ['8', 615.675], ['9', 607.5],
  ]),
  group('C', [
    ['1', 597.525], ['2', 599.2], ['3', 601.9], ['4', 603.975],
    ['5', 605.225], ['6', 607.075], ['7', 614.3], ['8', 615.825],
  ]),
  group('D', [
    ['1', 597.25], ['2', 598.6], ['3', 600.325], ['4', 602.9],
    ['5', 604.925], ['6', 606.15], ['7', 607.65], ['8', 614.65],
  ]),
  group('E', [
    ['1', 596.45], ['2', 598.775], ['3', 600.075], ['4', 602.25],
    ['5', 605.025], ['6', 606.85], ['7', 614.325], ['8', 615.775],
  ]),
]

const BLX_K12_GROUPS: PresetGroup[] = [
  group('A', [
    ['0', 637.075], ['1', 614.425], ['2', 622.425], ['3', 615.725], ['4', 624.05],
    ['5', 617.725], ['6', 625.0], ['7', 619.475], ['8', 634.8], ['9', 620.55],
  ]),
  group('B', [
    ['0', 636.725], ['1', 614.375], ['2', 626.325], ['3', 616.575], ['4', 632.175],
    ['5', 619.575], ['6', 633.575], ['7', 621.95], ['8', 635.475], ['9', 623.675],
  ]),
  group('C', [
    ['0', 637.475], ['1', 614.175], ['2', 628.05], ['3', 616.225], ['4', 631.7],
    ['5', 619.375], ['6', 633.4], ['7', 621.725], ['8', 636.2], ['9', 623.225],
  ]),
  group('D', [
    ['0', 614.475], ['1', 616.55], ['2', 617.85], ['3', 619.75], ['4', 621.95],
    ['5', 626.725], ['6', 628.175], ['7', 630.5], ['8', 633.15], ['9', 634.925],
  ]),
  group('E', [
    ['0', 637.1], ['1', 614.325], ['2', 624.725], ['3', 616.675], ['4', 629.725],
    ['5', 618.125], ['6', 620.25], ['7', 633.925], ['8', 635.85], ['9', 622.95],
  ]),
]

const BLX_M15_GROUPS: PresetGroup[] = [
  group('A', [
    ['0', 685.05], ['1', 662.4], ['2', 670.4], ['3', 663.7], ['4', 672.025],
    ['5', 665.7], ['6', 672.975], ['7', 667.45], ['8', 682.775], ['9', 668.525],
    ['A', 684.0], ['B', 685.35],
  ]),
  group('B', [
    ['0', 684.7], ['1', 662.35], ['2', 674.3], ['3', 664.55], ['4', 680.15],
    ['5', 667.55], ['6', 681.55], ['7', 669.925], ['8', 683.45], ['9', 671.65],
  ]),
  group('C', [
    ['0', 685.45], ['1', 662.15], ['2', 676.025], ['3', 664.2], ['4', 679.675],
    ['5', 667.35], ['6', 681.375], ['7', 669.7], ['8', 684.175], ['9', 671.2],
  ]),
  group('D', [
    ['0', 663.225], ['1', 664.3], ['2', 668.375], ['3', 670.75], ['4', 671.575],
    ['5', 673.825], ['6', 677.7], ['7', 679.475], ['8', 680.425], ['9', 682.025],
  ]),
  group('E', [
    ['0', 685.075], ['1', 662.3], ['2', 672.7], ['3', 664.65], ['4', 677.7],
    ['5', 666.1], ['6', 681.9], ['7', 668.225], ['8', 683.825], ['9', 670.925],
  ]),
]

const BLX_R12_GROUPS: PresetGroup[] = [
  group('A', [
    ['1', 794.075], ['2', 795.275], ['3', 798.025], ['4', 799.925],
    ['5', 796.3], ['6', 802.425], ['7', 804.025], ['8', 805.35], ['9', 805.85],
  ]),
  group('B', [
    ['1', 800.075], ['2', 801.975], ['3', 804.725], ['4', 805.925],
    ['5', 794.9], ['6', 795.775], ['7', 798.725], ['8', 803.7], ['9', 805.875],
  ]),
  group('C', [
    ['1', 794.2], ['2', 796.3], ['3', 798.9], ['4', 800.8],
    ['5', 802.125], ['6', 804.375], ['7', 805.875], ['8', 804.675], ['9', 805.3],
  ]),
  group('D', [
    ['1', 794.15], ['2', 796.425], ['3', 797.975], ['4', 800.45],
    ['5', 802.35], ['6', 803.75], ['7', 805.85], ['8', 804.925],
  ]),
  group('E', [
    ['1', 794.175], ['2', 796.45], ['3', 798.0], ['4', 800.475],
    ['5', 802.375], ['6', 803.775], ['7', 805.875], ['8', 805.275],
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
    id: 'shure-blx4-j11',
    brand: 'Shure',
    model: 'BLX4',
    bandLabel: 'J11',
    type: 'Microphone',
    startMhz: 596,
    endMhz: 616,
    tuning: 'blx-group-channel',
    stepMhz: 0.025,
    groups: BLX_J11_GROUPS,
    notes: 'Receptor BLX4 banda J11 (596–616 MHz; en EE.UU. salta el hueco 608–614).',
  },
  {
    id: 'shure-blx4-k12',
    brand: 'Shure',
    model: 'BLX4',
    bandLabel: 'K12',
    type: 'Microphone',
    startMhz: 614,
    endMhz: 638,
    tuning: 'blx-group-channel',
    stepMhz: 0.025,
    groups: BLX_K12_GROUPS,
    notes: 'Receptor BLX4 banda K12 (614–638). En el equipo: Grupo A–E, Canal 0–9 (sin A/B).',
  },
  {
    id: 'shure-blx4-m15',
    brand: 'Shure',
    model: 'BLX4',
    bandLabel: 'M15',
    type: 'Microphone',
    startMhz: 662,
    endMhz: 686,
    tuning: 'blx-group-channel',
    stepMhz: 0.025,
    groups: BLX_M15_GROUPS,
    notes: 'Receptor BLX4 banda M15 (etiqueta BLX4=-M15).',
  },
  {
    id: 'shure-blx4-r12',
    brand: 'Shure',
    model: 'BLX4',
    bandLabel: 'R12',
    type: 'Microphone',
    startMhz: 794,
    endMhz: 806,
    tuning: 'blx-group-channel',
    stepMhz: 0.025,
    groups: BLX_R12_GROUPS,
    notes: 'Receptor BLX4 banda R12 (794–806 MHz; algunos manuales listan 796–806).',
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

/** Recupera el modelo de un dispositivo ya guardado para reescanear. */
export function guessCatalogId(device: {
  catalogId?: string
  brand: string
  model: string
  frequencyMhz: number
}): string | null {
  if (device.catalogId && getWirelessModel(device.catalogId)) return device.catalogId

  const brand = device.brand.toLowerCase()
  const model = device.model.toLowerCase()
  const freq = device.frequencyMhz

  const hits = WIRELESS_CATALOG.filter((m) => {
    const sameBrand = brand.includes(m.brand.toLowerCase()) || model.includes(m.brand.toLowerCase())
    const sameModel =
      model.includes(m.model.toLowerCase()) ||
      model.includes(m.bandLabel.toLowerCase().replace('–', '-'))
    const inBand = freq >= m.startMhz - 1 && freq <= m.endMhz + 1
    return sameBrand && sameModel && inBand
  })
  if (hits.length === 1) return hits[0]!.id
  if (hits.length > 1) {
    const byFreq = hits.find((m) => freq >= m.startMhz && freq <= m.endMhz)
    return (byFreq ?? hits[0])!.id
  }

  if (brand.includes('shure') || model.includes('blx')) {
    if (freq >= 794) return 'shure-blx4-r12'
    if (freq >= 662) return 'shure-blx4-m15'
    if (freq >= 614) return 'shure-blx4-k12'
    if (freq >= 596) return 'shure-blx4-j11'
    if (freq >= 584) return 'shure-blx4-j10'
    if (freq >= 542) return 'shure-blx4-h10'
    if (freq >= 512) return 'shure-blx4-h9'
    if (freq >= 518) return 'shure-blx4-h8'
  }
  if (brand.includes('xtuga') || model.includes('iem') || model.includes('xtuga')) {
    const xtuga = WIRELESS_CATALOG.filter(
      (m) => m.brand === 'Xtuga' && freq >= m.startMhz && freq <= m.endMhz,
    )
    return xtuga[0]?.id ?? 'xtuga-iem1200'
  }
  return null
}
