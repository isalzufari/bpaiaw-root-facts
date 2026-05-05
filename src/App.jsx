import { useEffect, useCallback, useRef, useState } from 'react';
import Header from './components/Header';
import CameraSection from './components/CameraSection';
import InfoPanel from './components/InfoPanel';
import { useAppState } from './hooks/useAppState';
import { CameraService } from './services/CameraService';
import { DetectionService } from './services/DetectionService';
import { RootFactsService } from './services/RootFactsService';
import { APP_CONFIG, isValidDetection } from './utils/config';

function App() {
  const { state, actions } = useAppState();
  const detectionCleanupRef = useRef(null);
  const isRunningRef = useRef(false);
  const appStateRef = useRef('idle'); // Gunakan ref untuk state aplikasi agar loop selalu mendapat nilai terbaru
  const [currentTone, setCurrentTone] = useState('normal');

  // Sinkronkan ref dengan state (untuk digunakan di dalam loop async)
  useEffect(() => {
    appStateRef.current = state.appState;
  }, [state.appState]);

  // Inisialisasi layanan deteksi, kamera, dan generator fakta saat aplikasi dimuat
  useEffect(() => {
    const initServices = async () => {
      try {
        actions.setModelStatus('Menyiapkan Backend AI...');

        const camera = new CameraService();
        const detector = new DetectionService();
        const generator = new RootFactsService();

        actions.setServices({ camera, detector, generator });

        // Load models
        actions.setModelStatus('Memuat Model Deteksi (TF.js)...');
        await detector.loadModel();

        actions.setModelStatus('Memuat Model Bahasa (Transformers.js)...');
        // Note: We could implement a progress callback in RootFactsService for percentage
        await generator.loadModel();

        actions.setModelStatus('Model AI Siap');
        actions.setAppState('idle');
      } catch (error) {
        console.error('Initialization error:', error);
        actions.setError(
          'Gagal memuat model AI. Pastikan koneksi internet stabil.',
        );
        actions.setModelStatus('Gagal Memuat Model');
      }
    };

    initServices();

    // Bersihkan sumber daya saat komponen ditinggalkan
    return () => {
      isRunningRef.current = false;
      if (detectionCleanupRef.current) {
        cancelAnimationFrame(detectionCleanupRef.current);
      }
      if (state.services.camera) {
        state.services.camera.stopCamera();
      }
    };
  }, []);

  // Fungsi untuk memulai loop deteksi
  const startDetectionLoop = useCallback(async () => {
    if (!isRunningRef.current) return;

    const { detector, camera, generator } = state.services;

    if (
      camera.isReady() &&
      detector.isLoaded() &&
      appStateRef.current === 'idle'
    ) {
      try {
        const result = await detector.predict(camera.video);

        if (isValidDetection(result)) {
          // Berhenti memindai segera setelah ditemukan
          isRunningRef.current = false;
          actions.setDetectionResult(result);
          actions.setFunFactData(null);
          actions.setAppState('result');

          // Buat pembatalan jika terlalu lama
          const timeoutId = setTimeout(() => {
            if (state.funFactData === null) {
              actions.setFunFactData('error');
            }
          }, 10000); // 10 detik timeout

          try {
            const fact = await generator.generateFacts(result.className);
            clearTimeout(timeoutId);

            actions.setFunFactData({
              label: result.className,
              fact: fact,
              timestamp: new Date().toLocaleTimeString(),
            });
          } catch (genError) {
            clearTimeout(timeoutId);
            console.error('Fact generation error:', genError);
            actions.setFunFactData('error');
          }
        }
      } catch (error) {
        console.error('Detection loop error:', error);
      }
    }

    if (isRunningRef.current) {
      detectionCleanupRef.current = requestAnimationFrame(startDetectionLoop);
    }
  }, [state.services, state.appState, actions]);

  // Fungsi untuk mereset aplikasi agar bisa memindai kembali
  const handleReset = useCallback(() => {
    appStateRef.current = 'idle';
    actions.setAppState('idle');
    actions.setDetectionResult(null);
    actions.setFunFactData(null);
    if (state.isRunning) {
      isRunningRef.current = true;
      startDetectionLoop();
    }
  }, [actions, state.isRunning, startDetectionLoop]);

  // Fungsi untuk memulai dan menghentikan kamera
  const handleCameraToggle = useCallback(
    async (cameraId) => {
      const { camera } = state.services;

      if (state.isRunning) {
        isRunningRef.current = false;
        if (detectionCleanupRef.current) {
          cancelAnimationFrame(detectionCleanupRef.current);
        }
        camera.stopCamera();
        actions.setRunning(false);
        actions.setAppState('idle');
      } else {
        try {
          await camera.startCamera(cameraId);
          actions.setRunning(true);
          isRunningRef.current = true;
          startDetectionLoop();
        } catch (error) {
          actions.setError(
            'Gagal mengakses kamera. Pastikan izin telah diberikan.',
          );
        }
      }
    },
    [state.services, state.isRunning, actions, startDetectionLoop],
  );

  // Fungsi untuk mengubah nada fakta yang dihasilkan
  const handleToneChange = useCallback(
    (tone) => {
      setCurrentTone(tone);
      if (state.services.generator) {
        state.services.generator.setTone(tone);
      }
    },
    [state.services.generator],
  );

  // Fungsi untuk menyalin fakta ke clipboard
  const handleCopyToClipboard = useCallback(async () => {
    if (state.funFactData && state.funFactData.fact) {
      try {
        await navigator.clipboard.writeText(state.funFactData.fact);
        // You might want to show a toast or temporary "Copied!" state
        alert('Teks berhasil disalin ke papan klip!');
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    }
  }, [state.funFactData]);

  return (
    <div className="app-container">
      <Header modelStatus={state.modelStatus} />

      <main className="main-content">
        <CameraSection
          isRunning={state.isRunning}
          onToggleCamera={handleCameraToggle}
          onToneChange={handleToneChange}
          services={state.services}
          modelStatus={state.modelStatus}
          error={state.error}
          currentTone={currentTone}
        />

        <InfoPanel
          appState={state.appState}
          detectionResult={state.detectionResult}
          funFactData={state.funFactData ? state.funFactData.fact : null}
          onCopyFact={handleCopyToClipboard}
          onReset={handleReset}
          error={state.error}
        />
      </main>

      <footer className="footer">
        <p>Powered by TensorFlow.js & Transformers.js</p>
      </footer>

      {state.error && (
        <div
          style={{
            position: 'fixed',
            bottom: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '380px',
            padding: '0.875rem 1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-md)',
            color: '#991b1b',
            fontSize: '0.8125rem',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            zIndex: 1000,
          }}
        >
          <strong>Error:</strong> {state.error}
          <button
            onClick={() => actions.setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#991b1b',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
