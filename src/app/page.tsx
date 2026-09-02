"use client";

import { useState, useRef, useEffect } from "react";
import { Client } from "@gradio/client";

type AppState =
  | "idle"
  | "validating"
  | "connecting"
  | "uploading"
  | "processing"
  | "success"
  | "error";

interface MetricsData {
  success: boolean;
  metrics?: {
    vcdr: number;
    hcdr: number;
    area_cdr: number;
    vd_od: string;
    vd_oc: string;
    hd_od: string;
    hd_oc: string;
    area_od: string;
    area_oc: string;
    cdr_threshold: number;
    diagnosis: string;
    diagnosis_label: string;
    diagnosis_description: string;
  };
  error?: string;
}

interface GradioFileData {
  url?: string;
  path?: string;
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricsData["metrics"] | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (originalImage) {
        URL.revokeObjectURL(originalImage);
      }
    };
  }, [originalImage]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAppState("validating");
    
    // 1. Client-Side Validation (UX/Resource Protection ONLY, not security)
    const validTypes = ["image/jpeg", "image/png", "image/jpg", "image/bmp"];
    if (!validTypes.includes(file.type)) {
      setErrorMessage("Format file tidak didukung. Harap unggah JPEG, PNG, atau BMP.");
      setAppState("error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setErrorMessage("Ukuran file terlalu besar. Maksimal 5MB.");
      setAppState("error");
      return;
    }

    // Revoke previous URL if replacing an image without reloading
    if (originalImage) {
      URL.revokeObjectURL(originalImage);
    }

    // Set local preview
    const objectUrl = URL.createObjectURL(file);
    setOriginalImage(objectUrl);
    
    await processInference(file);
  };

  const processInference = async (file: File) => {
    try {
      setAppState("connecting");
      
      // We start connecting to the Hugging Face Space.
      // This is where a cold start (13-25s) might occur. The browser will wait.
      const hfClient = await Client.connect("ivancahyadi/gf-care-demo");
      
      setAppState("uploading");
      
      // Proceed to send the prediction request
      setAppState("processing");
      const result = await hfClient.predict("/predict", [file]);
      
      // result.data is typically an array corresponding to the outputs
      const data = result.data as Array<unknown>;
      if (!data || data.length < 2) {
        throw new Error("Respons dari server tidak sesuai format yang diharapkan.");
      }

      // Output 0: Overlay Image (Gradio FileData)
      const overlayData = data[0] as GradioFileData | string;
      const overlayUrl = typeof overlayData === 'string' ? overlayData : overlayData?.url;
      
      // Output 1: Metrics JSON
      const jsonResponse = data[1] as MetricsData;
      
      if (jsonResponse.success === false) {
        throw new Error(jsonResponse.error || "Gagal melakukan analisis citra.");
      }

      if (!overlayUrl) {
        throw new Error("Gambar overlay tidak ditemukan dalam respons.");
      }

      setResultImage(overlayUrl);
      setMetrics(jsonResponse.metrics || null);
      setAppState("success");

    } catch (err: unknown) {
      console.error("Inference Error:", err);
      const errMsg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses citra.";
      setErrorMessage(errMsg);
      setAppState("error");
    }
  };

  const resetState = () => {
    if (originalImage) {
      URL.revokeObjectURL(originalImage);
    }
    setAppState("idle");
    setErrorMessage("");
    setOriginalImage(null);
    setResultImage(null);
    setMetrics(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8 flex flex-col justify-center">
      
      {/* Header section is simplified when showing results */}
      {appState === "idle" || appState === "error" ? (
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-blue-600 mb-4">
            Sistem Skrining Indikasi Glaukoma
          </h1>
          <p className="text-gray-600 text-lg mb-4">
            Unggah citra fundus retina Anda untuk menganalisis indikasi risiko glaukoma berdasarkan rasio Cup-to-Disc (CDR) secara otomatis.
          </p>
          <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg text-left">
            <strong>Informasi Privasi:</strong> Citra Anda dikirim langsung ke server inferensi Hugging Face untuk dianalisis. Tidak ada gambar yang disimpan di infrastruktur web kami, meskipun file sementara mungkin ada di server inferensi selama proses berjalan.
          </div>
        </div>
      ) : (
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
            Hasil Analisis Citra Fundus
          </h1>
        </div>
      )}

      {/* Main Content Area */}
      <div className="w-full">
        
        {/* Error Message */}
        {appState === "error" && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 max-w-2xl mx-auto" role="alert">
            <strong className="font-bold">Error! </strong>
            <span className="block sm:inline">{errorMessage}</span>
          </div>
        )}

        {/* Upload State */}
        {(appState === "idle" || appState === "error") && (
          <div className="bg-white p-10 rounded-2xl shadow-lg border border-gray-200 max-w-2xl mx-auto text-center">
             <input 
              type="file" 
              ref={fileInputRef}
              accept="image/png, image/jpeg, image/jpg, image/bmp" 
              onChange={handleFileChange}
              className="hidden" 
              id="file-upload"
              aria-label="Unggah Citra Fundus"
            />
            <label 
              htmlFor="file-upload"
              className="cursor-pointer inline-block bg-blue-600 text-white font-bold text-xl py-4 px-10 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-300 transform hover:-translate-y-1"
            >
              Mulai Skrining
            </label>
            <p className="text-sm text-gray-500 mt-4">Pilih citra fundus (Format: JPEG/PNG/BMP, Max: 5MB).</p>
          </div>
        )}

        {/* Loading States */}
        {["validating", "connecting", "uploading", "processing"].includes(appState) && (
          <div className="bg-white p-10 rounded-2xl shadow-lg border border-gray-200 max-w-2xl mx-auto text-center flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6"></div>
            
            <h2 className="text-2xl font-semibold mb-2">
              {appState === "validating" && "Memvalidasi citra..."}
              {appState === "connecting" && "Menghubungkan ke layanan inferensi..."}
              {appState === "uploading" && "Mengunggah citra..."}
              {appState === "processing" && "Menganalisis citra (Mungkin memakan waktu beberapa saat)..."}
            </h2>
            
            {appState === "connecting" && (
              <p className="text-gray-500 mt-2 text-sm">
                Proses ini dapat memakan waktu hingga 30 detik apabila server inferensi sedang dalam kondisi "cold start" (mulai dari kondisi tidur). Harap tunggu...
              </p>
            )}
            {appState === "processing" && (
              <p className="text-gray-500 mt-2 text-sm">
                AI sedang melakukan segmentasi Optic Disc dan Optic Cup pada citra Anda.
              </p>
            )}
          </div>
        )}

        {/* Success State (Results Dashboard) */}
        {appState === "success" && metrics && (
          <div className="animate-in fade-in duration-500">
            {/* Images Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h2 className="text-2xl font-semibold mb-4 text-center">Citra Fundus Original</h2>
                  <div className="w-full aspect-square bg-black rounded-lg overflow-hidden relative">
                    {originalImage && (
                      <img src={originalImage} alt="Citra Fundus Original" className="w-full h-full object-contain" />
                    )}
                  </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <h2 className="text-2xl font-semibold mb-4 text-center">Hasil Segmentasi (Overlay)</h2>
                  <div className="w-full aspect-square bg-black rounded-lg overflow-hidden relative">
                    {resultImage && (
                      <img src={resultImage} alt="Hasil Segmentasi" className="w-full h-full object-contain" />
                    )}
                  </div>
                  <div className="flex items-center justify-center space-x-6 mt-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded-full bg-blue-500 border border-white"></div>
                        <span className="text-sm font-medium">Optic Disc</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded-full bg-red-500 border border-white"></div>
                        <span className="text-sm font-medium">Optic Cup</span>
                      </div>
                  </div>
              </div>
            </div>

            {/* Quantitative Analysis Card */}
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 mb-8 max-w-5xl mx-auto">
              <h2 className="text-2xl font-semibold mb-6 text-center">Data Analisis Kuantitatif</h2>
              
              {/* Diagnosis Summary Banner */}
              <div className="mb-8 pt-4 pb-6 border-b text-center">
                  <h3 className="text-lg font-medium text-gray-500 mb-2">Indikasi Skrining (vCDR &gt; {metrics.cdr_threshold})</h3>
                  
                  {metrics.diagnosis === 'Glaukoma' ? (
                    <div>
                      <div className="bg-red-50 text-red-700 text-2xl font-bold py-3 px-6 rounded-xl inline-block border border-red-200">
                        Terindikasi Glaukoma
                      </div>
                      <p className="text-red-600 mt-3 font-medium">{metrics.diagnosis_description}</p>
                    </div>
                  ) : (
                    <div>
                      <div className="bg-green-50 text-green-700 text-2xl font-bold py-3 px-6 rounded-xl inline-block border border-green-200">
                        Indikasi Normal
                      </div>
                      <p className="text-green-600 mt-3 font-medium">{metrics.diagnosis_description}</p>
                    </div>
                  )}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-lg">
                  <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-between h-full">
                        <p className="text-sm text-gray-500 mb-1">Diameter Vertikal Disc</p>
                        <p className="font-bold text-xl">{metrics.vd_od}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-between h-full">
                        <p className="text-sm text-gray-500 mb-1">Diameter Vertikal Cup</p>
                        <p className="font-bold text-xl">{metrics.vd_oc}</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200 flex flex-col justify-between h-full">
                        <p className="text-sm font-semibold text-blue-800 mb-1">Vertical CDR (vCDR)</p>
                        <p className="font-bold text-2xl text-blue-900">{metrics.vcdr.toFixed(3)}</p>
                      </div>
                  </div>
                  <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-between h-full">
                        <p className="text-sm text-gray-500 mb-1">Diameter Horizontal Disc</p>
                        <p className="font-bold text-xl">{metrics.hd_od}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-between h-full">
                        <p className="text-sm text-gray-500 mb-1">Diameter Horizontal Cup</p>
                        <p className="font-bold text-xl">{metrics.hd_oc}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-between h-full">
                        <p className="text-sm text-gray-500 mb-1">Horizontal CDR (hCDR)</p>
                        <p className="font-bold text-xl">{metrics.hcdr.toFixed(3)}</p>
                      </div>
                  </div>
                  <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-between h-full">
                        <p className="text-sm text-gray-500 mb-1">Luas Area Disc</p>
                        <p className="font-bold text-xl">{metrics.area_od}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-between h-full">
                        <p className="text-sm text-gray-500 mb-1">Luas Area Cup</p>
                        <p className="font-bold text-xl">{metrics.area_oc}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-between h-full">
                        <p className="text-sm text-gray-500 mb-1">Area CDR</p>
                        <p className="font-bold text-xl">{metrics.area_cdr.toFixed(3)}</p>
                      </div>
                  </div>
              </div>
            </div>

            <div className="text-center mt-10 mb-8">
                <button 
                  onClick={resetState}
                  className="bg-gray-100 text-gray-800 font-bold py-3 px-8 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-300 transition-all duration-300"
                >
                  Mulai Analisis Baru
                </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
