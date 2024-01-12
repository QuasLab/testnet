import { formatUnits } from '@ethersproject/units'
export { formatUnits, parseUnits } from '@ethersproject/units'

export function formatUnitsComma(value: any, decimals: number) {
  return formatUnits(value, decimals).replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',')
}
