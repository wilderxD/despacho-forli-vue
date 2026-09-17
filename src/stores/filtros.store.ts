import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type CampoFecha = 'PEDIDOFECHA' | 'FECHAENTREGA'
export type LineaFilter = '' | 'RESORTE' | 'ESPUMA'

export interface Filtros {
  texto: string
  estados: string[]
  supervisores: string[]
  fechaDesde: string
  fechaHasta: string
  campoFecha: CampoFecha
  linea: LineaFilter
}

function defaultFiltros(): Filtros {
  return {
    texto: '',
    estados: [],
    supervisores: [],
    fechaDesde: '',
    fechaHasta: '',
    campoFecha: 'PEDIDOFECHA',
    linea: '',
  }
}

export const useFiltrosStore = defineStore('filtros', () => {
  const prep = ref<Filtros>(defaultFiltros())
  const desp = ref<Filtros>(defaultFiltros())

  // Restore campoFecha from localStorage
  const cfPrep = localStorage.getItem('forli_campo_fecha_prep')
  if (cfPrep === 'FECHAENTREGA') prep.value.campoFecha = 'FECHAENTREGA'
  const cfDesp = localStorage.getItem('forli_campo_fecha_desp')
  if (cfDesp === 'FECHAENTREGA') desp.value.campoFecha = 'FECHAENTREGA'

  function updatePrep(patch: Partial<Filtros>) {
    prep.value = { ...prep.value, ...patch }
  }

  function updateDesp(patch: Partial<Filtros>) {
    desp.value = { ...desp.value, ...patch }
  }

  function setCampoFechaPrep(campo: CampoFecha) {
    updatePrep({ campoFecha: campo })
    localStorage.setItem('forli_campo_fecha_prep', campo)
  }

  function setCampoFechaDesp(campo: CampoFecha) {
    updateDesp({ campoFecha: campo })
    localStorage.setItem('forli_campo_fecha_desp', campo)
  }

  function resetPrep() {
    prep.value = defaultFiltros()
  }

  function resetDesp() {
    desp.value = defaultFiltros()
  }

  function isoField(campo: CampoFecha): 'fechaISO' | 'fechaEntregaISO' {
    return campo === 'FECHAENTREGA' ? 'fechaEntregaISO' : 'fechaISO'
  }

  const isoFieldPrep = computed(() => isoField(prep.value.campoFecha))
  const isoFieldDesp = computed(() => isoField(desp.value.campoFecha))

  return {
    prep,
    desp,
    updatePrep,
    updateDesp,
    setCampoFechaPrep,
    setCampoFechaDesp,
    resetPrep,
    resetDesp,
    isoField,
    isoFieldPrep,
    isoFieldDesp,
  }
})
