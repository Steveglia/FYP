import { defineFunction } from '@aws-amplify/backend';

export const store_lectures = defineFunction({
  name: 'store_lectures',
  entry: './handler.ts',
  bundling: { minify: false },
  timeoutSeconds: 60,
  environment: {
    LECTURES_TABLE_NAME: process.env.LECTURES_TABLE_NAME || 'Lectures'
  }
}); 