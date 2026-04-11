import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
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

  const [settings, setSettings] = useState({
    boxWidth: 54,
    boxHeight: 12,
    barcodeWidth: 25, // Reduced width to prevent overlapping
    barcodeHeight: 7,
    marginTop: 1,
    marginLeft: 2,
    textSpacing: 22, // Vertical gap between lines in dots
  });

  useEffect(() => {
    const saved = localStorage.getItem("barcodeSettings");
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem("barcodeSettings", JSON.stringify(settings));
    alert("Settings saved!");
  };

  const handleChange = (key: string, value: number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const initQZ = async () => {
    if (!qz.websocket.isActive()) await qz.websocket.connect();
  };

  const printLabel = async () => {
  try {
    await initQZ();
    const printer = await qz.printers.find("TSC TE244");
    const config = qz.configs.create(printer);

    // 1mm = 8 dots. Total height (12mm) = 96 dots.
    const dotX = settings.marginLeft * 8;
    
    // Start very high (4 dots from top) to fit all lines
    const startY = 4; 
    const rowGap = 18; // Tightened gap to fit 4 lines in 96 dots

    // Calculate barcode start (Right side)
    const barcodeStartX = (settings.boxWidth - settings.barcodeWidth - 2) * 8;

    const tspl = `
SIZE ${settings.boxWidth} mm,${settings.boxHeight} mm
GAP 3 mm,0 mm
DIRECTION 1
CLS
/* 4 LINES OF TEXT - ALLIGNED LEFT */
TEXT ${dotX},${startY},"1",0,1,1,"G:${grams}"
TEXT ${dotX},${startY + rowGap},"1",0,1,1,"SW:${stoneWeight}"
TEXT ${dotX},${startY + (rowGap * 2)},"1",0,1,1,"NW:${netWeight}"
TEXT ${dotX},${startY + (rowGap*3)},"1",0,1,1,"ID:${huid}"

/* BARCODE - ALLIGNED RIGHT */
/* We use a height of 6mm (48 dots) to ensure it fits the 12mm label */
BARCODE ${barcodeStartX},${startY + 10},"128",48,1,0,2,2,"${sku}"
PRINT 1
`;

    const data = [{ type: "raw", format: "command", data: tspl }];
    await qz.print(config, data);

  } catch (err) {
    console.error("Print Error", err);
  }
};

  return (
    <div className="space-y-6 p-4 bg-gray-50 rounded-lg border">
      <h2 className="text-sm font-bold text-gray-700">Printer & Layout Adjustments</h2>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {Object.entries(settings).map(([key, value]) => (
          <div key={key}>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">
              {key.replace(/([A-Z])/g, " $1")}
            </label>
            <Input
              className="h-8 text-xs"
              type="number"
              value={value}
              onChange={(e) => handleChange(key, Number(e.target.value))}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={saveSettings}>Save Config</Button>
        <Button className="bg-green-600" onClick={printLabel}>Print Now</Button>
      </div>

      <hr />

      {/* DYNAMIC PREVIEW */}
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-bold text-gray-400 mb-2">LIVE PREVIEW (54x12mm)</span>
        <div
          style={{
            width: `${settings.boxWidth}mm`,
            height: `${settings.boxHeight}mm`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "white",
            border: "1px solid black",
            padding: `0 ${settings.marginLeft}mm`,
            boxSizing: "border-box",
            overflow: "hidden"
          }}
        >  
          {/* Vertical Text Stack */}
          <div className="flex flex-col justify-center text-left font-mono font-bold" style={{ fontSize: '6px', lineHeight: '1.1' }}>
            <span>G: {grams}</span>
            <span>SW: {stoneWeight}</span>
            <span>NW: {netWeight}</span>
            <span className="truncate w-24">ID: {huid}</span>
          </div>

          {/* Barcode on the far right */}
          <div className="flex items-center justify-end" style={{ width: `${settings.barcodeWidth}mm` }}>
             <img src={barcodeImage} alt="barcode" style={{ height: `${settings.barcodeHeight}mm`, width: '100%', objectFit: 'contain' }} />
          </div>
        </div>
        <p className="mt-2 text-[10px] text-red-500">Note: Keep Barcode Width below 30 for this label size.</p>
      </div>
    </div>
  );
}