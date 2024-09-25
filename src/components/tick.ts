import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import baseStyle from '/src/base.css?inline'
import style from './tick.css?inline'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/icon/icon'
import { Brc20Balance, Unsubscribe, walletState } from '../lib/walletState'
import './supplyTick'
import { formatUnitsComma, parseUnits } from '../lib/units'
import { toast, toastImportant } from '../lib/toast'
import { getJson } from '../../api_lib/fetch'
import { Brc20Price, marketState } from '../lib/marketState'
import * as btc from '@scure/btc-signer'
import { hex, utf8 } from '@scure/base'
import { prepareRevealInscription } from '../lib/inscribe'
import { priceState } from '../lib/priceState'

@customElement('tick-row')
export class TickRow extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]
  @property() tick?: string
  @state() balance?: Brc20Balance
  @state() collateral?: Brc20Balance
  @state() price?: string
  @state() minting = false
  @state() withdrawing = false
  @state() priceTick?: string

  get tickQ() {
    return this.tick?.replace(/.$/, 'Q')
  }

  get pricing() {
    if (this.tick == 'sats') {
      this.priceTick = 'Price in USD is 1000 ' + this.tick
      var v = priceState.getTickPrice('1000sats')
      return Number(v).toFixed(6)
    } else {
      return Number(priceState.getTickPrice(this.tick ?? '')).toFixed(2)
    }
  }

  private priceUpdater?: Promise<any>
  private balanceUpdater?: Promise<any>
  private stateUnsubscribes: Unsubscribe[] = []

  connectedCallback(): void {
    super.connectedCallback()
    this.stateUnsubscribes.push(
      walletState.subscribe((k, v) => {
        switch (k) {
          case '_brc20Balance':
            this.balance = v?.find((b: any) => b.tick == this.tickQ)
            break
          case '_collateralBalance':
            this.collateral = v?.find((b: any) => b.ticker == this.tickQ)
            break
          case '_address':
            if (v) walletState.updateBrc20Balance()
            break
        }
      })
    )
    this.stateUnsubscribes.push(
      priceState.subscribe((k) => {
        switch (k) {
          case 'prices':
            this.requestUpdate()
            break
        }
      })
    )
    this.stateUnsubscribes.push(
      marketState.subscribe((_, v: Record<string, Brc20Price>) => {
        if (this.tick) this.price = v?.[this.tick]?.floorPrice
      }, 'brc20Price')
    )
    this.priceUpdater ??= this.updateBrc20Price()
    this.balanceUpdater ??= this.updateBrc20Balance()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this.priceUpdater = undefined
    this.balanceUpdater = undefined
    this.stateUnsubscribes.forEach((f) => f())
    this.stateUnsubscribes = []
  }

  async updateBrc20Price() {
    while (true) {
      await marketState
        .updateBrc20Price(this.tick!)
        .catch((e) => console.log(`failed to fetch price for ${this.tick}, error:`, e))
      await new Promise((r) => setTimeout(r, 60000))
    }
  }

  async updateBrc20Balance() {
    while (true) {
      await walletState.updateBrc20Balance().catch((e) => console.log(`failed to update brc20 balance, error:`, e))
      await new Promise((r) => setTimeout(r, 60000))
    }
  }

  mint() {
    const tick = this.tickQ!
    this.minting = true
    var { alert } = toastImportant(`Preparing inscribe transaction`)
    Promise.all([
      walletState.getPublicKey(),
      walletState.getAddress(),
      fetch('https://mempool.space/testnet/api/v1/fees/recommended').then(getJson)
    ])
      .then(async ([publicKey, address, feeRates]) => {
        if (!address) throw new Error('failed to get wallet address')
        const {
          inscription,
          customScripts,
          revealPayment,
          revealFee: fee
        } = prepareRevealInscription(tick, 'mint', 1000, address, publicKey, feeRates)
        await alert.hide()

        const value = 600n
        alert = toastImportant(
          `Inscribing <span style="white-space:pre-wrap">${utf8.encode(inscription.body)}</span>`
        ).alert
        const txid = await walletState.connector?.sendBitcoin(revealPayment.address!, Number(value + fee))
        await alert.hide()

        alert = toastImportant(`Waiting for inscription to be announced in mempool<sl-spinner></sl-spinner>`).alert
        while (true) {
          const res = await fetch(`https://mempool.space/testnet/api/tx/${txid}/status`)
          if (res.status == 200) {
            break
          }
          await new Promise((r) => setTimeout(r, 1000))
        }
        await alert.hide()

        alert = toastImportant(
          `Revealing <span style="white-space:pre-wrap">${utf8.encode(inscription.body)}</span>`
        ).alert
        const tx = new btc.Transaction({ customScripts })
        tx.addInput({
          ...revealPayment,
          txid,
          index: 0,
          witnessUtxo: { script: revealPayment.script, amount: value + fee }
        })
        tx.addOutputAddress(address, BigInt(value), btc.TEST_NETWORK)
        const psbt = tx.toPSBT()
        await walletState.connector
          ?.signPsbt(hex.encode(psbt), {
            autoFinalized: true,
            toSignInputs: [{ index: 0, publicKey, disableTweakSigner: true }]
          })
          .then((hex) => walletState.connector?.pushPsbt(hex))
          .then((id) => {
            toastImportant(
              `Mint transactions sent to network.<br>
              Inscription: <a href="https://mempool.space/testnet/tx/${txid}">${txid}</a><br/>
              Reveal: <a href="https://mempool.space/testnet/tx/${id}">${id}</a>`
            )
            console.log(id)
          })
      })
      .catch((e) => {
        console.error(e)
        toast(e)
      })
      .finally(() => {
        this.minting = false
        alert.hide()
      })
  }

  async withdraw() {
    this.withdrawing = true
    const amt = this.collateral!.overallBalance
    var { alert } = toastImportant(`Preparing withdraw inscription`)
    try {
      const [publicKey, address] = await Promise.all([walletState.getPublicKey(), walletState.getAddress()])
      // uncomment these to withdraw all utxo from brc20 deposit address
      // await fetch(`/api/withdrawTickBtc?amt=${amt}&tick=${this.tickQ}&pub=${publicKey}&address=${address}`)
      //   .then(getJson)
      //   .then(console.log)
      // return

      if (!address) throw new Error('failed to get wallet address')

      const [feeRates, { transferFee, address: brc20Address }] = await Promise.all([
        fetch('https://mempool.space/testnet/api/v1/fees/recommended').then(getJson),
        fetch(`/api/withdrawTick?pub=${publicKey}&address=${address}`).then(getJson)
      ])

      if (!brc20Address) throw new Error('failed to get withdraw address')

      const { inscription, customScripts, revealPayment, revealFee } = prepareRevealInscription(
        this.tickQ!,
        'transfer',
        amt,
        address,
        publicKey,
        feeRates
      )
      await alert.hide()

      // real inscribe and reveal
      const value = 600n
      alert = toastImportant(
        `Inscribing <span style="white-space:pre-wrap">${utf8.encode(
          inscription.body
        )}</span>, value: ${value}, revealFee: ${revealFee}, transferFee: ${transferFee}`
      ).alert
      const inscribeTx = await walletState.connector?.sendBitcoin(
        revealPayment.address!,
        Number(value) + Number(revealFee) + Number(transferFee)
      )
      await alert.hide()

      alert = toastImportant(`Waiting for inscription to be announced in mempool<sl-spinner></sl-spinner>`).alert
      while (true) {
        const res = await fetch(`https://mempool.space/testnet/api/tx/${inscribeTx}/status`)
        if (res.status == 200) {
          break
        }
        await new Promise((r) => setTimeout(r, 1000))
      }
      await alert.hide()

      alert = toastImportant(
        `Revealing <span style="white-space:pre-wrap">${utf8.encode(inscription.body)}</span>`
      ).alert
      const tx = new btc.Transaction({ customScripts })
      tx.addInput({
        ...revealPayment,
        txid: inscribeTx,
        index: 0,
        witnessUtxo: { script: revealPayment.script, amount: value + BigInt(revealFee) + BigInt(transferFee) }
      })
      tx.addOutputAddress(brc20Address, value + BigInt(transferFee), btc.TEST_NETWORK)
      const psbt = tx.toPSBT()
      const revealTx = await walletState.connector
        ?.signPsbt(hex.encode(psbt), {
          autoFinalized: true,
          toSignInputs: [{ index: 0, publicKey: publicKey, disableTweakSigner: true }]
        })
        .then((hex) => walletState.connector?.pushPsbt(hex))
      await alert.hide()

      alert = toastImportant(`Waiting for reveal tx to be announced in mempool<sl-spinner></sl-spinner>`).alert
      while (true) {
        const res = await fetch(`https://mempool.space/testnet/api/tx/${revealTx}/status`)
        if (res.status == 200) {
          break
        }
        await new Promise((r) => setTimeout(r, 1000))
      }
      await alert.hide()

      alert = toastImportant(
        `Ready to do withdraw.<br>
            Inscription: <a href="https://mempool.space/testnet/tx/${inscribeTx}">${inscribeTx}</a><br/>
            Reveal: <a href="https://mempool.space/testnet/tx/${revealTx}">${revealTx}</a><br/>
            Now waiting for MPC signatures...`
      ).alert
      const [res] = await Promise.all([
        fetch(`/api/withdrawTick?pub=${publicKey}&address=${address}&txid=${revealTx}&transferFee=${transferFee}`).then(
          getJson
        ),
        new Promise((r) => setTimeout(r, 500 + Math.random() * 2000)).then(() => {
          alert.innerHTML += '✔️'
        }),
        new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000)).then(() => {
          alert.innerHTML += '✔️'
        })
      ])
      const { txs } = res
      if (!Array.isArray(txs)) {
        console.error('withdraw txs not generated', res)
        throw new Error('withdraw txs not generated')
      }
      await alert.hide()
      toastImportant(
        `Withdraw transactions sent to network.<br>${txs
          .map((txid) => `<a href="https://mempool.space/testnet/tx/${txid}">${txid}</a>`)
          .join('<br/>')}`
      )
    } catch (e) {
      console.error(e)
      toast(e)
    }
    this.withdrawing = false
    alert.hide()
  }

  render() {
    return html`
      <span class="brc20-icon" style="background-image:url(brc20-${this.tick}.png)"></span>
      <div class="ml-3 flex-auto text-xs">
        <p>
          <a href="https://testnet.unisat.io/brc20/${this.tickQ}" class="font-medium text-sm">${this.tick}</a>
          ${when(this.priceTick, ()=>html`<sl-tooltip content="${this.priceTick}" placement="right-start">
            <span class="text-sl-neutral-600">
              Price: ${this.price ? formatUnitsComma(parseUnits(this.price ?? '0', 18), 10) : '-'} sats
              ($${this.pricing})
            </span>
          </sl-tooltip>`)}
          ${when(!this.priceTick, ()=>html`
            <span class="text-sl-neutral-600">
              Price: ${this.price ? formatUnitsComma(parseUnits(this.price ?? '0', 18), 10) : '-'} sats
              ($${this.pricing})
            </span>`)}
        </p>
        <p class="text-sl-neutral-600">
          ${this.balance?.overallBalance
            ? formatUnitsComma(parseUnits(this.balance.overallBalance, this.balance.decimals))
            : '-'}
          in wallet
        </p>
      </div>
      <div class="space-x-2 flex-none relative">
        <sl-tooltip content="Mint" class="flex-auto">
          <sl-button variant="text" circle ?loading=${this.minting} @click=${() => this.mint()}>
            <sl-icon name="lightning-charge" class="text-xl"></sl-icon>
          </sl-button>
        </sl-tooltip>
        <sl-button
          variant="default"
          circle
          ?disabled=${!this.balance?.overallBalance}
          @click=${() => this.dispatchEvent(new Event('supply'))}
        >
          <sl-icon name="plus"></sl-icon>
        </sl-button>
        <sl-button
          variant="default"
          circle
          ?disabled=${parseInt(this.collateral?.overallBalance ?? '0') <= 0}
          ?loading=${this.withdrawing}
          @click=${() => this.withdraw()}
        >
          <sl-icon name="dash"></sl-icon>
        </sl-button>
        ${when(
          parseInt(this.collateral?.overallBalance ?? '0') > 0,
          () =>
            html`<p class="text-xs text-sl-neutral-600 absolute -bottom-5 right-0">
              ${formatUnitsComma(parseUnits(this.collateral!.overallBalance, this.collateral!.decimals))} in protocol
            </p>`
        )}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tick-row': TickRow
  }
}
