import { State, property } from '@lit-app/state'

export { StateController, type Unsubscribe } from '@lit-app/state'

export type TickPrice = {
  tick: string
  platform: string
  close: string
  volume: string
}
//NOT IMPLEMENTED YET!!
export type WebsocketState = {
  websocket: WebSocket
  lockReconnect: boolean
  timeout: number
}

export const platBinance: string = 'binance'
export const platOkcoin: string = 'okcoin'

class PriceState extends State {
  private binance_wss = 'wss://stream.binance.com:443/stream?streams=btcusdt@ticker/ordiusdt@ticker/1000satsusdt@ticker'
  private okcoin_wss = 'wss://real.okcoin.com:8443/ws/v5/public'
  private okcoin_data = {
    op: 'subscribe',
    args: [
      {
        channel: 'tickers',
        instId: 'BTC-USD'
      }
    ]
  }
  @property({ type: Object }) public prices: Record<string, TickPrice> = {}
  private binanceWebsocket?: WebSocket
  private okcoinWebsocket?: WebSocket

  //key: binance_btc
  public getPlatformTickPrice(platform: string, tick: string) {
    var v: TickPrice = this.prices[platform + '_' + tick] ?? this.getDefaultPrice(platform, tick)
    return v?.close
  }

  protected getDefaultPrice(platform: string, tick: string): TickPrice {
    return { tick: tick, platform: platform, close: '0', volume: '0' }
  }

  public getTickPrice(tick: string) {
    var binance = this.getPlatformTickPrice(platBinance, tick)
    var okcoin = this.getPlatformTickPrice(platOkcoin, tick)
    console.log("prices getting", binance, okcoin)
    if (binance == '0' && okcoin == '0') {
      return 'N/A'
    } else {
      var binancePercent = binance == '0' ? 0 : 1
      var okcoinPercent = okcoin == '0' ? 0 : 1
      var price = (
        (Number(binance) * binancePercent + Number(okcoin) * okcoinPercent) /
        (binancePercent + okcoinPercent)
      ).toFixed(8)
      return price
    }
  }

  private async initBinanceWebsocket() {
    this.binanceWebsocket = new WebSocket(this.binance_wss)
    this.binanceWebsocket.addEventListener('message', (e: any) => {
      var msg = JSON.parse(e.data).data
    //   console.log('receive message:', msg)
      var tick = msg.s.substring(0, msg.s.length - 4).toLowerCase()
      this.prices[platBinance + '_' + tick] = { tick: tick, platform: platBinance, close: msg.c, volume: msg.v }
    })
    this.binanceWebsocket.addEventListener('close', () => {
      console.log('binance ws closed!')
      this.initBinanceWebsocket()
    })
  }

  private async initOkcoinWebsocket() {
    this.okcoinWebsocket = new WebSocket(this.okcoin_wss)
    this.okcoinWebsocket.addEventListener('open', () => {
      this.okcoinWebsocket?.send(JSON.stringify(this.okcoin_data))
    })
    this.okcoinWebsocket.addEventListener('message', (e: any) => {
      console.log('receive message:', e.data)
      var message = JSON.parse(e.data).data
      if (message != undefined) {
        var msg = message[0]
        var tick = msg.instId.substring(0, msg.instId.length - 4).toLowerCase()
        this.prices[platOkcoin + '_' + tick] = { tick: tick, platform: platOkcoin, close: msg.last, volume: msg.vol24h }
      }
    })
    this.okcoinWebsocket.addEventListener('close', () => {
      console.log('okcoin ws closed!')
      this.initOkcoinWebsocket()
    })
    this.okcoinWebsocket.addEventListener('error', () => {
      console.log('okcoin ws ERROR!')
    })
  }

  public async subscribeAll() {
    this.initBinanceWebsocket()
    this.initOkcoinWebsocket()
  }

  public unsubscribeAll() {
    //TODO
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

export const priceState = new PriceState()
