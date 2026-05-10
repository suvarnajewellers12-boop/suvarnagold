"use client";

import { useState } from "react";

export default function BulkUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;


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

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("https://suvarnagold-16e5.vercel.app/api/products/bulk", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}` 
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setMessage(data.message);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto border rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Bulk Upload Products</h2>

      <input
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileChange}
        className="mb-4"
      />

      <button
        onClick={handleUpload}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {loading ? "Uploading..." : "Upload Excel"}
      </button>

      {message && (
        <p className="mt-4 text-sm">{message}</p>
      )}
    </div>
  );
}