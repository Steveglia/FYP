import { defineFunction } from '@aws-amplify/backend';

export const store_events = defineFunction({
  name: 'store_events',
  entry: './handler.ts',
  bundling: { minify: false },
  timeoutSeconds: 60,
  environment: {
    EVENTS_TABLE_NAME: process.env.EVENTS_TABLE_NAME || 'Events'
  }
});
