"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySignature = verifySignature;
// ponytail: HMAC-SHA256 verify, crypto is stdlib
const crypto_1 = __importDefault(require("crypto"));
function verifySignature(payload, signature, appSecret) {
    const expected = 'sha256=' + crypto_1.default.createHmac('sha256', appSecret).update(payload, 'utf8').digest('hex');
    // Timing-safe comparison
    return crypto_1.default.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(signature, 'utf8'));
}
