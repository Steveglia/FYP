"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStudySessions = void 0;
const backend_1 = require("@aws-amplify/backend");
exports.generateStudySessions = (0, backend_1.defineFunction)({
    name: "generateStudySessions",
    timeoutSeconds: 60,
});
