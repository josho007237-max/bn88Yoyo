"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirm = exports.createPayment = void 0;
const linePay_service_1 = require("../services/linePay.service");
const createPayment = async (req, res) => {
    const { orderId, amount } = req.body;
    const data = await (0, linePay_service_1.requestPayment)(orderId, amount);
    res.json({
        ok: true,
        paymentUrl: data.info.paymentUrl.web,
        transactionId: data.info.transactionId,
    });
};
exports.createPayment = createPayment;
const confirm = async (req, res) => {
    const { transactionId, amount } = req.body;
    const data = await (0, linePay_service_1.confirmPayment)(transactionId, amount);
    res.json({ ok: true, data });
};
exports.confirm = confirm;
