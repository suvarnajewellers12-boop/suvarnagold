import Barcode from 'react-barcode';

export const BarcodeDisplay = ({ code, name }: { code: string; name: string }) => (
  <div className="flex flex-col items-center bg-white p-4 rounded-lg">
    <p className="text-[10px] font-bold mb-1 uppercase tracking-tighter">{name}</p>
    <Barcode 
      value={code} 
      width={1.2} 
      height={50} 
      fontSize={14}
      margin={0}
    />
  </div>
);