import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  Edit2,
  Trash2,
  MapPin,
  CheckCircle2,
  XCircle,
  Eye,
} from 'lucide-react';
import { StorageService } from '../services/storageService';
import { RentalItem } from '../types';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../components/common/ToastContext';
import { formatINR, FALLBACK_IMAGE } from '../utils/format';
import { useWallet } from '../context/WalletContext';
import {
  createRental,
  confirmHandover,
  confirmReturn,
  fetchRental,
  inrToWei,
  parseToWei,
  OnChainRental,
} from '../blockchain/contract';
import { EXPLORER_TX_URL, MST_NETWORK, RentalState } from '../blockchain/config';
import { switchToMSTNetwork } from '../blockchain/wallet';
import { ShieldCheck, ExternalLink, RefreshCw } from 'lucide-react';

interface OwnerAgreement {
  rentalId: number;
  itemId: string;
  itemTitle: string;
  renter: string;
  rentMSTC: string;
  depositMSTC: string;
  durationDays: number;
  txHash: string;
  createdAt: string;
}

const OWNER_AGREEMENTS_KEY = 'unirent_owner_agreements_v1';

export const MyListings: React.FC = () => {
  const currentUser = StorageService.getCurrentUser();
  const { showToast } = useToast();
  const { wallet, connect } = useWallet();

  const [items, setItems] = useState<RentalItem[]>(() => {
    const all = StorageService.getItems();
    // Return items owned by current user (or fallback to student-1 items)
    return all.filter((i) => i.ownerId === currentUser.id || i.ownerId === 'student-1');
  });

  const [editingItem, setEditingItem] = useState<RentalItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RentalItem | null>(null);

  // On-Chain Escrow Modal state
  const [escrowTargetItem, setEscrowTargetItem] = useState<RentalItem | null>(null);
  const [renterAddressInput, setRenterAddressInput] = useState('');
  const [escrowRentMSTC, setEscrowRentMSTC] = useState('0.450');
  const [escrowDepositMSTC, setEscrowDepositMSTC] = useState('1.500');
  const [escrowDurationDays, setEscrowDurationDays] = useState(3);
  const [isCreatingEscrow, setIsCreatingEscrow] = useState(false);
  const [createdEscrowResult, setCreatedEscrowResult] = useState<{ rentalId: number; txHash: string } | null>(null);

  // Stored owner agreements
  const [ownerAgreements, setOwnerAgreements] = useState<OwnerAgreement[]>(() => {
    try {
      const data = localStorage.getItem(OWNER_AGREEMENTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  });

  const [agreementOnChainData, setAgreementOnChainData] = useState<Record<number, OnChainRental>>({});
  const [actionLoadingRentalId, setActionLoadingRentalId] = useState<number | null>(null);

  const refreshAgreementsOnChain = async () => {
    if (!wallet.provider || ownerAgreements.length === 0) return;
    const map: Record<number, OnChainRental> = {};
    for (const ag of ownerAgreements) {
      try {
        const data = await fetchRental(wallet.provider, BigInt(ag.rentalId));
        map[ag.rentalId] = data;
      } catch (e) {
        console.warn('Error fetching agreement', ag.rentalId, e);
      }
    }
    setAgreementOnChainData(map);
  };

  useEffect(() => {
    refreshAgreementsOnChain();
  }, [ownerAgreements, wallet.provider]);

  const openEscrowModal = (item: RentalItem) => {
    setEscrowTargetItem(item);
    setCreatedEscrowResult(null);
    setRenterAddressInput('');
    setEscrowRentMSTC(((item.dailyPrice * 3) / 1000).toFixed(3));
    setEscrowDepositMSTC((item.securityDeposit / 1000).toFixed(3));
    setEscrowDurationDays(3);
  };

  const handleCreateOnChainEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escrowTargetItem) return;

    if (!wallet.connected || !wallet.signer) {
      showToast('Please connect your BridgeKey / EVM wallet first.', 'error');
      await connect();
      return;
    }
    if (!wallet.isCorrectNetwork) {
      showToast(`Please switch wallet network to MST Testnet (Chain ID ${MST_NETWORK.chainId}).`, 'error');
      await switchToMSTNetwork();
      return;
    }

    const cleanAddr = renterAddressInput.trim();
    if (!cleanAddr.startsWith('0x') || cleanAddr.length !== 42) {
      showToast('Please enter a valid 42-character Ethereum renter address (0x...).', 'error');
      return;
    }
    if (cleanAddr.toLowerCase() === wallet.address.toLowerCase()) {
      showToast('Owner cannot be renter on the smart contract. Please enter the student renter address.', 'error');
      return;
    }

    setIsCreatingEscrow(true);
    try {
      showToast('Broadcasting createRental to MST Testnet... Please approve in your wallet.', 'info');
      const rentWei = parseToWei(escrowRentMSTC);
      const depositWei = parseToWei(escrowDepositMSTC);
      const durationSec = BigInt(escrowDurationDays * 86400);

      const result = await createRental(wallet.signer, {
        renter: cleanAddr,
        itemRef: escrowTargetItem.id,
        rentAmountWei: rentWei,
        depositAmountWei: depositWei,
        durationSeconds: durationSec,
      });

      const newAg: OwnerAgreement = {
        rentalId: Number(result.rentalId),
        itemId: escrowTargetItem.id,
        itemTitle: escrowTargetItem.title,
        renter: cleanAddr,
        rentMSTC: escrowRentMSTC,
        depositMSTC: escrowDepositMSTC,
        durationDays: escrowDurationDays,
        txHash: result.txHash,
        createdAt: new Date().toISOString().split('T')[0],
      };

      const updated = [newAg, ...ownerAgreements];
      setOwnerAgreements(updated);
      localStorage.setItem(OWNER_AGREEMENTS_KEY, JSON.stringify(updated));
      setCreatedEscrowResult({ rentalId: Number(result.rentalId), txHash: result.txHash });
      showToast(`Escrow agreement #${result.rentalId} deployed on MST Testnet!`, 'success');
      refreshAgreementsOnChain();
    } catch (err: any) {
      console.error('Failed to create rental on-chain:', err);
      showToast(err?.message || 'Transaction failed or was rejected.', 'error');
    } finally {
      setIsCreatingEscrow(false);
    }
  };

  const handleOwnerConfirmHandover = async (rentalId: number) => {
    if (!wallet.connected || !wallet.signer) {
      showToast('Please connect your wallet.', 'error');
      await connect();
      return;
    }
    if (!wallet.isCorrectNetwork) {
      showToast('Please switch network to MST Testnet (91562037).', 'error');
      await switchToMSTNetwork();
      return;
    }

    setActionLoadingRentalId(rentalId);
    try {
      showToast('Confirming item handover on MST Testnet...', 'info');
      await confirmHandover(wallet.signer, BigInt(rentalId));
      showToast(`Owner handover confirmed for Rental #${rentalId}!`, 'success');
      refreshAgreementsOnChain();
    } catch (err: any) {
      showToast(err?.message || 'Handover confirmation failed.', 'error');
    } finally {
      setActionLoadingRentalId(null);
    }
  };

  const handleOwnerConfirmReturn = async (rentalId: number) => {
    if (!wallet.connected || !wallet.signer) {
      showToast('Please connect your wallet.', 'error');
      await connect();
      return;
    }
    if (!wallet.isCorrectNetwork) {
      showToast('Please switch network to MST Testnet (91562037).', 'error');
      await switchToMSTNetwork();
      return;
    }

    setActionLoadingRentalId(rentalId);
    try {
      showToast('Confirming item return on MST Testnet... Rent will settle to your wallet.', 'info');
      await confirmReturn(wallet.signer, BigInt(rentalId));
      showToast(`Return confirmed! Rental #${rentalId} settled on MST Testnet.`, 'success');
      refreshAgreementsOnChain();
    } catch (err: any) {
      showToast(err?.message || 'Return confirmation failed.', 'error');
    } finally {
      setActionLoadingRentalId(null);
    }
  };

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editDeposit, setEditDeposit] = useState<number>(0);
  const [editAvailable, setEditAvailable] = useState<boolean>(true);

  const openEditModal = (item: RentalItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditPrice(item.dailyPrice);
    setEditDeposit(item.securityDeposit);
    setEditAvailable(item.isAvailable);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    StorageService.updateItem(editingItem.id, {
      title: editTitle,
      dailyPrice: Number(editPrice),
      securityDeposit: Number(editDeposit),
      isAvailable: editAvailable,
    });

    const all = StorageService.getItems();
    setItems(all.filter((i) => i.ownerId === currentUser.id || i.ownerId === 'student-1'));
    setEditingItem(null);
    showToast('Listing updated successfully!', 'success');
  };

  const handleDeleteListing = () => {
    if (!deleteTarget) return;

    StorageService.removeItem(deleteTarget.id);
    const all = StorageService.getItems();
    setItems(all.filter((i) => i.ownerId === currentUser.id || i.ownerId === 'student-1'));
    setDeleteTarget(null);
    showToast('Listing removed from marketplace.', 'info');
  };

  const handleToggleAvailability = (item: RentalItem) => {
    const updated = !item.isAvailable;
    StorageService.updateItem(item.id, { isAvailable: updated });
    const all = StorageService.getItems();
    setItems(all.filter((i) => i.ownerId === currentUser.id || i.ownerId === 'student-1'));
    showToast(
      updated ? 'Item marked as available for rent.' : 'Item paused from new bookings.',
      'info'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#202938]">My Listed Items</h1>
          <p className="text-xs text-[#687386] mt-0.5">
            Manage peer rental pricing, active availability, and listing status for your items.
          </p>
        </div>
        <Link to="/create-listing">
          <Button variant="primary" size="sm" className="gap-1.5">
            <PlusCircle className="w-4 h-4" />
            <span>List New Item</span>
          </Button>
        </Link>
      </div>

      {/* Listings List */}
      {items.length === 0 ? (
        <EmptyState
          title="You haven't listed any items yet"
          description="Have calculators, monitors, camera gear, or textbooks sitting around? List them to earn money from fellow students."
          action={
            <Link to="/create-listing">
              <Button variant="primary" size="sm">
                Create First Listing
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-[#E5E8EF] hover:border-[#3157C8]/40 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-16/10 bg-slate-100">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                    }}
                  />
                  <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                    <Badge variant="neutral" size="sm" className="bg-white/95 font-semibold">
                      {item.category}
                    </Badge>
                    <Badge
                      variant={item.isAvailable ? 'success' : 'danger'}
                      size="sm"
                      className="bg-white/95"
                    >
                      {item.isAvailable ? 'Active & Available' : 'Paused / Rented'}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-sm text-[#202938] line-clamp-1">
                    {item.title}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-[#687386]">
                    <span>
                      Daily: <strong className="text-[#202938]">{formatINR(item.dailyPrice)}</strong>
                    </span>
                    <span>
                      Deposit: <strong className="text-[#202938]">{formatINR(item.securityDeposit)}</strong>
                    </span>
                  </div>
                  <p className="text-[11px] text-[#687386] flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#94A3B8]" />
                    <span className="truncate">{item.location}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-4 py-3 bg-slate-50/60 border-t border-[#E5E8EF] flex items-center justify-between gap-2">
                <button
                  onClick={() => handleToggleAvailability(item)}
                  className="text-xs text-[#687386] hover:text-[#202938] font-medium"
                >
                  {item.isAvailable ? 'Pause Listing' : 'Activate'}
                </button>

                <div className="flex items-center gap-1.5">
                  <Link to={`/item/${item.id}`} title="View Public Page">
                    <Button variant="ghost" size="sm" className="p-1.5">
                      <Eye className="w-4 h-4 text-[#687386]" />
                    </Button>
                  </Link>

                  <Button
                    variant="outline"
                    size="sm"
                    className="p-1.5 text-[#3157C8] border-[#3157C8]/40 hover:bg-blue-50"
                    onClick={() => openEscrowModal(item)}
                    title="Create MST Testnet Escrow Agreement"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="p-1.5"
                    onClick={() => openEditModal(item)}
                    title="Edit Listing"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#3157C8]" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1.5 text-[#C94C4C] hover:bg-rose-50"
                    onClick={() => setDeleteTarget(item)}
                    title="Remove Listing"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* On-Chain Escrow Agreements Section */}
      {ownerAgreements.length > 0 && (
        <div className="bg-white border border-[#E5E8EF] rounded-xl overflow-hidden shadow-xs space-y-3 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E8EF]">
            <div>
              <h2 className="text-base font-bold text-[#202938] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#3157C8]" />
                <span>My On-Chain Escrow Agreements ({ownerAgreements.length})</span>
              </h2>
              <p className="text-xs text-[#687386] mt-0.5">
                Smart contract agreements created from your wallet on MST Testnet (Chain ID 91562037).
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={refreshAgreementsOnChain} className="gap-1 text-xs">
              <RefreshCw className="w-3.5 h-3.5 text-[#3157C8]" />
              <span>Refresh On-Chain</span>
            </Button>
          </div>

          <div className="divide-y divide-[#E5E8EF]">
            {ownerAgreements.map((ag) => {
              const onChain = agreementOnChainData[ag.rentalId];
              const stateNum = onChain ? onChain.state : RentalState.Created;
              const stateLabel = RentalState[stateNum] ?? 'Created';

              return (
                <div key={ag.rentalId} className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#3157C8] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        Rental #{ag.rentalId}
                      </span>
                      <Badge
                        variant={
                          stateLabel === 'Active'
                            ? 'success'
                            : stateLabel === 'Settled'
                            ? 'neutral'
                            : stateLabel === 'Disputed'
                            ? 'danger'
                            : 'primary'
                        }
                        size="sm"
                      >
                        {stateLabel}
                      </Badge>
                      <span className="text-[11px] text-[#687386]">Created: {ag.createdAt}</span>
                    </div>
                    <h4 className="font-semibold text-sm text-[#202938]">{ag.itemTitle}</h4>
                    <div className="flex flex-wrap gap-3 text-xs text-[#687386]">
                      <span>Renter: <span className="font-mono text-[#202938]">{ag.renter.slice(0, 8)}...{ag.renter.slice(-6)}</span></span>
                      <span>Rent: <strong className="text-[#202938]">{ag.rentMSTC} tMSTC</strong></span>
                      <span>Deposit: <strong className="text-[#202938]">{ag.depositMSTC} tMSTC</strong></span>
                      <span>Duration: {ag.durationDays} days</span>
                    </div>
                    <div className="pt-0.5">
                      <a
                        href={EXPLORER_TX_URL(ag.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-[#3157C8] hover:underline"
                      >
                        <span>Tx: {ag.txHash.slice(0, 14)}...</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Owner Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {onChain && onChain.state === RentalState.Booked && !onChain.ownerHandoverConfirmed && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOwnerConfirmHandover(ag.rentalId)}
                        isLoading={actionLoadingRentalId === ag.rentalId}
                        className="text-xs"
                      >
                        Confirm Handover
                      </Button>
                    )}

                    {onChain && onChain.state === RentalState.Active && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOwnerConfirmReturn(ag.rentalId)}
                        isLoading={actionLoadingRentalId === ag.rentalId}
                        className="text-xs"
                      >
                        Confirm Return & Settle
                      </Button>
                    )}

                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/checkout/${ag.itemId}?rentalId=${ag.rentalId}`);
                        showToast('Checkout link with Rental ID copied to clipboard!', 'info');
                      }}
                    >
                      Copy Renter Link
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Escrow Modal */}
      <Modal
        isOpen={!!escrowTargetItem}
        onClose={() => setEscrowTargetItem(null)}
        title="Create MST Testnet Escrow Agreement"
        maxWidth="md"
      >
        {escrowTargetItem && (
          <form onSubmit={handleCreateOnChainEscrow} className="space-y-4">
            <p className="text-xs text-[#687386]">
              Deploy an immutable rental agreement on the MST Testnet smart contract. You will be registered as the <strong>Owner</strong>. Once deployed, the renter deposits funds into escrow.
            </p>
            <div className="p-3 bg-slate-50 border border-[#E5E8EF] rounded-lg text-xs space-y-1">
              <span className="font-semibold text-[#202938] block">{escrowTargetItem.title}</span>
              <span className="text-[#687386]">Handover: {escrowTargetItem.location}</span>
            </div>
            <Input
              label="Renter's Ethereum Wallet Address"
              placeholder="0x..."
              value={renterAddressInput}
              onChange={(e) => setRenterAddressInput(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Total Rent (tMSTC)"
                type="number"
                step="0.001"
                min={0.001}
                value={escrowRentMSTC}
                onChange={(e) => setEscrowRentMSTC(e.target.value)}
                required
              />
              <Input
                label="Security Deposit (tMSTC)"
                type="number"
                step="0.001"
                min={0}
                value={escrowDepositMSTC}
                onChange={(e) => setEscrowDepositMSTC(e.target.value)}
                required
              />
            </div>
            <Input
              label="Agreed Rental Duration (Days)"
              type="number"
              min={1}
              value={escrowDurationDays}
              onChange={(e) => setEscrowDurationDays(Number(e.target.value))}
              required
            />
            {createdEscrowResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Success! Agreement Deployed:</span>
                  <span>Rental #{createdEscrowResult.rentalId}</span>
                </div>
                <a
                  href={EXPLORER_TX_URL(createdEscrowResult.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[#3157C8] hover:underline"
                >
                  <span>View Tx on MST Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            <div className="pt-3 border-t border-[#E5E8EF] flex justify-end gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setEscrowTargetItem(null)}>
                Close
              </Button>
              <Button variant="primary" size="sm" type="submit" isLoading={isCreatingEscrow}>
                Deploy to MST Testnet
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Edit Listing Details"
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Item Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Daily Rate (₹)"
              type="number"
              min={1}
              value={editPrice}
              onChange={(e) => setEditPrice(Number(e.target.value))}
              required
            />
            <Input
              label="Security Deposit (₹)"
              type="number"
              min={0}
              value={editDeposit}
              onChange={(e) => setEditDeposit(Number(e.target.value))}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[#202938] cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={editAvailable}
              onChange={(e) => setEditAvailable(e.target.checked)}
              className="text-[#3157C8] rounded focus:ring-[#3157C8]"
            />
            <span className="font-medium">Item is currently available for new student bookings</span>
          </label>

          <div className="pt-4 border-t border-[#E5E8EF] flex justify-end gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteListing}
        title="Remove Listing"
        message={`Are you sure you want to remove "${deleteTarget?.title}" from UniRent? This action cannot be undone.`}
        confirmText="Remove Listing"
        variant="danger"
      />
    </div>
  );
};
