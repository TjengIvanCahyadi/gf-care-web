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
    <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-8 flex flex-col">
      
      {/* Brand & Subtitle */}
      <div className="text-center max-w-3xl mx-auto mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold text-blue-700 tracking-tight mb-2">
          GF-CARE
        </h1>
        <h2 className="text-lg md:text-xl font-medium text-gray-600 mb-4">
          Glaucoma Fundus &ndash; Cup-to-Disc Ratio Assessment for Retinal Evaluation
        </h2>
        <p className="text-gray-500 text-base md:text-lg">
          Unggah citra fundus retina Anda untuk menganalisis indikasi risiko glaukoma berdasarkan rasio Cup-to-Disc (CDR) secara otomatis.
        </p>
      </div>

      {/* Main Content Area */}
      <div className="w-full flex-1 flex flex-col">
        {/* Error Message */}
        {appState === "error" && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 max-w-2xl mx-auto w-full" role="alert">
            <strong className="font-bold">Error! </strong>
            <span className="block sm:inline">{errorMessage}</span>
          </div>
        )}

        {/* Upload State */}
        {(appState === "idle" || appState === "error") && (
          <div className="bg-white p-10 rounded-2xl shadow-lg border border-gray-200 max-w-2xl mx-auto w-full text-center">
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
          <div className="bg-white p-10 rounded-2xl shadow-lg border border-gray-200 max-w-2xl mx-auto w-full text-center flex flex-col items-center">
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
          <div className="animate-in fade-in duration-500 max-w-5xl mx-auto w-full">
            <h3 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-6">Hasil Analisis</h3>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row">
              {/* Left Column: Overlay Image */}
              <div className="w-full md:w-1/2 bg-gray-50 p-6 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col">
                <h4 className="text-lg font-semibold mb-4 text-center text-gray-700">Segmentasi Overlay</h4>
                <div className="flex-1 flex flex-col justify-center items-center">
                  <div className="w-full max-w-sm aspect-square bg-black rounded-lg overflow-hidden relative shadow-inner">
                    {resultImage && (
                      <img src={resultImage} alt="Hasil Segmentasi Overlay" className="w-full h-full object-contain" />
                    )}
                  </div>
                  <div className="flex items-center justify-center space-x-6 mt-6">
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded-full bg-blue-500 shadow-sm border border-white"></div>
                        <span className="text-sm font-medium text-gray-600">Optic Disc</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded-full bg-red-500 shadow-sm border border-white"></div>
                        <span className="text-sm font-medium text-gray-600">Optic Cup</span>
                      </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Metrics & Indication */}
              <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col">
                {/* Screening Indication */}
                <div className="text-center mb-6 pb-6 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Indikasi Skrining</p>
                  {metrics.diagnosis === 'Glaukoma' ? (
                    <div>
                      <div className="bg-red-50 text-red-700 text-xl md:text-2xl font-bold py-2 px-6 rounded-lg border border-red-200 inline-block">
                        Terindikasi Glaukoma
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="bg-green-50 text-green-700 text-xl md:text-2xl font-bold py-2 px-6 rounded-lg border border-green-200 inline-block">
                        Indikasi Normal
                      </div>
                    </div>
                  )}
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 col-span-2 sm:col-span-1">
                    <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">Vertical CDR</p>
                    <p className="font-bold text-2xl text-blue-900">{metrics.vcdr.toFixed(3)}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Horizontal CDR</p>
                    <p className="font-bold text-xl text-gray-800">{metrics.hcdr.toFixed(3)}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Area CDR</p>
                    <p className="font-bold text-xl text-gray-800">{metrics.area_cdr.toFixed(3)}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 col-span-2 sm:col-span-1 flex flex-col justify-center">
                    <p className="text-xs text-gray-500 mb-1">Batas Aman vCDR</p>
                    <p className="font-medium text-gray-700">&le; {metrics.cdr_threshold}</p>
                  </div>
                </div>

                {/* Additional metrics */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex justify-between"><span>Vert. Disc:</span> <span className="font-medium">{metrics.vd_od}</span></div>
                  <div className="flex justify-between"><span>Vert. Cup:</span> <span className="font-medium">{metrics.vd_oc}</span></div>
                  <div className="flex justify-between"><span>Horiz. Disc:</span> <span className="font-medium">{metrics.hd_od}</span></div>
                  <div className="flex justify-between"><span>Horiz. Cup:</span> <span className="font-medium">{metrics.hd_oc}</span></div>
                  <div className="flex justify-between"><span>Area Disc:</span> <span className="font-medium">{metrics.area_od}</span></div>
                  <div className="flex justify-between"><span>Area Cup:</span> <span className="font-medium">{metrics.area_oc}</span></div>
                </div>

                {/* Explanation */}
                <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-700 border border-gray-100 flex-1">
                  <strong className="block mb-1 text-gray-800">Keterangan:</strong>
                  {metrics.diagnosis_description}
                </div>

                <div className="text-center mt-8">
                    <button 
                      onClick={resetState}
                      className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-colors"
                    >
                      Mulai Analisis Baru
                    </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Responsible AI / Medical Warning */}
      <div className="max-w-4xl mx-auto w-full mt-12 bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8 shadow-sm">
        <h3 className="text-amber-800 font-bold text-lg mb-2">Peringatan Medis / Medical Disclaimer</h3>
        <p className="text-amber-700 text-sm leading-relaxed">
          GF-CARE adalah alat penelitian untuk segmentasi citra fundus berdasarkan rasio Cup-to-Disc. 
          Sistem ini <strong>BUKAN</strong> merupakan sistem diagnosis medis yang definitif. 
          Hasil skrining tidak dapat menggantikan penilaian klinis profesional. 
          Harap konsultasikan dengan dokter spesialis mata (Oftalmologis) untuk pemeriksaan dan diagnosis yang akurat.
        </p>
      </div>

      {/* Privacy Information */}
      <div className="max-w-4xl mx-auto w-full text-center text-xs text-gray-500 mb-4 px-4">
        <strong>Informasi Privasi:</strong> Citra Anda dikirim langsung ke server inferensi Hugging Face untuk dianalisis. Tidak ada gambar yang disimpan di infrastruktur web kami, meskipun file sementara mungkin ada di server inferensi selama proses berjalan.
      </div>
      
    </main>
  );
}
