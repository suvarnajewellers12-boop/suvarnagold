import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import qz from "qz-tray";

interface Props {
  barcodeImage: string;
  sku: string;
}

export default function BarcodeSettingsWidget({ barcodeImage, sku }: Props) {

  const [settings, setSettings] = useState({
    boxWidth: 54,
    boxHeight: 12,
    barcodeWidth: 48,
    barcodeHeight: 8,
    marginTop: 0,
    marginLeft: 0,
    showText: false,
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
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // 🔥 QZ INIT
  const initQZ = async () => {
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect();
      console.log("QZ Connected ✅");
    }
  };

  // 🔥 PRINT FUNCTION
  const printLabel = async () => {
    try {
      await initQZ();

      // 👉 get available printers (optional debug)
      // const printers = await qz.printers.find();
      // console.log(printers);

      const printer = await qz.printers.find("TSC TE244"); // ⚠️ exact name

      const config = qz.configs.create(printer);

      const tspl = `
SIZE 54 mm,12 mm
GAP 0.3 mm,0 mm
DIRECTION 1
CLS
BARCODE ${settings.marginLeft},${settings.marginTop },"128",${settings.barcodeHeight * 8},1,0,1,1,"${sku}"
PRINT 1
`;

      const data = [{
        type: "raw",
        format: "command",
        data: tspl
      }];

      await qz.print(config, data);

      console.log("Printed Successfully 🚀");

    } catch (err) {
      console.error("Print Error ❌", err);
      alert("Printing failed. Check QZ Tray.");
    }
  };

  return (
    <div className="space-y-6">

      {/* SETTINGS */}
      <div className="grid grid-cols-2 gap-4">

        {[
          "boxWidth",
          "boxHeight",
          "barcodeWidth",
          "barcodeHeight",
          "marginTop",
          "marginLeft",
        ].map((key) => (
          <div key={key}>
            <label className="text-xs font-semibold">
              {key.replace(/([A-Z])/g, " $1")}
            </label>
            <Input
              type="number"
              value={(settings as any)[key]}
              onChange={(e) => handleChange(key, Number(e.target.value))}
            />
          </div>
        ))}

      </div>

      <Button onClick={saveSettings} className="w-full">
        Save Settings
      </Button>

      {/* 🔥 PRINT BUTTON */}
      <Button onClick={printLabel} className="w-full bg-green-600">
        Print Label (Direct)
      </Button>

      {/* PREVIEW */}
      <div className="flex justify-center">

        <div
          style={{
            width: `${settings.boxWidth}mm`,
            height: `${settings.boxHeight}mm`,
            position: "relative",
            background: "white",
            border: "1px solid #ccc",
            overflow: "hidden",
          }}
        >

          <img
            src={barcodeImage}
            alt="barcode"
            style={{
              position: "absolute",
              top: `${settings.marginTop}mm`,
              left: `${settings.marginLeft}mm`,
              width: `${settings.barcodeWidth}mm`,
              height: `${settings.barcodeHeight}mm`,
              objectFit: "contain",
            }}
          />

        </div>

      </div>

    </div>
  );
}