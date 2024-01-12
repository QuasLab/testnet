import '@shoelace-style/shoelace/dist/components/alert/alert'
import SlAlert from '@shoelace-style/shoelace/dist/components/alert/alert'
import '@shoelace-style/shoelace/dist/components/icon/icon'

export function toast(
  message: any,
  options: {
    variant?: string
    closable?: boolean
    duration?: number
    icon?: string
  } = { closable: true, duration: 3000 }
) {
  const alert: SlAlert = Object.assign(document.createElement('sl-alert'), {
    ...options,
    variant: options.variant ?? (message instanceof Error ? 'danger' : 'default'),
    innerHTML: `<sl-icon slot="icon" name=${
      options.icon ?? (message instanceof Error ? 'exclamation-octagon' : 'info-circle')
    }></sl-icon>${message?.message ?? message}`
  })
  document.body.append(alert)
  return { alert, toasting: alert.toast() }
}
