"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store_events = void 0;
const backend_1 = require("@aws-amplify/backend");
exports.store_events = (0, backend_1.defineFunction)({
    name: 'store_events',
    entry: './handler.ts',
    bundling: { minify: false },
    timeoutSeconds: 60,
    environment: {
        EVENTS_TABLE_NAME: process.env.EVENTS_TABLE_NAME || 'Events'
    }
});
