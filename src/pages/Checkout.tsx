import React, { useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Calendar,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { StorageService } from '../services/storageService';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { PriceSummaryBox } from '../components/marketplace/PriceSummaryBox';
import { PaymentMethods, PaymentMethodType } from '../components/marketplace/PaymentMethods';
import { useToast } from '../components/common/ToastContext';
import { formatINR, FALLBACK_IMAGE } from '../utils/format';
import { useWallet } from '../context/WalletContext';
import { bookAndDeposit, inrToWei, fetchRental, weiToMSTC } from '../blockchain/contract';
import { switchToMSTNetwork } from '../blockchain/wallet';
import { MST_NETWORK, EXPLORER_TX_URL, RentalState } from '../blockchain/config';
import { ethers } from 'ethers';

export const Checkout: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { wallet, connect, refreshWalletBalance } = useWallet();

  const item = StorageService.getItemById(id || '');
  const currentUser = StorageService.getCurrentUser();
  const walletBalance = StorageService.getWalletBalance();

  const startDate = searchParams.get('start') || new Date().toISOString().split('T')[0];
  const endDate =
    searchParams.get('end') ||
    new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
  const days = Number(searchParams.get('days') || '3');

  const [paymentOption, setPaymentOption] = useState<PaymentMethodType>('wallet');
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [onChainRentalIdInput, setOnChainRentalIdInput] = useState(searchParams.get('rentalId') || '');
  const [txStatus, setTxStatus] = useState<'idle' | 'awaiting_signature' | 'confirming' | 'confirmed' | 'failed'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  if (!item) {
    return (
      <div className="bg-white border border-[#E5E8EF] rounded-xl p-10 text-center max-w-md mx-auto my-8">
        <h2 className="text-lg font-bold text-[#202938]">Item not found</h2>
        <Link to="/marketplace">
          <Button variant="secondary" size="sm" className="mt-4">
            Return to Marketplace
          </Button>
        </Link>
      </div>
    );
  }

  const rentalFee = item.dailyPrice * Math.max(1, days);
  const totalAmount = rentalFee + item.securityDeposit;
  const totalWei = inrToWei(totalAmount);
  const totalMSTCStr = weiToMSTC(totalWei);

  const handleConfirmBooking = async () => {
    if (!agreedToTerms) {
      showToast('Please agree to the peer rental and return terms to proceed.', 'error');
      return;
    }

    if (paymentOption === 'upi') {
      setIsProcessing(true);
      setTimeout(() => {
        const booking = StorageService.createBooking({
          item,
          startDate,
          endDate,
          days,
          rentalFee,
          securityDeposit: item.securityDeposit,
          totalAmount,
        });
        setIsProcessing(false);
        showToast('Simulated UPI payment authorized! Booking confirmed.', 'success');
        navigate(`/booking-confirmation/${booking.bookingRef}?method=upi`);
      }, 600);
      return;
    }

    // Web3 / MST Testnet Blockchain Escrow Flow
    if (!wallet.connected || !wallet.signer || !wallet.provider) {
      showToast('Please connect your BridgeKey or EVM wallet to lock escrow funds.', 'error');
      await connect();
      return;
    }

    if (!wallet.isCorrectNetwork) {
      showToast(`Please switch your wallet to MST Testnet (Chain ID ${MST_NETWORK.chainId}).`, 'error');
      await switchToMSTNetwork();
      return;
    }

    const requiredMSTC = parseFloat(totalMSTCStr);
    const userBalance = parseFloat(wallet.balance);
    if (userBalance < requiredMSTC) {
      showToast(
        `Insufficient tMSTC balance: You have ${wallet.balance} tMSTC, but ${requiredMSTC.toFixed(3)} tMSTC is required. Obtain free tokens at https://faucet.masterstroke.academy`,
        'error'
      );
      return;
    }

    const rentalIdNum = parseInt(onChainRentalIdInput.trim(), 10);
    if (isNaN(rentalIdNum) || rentalIdNum <= 0) {
      showToast(
        'Please enter a valid On-Chain Rental ID. (The item owner creates this via My Listings > Create Escrow).',
        'error'
      );
      return;
    }

    setIsProcessing(true);
    setTxStatus('awaiting_signature');
    setTxError(null);

    try {
      // 1. Verify on-chain rental state before requesting deposit
      const onChainData = await fetchRental(wallet.provider, BigInt(rentalIdNum));
      if (onChainData.state !== RentalState.Created) {
        throw new Error(
          `On-chain Rental #${rentalIdNum} is not in 'Created' state. Current state: ${RentalState[onChainData.state] ?? onChainData.state}`
        );
      }
      if (onChainData.renter.toLowerCase() !== wallet.address.toLowerCase()) {
        throw new Error(
          `Connected wallet (${wallet.address.slice(0, 6)}...) does not match designated renter (${onChainData.renter.slice(0, 6)}...) on Rental #${rentalIdNum}.`
        );
      }

      const expectedDeposit = onChainData.rentAmount + onChainData.depositAmount;

      // 2. Call bookAndDeposit with exact required funds
      setTxStatus('awaiting_signature');
      showToast('Please confirm the escrow deposit in your wallet...', 'info');

      setTxStatus('confirming');
      const result = await bookAndDeposit(wallet.signer, BigInt(rentalIdNum), expectedDeposit);

      setTxStatus('confirmed');
      setTxHash(result.hash);

      // 3. Record confirmed booking with verifiable on-chain metadata
      const booking = StorageService.createBooking({
        item,
        startDate,
        endDate,
        days,
        rentalFee,
        securityDeposit: item.securityDeposit,
        totalAmount,
        onChainRentalId: rentalIdNum,
        blockchainTxHash: result.hash,
        renterWalletAddress: wallet.address,
        ownerWalletAddress: onChainData.owner,
      });

      await refreshWalletBalance();
      showToast('Escrow deposit confirmed on MST Testnet!', 'success');
      navigate(`/booking-confirmation/${booking.bookingRef}?method=wallet&tx=${result.hash}&rentalId=${rentalIdNum}`);
    } catch (err: any) {
      console.error('Booking failed:', err);
      const errMsg = err?.message || 'Transaction failed or was rejected.';
      setTxStatus('failed');
      setTxError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to={`/item/${item.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#687386] hover:text-[#202938]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Item Details</span>
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[#202938]">Rental Checkout & Escrow</h1>
        <p className="text-xs text-[#687386] mt-0.5">
          Review your reservation dates, escrow breakdown, and simulated student payment.
        </p>
      </div>

      {/* Notice Banner */}
      <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#3157C8] shrink-0 mt-0.5" />
        <div className="text-xs text-[#202938] leading-relaxed">
          <strong>MST Testnet Escrow Active:</strong> UniRent Wallet transactions lock testnet <span className="font-semibold text-[#3157C8]">tMSTC</span> directly in the deployed smart contract on MST Testnet (Chain ID 91562037). Funds remain locked in escrow until item return confirmation.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Column: Booking Summary & Payment Methods (7 cols) */}
        <div className="md:col-span-7 space-y-6">
          {/* Item Mini Card */}
          <div className="bg-white border border-[#E5E8EF] rounded-xl p-4 flex gap-4 items-center shadow-xs">
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-20 h-20 rounded-lg object-cover border border-[#E5E8EF]"
              onError={(e) => {
                (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
              }}
            />
            <div className="flex-1">
              <Badge variant="neutral" size="sm" className="mb-1">
                {item.category}
              </Badge>
              <h3 className="font-semibold text-sm text-[#202938]">{item.title}</h3>
              <p className="text-xs text-[#687386] mt-0.5">Owner: {item.ownerName} ({item.ownerCollege})</p>
              <p className="text-xs text-[#687386]">Handover: {item.location}</p>
            </div>
          </div>

          {/* Rental Dates Summary */}
          <div className="bg-white border border-[#E5E8EF] rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#202938]">
              Rental Schedule
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-[#E5E8EF] rounded-lg">
                <span className="text-[#687386] block text-[11px]">Start Date (Pickup)</span>
                <span className="font-semibold text-[#202938] text-sm">{startDate}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-[#E5E8EF] rounded-lg">
                <span className="text-[#687386] block text-[11px]">End Date (Return)</span>
                <span className="font-semibold text-[#202938] text-sm">{endDate}</span>
              </div>
            </div>
            <p className="text-xs text-[#687386]">
              Total Reservation: <strong className="text-[#202938]">{days} days</strong>
            </p>
          </div>

          {/* Two Selectable Payment Methods */}
          <PaymentMethods
            selectedMethod={paymentOption}
            onSelectMethod={setPaymentOption}
            walletBalance={walletBalance}
            walletAddress={currentUser.walletAddress}
            totalAmount={totalAmount}
            realWalletConnected={wallet.connected}
            realWalletBalance={wallet.balance}
            realWalletAddress={wallet.address}
            isCorrectNetwork={wallet.isCorrectNetwork}
            onConnectWallet={connect}
            onSwitchNetwork={switchToMSTNetwork}
          />

          {/* On-Chain Escrow Agreement Input */}
          {paymentOption === 'wallet' && (
            <div className="bg-white border border-[#3157C8]/40 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#202938] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#3157C8]" />
                  <span>On-Chain Rental Escrow Agreement</span>
                </h3>
                <span className="text-[11px] text-[#3157C8] font-mono">MST Testnet</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#202938] block mb-1">
                  Agreement Rental ID (from Item Owner)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 1"
                  value={onChainRentalIdInput}
                  onChange={(e) => setOnChainRentalIdInput(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-[#E5E8EF] rounded-lg px-3 py-2 font-mono text-[#202938] focus:outline-none focus:ring-2 focus:ring-[#3157C8]"
                />
                <p className="text-[11px] text-[#687386] mt-1">
                  The item owner creates the agreement on-chain via <strong>My Listings &gt; Create Escrow</strong>. Enter the generated Rental ID to lock funds in escrow.
                </p>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200/50 rounded-lg text-xs space-y-1 text-[#202938]">
                <div className="flex justify-between">
                  <span className="text-[#687386]">Rent Escrow Hold:</span>
                  <span className="font-semibold">{(rentalFee / 1000).toFixed(3)} tMSTC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#687386]">Security Deposit Hold:</span>
                  <span className="font-semibold">{(item.securityDeposit / 1000).toFixed(3)} tMSTC</span>
                </div>
                <div className="flex justify-between border-t border-blue-200/50 pt-1 font-bold text-[#3157C8]">
                  <span>Total Lockup:</span>
                  <span>{totalMSTCStr} tMSTC</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Cost Breakdown & Confirmation (5 cols) */}
        <div className="md:col-span-5 space-y-5">
          <div className="bg-white border border-[#E5E8EF] rounded-xl p-5 shadow-xs space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#202938]">
              Cost Breakdown
            </h3>

            <PriceSummaryBox
              dailyPrice={item.dailyPrice}
              securityDeposit={item.securityDeposit}
              days={days}
            />

            <div className="p-3 bg-slate-50 border border-[#E5E8EF] rounded-lg text-xs space-y-1">
              <span className="text-[#687386] block text-[11px]">Payment Mode</span>
              <p className="font-semibold text-[#202938]">
                {paymentOption === 'upi' ? 'UPI Instant Payment (Prototype)' : `MST Testnet Escrow (${totalMSTCStr} tMSTC)`}
              </p>
            </div>

            {/* Live Transaction Status Banners */}
            {txStatus === 'awaiting_signature' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-[#3157C8] flex items-center gap-2 animate-pulse">
                <div className="w-3 h-3 rounded-full border-2 border-[#3157C8] border-t-transparent animate-spin shrink-0" />
                <span>Please confirm the escrow deposit in your wallet...</span>
              </div>
            )}
            {txStatus === 'confirming' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-amber-600 border-t-transparent animate-spin shrink-0" />
                <span>Transaction broadcast to MST Testnet. Waiting for block confirmation...</span>
              </div>
            )}
            {txStatus === 'failed' && txError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 space-y-1">
                <strong>Transaction Failed:</strong>
                <p className="text-[11px] break-words">{txError}</p>
              </div>
            )}

            <div className="space-y-3 pt-3 border-t border-[#E5E8EF]">
              <label className="flex items-start gap-2 text-xs text-[#687386] cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 text-[#3157C8] rounded focus:ring-[#3157C8]"
                />
                <span>
                  I understand the security deposit will be temporarily locked in escrow and I agree to return the item on {endDate} in its verified condition.
                </span>
              </label>

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleConfirmBooking}
                isLoading={isProcessing}
              >
                {paymentOption === 'upi'
                  ? `Confirm Booking via UPI (${formatINR(totalAmount)})`
                  : `Deposit Escrow (${totalMSTCStr} tMSTC)`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
