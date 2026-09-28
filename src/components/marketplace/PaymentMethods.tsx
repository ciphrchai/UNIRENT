import React from 'react';
import { Wallet, Smartphone, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Badge } from '../common/Badge';
import { formatINR } from '../../utils/format';

export type PaymentMethodType = 'upi' | 'wallet';

export interface PaymentMethodsProps {
  selectedMethod: PaymentMethodType;
  onSelectMethod: (method: PaymentMethodType) => void;
  walletBalance: number;
  walletAddress: string;
  totalAmount: number;
  realWalletConnected?: boolean;
  realWalletBalance?: string;
  realWalletAddress?: string;
  isCorrectNetwork?: boolean;
  onConnectWallet?: () => void;
  onSwitchNetwork?: () => void;
}

export const PaymentMethods: React.FC<PaymentMethodsProps> = ({
  selectedMethod,
  onSelectMethod,
  walletBalance,
  walletAddress,
  totalAmount,
  realWalletConnected,
  realWalletBalance,
  realWalletAddress,
  isCorrectNetwork,
  onConnectWallet,
  onSwitchNetwork,
}) => {
  return (
    <div className="bg-white border border-[#E5E8EF] rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-1 border-b border-[#E5E8EF]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#202938]">
          Select Payment Method
        </h3>
        <span className="text-[11px] text-[#687386]">Choose 1 of 2 options</span>
      </div>

      {/* Option A: UPI Payment */}
      <label
        onClick={() => onSelectMethod('upi')}
        className={`flex items-start gap-3.5 p-4 border rounded-xl cursor-pointer transition-all ${
          selectedMethod === 'upi'
            ? 'border-[#3157C8] bg-blue-50/40 ring-2 ring-[#3157C8]/20 shadow-xs'
            : 'border-[#E5E8EF] hover:bg-slate-50/70'
        }`}
      >
        <div className="pt-0.5">
          <input
            type="radio"
            name="paymentOption"
            value="upi"
            checked={selectedMethod === 'upi'}
            onChange={() => onSelectMethod('upi')}
            className="w-4 h-4 text-[#3157C8] focus:ring-[#3157C8] cursor-pointer"
          />
        </div>

        <div className="flex-1 space-y-2 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {/* Recognizable UPI badge styling */}
              <div className="px-2 py-0.5 bg-[#097939] text-white font-black text-[11px] rounded tracking-wider flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-white" />
                <span>UPI</span>
              </div>
              <span className="font-semibold text-sm text-[#202938]">
                UPI Instant Payment
              </span>
            </div>
            <Badge variant="success" size="sm">
              Instant Refund Support
            </Badge>
          </div>

          <p className="text-[#687386] text-xs">
            Pay using your preferred UPI app.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-[#687386]">Supported Apps:</span>
            <div className="flex gap-1.5 flex-wrap text-[11px] font-medium text-[#202938]">
              <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Google Pay</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">PhonePe</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Paytm</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">BHIM</span>
            </div>
          </div>

          {selectedMethod === 'upi' && (
            <div className="mt-3 p-3 bg-white border border-[#E5E8EF] rounded-lg space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#687386]">Simulated UPI Flow:</span>
                <span className="font-semibold text-[#16845B] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready to authorize
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value="student.a@okaxis"
                  className="w-full text-xs bg-slate-50 border border-[#E5E8EF] rounded px-2.5 py-1.5 font-mono text-[#202938]"
                />
                <button
                  type="button"
                  className="text-[11px] font-medium px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-[#202938]"
                >
                  Verified
                </button>
              </div>
            </div>
          )}
        </div>
      </label>

      {/* Option B: UniRent Wallet (MST Coins) */}
      <label
        onClick={() => onSelectMethod('wallet')}
        className={`flex items-start gap-3.5 p-4 border rounded-xl cursor-pointer transition-all ${
          selectedMethod === 'wallet'
            ? 'border-[#3157C8] bg-blue-50/40 ring-2 ring-[#3157C8]/20 shadow-xs'
            : 'border-[#E5E8EF] hover:bg-slate-50/70'
        }`}
      >
        <div className="pt-0.5">
          <input
            type="radio"
            name="paymentOption"
            value="wallet"
            checked={selectedMethod === 'wallet'}
            onChange={() => onSelectMethod('wallet')}
            className="w-4 h-4 text-[#3157C8] focus:ring-[#3157C8] cursor-pointer"
          />
        </div>

        <div className="flex-1 space-y-2 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-blue-100 text-[#3157C8] rounded">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold text-sm text-[#202938]">
                MST Testnet Wallet (tMSTC)
              </span>
            </div>
            {realWalletConnected ? (
              isCorrectNetwork ? (
                <Badge variant="success" size="sm">
                  {realWalletBalance ?? '0'} tMSTC Available
                </Badge>
              ) : (
                <Badge variant="danger" size="sm">
                  Wrong Network
                </Badge>
              )
            ) : (
              <Badge variant="neutral" size="sm">
                Wallet Not Connected
              </Badge>
            )}
          </div>

          <p className="text-[#687386] text-xs">
            Rental payment and security deposit will be locked directly in the deployed UniRent smart contract on MST Testnet.
          </p>

          {!realWalletConnected ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onConnectWallet?.();
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#3157C8] text-white hover:bg-[#2446A8] transition-colors cursor-pointer"
              >
                Connect BridgeKey / EVM Wallet
              </button>
            </div>
          ) : !isCorrectNetwork ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSwitchNetwork?.();
                }}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer"
              >
                Switch to MST Testnet (Chain ID 91562037)
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="p-2 bg-white border border-[#E5E8EF] rounded">
                <span className="text-[#687386] block">Escrow Hold Amount</span>
                <span className="font-bold text-[#3157C8] text-xs">
                  {(totalAmount / 1000).toFixed(3)} tMSTC ({formatINR(totalAmount)})
                </span>
              </div>
              <div className="p-2 bg-white border border-[#E5E8EF] rounded">
                <span className="text-[#687386] block">Connected Wallet</span>
                <span className="font-mono text-[#202938] text-xs truncate block" title={realWalletAddress}>
                  {realWalletAddress ? `${realWalletAddress.slice(0, 10)}...${realWalletAddress.slice(-6)}` : walletAddress}
                </span>
              </div>
            </div>
          )}
        </div>
      </label>
    </div>
  );
};
