"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import qz from "qz-tray";
import { 
  Printer, X, ListChecks, Play, Loader2, 
  Trash2, Layers, Weight, Tag 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  sku: string;
  stoneWeight: number;
  netWeight: number;
  grams: number;
  huid?: string;
}

interface BulkBarcodePrinterProps {
  queue: Product[];
  onClearQueue: () => void;
  onRemoveFromQueue: (id: string) => void;
}

export default function BulkBarcodePrinter({
  queue,
  onClearQueue,
  onRemoveFromQueue
}: BulkBarcodePrinterProps) {
  const [status, setStatus] = useState<string>("Ready");
  const [isPrinting, setIsPrinting] = useState(false);

  // TSC TE244 Label Configuration (63x12mm)
  const CONFIG = {
    boxWidth: 63,
    boxHeight: 12,
    barcodeWidth: 50,
    barcodeHeight: 8,
  };

  const logStatus = (msg: string, isError = false) => {
    console.log(`[QZ-Bulk] ${msg}`);
    setStatus(isError ? `❌ ${msg}` : msg);
  };

  const initQZ = async () => {
    try {
      if (qz.websocket.isActive()) return;
      logStatus("Connecting to QZ Tray...");
      await qz.websocket.connect();
      logStatus("QZ Tray Connected.");
    } catch (err: any) {
      logStatus("QZ Tray not running.", true);
      throw err;
    }
  };

  const printBulkLabels = async () => {
    if (queue.length === 0) return;
    setIsPrinting(true);
    try {
      await initQZ();

      logStatus(`Finding 'TSC TE244'...`);
      const printer = await qz.printers.find("TSC TE244");
      const config = qz.configs.create(printer);

      let fullTspl = "";

      // Iterate through the selected products and build one continuous TSPL command
      queue.forEach((item) => {
        const startY = 20;
        const rowGap = 24;
        const barcodeStartX = (CONFIG.boxWidth - CONFIG.barcodeWidth) * 8;

        fullTspl += `
CLS
SIZE ${CONFIG.boxWidth} mm,${CONFIG.boxHeight} mm
GAP 3 mm,0 mm
DIRECTION 1
TEXT 0,${startY},"1",0,1,1,"G:${item.grams}"
TEXT 0,${startY + rowGap},"1",0,1,1,"SW:${item.stoneWeight}"
TEXT 0,${startY + (rowGap * 2)},"1",0,1,1,"NW:${item.netWeight}"
BARCODE ${barcodeStartX},${startY},"128",48,0,0,2,2,"${item.sku}"
TEXT ${barcodeStartX},${startY + 52},"1",0,1,1,"ID:${item.huid || ""} ${item.sku}"
PRINT 1
`;
      });

      logStatus(`Sending ${queue.length} labels...`);
      const data = [{ type: "raw", format: "command", data: fullTspl }];

      await qz.print(config, data);
      logStatus(`Success: ${queue.length} labels printed.`);
      onClearQueue(); // Optionally clear queue after successful print
    } catch (err: any) {
      logStatus(`Print Error: ${err.message}`, true);
    } finally {
      setIsPrinting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (qz.websocket.isActive()) {
        qz.websocket.disconnect().catch(console.error);
      }
    };
  }, []);

  return (
    <div className="fixed bottom-8 right-8 z-[100] w-96 bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border-2 border-amber-100 overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-700 to-amber-500 p-5 text-white flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <span className="block font-serif font-bold text-sm leading-none">Print Registry</span>
            <span className="text-[10px] uppercase tracking-widest opacity-80">{queue.length} Items Selected</span>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClearQueue} 
          className="text-white hover:bg-white/10 rounded-full h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* List Area */}
      <div className="max-h-64 overflow-y-auto p-4 space-y-2 bg-[#FDFCFB] custom-scrollbar">
        {queue.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-300">
            <Tag className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-[10px] font-bold uppercase tracking-tighter">Queue is empty</p>
          </div>
        ) : (
          queue.map((item) => (
            <div 
              key={item.id} 
              className="flex items-center justify-between bg-white p-3 rounded-2xl border border-amber-100/50 group hover:border-amber-300 transition-all shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-[10px] font-bold text-amber-700 border border-amber-100">
                  {item.sku.slice(-2)}
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black text-slate-800 uppercase leading-tight truncate w-40">{item.name}</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[8px] font-bold text-amber-600 font-mono">{item.sku}</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase">{item.grams}g</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => onRemoveFromQueue(item.id)} 
                className="opacity-0 group-hover:opacity-100 h-8 w-8 flex items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-6 bg-white border-t border-amber-50">
        <div className={cn(
          "text-[9px] text-center mb-4 font-mono font-bold px-3 py-1 rounded-full uppercase tracking-tighter",
          status.includes('❌') ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
        )}>
          {status}
        </div>
        
        <Button
          disabled={isPrinting || queue.length === 0}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-black h-14 rounded-[1.25rem] shadow-xl shadow-green-200 transition-all active:scale-95 flex items-center justify-center gap-3 text-xs tracking-widest uppercase"
          onClick={printBulkLabels}
        >
          {isPrinting ? (
            <Loader2 className="animate-spin w-5 h-5" />
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              Process Batch Print
            </>
          )}
        </Button>
      </div>
    </div>
  );
}