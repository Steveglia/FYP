import { defineFunction } from '@aws-amplify/backend';

export const generatePreferenceVector = defineFunction({
  name: 'generatePreferenceVector',
  entry: './handler.ts'
});
