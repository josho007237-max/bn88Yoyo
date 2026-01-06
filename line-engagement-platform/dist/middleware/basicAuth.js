"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.basicAuthMiddleware = void 0;
const basic_auth_1 = __importDefault(require("basic-auth"));
const env_1 = require("../config/env");
const basicAuthMiddleware = (req, res, next) => {
    const user = (0, basic_auth_1.default)(req);
    if (!user || user.name !== env_1.env.BULL_BOARD_USER || user.pass !== env_1.env.BULL_BOARD_PASS) {
        res.set('WWW-Authenticate', 'Basic realm="Bull Board"');
        return res.status(401).send('Authentication required.');
    }
    return next();
};
exports.basicAuthMiddleware = basicAuthMiddleware;
