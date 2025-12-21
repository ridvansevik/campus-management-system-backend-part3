const express = require('express');
const { getBalance, topUpWallet, getTransactions } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/balance', protect, getBalance);
router.post('/topup', protect, topUpWallet);
router.get('/transactions', protect, getTransactions);

module.exports = router;