# System Architecture Documentation - RootFacts

Dokumen ini menyajikan arsitektur teknis dan logika bisnis dari aplikasi RootFacts, mencakup aliran data, kontrol proses, dan mekanisme integrasi AI.

---

## 1. System Visualizations

### Data Flow Diagram (DFD) Level 1

The following diagram illustrates the data flow from the hardware interface to the AI inference engines.

```mermaid
graph LR
    User((User))

    subgraph "RootFacts Application"
        P1[P1: Camera Controller]
        P2[P2: Object Detector]
        P3[P3: Fact Generator]
        P4[P4: UI/State Manager]
    end

    DS1[(TF.js Model & Labels)]
    DS2[(Transformers.js Model)]

    User -- "Camera Stream" --> P1
    P1 -- "Image Tensor" --> P2
    DS1 -- "Model Weights & Labels" --> P2
    P2 -- "Class Label & Confidence" --> P4

    P4 -- "Prompt Generation" --> P3
    DS2 -- "LLM Weights" --> P3
    P3 -- "Generated Fun Fact" --> P4

    P4 -- "Identification & AI Result" --> User
    User -- "Configuration/Reset" --> P4
```

### System Flowchart

This flowchart defines the operational logic from application initialization to result output.

```mermaid
flowchart TD
    Start([Open Application]) --> Init[Initialize TF.js & Transformers.js]
    Init --> LoadModel{Load AI Models}

    LoadModel -- Failure --> Error[Display Error Notification]
    LoadModel -- Success --> Idle[Status: Ready / Idle]

    Idle --> StartCam[User Triggers Scan]
    StartCam --> Capture[Capture Video Frame]

    Capture --> Detect[Inference Engine - TF.js]
    Detect --> CheckValid{Confidence > Threshold?}

    CheckValid -- No --> Capture
    CheckValid -- Yes --> StopCam[Halt Detection Loop]

    StopCam --> ShowResult[Display Identification Result]
    ShowResult --> GenFact[Generate Fact - LLM Inference]

    GenFact --> Display[Render Full Result UI]
    Display --> WaitReset{Trigger Manual Reset?}

    WaitReset -- Yes --> Reset[Clear State & Resume Loop]
    Reset --> Capture

    WaitReset -- No --> Display
```

### Activity Diagram

A sequential representation of the interactions between the User and the RootFacts System.

```mermaid
stateDiagram-v2
    [*] --> Initialization: App Launch
    Initialization --> Ready: Models Loaded Successfully

    state Ready {
        [*] --> WaitingForUser
        WaitingForUser --> ConfigureTone: User Selects Persona
    }

    Ready --> Scanning: User Clicks "Start Scan"

    state Scanning {
        [*] --> FetchFrame
        FetchFrame --> Analyze: AI Inference
        Analyze --> FetchFrame : Low Confidence
        Analyze --> ObjectFound : High Confidence
    }

    Scanning --> PresentResult: Detection Success

    state PresentResult {
        [*] --> DisplayLabel
        DisplayLabel --> LLMProcessing: Generating Fact
        LLMProcessing --> FinalResult: Generation Complete
        FinalResult --> ActionCopy: User Clicks Copy
    }

    PresentResult --> Ready: User Clicks "Scan Again"

    Initialization --> Failure: Loading Error
    Failure --> [*]
```

---

## 2. Core Business Logic Explanation

Berikut adalah penjelasan teknis mengenai logika bisnis utama yang diimplementasikan dalam sistem RootFacts.

### A. Adaptive AI Initialization

Sistem secara otomatis mendeteksi kapabilitas perangkat keras untuk memilih backend pemrosesan terbaik. Prioritas diberikan kepada **WebGPU** untuk efisiensi tinggi, dengan fallback ke **WebGL** atau **CPU**.

```javascript
// Logic for adaptive backend selection
if (navigator.gpu) {
  await tf.setBackend('webgpu'); // Primary: High-performance GPU processing
} else {
  await tf.setBackend('webgl'); // Secondary: Hardware acceleration fallback
}
```

### B. High-Precision Object Detection

Proses deteksi melibatkan transformasi citra menjadi tensor (224x224 pixel) yang dinormalisasi sebelum dikirim ke mesin inferensi TensorFlow.js.

```javascript
// Image-to-Tensor transformation and prediction
const tensor = tf.browser
  .fromPixels(videoElement)
  .resizeNearestNeighbor([224, 224])
  .toFloat()
  .div(127.5)
  .sub(1); // Normalization

const prediction = model.predict(tensor);
```

### C. Generative AI Persona Engine

Sistem menggunakan modul Transformers.js untuk melakukan _Natural Language Generation_ secara lokal. Konten fakta disesuaikan secara dinamis berdasarkan parameter gaya bahasa (_Tone_) yang dipilih pengguna.

```javascript
// Dynamic prompt engineering for LLM
const prompt = `Provide a ${selectedTone} fact about the vegetable: ${vegetableName}.`;
const result = await generator(prompt, { max_new_tokens: 128 });
```

### D. PWA & Offline Optimization

Untuk memenuhi kriteria akses luring, sistem menerapkan strategi _Precaching_ pada Service Worker. Berkas model AI yang berukuran besar dikelola melalui konfigurasi Workbox dengan limitasi ukuran file yang telah dioptimalkan.

```javascript
// PWA configuration for local asset persistence
workbox: {
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // Optimized for 5MB assets
  globPatterns: ['**/*.{json,bin,js,css,html}'], // Persistence for AI weights
}
```

---

> [!NOTE]
> Seluruh proses inferensi dilakukan pada sisi klien (_client-side_), memastikan kedaulatan data pengguna dan responsivitas aplikasi tanpa ketergantungan pada API eksternal setelah pemuatan awal.
