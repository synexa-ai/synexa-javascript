import axios, { AxiosInstance } from 'axios';
import { FileOutput } from './file-output';

interface SynexaOptions {
  auth: string;
  baseUrl?: string;
}

interface WaitOptions {
  type?: 'poll' | 'block';
  interval?: number;
  timeout?: number;
}

interface RunOptions {
  input: Record<string, any>;
  wait?: WaitOptions;
  webhook?: string;
  webhook_events_filter?: Array<'start' | 'output' | 'logs' | 'completed'>;
  signal?: AbortSignal;
  progress?: (prediction: PredictionResponse) => void;
}

interface PredictionInput {
  model: string;
  input: Record<string, any>;
  webhook?: string;
  webhook_events_filter?: Array<'start' | 'output' | 'logs' | 'completed'>;
}

interface PredictionResponse {
  id: string;
  model: string;
  version: string | null;
  input: Record<string, any>;
  logs: string | null;
  output: string[] | null;
  error: string | null;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  metrics: {
    predict_time?: number;
    [key: string]: any;
  } | null;
}

export default class Synexa {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(options: SynexaOptions) {
    this.apiKey = options.auth;
    this.client = axios.create({
      baseURL: options.baseUrl || 'https://api.synexa.ai/v1',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      }
    });
  }

  async createPrediction(input: PredictionInput): Promise<PredictionResponse> {
    try {
      const response = await this.client.post('/predictions', input);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to create prediction: ${error.message}`);
      }
      throw error;
    }
  }

  async getPrediction(id: string): Promise<PredictionResponse> {
    try {
      const response = await this.client.get(`/predictions/${id}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get prediction: ${error.message}`);
      }
      throw error;
    }
  }

  private async waitWithPolling(
    prediction: PredictionResponse,
    options: WaitOptions = {},
    signal?: AbortSignal,
    progress?: (prediction: PredictionResponse) => void
  ): Promise<PredictionResponse> {
    const interval = options.interval || 500;
    let currentPrediction = prediction;

    while (currentPrediction.status !== 'succeeded' && currentPrediction.status !== 'failed') {
      if (signal?.aborted) {
        throw new Error('Prediction cancelled');
      }

      await new Promise(resolve => setTimeout(resolve, interval));
      currentPrediction = await this.getPrediction(currentPrediction.id);
      
      if (progress) {
        progress(currentPrediction);
      }
    }

    if (currentPrediction.status === 'failed') {
      throw new Error(`Prediction failed: ${currentPrediction.error}`);
    }

    return currentPrediction;
  }

  private async waitWithBlock(
    prediction: PredictionResponse,
    options: WaitOptions = {},
    signal?: AbortSignal,
    progress?: (prediction: PredictionResponse) => void
  ): Promise<PredictionResponse> {
    try {
      const response = await this.client.post(`/predictions/${prediction.id}/wait`, {
        timeout: options.timeout || 60
      }, {
        signal
      });
      const result = response.data;
      
      if (progress) {
        progress(result);
      }

      if (result.status === 'failed') {
        throw new Error(`Prediction failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Prediction cancelled');
      }
      // If blocking wait fails, fall back to polling
      return this.waitWithPolling(prediction, options, signal, progress);
    }
  }

  async wait(
    prediction: PredictionResponse,
    options: WaitOptions = {},
    signal?: AbortSignal,
    progress?: (prediction: PredictionResponse) => void
  ): Promise<PredictionResponse> {
    const waitType = options.type || 'block';
    
    if (progress) {
      progress(prediction);
    }

    if (waitType === 'block') {
      return this.waitWithBlock(prediction, options, signal, progress);
    } else {
      return this.waitWithPolling(prediction, options, signal, progress);
    }
  }

  async run(
    identifier: string,
    options: RunOptions
  ): Promise<Array<string | FileOutput>> {
    const [owner, model] = identifier.split('/');
    const [name, version] = model.split(':');

    const prediction = await this.createPrediction({
      model: `${owner}/${name}`,
      input: options.input,
      webhook: options.webhook,
      webhook_events_filter: options.webhook_events_filter
    });

    const result = await this.wait(
      prediction,
      options.wait,
      options.signal,
      options.progress
    );

    if (!result.output) {
      throw new Error('No output received from the prediction');
    }

    return result.output.map(output => {
      if (output.startsWith('http')) {
        return new FileOutput(output);
      }
      return output;
    });
  }
}
