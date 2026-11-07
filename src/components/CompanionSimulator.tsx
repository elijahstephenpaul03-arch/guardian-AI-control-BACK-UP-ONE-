import React, { useState, useEffect, useRef } from "react";
import { 
  Smartphone, Battery, BatteryCharging, Wifi, WifiOff, MapPin, 
  AlertTriangle, Power, Send, RefreshCw, QrCode, Copy, CheckCircle2,
  Lock, Shield, Eye, Settings, Heart, Signal, Radio, Sparkles
} from "lucide-react";
import { db } from "../lib/firebase";
import { doc, setDoc } from "firebase/firestore";

interface CompanionSimulatorProps {
  onBackToDashboard?: () => void;
}

export default function CompanionSimulator({ onBackToDashboard }: CompanionSimulatorProps) {
  // Device Identity State (Persistent)
  const [deviceId, setDeviceId] = useState<string>("");
  const [deviceName, setDeviceName] = useState<string>("Alex's Pixel 8");
  const [deviceModel, setDeviceModel] = useState<string>("Google Pixel 8 Pro");
  const [androidVersion, setAndroidVersion] = useState<string>("Android 14");
  
  // Telemetry States
  const [battery, setBattery] = useState<number>(82);
  const [charging, setCharging] = useState<boolean>(false);
  const [internetStatus, setInternetStatus] = useState<"wifi" | "cellular" | "none">("wifi");
  const [screenOn, setScreenOn] = useState<boolean>(true);
  const [sosActive, setSosActive] = useState<boolean>(false);
  
  // Simulated GPS Locations (Kondapur, Hyderabad, Telangana, India)
  const locations = [
    { name: "Home Safe Zone (Raghavendra Colony)", lat: 17.4875, lng: 78.3890 },
    { name: "Kondapur Tech Academy", lat: 17.4849, lng: 78.3907 },
    { name: "Botanical Garden Sports Complex", lat: 17.4820, lng: 78.3860 },
    { name: "Sarath City Capital Mall", lat: 17.4570, lng: 78.3636 },
    { name: "HITEC City Hub", lat: 17.4474, lng: 78.3762 }
  ];
  const [currentLocationIdx, setCurrentLocationIdx] = useState<number>(0);
  
  // Status state
  const [copied, setCopied] = useState<boolean>(false);
  const [lastUploaded, setLastUploaded] = useState<string>("Never");
  const [uploading, setUploading] = useState<boolean>(false);
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);
  const lastUploadedSigRef = useRef<string>("");

  // Generate or retrieve persistent Device ID
  useEffect(() => {
    let savedId = localStorage.getItem("GUA_COMPANION_DEVICE_ID");
    if (!savedId) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No easily confused characters
      let result = "GUA-";
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      localStorage.setItem("GUA_COMPANION_DEVICE_ID", result);
      savedId = result;
    }
    setDeviceId(savedId);
  }, []);

  // Upload current state to Firestore with change detection
  const uploadTelemetry = async (forced = false) => {
    if (!deviceId) return;
    const activeLoc = locations[currentLocationIdx];
    const signature = `${deviceId}|${deviceName}|${battery}|${charging}|${internetStatus}|${activeLoc.lat}|${activeLoc.lng}|${screenOn}|${sosActive}`;
    
    // Do not write device telemetry back to Firestore on every tick unless data actually changed
    if (!forced && lastUploadedSigRef.current === signature) {
      return;
    }
    if (quotaExceeded && !forced) {
      return;
    }

    setUploading(true);
    try {
      const deviceRef = doc(db, "devices", deviceId);
      await setDoc(deviceRef, {
        deviceId,
        deviceName,
        deviceModel,
        androidVersion,
        battery,
        charging,
        internetStatus,
        gps: {
          lat: activeLoc.lat,
          lng: activeLoc.lng,
          name: activeLoc.name
        },
        screenOn,
        lastSeen: new Date().toISOString(),
        sosActive
      }, { merge: true });
      
      lastUploadedSigRef.current = signature;
      setQuotaExceeded(false);
      setLastUploaded(new Date().toLocaleTimeString());
    } catch (err: any) {
      if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
        setQuotaExceeded(true);
      }
      console.warn("Companion app notice uploading telemetry to Firestore:", err?.message || err);
    } finally {
      setUploading(false);
    }
  };

  // Run periodic auto-upload or trigger immediate upload on state changes
  useEffect(() => {
    if (autoSync && deviceId) {
      uploadTelemetry();
    }
  }, [
    deviceId, deviceName, deviceModel, androidVersion, 
    battery, charging, internetStatus, currentLocationIdx, 
    screenOn, sosActive, autoSync
  ]);

  // Handle manual trigger
  const handleManualUpload = () => {
    uploadTelemetry(true);
  };

  const copyId = () => {
    navigator.clipboard.writeText(deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col p-4 md:p-8 select-none font-sans overflow-y-auto">
      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header Panel */}
      <header className="relative max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono tracking-widest text-teal-400 uppercase font-bold">Android Client Simulator</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-display text-white mt-1">
            Guardian AI Companion App
          </h1>
        </div>
        <div className="flex gap-2">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer"
            >
              Back to Parent Dashboard
            </button>
          )}
        </div>
      </header>

      {/* Dual Pane Interface */}
      <div className="relative max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8 flex-1">
        
        {/* LEFT PANE: CONTROLS & PARAMETERS (8 cols on desktop) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Connection & Setup status */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2 text-white">
              <Settings className="h-5 w-5 text-teal-400" />
              <span>Device Pairing Setup</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              To test real-time monitoring, enter this unique Device ID in your **Parent Dashboard** pairing tab, or scan the QR code using your webcam.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-mono block uppercase">Generated Device ID</span>
                  <span className="text-xl font-black text-white font-mono tracking-wider">{deviceId || "Generating..."}</span>
                </div>
                <button
                  onClick={copyId}
                  className="p-3 bg-slate-900 hover:bg-slate-800 rounded-xl transition-all hover:border hover:border-slate-700 cursor-pointer text-slate-300"
                >
                  {copied ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-mono block uppercase">Cloud Sync Engine</span>
                  <div className="flex items-center space-x-1.5 mt-1">
                    <span className={`h-2 w-2 rounded-full ${autoSync ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></span>
                    <span className="text-xs font-bold text-white">{autoSync ? 'Active Auto-Upload' : 'Sync Paused'}</span>
                  </div>
                </div>
                <button
                  onClick={handleManualUpload}
                  disabled={uploading}
                  className="p-3 bg-slate-900 hover:bg-slate-800 text-teal-400 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  title="Manual Sync Now"
                >
                  <RefreshCw className={`h-5 w-5 ${uploading ? 'animate-spin text-teal-300' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Device Settings Customizer */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-6">
            <h3 className="font-bold text-base text-white">Device Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1.5">Child Name Reference</label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-teal-400 outline-none rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1.5">Model Identifier</label>
                <input
                  type="text"
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-teal-400 outline-none rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-mono uppercase block mb-1.5">Android Core</label>
                <input
                  type="text"
                  value={androidVersion}
                  onChange={(e) => setAndroidVersion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-teal-400 outline-none rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="h-px bg-slate-800"></div>

            {/* Hardware Telemetry Controller */}
            <h3 className="font-bold text-base text-white">Hardware & Network Telemetry</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Battery Telemetry */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-mono uppercase">Battery Power</span>
                  <span className="font-bold text-white">{battery}%</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={battery}
                    onChange={(e) => setBattery(Number(e.target.value))}
                    className="flex-1 accent-teal-400"
                  />
                  <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={charging}
                      onChange={(e) => setCharging(e.target.checked)}
                      className="accent-teal-400 rounded"
                    />
                    <span className="text-slate-400">Charging</span>
                  </label>
                </div>
              </div>

              {/* Internet Status */}
              <div className="space-y-3">
                <span className="text-xs text-slate-400 font-mono uppercase block">Internet Connection State</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "wifi", label: "WiFi Active" },
                    { id: "cellular", label: "Cellular 5G" },
                    { id: "none", label: "Offline" }
                  ].map((net) => (
                    <button
                      key={net.id}
                      onClick={() => setInternetStatus(net.id as any)}
                      className={`py-2 px-3 text-xs rounded-xl font-bold border transition-all cursor-pointer ${
                        internetStatus === net.id 
                          ? "bg-teal-500/10 border-teal-400 text-teal-400" 
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {net.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            <div className="h-px bg-slate-800"></div>

            {/* GPS Location Teleportation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase text-slate-400 font-mono">Simulated GPS Position (Teleportation)</h4>
                <span className="inline-flex items-center text-[10px] font-mono text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded-full">
                  <Radio className="h-3 w-3 mr-1 animate-pulse" /> Live Teleport Active
                </span>
              </div>
              <p className="text-xs text-slate-500">Click a safe zone or destination below to immediately teleport the child's device in real-time. Notice how the Parent Dashboard's map moves instantly.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {locations.map((loc, idx) => (
                  <button
                    key={loc.name}
                    onClick={() => setCurrentLocationIdx(idx)}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                      currentLocationIdx === idx 
                        ? "bg-blue-500/10 border-blue-400 text-blue-400" 
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    <MapPin className="h-4 w-4" />
                    <span className="text-[10px] font-bold block leading-tight truncate w-full">{loc.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-slate-800"></div>

            {/* Screen status & Panic button */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-white">Screen Activity Status</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Toggle to simulate locking or powering off</p>
                </div>
                <button
                  onClick={() => setScreenOn(!screenOn)}
                  className={`py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    screenOn 
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                      : "bg-slate-900 text-slate-500 border border-slate-800"
                  }`}
                >
                  {screenOn ? "Screen ON" : "Screen OFF"}
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-rose-500 animate-pulse" />
                    <span>Emergency SOS Trigger</span>
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Launches parent notification siren</p>
                </div>
                <button
                  onClick={() => setSosActive(!sosActive)}
                  className={`py-2 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    sosActive 
                      ? "bg-rose-500 text-white border-rose-600 animate-pulse shadow-lg shadow-rose-500/30" 
                      : "bg-rose-950/20 text-rose-400 border-rose-900/50 hover:bg-rose-950/40"
                  }`}
                >
                  {sosActive ? "DISMISS SOS" : "TRIGGER SOS"}
                </button>
              </div>
            </div>

          </div>

          {/* Sync Stats Tracker */}
          <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Last Telemetry Uploaded:</span>
              <span className="font-bold text-teal-400 font-mono">{lastUploaded}</span>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  className="accent-teal-400 rounded"
                />
                <span className="text-slate-400 text-xs">Real-Time State Auto-Push</span>
              </label>
              <div className="text-slate-500 text-[11px] font-mono">
                No simulated data. Pushing direct to Firebase.
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT PANE: SMARTPHONE MOCKUP (5 cols on desktop) */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div className="relative w-full max-w-[340px] aspect-[9/19.5] bg-slate-950 border-[10px] border-slate-800 rounded-[3rem] shadow-2xl flex flex-col overflow-hidden ring-4 ring-slate-900/60 ring-offset-4 ring-offset-slate-950">
            
            {/* Phone notch camera / Speaker */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-50 flex items-center justify-center">
              <div className="w-12 h-1 bg-slate-950 rounded-full mb-1"></div>
            </div>

            {/* Phone Screen Canvas */}
            <div className="flex-1 bg-slate-900 relative flex flex-col p-4 pt-10 select-none">
              {/* Dynamic Screen Off Overlay */}
              {!screenOn && (
                <div className="absolute inset-0 bg-black z-40 flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <Power className="h-10 w-10 text-slate-800 animate-pulse" />
                  <p className="text-xs text-slate-600 font-mono uppercase tracking-widest">Screen Power Off</p>
                  <button 
                    onClick={() => setScreenOn(true)}
                    className="mt-4 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-400"
                  >
                    Click to Turn On
                  </button>
                </div>
              )}

              {/* Status bar */}
              <div className="absolute top-2 left-4 right-4 flex items-center justify-between text-[11px] text-slate-400 font-mono z-30">
                <span className="font-semibold">09:41 AM</span>
                <div className="flex items-center space-x-1.5">
                  <Signal className="h-3.5 w-3.5 text-teal-400" />
                  {internetStatus === "wifi" ? <Wifi className="h-3.5 w-3.5 text-teal-400" /> : internetStatus === "cellular" ? <Radio className="h-3.5 w-3.5 text-teal-400 animate-pulse" /> : <WifiOff className="h-3.5 w-3.5 text-rose-500" />}
                  <div className="flex items-center space-x-0.5">
                    {charging ? <BatteryCharging className="h-4 w-4 text-teal-400 animate-pulse" /> : <Battery className="h-4 w-4 text-teal-500" />}
                    <span>{battery}%</span>
                  </div>
                </div>
              </div>

              {/* Mobile App Canvas Content */}
              <div className="flex-1 flex flex-col justify-between pt-4 space-y-4">
                
                {/* App Brand Header */}
                <div className="text-center space-y-1">
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-400 flex items-center justify-center shadow-lg shadow-blue-500/20 border border-blue-400/30">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-sm font-black font-display text-white tracking-tight mt-2">
                    Guardian AI <span className="text-teal-400">Companion</span>
                  </h2>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Child Monitoring Node</p>
                </div>

                {/* Main Card Status */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 text-center space-y-3 relative overflow-hidden">
                  {sosActive && (
                    <div className="absolute inset-0 bg-rose-950/20 animate-pulse pointer-events-none border border-rose-500/40 rounded-2xl"></div>
                  )}
                  
                  <div>
                    <span className="text-[9px] text-slate-500 font-mono uppercase block">Agent Security Link</span>
                    <div className="inline-flex items-center space-x-1.5 mt-1 bg-teal-500/10 border border-teal-500/20 px-2.5 py-0.5 rounded-full text-[10px] text-teal-400 font-bold">
                      <span className="h-1.5 w-1.5 bg-teal-400 rounded-full animate-ping"></span>
                      <span>ACTIVE SHIELD RUNNING</span>
                    </div>
                  </div>

                  <div className="h-px bg-slate-900"></div>

                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-500 font-mono block uppercase">Assigned child ID</span>
                    <p className="text-base font-bold font-mono tracking-wider text-white">{deviceId || "Loading..."}</p>
                  </div>

                  <div className="h-px bg-slate-900"></div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] text-slate-500 font-mono block uppercase">Assigned Location</span>
                    <div className="flex items-center justify-center gap-1 text-xs text-white font-medium">
                      <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{locations[currentLocationIdx].name}</span>
                    </div>
                  </div>
                </div>

                {/* SOS Panic Mode Visual */}
                {sosActive ? (
                  <div className="bg-rose-900/30 border border-rose-500/30 rounded-2xl p-4 text-center space-y-2 animate-bounce">
                    <AlertTriangle className="h-6 w-6 text-rose-500 mx-auto animate-pulse" />
                    <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider font-mono">PANIC EMERGENCY ACTIVE</h4>
                    <p className="text-[9px] text-rose-300">Broadcasting emergency siren log to parent dashboard in real-time...</p>
                  </div>
                ) : (
                  <div className="bg-slate-950/30 border border-slate-900 rounded-2xl p-3 flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-[10px] text-slate-400">FIPS-encrypted pipeline secured</span>
                  </div>
                )}

                {/* QR Code pairing illustration */}
                <div className="bg-slate-950/60 border border-slate-850 rounded-2xl p-3 flex flex-col items-center justify-center space-y-2">
                  <span className="text-[9px] text-slate-400 font-mono uppercase">Scan QR to Pair</span>
                  {deviceId ? (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${deviceId}&color=000000&bgcolor=ffffff`}
                      alt="Pairing QR Code"
                      referrerPolicy="no-referrer"
                      className="h-[100px] w-[100px] rounded-lg p-1.5 bg-white border border-slate-800"
                    />
                  ) : (
                    <div className="h-[100px] w-[100px] bg-slate-900 animate-pulse rounded-lg flex items-center justify-center">
                      <QrCode className="h-8 w-8 text-slate-700" />
                    </div>
                  )}
                  <p className="text-[9px] text-slate-500 text-center leading-tight">Hold camera over QR code in pairing panel to instantly bind.</p>
                </div>

                {/* App Bottom Footer */}
                <div className="text-[9px] text-slate-500 font-mono text-center flex items-center justify-center gap-1 pt-1.5 border-t border-slate-900">
                  <Heart className="h-3 w-3 text-red-500/70" />
                  <span>Protecting what matters most</span>
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
