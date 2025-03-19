"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePreferenceVector = void 0;
const backend_1 = require("@aws-amplify/backend");
exports.generatePreferenceVector = (0, backend_1.defineFunction)({
    name: 'generatePreferenceVector',
    entry: './handler.ts',
    bundling: { minify: false },
    timeoutSeconds: 60,
    environment: {
        EVENTS_TABLE_NAME: process.env.EVENTS_TABLE_NAME || 'Events'
    }
});
