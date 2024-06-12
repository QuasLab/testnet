import { LitElement, html, unsafeCSS } from 'lit'
import { customElement } from 'lit/decorators.js'
import baseStyle from './base.css?inline'
import style from './main.css?inline'
import './global.css'
import '@shoelace-style/shoelace/dist/themes/light.css'
import '@shoelace-style/shoelace/dist/components/icon/icon'
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button'
import '@shoelace-style/shoelace/dist/components/button/button'
import '@shoelace-style/shoelace/dist/components/divider/divider'
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip'
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js'

setBasePath(import.meta.env.MODE === 'development' ? 'node_modules/@shoelace-style/shoelace/dist' : '/')

function darkMode(enable = true) {
  if (enable) {
    import('@shoelace-style/shoelace/dist/themes/dark.css')
    document.documentElement.setAttribute('class', 'sl-theme-dark')
  } else {
    document.documentElement.removeAttribute('class')
  }
}

globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').matches && darkMode()

globalThis.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
  darkMode(e.matches)
})

@customElement('relinx-main')
export class RelinxMain extends LitElement {
  static styles = [unsafeCSS(baseStyle), unsafeCSS(style)]

  render() {
    return html``
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'relinx-main': RelinxMain
  }
}
