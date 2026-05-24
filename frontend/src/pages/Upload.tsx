"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProgressStatus {
  stage: "idle" | "uploading" | "parsing" | "processing" | "complete";
  percentage: number;
  message: string;
}

export default function BulkUpload() {
  const { token, isAuthChecking } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showFields, setShowFields] = useState(false);
  const [progress, setProgress] = useState<ProgressStatus>({
    stage: "idle",
    percentage: 0,
    message: "",
  });

  const requiredFields = [
    { name: "name", required: true, description: "Product name" },
    { name: "metalType", required: true, description: "Metal type (e.g., Gold, Silver)" },
    { name: "grams", required: true, description: "Weight in grams" },
    { name: "carats", required: false, description: "Carats (e.g., 24K, 22K)" },
    { name: "manufactureDate", required: true, description: "Date of manufacture (YYYY-MM-DD)" },
    { name: "stoneWeight", required: false, description: "Weight of stones" },
    { name: "grossWeight", required: false, description: "Gross weight" },
    { name: "netWeight", required: false, description: "Net weight" },
    { name: "category", required: false, description: "Category (e.g., Necklace, Earring)" },
    { name: "bodyPart", required: false, description: "Body part" },
    { name: "branchName", required: false, description: "Branch name" },
    { name: "stoneCost", required: false, description: "Cost of stones" },
    { name: "va", required: false, description: "VA percentage (default: 2.5)" },
    { name: "itemCode", required: false, description: "Item code" },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setProgress({ stage: "uploading", percentage: 0, message: "Starting upload..." });

      const formData = new FormData();
      formData.append("file", file);

      // Use XMLHttpRequest to track upload progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 60); // 0-60%
            setProgress({
              stage: "uploading",
              percentage: percentComplete,
              message: `Uploading: ${percentComplete}% (${(event.loaded / 1024).toFixed(1)} KB)`,
            });
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status === 201 || xhr.status === 200) {
            setProgress({ stage: "parsing", percentage: 65, message: "Parsing Excel file..." });
            setTimeout(() => {
              setProgress({ stage: "processing", percentage: 85, message: "Processing and saving to database..." });
            }, 500);
            setTimeout(() => {
              const data = JSON.parse(xhr.responseText);
              setProgress({ stage: "complete", percentage: 100, message: "✅ Upload complete!" });
              setMessage(data.message);
              resolve();
            }, 1500);
          } else {
            const data = JSON.parse(xhr.responseText);
            let errorMsg = data.error || "Upload failed";
            if (data.details && Array.isArray(data.details)) {
              errorMsg += "\n" + data.details.slice(0, 5).join("\n");
              if (data.total_errors > 5) {
                errorMsg += `\n... and ${data.total_errors - 5} more errors`;
              }
            }
            reject(new Error(errorMsg));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload cancelled"));
        });

        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        xhr.open(
          "POST",
          "https://suvarnagold-16e5.vercel.app/api/products/bulk",
          true
        );
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.send(formData);
      });

      setFile(null);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
      setProgress({ stage: "idle", percentage: 0, message: "" });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="p-6 max-w-2xl mx-auto border rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Bulk Upload Products</h2>

      <div className="mb-6 p-4 bg-blue-50 rounded">
        <button
          onClick={() => setShowFields(!showFields)}
          className="text-blue-600 font-semibold hover:underline"
        >
          {showFields ? "Hide" : "Show"} Required Excel Fields
        </button>
        {showFields && (
          <div className="mt-3">
            <p className="text-sm font-semibold mb-2">Excel Column Names:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {requiredFields.map((field) => (
                <div key={field.name} className="p-2 bg-white rounded border">
                  <span className={field.required ? "font-semibold text-red-600" : ""}>
                    {field.name}
                  </span>
                  <p className="text-xs text-gray-600">{field.description}</p>
                  {field.required && <span className="text-red-600 text-xs">*Required</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-700 mt-3">
              <strong>Note:</strong>
              <br />• SKU auto-generated with format SV[YY][5-digit-sequence]
            </p>
          </div>
        )}
      </div>

      <div className="mb-4">
        <input
          type="file"
          accept=".xlsx, .xls, .gz"
          onChange={handleFileChange}
          className="mb-4 p-2 border rounded w-full"
        />
        {file && (
          <div className="text-sm text-gray-600">
            <p>File: {file.name}</p>
            <p>Size: {(file.size / 1024).toFixed(2)} KB</p>
          </div>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={loading || !file}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Uploading..." : "Upload Excel"}
      </button>

      {loading && (
        <div className="mt-6 p-4 bg-blue-50 rounded">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">
              {progress.stage === "uploading" && "📤 Uploading File"}
              {progress.stage === "parsing" && "📖 Parsing Excel"}
              {progress.stage === "processing" && "⚙️ Processing Data"}
              {progress.stage === "complete" && "✅ Complete"}
            </p>
            <span className="text-sm font-bold text-blue-600">{progress.percentage}%</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-2">
            <div
              className={`h-full transition-all duration-300 ${
                progress.stage === "complete"
                  ? "bg-green-500"
                  : "bg-blue-500"
              }`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          <p className="text-xs text-gray-700">{progress.message}</p>
        </div>
      )}

      {message && (
        <p className={`mt-4 text-sm font-semibold whitespace-pre-wrap ${message.includes("Error") ? "text-red-600" : "text-green-600"}`}>
          {message}
        </p>
      )}

      <div className="mt-6 p-3 bg-gray-100 rounded text-xs text-gray-700">
        <p className="font-semibold mb-2">📊 Performance Tips:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>600 products:</strong> ~5-15 seconds</li>
          <li><strong>Compression:</strong> Rename .xlsx → .xlsx.gz to reduce file size by ~70%</li>
          <li><strong>Best for:</strong> Large batches over slow networks</li>
        </ul>
      </div>
    </div>
  );
}