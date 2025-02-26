import { defineFunction } from '@aws-amplify/backend';

export const store_events = defineFunction({
  // optionally specify a name for the Function (defaults to directory name)
  name: 'store_events',
  // optionally specify a path to your handler (defaults to "./handler.ts")
  entry: './handler.ts',

  bundling: {
    minify: false
  },
  timeoutSeconds: 60,
  environment: {
    EVENTS_TABLE_NAME: process.env.EVENTS_TABLE_NAME || 'Events' // Replace with your actual table name
  }
});