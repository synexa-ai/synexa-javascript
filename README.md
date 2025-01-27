# Synexa Node.js Client

A Node.js client for Synexa AI API. It lets you run AI models and manage predictions through Synexa's HTTP API.

## Installation

Install it from npm:

```bash
npm install synexa
```

## Usage

Import the package:

```typescript
// ESM
import Synexa from 'synexa';

// CommonJS
const Synexa = require('synexa').default;
```

Instantiate the client:

```typescript
const synexa = new Synexa({
  auth: process.env.SYNEXA_API_TOKEN // Your Synexa API token
});
```

Run a model and await the result:

```typescript
const model = "black-forest-labs/flux-schnell";
const input = {
  prompt: "An astronaut riding a rainbow unicorn, cinematic, dramatic"
};

const [output] = await synexa.run(model, { input });
// If the output is a URL, you get a FileOutput object
if (output instanceof FileOutput) {
  console.log(output.url()); // Get the URL string
  const blob = await output.blob(); // Get the file data as a Blob
}
```

You can also create a prediction with more control:

```typescript
// Create a prediction with webhook
const prediction = await synexa.createPrediction({
  model: "black-forest-labs/flux-schnell",
  input: {
    prompt: "An astronaut riding a rainbow unicorn, cinematic, dramatic"
  },
  webhook: "https://your-webhook-url.com",
  webhook_events_filter: ["start", "completed"]
});

// Get prediction status
const status = await synexa.getPrediction(prediction.id);

// Wait for the prediction with options
const result = await synexa.wait(prediction, {
  type: "block", // "block" or "poll"
  interval: 1000, // polling interval in ms
  timeout: 60 // timeout in seconds for blocking mode
});

console.log(result.output);
```

Advanced usage with all options:

```typescript
const controller = new AbortController();

const [output] = await synexa.run("black-forest-labs/flux-schnell", {
  input: {
    prompt: "An astronaut riding a rainbow unicorn, cinematic, dramatic"
  },
  wait: {
    type: "block", // or "poll"
    interval: 1000, // polling interval in ms
    timeout: 60 // timeout in seconds for blocking mode
  },
  webhook: "https://your-webhook-url.com",
  webhook_events_filter: ["start", "output", "logs", "completed"],
  signal: controller.signal, // AbortSignal for cancellation
  progress: (prediction) => {
    console.log(`Status: ${prediction.status}`);
  }
});
```

## API Reference

### Constructor Options

| Option | Type | Description |
|--------|------|-------------|
| `auth` | string | **Required**. Your Synexa API token |
| `baseUrl` | string | Optional. The base URL for the Synexa API |

### Run Options

| Option | Type | Description |
|--------|------|-------------|
| `input` | object | **Required**. An object with the model inputs |
| `wait.type` | "poll" \| "block" | `"block"` holds the request open, `"poll"` makes repeated requests. Defaults to `"block"` |
| `wait.interval` | number | Polling interval in milliseconds. Defaults to 500 |
| `wait.timeout` | number | In `"block"` mode determines how long the request will be held open until falling back to polling. Defaults to 60 |
| `webhook` | string | An HTTPS URL for receiving a webhook when the prediction has new output |
| `webhook_events_filter` | string[] | An array of events which should trigger webhooks. Values: `"start"`, `"output"`, `"logs"`, `"completed"` |
| `signal` | AbortSignal | An AbortSignal to cancel the prediction |
| `progress` | function | Callback function that receives the prediction object as it's updated |

### FileOutput

The `FileOutput` class implements `ReadableStream` and provides methods to access file data:

- `url()`: Get the URL string for the file
- `blob()`: Get the file data as a Blob

### Error Handling

The client will throw errors for various failure cases:
- Network errors
- API errors
- Timeout errors when polling for results
- Missing or invalid output
- Prediction cancellation
- Failed predictions with error messages
