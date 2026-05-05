export class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.config = {
      fps: 15,
    };
  }

  setVideoElement(videoElement) {
    this.video = videoElement;
  }

  setCanvasElement(canvasElement) {
    this.canvas = canvasElement;
  }

  async loadCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === 'videoinput');
    } catch (error) {
      console.error('Error loading cameras:', error);
      return [];
    }
  }

  async startCamera(selectedCameraId) {
    try {
      if (this.stream) {
        this.stopCamera();
      }

      const constraints = {
        video: {
          frameRate: { ideal: this.config.fps },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      if (selectedCameraId === 'front') {
        constraints.video.facingMode = { ideal: 'user' };
      } else if (selectedCameraId === 'default') {
        constraints.video.facingMode = { ideal: 'environment' };
      } else if (selectedCameraId && typeof selectedCameraId === 'string') {
        constraints.video.deviceId = { exact: selectedCameraId };
      }



      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.video) {
        this.video.srcObject = this.stream;
        await this.video.play();
      }

      return this.stream;
    } catch (error) {
      console.error('Error starting camera:', error);
      throw error;
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }
  }

  setFPS(fps) {
    this.config.fps = fps;
    // Note: To apply FPS immediately, we would need to re-request the stream
    // but usually setting it in config is enough for the next startCamera call
    // or we can apply it to the track if supported.
    if (this.stream) {
      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.applyConstraints) {
        videoTrack.applyConstraints({ frameRate: { ideal: fps } })
          .catch((err) => console.warn('Could not apply FPS constraint:', err));
      }
    }
  }

  isActive() {
    return this.stream !== null && this.stream.active;
  }

  isReady() {
    return (
      this.video !== null &&
      this.video.readyState >= 2 &&
      this.isActive()
    );
  }
}