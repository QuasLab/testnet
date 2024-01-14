import { LitElement, html, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { Ref, createRef, ref } from 'lit/directives/ref.js'
import { when } from 'lit/directives/when.js'
import baseStyle from '/src/base.css?inline'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/input/input'
import '@shoelace-style/shoelace/dist/components/dialog/dialog'
import { SlDialog, SlInput } from '@shoelace-style/shoelace'
import { toast } from '../lib/toast'

@customElement('borrow-panel')
export class BorrowPanel extends LitElement {
  static styles = [unsafeCSS(baseStyle)]
  @property() tick = ''
  @property() max = 0
  @state() input: Ref<SlInput> = createRef<SlInput>()
  @state() dialog: Ref<SlDialog> = createRef<SlDialog>()
  @state() inputValue = 0
  @state() borrowing = false
  @state() sig1 = false
  @state() sig2 = false
  @state() sig3 = false

  public show() {
    this.borrowing = false
    this.sig1 = false
    this.sig2 = false
    this.sig3 = false
    this.dialog.value?.show()
  }

  private async doBorrow() {
    this.borrowing = true
    try {
      await Promise.all([
        new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 1200)).then(() => (this.sig1 = true)),
        new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 1200)).then(() => (this.sig2 = true)),
        new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 1200)).then(() => (this.sig3 = true))
      ])
      // walletState._borrowedBalance += this.input.value!.valueAsNumber
    } catch (e) {
      console.warn(e)
      toast(e)
    }
    this.borrowing = false
  }

  render() {
    return html`
      <sl-dialog ${ref(this.dialog)}>
        <span slot="label" style="color:var(--sl-color-primary-500)">Borrow</span>
        <div class="flex items-center">
          <sl-input
            ${ref(this.input)}
            class="flex-auto mr-2"
            placeholder="0"
            filled
            type="number"
            @sl-input=${() => (this.inputValue = this.input.value!.valueAsNumber)}
          ></sl-input>
          <sl-button
            size="small"
            @click=${() => {
              this.input.value!.value = this.max.toString()
              this.inputValue = this.input.value!.valueAsNumber
            }}
            pill
            >Max</sl-button
          >
        </div>
        <div class="flex text-xs items-center text-sl-neutral-600">
          <span class="brc20-icon" style="background-image:url(brc20-${this.tick}.png)"></span>Max to ${this.max}
        </div>
        <div class="mt-4 space-y-2">
          <sl-button
            class="w-full"
            ?disabled=${this.inputValue <= 0}
            @click=${() => this.doBorrow()}
            pill
            .loading=${this.borrowing}
            >Borrow</sl-button
          >
          <sl-button class="w-full" @click=${() => this.dialog.value?.hide()} pill>Cancel</sl-button>
        </div>
        ${when(this.borrowing, () => html`<div class="mt-2">Waiting for MPC signatures</div>`)}
        ${when(this.borrowing || this.sig1, () =>
          when(
            this.sig1,
            () => html`<sl-icon name="check2-circle"></sl-icon>`,
            () => html`<sl-spinner></sl-spinner>`
          )
        )}
        ${when(this.borrowing || this.sig2, () =>
          when(
            this.sig2,
            () => html`<sl-icon name="check2-circle"></sl-icon>`,
            () => html`<sl-spinner></sl-spinner>`
          )
        )}
        ${when(this.borrowing || this.sig3, () =>
          when(
            this.sig3,
            () => html`<sl-icon name="check2-circle"></sl-icon>`,
            () => html`<sl-spinner></sl-spinner>`
          )
        )}
      </sl-dialog>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'borrow-panel': BorrowPanel
  }
}
