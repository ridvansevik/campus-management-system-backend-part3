const express = require('express');
const { getBalance, topUpWallet, getTransactions, handlePaymentWebhook } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/balance', protect, getBalance);
router.post('/topup', protect, topUpWallet);
router.post('/topup/webhook', handlePaymentWebhook); // Webhook için auth gerekmez (signature ile doğrulanır)
router.get('/transactions', protect, getTransactions);

module.exports = router;