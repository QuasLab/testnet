import path from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

/** @type {import('vite').UserConfig} */
export default {
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        relinx: path.resolve(__dirname, 'relinx/index.html')
      }
    }
  },
  css: {
    devSourcemap: true,
    modules: { generateScopedName: '[hash:base64:6]' }
  },
  plugins: [
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
