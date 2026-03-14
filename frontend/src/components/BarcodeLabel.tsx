"use client"

import Barcode from "react-barcode"

interface Props {
  sku: string
}

export default function BarcodeLabel({ sku }: Props) {

  return (
    <div className="barcode-label">

      <Barcode
        value={sku}
        width={1}
        height={32}
        displayValue={false}
        margin={0}
      />

      <div className="sku">{sku}</div>

    </div>
  )
}