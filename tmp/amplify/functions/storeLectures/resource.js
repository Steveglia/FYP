"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store_lectures = void 0;
const backend_1 = require("@aws-amplify/backend");
exports.store_lectures = (0, backend_1.defineFunction)({
    name: 'store_lectures',
    entry: './handler.ts',
    bundling: { minify: false },
    timeoutSeconds: 60,
    environment: {
        LECTURES_TABLE_NAME: process.env.LECTURES_TABLE_NAME || 'Lectures'
    }
});
