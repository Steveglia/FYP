import { defineFunction } from '@aws-amplify/backend';

export const generatePreferenceVector = defineFunction({
  name: 'generatePreferenceVector',
  entry: './handler.ts',
  bundling: { minify: false },
  timeoutSeconds: 60,
  environment: {
    EVENTS_TABLE_NAME: process.env.EVENTS_TABLE_NAME || 'Events'
  }
});
