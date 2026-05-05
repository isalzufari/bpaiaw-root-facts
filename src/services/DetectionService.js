import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.config = {
      modelUrl: '/model/model.json',
      metadataUrl: '/model/metadata.json',
    };
  }

  async loadModel() {
    try {
      // Adaptive Backend: Try WebGPU, then WebGL, then CPU
      if (navigator.gpu) {
        try {
          await tf.setBackend('webgpu');
          console.log('Using WebGPU backend');
        } catch (e) {
          console.warn('WebGPU failed, falling back to WebGL', e);
          await tf.setBackend('webgl');
        }
      } else {
        await tf.setBackend('webgl');
        console.log('Using WebGL backend');
      }
      await tf.ready();

      // Load model and metadata
      const [model, metadataResponse] = await Promise.all([
        tf.loadLayersModel(this.config.modelUrl),
        fetch(this.config.metadataUrl),
      ]);

      const metadata = await metadataResponse.json();

      this.model = model;
      this.labels = metadata.labels || [];

      console.log('Model loaded successfully with labels:', this.labels);
      return { model, labels: this.labels };
    } catch (error) {
      console.error('Error loading model:', error);
      throw error;
    }
  }

  async predict(imageElement) {
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    // Memory Management: Use tf.tidy to clean up tensors
    return tf.tidy(() => {
      const tensor = tf.browser
        .fromPixels(imageElement)
        .resizeNearestNeighbor([224, 224]) // TM models usually use 224x224
        .toFloat()
        .expandDims();

      // Teachable Machine models usually expect normalization
      const normalizedTensor = tensor.div(127.5).sub(1);

      const predictions = this.model.predict(normalizedTensor);
      const probabilities = predictions.dataSync();

      // Find the label with highest probability
      let maxProb = -1;
      let labelIdx = -1;

      for (let i = 0; i < probabilities.length; i++) {
        if (probabilities[i] > maxProb) {
          maxProb = probabilities[i];
          labelIdx = i;
        }
      }

      return {
        className: this.labels[labelIdx] || 'Unknown',
        score: maxProb,
        confidence: Math.round(maxProb * 100),
        isValid: labelIdx !== -1,
        allPredictions: probabilities,
      };
    });
  }

  isLoaded() {
    return this.model !== null;
  }
}
