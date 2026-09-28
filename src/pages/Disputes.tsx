import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ShieldAlert,
  FileText,
  UploadCloud,
  CheckCircle2,
  Info,
  ExternalLink,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';
import { StorageService } from '../services/storageService';
import { DisputeRecord, DisputeStatus } from '../types';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { EmptyState } from '../components/common/EmptyState';
import { useToast } from '../components/common/ToastContext';
import { useWallet } from '../context/WalletContext';
import { raiseDispute } from '../blockchain/contract';
import { EXPLORER_TX_URL } from '../blockchain/config';
import { switchToMSTNetwork } from '../blockchain/wallet';

export const Disputes: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [disputes, setDisputes] = useState<DisputeRecord[]>(StorageService.getDisputes());
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<DisputeRecord | null>(null);
  const [isSubmittingOnChain, setIsSubmittingOnChain] = useState(false);
  const { showToast } = useToast();
  const { wallet, connect } = useWallet();

  // Form state
  const [rentalRef, setRentalRef] = useState(searchParams.get('rentalRef') || '');
  const [onChainRentalIdInput, setOnChainRentalIdInput] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceName, setEvidenceName] = useState<string | null>(null);

  const getStatusBadge = (status: DisputeStatus) => {
    switch (status) {
      case 'Under Review':
        return <Badge variant="warning">{status}</Badge>;
      case 'Evidence Required':
        return <Badge variant="danger">{status}</Badge>;
      case 'Resolved':
      case 'Closed':
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const handleRaiseDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rentalRef.trim() || !itemTitle.trim() || !reason.trim() || !description.trim()) {
      showToast('Please fill all dispute details.', 'error');
      return;
    }

    let txHash: string | undefined;

    // If an on-chain Rental ID is provided, freeze escrow in the smart contract
    if (onChainRentalIdInput.trim()) {
      const rId = parseInt(onChainRentalIdInput.trim(), 10);
      if (!isNaN(rId) && rId > 0) {
        if (!wallet.connected || !wallet.signer) {
          showToast('Please connect your wallet to submit on-chain dispute freeze.', 'error');
          await connect();
          return;
        }
        if (!wallet.isCorrectNetwork) {
          showToast('Please switch network to MST Testnet (91562037).', 'error');
          await switchToMSTNetwork();
          return;
        }

        setIsSubmittingOnChain(true);
        try {
          showToast('Freezing escrow funds on MST Testnet smart contract...', 'info');
          const res = await raiseDispute(wallet.signer, BigInt(rId));
          txHash = res.hash;
          showToast(`Dispute frozen on-chain! Escrow settlement locked. Tx: ${res.hash.slice(0, 10)}...`, 'success');
        } catch (err: any) {
          console.error('Failed to raise on-chain dispute:', err);
          showToast(err?.message || 'On-chain dispute call failed.', 'error');
          setIsSubmittingOnChain(false);
          return;
        } finally {
          setIsSubmittingOnChain(false);
        }
      }
    }

    const newDisp = StorageService.createDispute({
      rentalRef,
      itemTitle,
      reason,
      description,
      evidenceFiles: evidenceName ? [evidenceName] : ['handover_inspection_photo.jpg'],
    });

    setDisputes(StorageService.getDisputes());
    setIsRaiseModalOpen(false);
    // Reset
    setRentalRef('');
    setOnChainRentalIdInput('');
    setItemTitle('');
    setReason('');
    setDescription('');
    setEvidenceName(null);
    showToast(`Dispute logged under reference ${newDisp.id}. Campus mediation review scheduled.`, 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#202938]">Dispute Resolution Center</h1>
          <p className="text-xs text-[#687386] mt-0.5">
            Resolve condition discrepancies, late returns, and deposit escrow disagreements.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsRaiseModalOpen(true)}
          className="gap-1.5"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Raise New Dispute</span>
        </Button>
      </div>

      {/* Critical Blockchain Notice */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[#C58A24] shrink-0 mt-0.5" />
        <div className="text-xs text-[#202938] leading-relaxed">
          <strong className="text-[#C58A24]">Important Architecture Disclaimer:</strong> While smart contracts automate the escrow locking and release of digital funds, physical item conditions and scratch damage cannot be independently verified on-chain. UniRent combines mutual photographic check-ins with peer student campus mediation before escrow finalization.
        </div>
      </div>

      {/* Active Disputes List */}
      <div className="bg-white border border-[#E5E8EF] rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[#E5E8EF] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#202938]">
            Dispute Cases ({disputes.length})
          </h3>
        </div>

        {disputes.length === 0 ? (
          <EmptyState
            title="No open disputes"
            description="You have no unresolved complaints or escrow holds on your account."
          />
        ) : (
          <div className="divide-y divide-[#E5E8EF]">
            {disputes.map((disp) => (
              <div
                key={disp.id}
                className="p-5 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#3157C8]">
                      {disp.rentalRef}
                    </span>
                    {getStatusBadge(disp.status)}
                    <span className="text-[11px] text-[#687386]">Opened: {disp.createdAt}</span>
                  </div>

                  <h4 className="font-semibold text-sm text-[#202938]">{disp.itemTitle}</h4>
                  <p className="text-xs text-[#687386]">
                    <strong>Reason:</strong> {disp.reason}
                  </p>
                  <p className="text-xs text-[#687386] line-clamp-1 max-w-xl">
                    {disp.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedDispute(disp)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dispute Details Modal */}
      <Modal
        isOpen={!!selectedDispute}
        onClose={() => setSelectedDispute(null)}
        title="Dispute Case Overview"
        maxWidth="md"
      >
        {selectedDispute && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E8EF]">
              <div>
                <span className="text-[#687386] block text-[11px]">Rental Reference</span>
                <span className="font-mono font-bold text-sm text-[#202938]">
                  {selectedDispute.rentalRef}
                </span>
              </div>
              {getStatusBadge(selectedDispute.status)}
            </div>

            <div>
              <span className="text-[#687386] block text-[11px]">Item Involved</span>
              <p className="font-semibold text-sm text-[#202938]">{selectedDispute.itemTitle}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-[#E5E8EF] rounded-lg">
              <div>
                <span className="text-[#687386] text-[11px]">Raised By</span>
                <p className="font-medium text-[#202938]">{selectedDispute.raisedBy}</p>
              </div>
              <div>
                <span className="text-[#687386] text-[11px]">Counterparty</span>
                <p className="font-medium text-[#202938]">{selectedDispute.opponentName}</p>
              </div>
            </div>

            <div>
              <span className="text-[#687386] block text-[11px]">Issue Description</span>
              <p className="p-3 bg-slate-50 border border-[#E5E8EF] rounded-lg text-[#202938] leading-relaxed mt-1">
                {selectedDispute.description}
              </p>
            </div>

            {selectedDispute.evidenceFiles && selectedDispute.evidenceFiles.length > 0 && (
              <div>
                <span className="text-[#687386] block text-[11px] mb-1.5">Submitted Evidence Files</span>
                <div className="flex flex-wrap gap-2">
                  {selectedDispute.evidenceFiles.map((file, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#E5E8EF] rounded text-[11px] text-[#3157C8]"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#687386]" />
                      <span>{file}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 bg-blue-50/70 border border-blue-200/50 rounded-lg text-[#687386] text-[11px]">
              Escrow funds remain frozen until both parties agree to terms or campus student mediation reaches a determination.
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E5E8EF]">
              <Button variant="secondary" size="sm" onClick={() => setSelectedDispute(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Raise Dispute Modal */}
      <Modal
        isOpen={isRaiseModalOpen}
        onClose={() => setIsRaiseModalOpen(false)}
        title="File a Rental Dispute"
        maxWidth="md"
      >
        <form onSubmit={handleRaiseDispute} className="space-y-4">
          <Input
            label="Rental Reference Number"
            placeholder="e.g. UR-2026-8492"
            value={rentalRef}
            onChange={(e) => setRentalRef(e.target.value)}
            required
          />

          <Input
            label="On-Chain Rental ID (Optional - Freezes smart contract escrow)"
            placeholder="e.g. 1"
            type="number"
            min={1}
            value={onChainRentalIdInput}
            onChange={(e) => setOnChainRentalIdInput(e.target.value)}
          />

          <Input
            label="Item Title"
            placeholder="e.g. Sony Alpha a6400 Camera"
            value={itemTitle}
            onChange={(e) => setItemTitle(e.target.value)}
            required
          />

          <Input
            label="Dispute Reason"
            placeholder="e.g. Scratch on lens filter rim, late return, missing charger"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5 text-left">
            <label htmlFor="dispute-explanation-textarea" className="text-xs font-semibold text-[#202938]">
              Detailed Explanation
            </label>
            <textarea
              id="dispute-explanation-textarea"
              rows={3}
              placeholder="State what occurred during handover or return, and what resolution you request (e.g. partial deposit deduction)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs bg-white text-[#202938] border border-[#E5E8EF] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3157C8]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#202938] block mb-1">
              Photographic Evidence
            </label>
            <label className="border-2 border-dashed border-[#E5E8EF] hover:border-[#3157C8] rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50/50">
              <UploadCloud className="w-5 h-5 text-[#687386] mb-1" />
              <span className="text-xs font-medium text-[#3157C8]">
                {evidenceName || 'Attach handover photo or screenshot'}
              </span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setEvidenceName(e.target.files[0].name);
                }}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E8EF]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsRaiseModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="sm">
              Submit Dispute
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
