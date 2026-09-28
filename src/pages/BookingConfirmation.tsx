import React from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Calendar,
  ShieldCheck,
  ArrowRight,
  ShoppingBag,
  Info,
  Clock,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { StorageService } from '../services/storageService';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { formatINR, FALLBACK_IMAGE } from '../utils/format';
import { EXPLORER_TX_URL } from '../blockchain/config';

export const BookingConfirmation: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const booking = StorageService.getBookingById(bookingId || '');

  const txHash = booking?.blockchainTxHash || searchParams.get('tx');
  const onChainRentalId = booking?.onChainRentalId || searchParams.get('rentalId');
  const isRealOnChain = !!txHash && !txHash.includes('Simulated') && !txHash.includes('Local');

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      {/* Success banner card */}
      <div className="bg-white border border-[#E5E8EF] rounded-2xl p-8 text-center shadow-xs space-y-4">
        <div className="w-14 h-14 bg-emerald-50 text-[#16845B] border border-emerald-200/60 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#16845B] mb-2 border border-emerald-200/50">
            {isRealOnChain ? 'On-Chain Escrow Locked (MST Testnet)' : 'Booking Reserved'}
          </span>
          <h1 className="text-2xl font-bold text-[#202938]">
            {isRealOnChain ? 'Escrow Confirmed on Blockchain' : 'Rental Request Confirmed'}
          </h1>
          <p className="text-xs text-[#687386] max-w-md mx-auto mt-1">
            {isRealOnChain
              ? 'Your rent payment and security deposit are securely locked in the UniRent RentalEscrow smart contract on MST Testnet.'
              : 'Your peer rental request has been created. The owner has been notified for campus pickup coordination.'}
          </p>
        </div>

        {/* Real On-Chain Blockchain Box */}
        {isRealOnChain ? (
          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl text-left space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>MST Blockchain Escrow Record</span>
              </span>
              {onChainRentalId && (
                <span className="text-xs font-mono font-bold text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-200">
                  Rental #{onChainRentalId}
                </span>
              )}
            </div>

            <div className="text-xs space-y-1">
              <span className="text-[#687386] block text-[11px]">Transaction Hash</span>
              <p className="font-mono text-[11px] text-[#202938] break-all bg-white p-2 rounded border border-emerald-100">
                {txHash}
              </p>
            </div>

            <div className="pt-1 flex items-center justify-end">
              <a
                href={EXPLORER_TX_URL(txHash!)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#3157C8] hover:underline"
              >
                <span>View on MST Testnet Explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-lg text-xs text-[#C58A24] text-left flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Demo Notice:</strong> This reservation was created with simulated mock funds. To lock real escrow on-chain, select UniRent Wallet with MST Testnet.
            </span>
          </div>
        )}

        {/* Reference Number Box */}
        <div className="p-4 bg-slate-50 border border-[#E5E8EF] rounded-xl flex items-center justify-between text-left">
          <div>
            <span className="text-[11px] text-[#687386] block">Booking Reference Number</span>
            <span className="text-base font-mono font-bold text-[#202938]">
              {booking?.bookingRef || bookingId || 'UR-2026-DEMO'}
            </span>
          </div>
          <Badge variant="primary" size="sm">
            Status: {booking?.status || 'Upcoming'}
          </Badge>
        </div>

        {/* Item & Reservation Details */}
        {booking && (
          <div className="border border-[#E5E8EF] rounded-xl p-4 text-left space-y-3">
            <div className="flex items-center gap-3.5 pb-3 border-b border-[#E5E8EF]">
              <img
                src={booking.itemImage}
                alt={booking.itemTitle}
                className="w-14 h-14 rounded-lg object-cover border border-[#E5E8EF]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                }}
              />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-[#202938]">{booking.itemTitle}</h4>
                <p className="text-xs text-[#687386]">Owner: {booking.ownerName} ({booking.ownerCollege})</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#687386] text-[11px]">Rental Duration</span>
                <p className="font-medium text-[#202938]">
                  {booking.startDate} → {booking.endDate} ({booking.days} days)
                </p>
              </div>
              <div>
                <span className="text-[#687386] text-[11px]">Total Simulated Escrow</span>
                <p className="font-bold text-[#3157C8] text-sm">{formatINR(booking.totalAmount)}</p>
                <p className="text-[10px] text-[#687386]">
                  Rent: {formatINR(booking.rentalFee)} | Deposit: {formatINR(booking.securityDeposit)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
          <Link to="/my-rentals" className="w-full sm:w-auto">
            <Button variant="primary" size="md" className="w-full sm:w-auto gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span>View My Rentals</span>
            </Button>
          </Link>
          <Link to="/marketplace" className="w-full sm:w-auto">
            <Button variant="secondary" size="md" className="w-full sm:w-auto gap-2">
              <span>Back to Marketplace</span>
              <ArrowRight className="w-4 h-4 text-[#687386]" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
