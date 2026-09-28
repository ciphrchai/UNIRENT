import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { StorageService } from '../services/storageService';
import { RentalBooking, RentalStatus } from '../types';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { useToast } from '../components/common/ToastContext';
import { formatINR, FALLBACK_IMAGE } from '../utils/format';
import { useWallet } from '../context/WalletContext';
import {
  confirmHandover,
  confirmReturn,
  cancelAfterBooking,
  fetchRental,
  OnChainRental,
} from '../blockchain/contract';
import { EXPLORER_TX_URL, RentalState } from '../blockchain/config';
import { switchToMSTNetwork } from '../blockchain/wallet';

const TABS: RentalStatus[] = ['Upcoming', 'Active', 'Completed', 'Cancelled'];

export const MyRentals: React.FC = () => {
  const [activeTab, setActiveTab] = useState<RentalStatus>('Upcoming');
  const [selectedBooking, setSelectedBooking] = useState<RentalBooking | null>(null);
  const [cancelDialogTarget, setCancelDialogTarget] = useState<RentalBooking | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [onChainDataMap, setOnChainDataMap] = useState<Record<number, OnChainRental>>({});
  const { showToast } = useToast();
  const { wallet, connect } = useWallet();

  const [bookings, setBookings] = useState<RentalBooking[]>(StorageService.getBookings());

  // Fetch on-chain status for bookings with onChainRentalId
  useEffect(() => {
    if (!wallet.provider) return;
    const fetchStates = async () => {
      const map: Record<number, OnChainRental> = {};
      for (const b of bookings) {
        if (b.onChainRentalId) {
          try {
            const data = await fetchRental(wallet.provider, BigInt(b.onChainRentalId));
            map[b.onChainRentalId] = data;
          } catch (e) {
            console.warn(`Could not fetch on-chain rental #${b.onChainRentalId}`, e);
          }
        }
      }
      setOnChainDataMap(map);
    };
    fetchStates();
  }, [bookings, wallet.provider]);

  const filteredBookings = bookings.filter((b) => b.status === activeTab);

  const getStatusBadgeVariant = (status: RentalStatus) => {
    switch (status) {
      case 'Upcoming':
        return 'primary';
      case 'Active':
        return 'success';
      case 'Completed':
        return 'neutral';
      case 'Cancelled':
        return 'danger';
    }
  };

  const handleCancelBooking = async () => {
    if (!cancelDialogTarget) return;

    if (cancelDialogTarget.onChainRentalId) {
      if (!wallet.connected || !wallet.signer) {
        showToast('Please connect your wallet to submit on-chain cancellation.', 'error');
        await connect();
        return;
      }
      if (!wallet.isCorrectNetwork) {
        showToast('Please switch network to MST Testnet (91562037).', 'error');
        await switchToMSTNetwork();
        return;
      }

      setActionLoadingId(cancelDialogTarget.id);
      try {
        showToast('Signing cancellation and escrow refund on MST Testnet...', 'info');
        const res = await cancelAfterBooking(wallet.signer, BigInt(cancelDialogTarget.onChainRentalId));
        StorageService.updateBookingStatus(cancelDialogTarget.id, 'Cancelled');
        StorageService.updateBooking(cancelDialogTarget.id, { blockchainTxHash: res.hash });
        StorageService.addTransaction({
          id: `tx-${Date.now()}`,
          reference: `TX-${Math.floor(10000 + Math.random() * 90000)}-MST`,
          itemName: cancelDialogTarget.itemTitle,
          type: 'Deposit Refund',
          amount: cancelDialogTarget.totalAmount,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          status: 'Refunded',
          blockchainTxHash: res.hash,
          isRealOnChain: true,
          rentalId: cancelDialogTarget.onChainRentalId,
        });
        setBookings(StorageService.getBookings());
        showToast('On-chain cancellation confirmed! Escrow refunded to your wallet.', 'success');
      } catch (err: any) {
        console.error('Cancellation failed:', err);
        showToast(err?.message || 'Cancellation transaction failed.', 'error');
      } finally {
        setActionLoadingId(null);
        setCancelDialogTarget(null);
      }
      return;
    }

    // Fallback for non-blockchain mock bookings
    StorageService.updateBookingStatus(cancelDialogTarget.id, 'Cancelled');
    setBookings(StorageService.getBookings());
    showToast(`Booking ${cancelDialogTarget.bookingRef} cancelled. Escrow refund recorded.`, 'info');
    setCancelDialogTarget(null);
  };

  const handleConfirmHandover = async (booking: RentalBooking) => {
    if (!booking.onChainRentalId) return;

    if (!wallet.connected || !wallet.signer) {
      showToast('Please connect your wallet to confirm item handover.', 'error');
      await connect();
      return;
    }
    if (!wallet.isCorrectNetwork) {
      showToast('Please switch network to MST Testnet (91562037).', 'error');
      await switchToMSTNetwork();
      return;
    }

    setActionLoadingId(booking.id);
    try {
      showToast('Signing item handover confirmation on MST Testnet...', 'info');
      const res = await confirmHandover(wallet.signer, BigInt(booking.onChainRentalId));
      showToast('Handover confirmed on MST Testnet!', 'success');

      // Check if both confirmed to update local status to Active
      if (wallet.provider) {
        const updatedOnChain = await fetchRental(wallet.provider, BigInt(booking.onChainRentalId));
        setOnChainDataMap((prev) => ({ ...prev, [booking.onChainRentalId!]: updatedOnChain }));
        if (updatedOnChain.state === RentalState.Active) {
          StorageService.updateBookingStatus(booking.id, 'Active');
          setBookings(StorageService.getBookings());
          showToast('Both parties confirmed handover! Rental is now ACTIVE.', 'success');
        }
      }
    } catch (err: any) {
      console.error('Handover confirmation failed:', err);
      showToast(err?.message || 'Handover confirmation failed.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkReturned = async (booking: RentalBooking) => {
    if (booking.onChainRentalId) {
      if (!wallet.connected || !wallet.signer) {
        showToast('Please connect your wallet to confirm item return.', 'error');
        await connect();
        return;
      }
      if (!wallet.isCorrectNetwork) {
        showToast('Please switch network to MST Testnet (91562037).', 'error');
        await switchToMSTNetwork();
        return;
      }

      setActionLoadingId(booking.id);
      try {
        showToast('Signing item return confirmation on MST Testnet...', 'info');
        const res = await confirmReturn(wallet.signer, BigInt(booking.onChainRentalId));
        showToast('Return confirmed on MST Testnet!', 'success');

        if (wallet.provider) {
          const updatedOnChain = await fetchRental(wallet.provider, BigInt(booking.onChainRentalId));
          setOnChainDataMap((prev) => ({ ...prev, [booking.onChainRentalId!]: updatedOnChain }));
          if (updatedOnChain.state === RentalState.Settled) {
            StorageService.updateBookingStatus(booking.id, 'Completed');
            StorageService.addTransaction({
              id: `tx-${Date.now()}`,
              reference: `TX-${Math.floor(10000 + Math.random() * 90000)}-MST`,
              itemName: booking.itemTitle,
              type: 'Deposit Refund',
              amount: booking.securityDeposit,
              date: new Date().toISOString().replace('T', ' ').substring(0, 16),
              status: 'Released',
              blockchainTxHash: res.hash,
              isRealOnChain: true,
              rentalId: booking.onChainRentalId,
            });
            setBookings(StorageService.getBookings());
            showToast('Return confirmed and settled! Escrow deposit refunded to your wallet.', 'success');
          }
        }
      } catch (err: any) {
        console.error('Return confirmation failed:', err);
        showToast(err?.message || 'Return confirmation failed.', 'error');
      } finally {
        setActionLoadingId(null);
      }
      return;
    }

    // Fallback for mock bookings
    StorageService.updateBookingStatus(booking.id, 'Completed');
    setBookings(StorageService.getBookings());
    showToast(`Rental ${booking.bookingRef} marked as returned! Deposit released.`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#202938]">My Student Rentals</h1>
          <p className="text-xs text-[#687386] mt-0.5">
            Manage your booked items, pickup dates, and security deposit escrow statuses.
          </p>
        </div>
        <Link to="/marketplace">
          <Button variant="secondary" size="sm">
            Browse More Items
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5E8EF] gap-2">
        {TABS.map((tab) => {
          const count = bookings.filter((b) => b.status === tab).length;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? 'border-[#3157C8] text-[#3157C8]'
                  : 'border-transparent text-[#687386] hover:text-[#202938]'
              }`}
            >
              <span>{tab}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-blue-100 text-[#3157C8]' : 'bg-slate-100 text-[#687386]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Booking List or Empty State */}
      {filteredBookings.length === 0 ? (
        <EmptyState
          title={`No ${activeTab.toLowerCase()} rentals`}
          description={`You do not have any rentals in "${activeTab}" status at this time.`}
          action={
            <Link to="/marketplace">
              <Button variant="primary" size="sm">
                Explore Marketplace
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white border border-[#E5E8EF] hover:border-[#3157C8]/40 rounded-xl p-5 shadow-xs transition-all flex flex-col md:flex-row gap-5 items-start md:items-center justify-between"
            >
              <div className="flex gap-4 items-center">
                <img
                  src={booking.itemImage}
                  alt={booking.itemTitle}
                  className="w-20 h-20 rounded-lg object-cover border border-[#E5E8EF] shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                  }}
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral" size="sm">
                      {booking.category}
                    </Badge>
                    <Badge variant={getStatusBadgeVariant(booking.status)} size="sm">
                      {booking.status}
                    </Badge>
                    <span className="text-[11px] font-mono text-[#687386]">
                      {booking.bookingRef}
                    </span>
                  </div>

                  <h3 className="font-semibold text-sm text-[#202938]">
                    {booking.itemTitle}
                  </h3>

                  <p className="text-xs text-[#687386]">
                    Owner: <strong className="text-[#202938]">{booking.ownerName}</strong> ({booking.ownerCollege})
                  </p>

                  <div className="flex items-center gap-3 text-xs text-[#687386] pt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#94A3B8]" />
                      <span>{booking.startDate} to {booking.endDate} ({booking.days} days)</span>
                    </span>

                    {booking.onChainRentalId && (
                      <span className="flex items-center gap-1 text-[#3157C8] font-mono text-[11px]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Escrow #{booking.onChainRentalId}</span>
                      </span>
                    )}

                    {booking.blockchainTxHash && (
                      <a
                        href={EXPLORER_TX_URL(booking.blockchainTxHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-[#3157C8] hover:underline font-mono"
                        title={booking.blockchainTxHash}
                      >
                        <span>MST Tx</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Dual Confirmation Status for On-Chain Rentals */}
                  {booking.onChainRentalId && onChainDataMap[booking.onChainRentalId] && (
                    <div className="pt-1.5 flex flex-wrap gap-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-[#202938] border border-slate-200">
                        Owner Handover:{' '}
                        <strong className={onChainDataMap[booking.onChainRentalId].ownerHandoverConfirmed ? 'text-emerald-700' : 'text-amber-700'}>
                          {onChainDataMap[booking.onChainRentalId].ownerHandoverConfirmed ? '✓ Confirmed' : 'Pending'}
                        </strong>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-[#202938] border border-slate-200">
                        Renter Handover:{' '}
                        <strong className={onChainDataMap[booking.onChainRentalId].renterHandoverConfirmed ? 'text-emerald-700' : 'text-amber-700'}>
                          {onChainDataMap[booking.onChainRentalId].renterHandoverConfirmed ? '✓ Confirmed' : 'Pending'}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Price & Action Buttons */}
              <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-[#E5E8EF]">
                <div className="text-left md:text-right">
                  <span className="text-sm font-bold text-[#202938]">
                    {formatINR(booking.totalAmount)}
                  </span>
                  <div className="text-[11px] text-[#687386]">
                    Rent: {formatINR(booking.rentalFee)} | Deposit: {formatINR(booking.securityDeposit)}
                  </div>
                  {booking.onChainRentalId && (
                    <div className="text-[10px] text-[#3157C8] font-mono">
                      {(booking.totalAmount / 1000).toFixed(3)} tMSTC Escrow
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Link to={`/item/${booking.itemId}`}>
                    <Button variant="secondary" size="sm">
                      Item Page
                    </Button>
                  </Link>

                  {/* On-Chain Handover Confirmation */}
                  {booking.onChainRentalId &&
                    booking.status === 'Upcoming' &&
                    onChainDataMap[booking.onChainRentalId] &&
                    !onChainDataMap[booking.onChainRentalId].renterHandoverConfirmed && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleConfirmHandover(booking)}
                        isLoading={actionLoadingId === booking.id}
                        className="text-xs"
                      >
                        Confirm Handover
                      </Button>
                    )}

                  {booking.status === 'Upcoming' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCancelDialogTarget(booking)}
                      isLoading={actionLoadingId === booking.id}
                      className="text-xs text-[#C94C4C] border-[#C94C4C] hover:bg-rose-50"
                    >
                      Cancel
                    </Button>
                  )}

                  {booking.status === 'Active' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleMarkReturned(booking)}
                      isLoading={actionLoadingId === booking.id}
                    >
                      Return Item
                    </Button>
                  )}

                  <Link to={`/disputes?rentalRef=${booking.bookingRef}`}>
                    <Button variant="ghost" size="sm" className="text-xs">
                      Issue?
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Dialog for Cancel */}
      <ConfirmationDialog
        isOpen={!!cancelDialogTarget}
        onClose={() => setCancelDialogTarget(null)}
        onConfirm={handleCancelBooking}
        title="Cancel Student Rental"
        message={`Are you sure you want to cancel booking ${cancelDialogTarget?.bookingRef}? The reserved dates will be freed and your simulated security deposit refunded.`}
        confirmText="Yes, Cancel Booking"
        variant="danger"
      />
    </div>
  );
};
