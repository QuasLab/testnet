import path from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import vercel from 'vite-plugin-vercel'

/** @type {import('vite').UserConfig} */
export default {
  css: {
    devSourcemap: true,
    modules: { generateScopedName: '[hash:base64:6]' }
  },
  plugins: [
    // vercel(),
    viteStaticCopy({
      targets: [
        {
          src: path.resolve(__dirname, 'node_modules/@shoelace-style/shoelace/dist/assets'),
          dest: path.resolve(__dirname, 'dist')
        }
      ]
    })
  ]
}
