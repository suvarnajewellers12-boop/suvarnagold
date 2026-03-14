import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  barcodeImage: string;
  sku: string;
}

export default function BarcodeSettingsWidget({ barcodeImage, sku }: Props) {

  const [settings, setSettings] = useState({
    boxWidth: 80,
    boxHeight: 12,
    barcodeWidth: 23,
    barcodeHeight: 8,
    marginTop: 1,
    marginLeft: -7,
  });

  // Load saved settings
  useEffect(() => {
    const saved = localStorage.getItem("barcodeSettings");
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  // Save settings
  const saveSettings = () => {
    localStorage.setItem("barcodeSettings", JSON.stringify(settings));
    alert("Settings saved!");
  };

  return (
    <div className="space-y-6">

      {/* SETTINGS CONTROLS */}
      <div className="grid grid-cols-2 gap-4">

        <div>
          <label className="text-xs font-bold">Box Width (mm)</label>
          <Input
            type="number"
            value={settings.boxWidth}
            onChange={(e) =>
              setSettings({ ...settings, boxWidth: Number(e.target.value) })
            }
          />
        </div>

        <div>
          <label className="text-xs font-bold">Box Height (mm)</label>
          <Input
            type="number"
            value={settings.boxHeight}
            onChange={(e) =>
              setSettings({ ...settings, boxHeight: Number(e.target.value) })
            }
          />
        </div>

        <div>
          <label className="text-xs font-bold">Barcode Width (mm)</label>
          <Input
            type="number"
            value={settings.barcodeWidth}
            onChange={(e) =>
              setSettings({ ...settings, barcodeWidth: Number(e.target.value) })
            }
          />
        </div>

        <div>
          <label className="text-xs font-bold">Barcode Height (mm)</label>
          <Input
            type="number"
            value={settings.barcodeHeight}
            onChange={(e) =>
              setSettings({ ...settings, barcodeHeight: Number(e.target.value) })
            }
          />
        </div>

        <div>
          <label className="text-xs font-bold">Margin Top (mm)</label>
          <Input
            type="number"
            value={settings.marginTop}
            onChange={(e) =>
              setSettings({ ...settings, marginTop: Number(e.target.value) })
            }
          />
        </div>

        <div>
          <label className="text-xs font-bold">Margin Left (mm)</label>
          <Input
            type="number"
            value={settings.marginLeft}
            onChange={(e) =>
              setSettings({ ...settings, marginLeft: Number(e.target.value) })
            }
          />
        </div>

      </div>

      <Button onClick={saveSettings} className="w-full">
        Save Settings
      </Button>

      {/* LIVE PREVIEW */}
      <div className="border rounded-lg p-4 bg-gray-50 flex justify-center">

        <div
          style={{
            width: `${settings.boxWidth}mm`,
            height: `${settings.boxHeight}mm`,
            marginTop: `${settings.marginTop}mm`,
            marginLeft: `${settings.marginLeft}mm`,
          }}
          className="flex flex-col items-center justify-center bg-white border"
        >

          <img
            src={barcodeImage}
            style={{
              width: `${settings.barcodeWidth}mm`,
              height: `${settings.barcodeHeight}mm`,
              objectFit: "contain",
            }}
          />

          <p className="text-[10px] font-mono mt-1">{sku}</p>

        </div>

      </div>

    </div>
  );
}