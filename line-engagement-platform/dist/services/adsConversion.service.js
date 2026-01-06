"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitConversion = void 0;
const axios_1 = require("../utils/axios");
const env_1 = require("../config/env");
const emitConversion = async (eventName, payload) => {
    const url = 'https://api.line.biz/ads/conversion/events';
    return axios_1.http.post(url, { event: eventName, properties: payload }, {
        headers: {
            Authorization: `Bearer ${env_1.env.ADS_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
        },
    });
};
exports.emitConversion = emitConversion;
