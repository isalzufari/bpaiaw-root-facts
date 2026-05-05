/* eslint-disable indent */
import { pipeline, env } from '@huggingface/transformers';
import { TONE_CONFIG } from '../utils/config.js';

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = {
      model: 'Xenova/LaMini-Flan-T5-77M',
    };
    this.currentTone = TONE_CONFIG.defaultTone;
  }

  async loadModel() {
    try {
      // Configuration for Transformers.js
      env.allowLocalModels = false;

      // Initialize the pipeline with WebGPU support if possible
      this.generator = await pipeline(
        'text2text-generation',
        this.config.model,
        {
          device: 'webgpu', // Fallback is automatic to 'wasm' if webgpu is not available
          dtype: 'q4', // Use quantized model for performance
        },
      );

      this.isModelLoaded = true;
      return true;
    } catch (error) {
      console.error('Error loading Transformers.js model:', error);
      this.isModelLoaded = false;
      throw error;
    }
  }

  setTone(tone) {
    this.currentTone = tone;
  }

  async generateFacts(vegetableName) {
    if (!this.generator) {
      throw new Error('Generator not initialized');
    }

    this.isGenerating = true;

    try {
      // Construct prompt based on tone (Advanced Persona feature)
      let personaPrompt = '';
      switch (this.currentTone) {
        case 'funny':
          personaPrompt = 'Give me a hilarious and funny fact about ';
          break;
        case 'professional':
          personaPrompt =
            'Provide a professional, educational, and scientific fact about ';
          break;
        case 'casual':
          personaPrompt = 'Tell me a casual, cool, and interesting fact about ';
          break;
        default:
          personaPrompt = 'Give me an interesting fun fact about ';
          break;
      }

      const prompt = `${personaPrompt} ${vegetableName}. Keep it short and engaging.`;

      // Generate with Skilled parameters
      const output = await this.generator(prompt, {
        max_new_tokens: 150,
        temperature: 0.7,
        top_p: 0.9,
        do_sample: true,
      });

      this.isGenerating = false;
      return output[0].generated_text;
    } catch (error) {
      this.isGenerating = false;
      console.error('Error generating facts:', error);
      throw error;
    }
  }

  isReady() {
    return this.isModelLoaded && !this.isGenerating;
  }
}
