import { State, StateEvent, property } from '@lit-app/state'
import { getJson } from '../../api_lib/fetch'

export { StateController, type Unsubscribe } from '@lit-app/state'

export type Brc20Price = {
  tick: string
  floorPrice: string
  btcVolume: string
}

class MarketState extends State {
  @property({ type: Object }) public brc20Price: Record<string, Brc20Price> = {}

  public async getBrc20Price(tick: string) {
    return this.brc20Price[tick] ?? this.updateBrc20Price(tick)
  }

  public async updateBrc20Price(tick: string): Promise<Brc20Price> {
    return fetch(`/api/collections?slug=${tick}`)
      .then(getJson)
      .then((res) => {
        const price = res?.data?.data?.[0]
        this.brc20Price[tick] = { tick, floorPrice: price.floorPrice, btcVolume: price.totalVolume }
        console.log('update brc20 price:', JSON.stringify(this.brc20Price))
        this.dispatchEvent(new StateEvent('brc20Price', this.brc20Price, this))
        return this.brc20Price[tick]
      })
  }

  reset(): void {
    super.reset()
    ;[...this.propertyMap]
      // @ts-ignore
      .filter(([key, definition]) => definition.skipReset !== true && definition.resetValue === undefined)
      .forEach(([key, definition]) => {
        ;(this as {} as { [key: string]: unknown })[key as string] = definition.resetValue
      })
  }
}

export const marketState = new MarketState()
