declare module 'qrcode-generator' {
  type QRErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'
  type QRCode = {
    addData(data: string): void
    make(): void
    createSvgTag(opts?: { cellSize?: number; margin?: number }): string
  }
  function qrcode(typeNumber: number, errorCorrectionLevel: QRErrorCorrectionLevel): QRCode
  export default qrcode
}
