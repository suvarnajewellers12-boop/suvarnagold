import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import qz from "qz-tray";

interface Props {
  barcodeImage: string;
  sku: string;
  stoneWeight: number;
  netWeight: number;
  grams: number;
  huid: string;
}

export default function BarcodeSettingsWidget({ 
  barcodeImage, 
  sku, 
  stoneWeight, 
  netWeight, 
  grams, 
  huid 
}: Props) {

  // Hardcoded settings based on your image requirements
  const CONFIG = {
    boxWidth: 54,
    boxHeight: 12,
    barcodeWidth: 45,
    barcodeHeight: 8,
    marginTop: 0,
    marginLeft: 0,
  };

  const initQZ = async () => {
    if (!qz.websocket.isActive()) await qz.websocket.connect();
  };

  const printLabel = async () => {
    try {
      await initQZ();
      const printer = await qz.printers.find("TSC TE244");
      const config = qz.configs.create(printer);

      // 1mm = 8 dots
      const startY = 4; // Top padding in dots
      const rowGap = 24; // Vertical spacing for text lines
      
      // Calculate barcode position (X = 0 as per your image margin)
      // We position the barcode on the right side of the label
      const barcodeStartX = (CONFIG.boxWidth - CONFIG.barcodeWidth) * 8;

      const tspl = `
SIZE ${CONFIG.boxWidth} mm,${CONFIG.boxHeight} mm
GAP 3 mm,0 mm
DIRECTION 1
CLS
/* LEFT SIDE DATA */
TEXT 8,${startY},"1",0,1,1,"G:${grams}"
TEXT 8,${startY + rowGap},"1",0,1,1,"SW:${stoneWeight}"
TEXT 8,${startY + (rowGap * 2)},"1",0,1,1,"NW:${netWeight}"

/* RIGHT SIDE BARCODE (SKU) WITH HUID BELOW IT */
BARCODE ${barcodeStartX},${startY},"128",48,0,0,2,2,"${sku}"
TEXT ${barcodeStartX},${startY + 52},"1",0,1,1,"ID:${huid}"

PRINT 1
`;

      const data = [{ type: "raw", format: "command", data: tspl }];
      await qz.print(config, data);
    } catch (err) {
      console.error("Print Error", err);
    }
  };

  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      {/* LABEL PREVIEW */}
      <div className="mb-6 group relative">
        <span className="block text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest text-center">
          Label Preview (${CONFIG.boxWidth}x${CONFIG.boxHeight}mm)
        </span>
        
        <div
          style={{
            width: `${CONFIG.boxWidth}mm`,
            height: `${CONFIG.boxHeight}mm`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "white",
            border: "1px solid #e5e7eb",
            padding: "0 2mm",
            boxSizing: "border-box",
            overflow: "hidden"
          }}
        >  
          {/* Weights Stack */}
          <div className="flex flex-col justify-center text-left font-mono font-bold" style={{ fontSize: '7px', lineHeight: '1.1' }}>
            <span>G: {grams}</span>
            <span>SW: {stoneWeight}</span>
            <span>NW: {netWeight}</span>
          </div>

          {/* Barcode + HUID Stack */}
          <div className="flex flex-col items-center justify-center" style={{ width: `${CONFIG.barcodeWidth}mm` }}>
             <img 
               src={barcodeImage} 
               alt="barcode" 
               style={{ height: `${CONFIG.barcodeHeight}mm`, width: '100%', objectFit: 'contain' }} 
             />
             <span className="font-mono font-bold text-[6px] mt-0.5 uppercase">ID: {huid}</span>
          </div>
        </div>
      </div>

      {/* ACTION BUTTON */}
      <Button 
        className="w-full max-w-[200px] bg-[#16a34a] hover:bg-[#15803d] text-white font-bold py-6 rounded-lg transition-all shadow-lg active:scale-95"
        onClick={printLabel}
      >
        Print Label
      </Button>
    </div>
  );
}