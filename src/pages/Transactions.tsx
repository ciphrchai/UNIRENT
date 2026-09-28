import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
  Info,
  ExternalLink,
} from 'lucide-react';
import { StorageService } from '../services/storageService';
import { TransactionRecord } from '../types';
import { Badge } from '../components/common/Badge';
import { formatINR } from '../utils/format';
import { EXPLORER_TX_URL } from '../blockchain/config';

export const Transactions: React.FC = () => {
  const transactions = StorageService.getTransactions();
  const [filterType, setFilterType] = useState<string>('all');

  const filtered = transactions.filter((tx) => {
    if (filterType === 'all') return true;
    return tx.type.toLowerCase().includes(filterType.toLowerCase());
  });

  const getStatusVariant = (status: TransactionRecord['status']) => {
    switch (status) {
      case 'Completed':
      case 'Released':
        return 'success';
      case 'Pending Escrow':
        return 'warning';
      case 'Refunded':
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#202938]">Transaction & Escrow History</h1>
        <p className="text-xs text-[#687386] mt-0.5">
          Audit trail of student rental fees, security deposit escrow holds, and refunds on MST Testnet.
        </p>
      </div>

      {/* Notice Banner */}
      <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#3157C8] shrink-0 mt-0.5" />
        <div className="text-xs text-[#202938] leading-relaxed">
          <strong>MST Blockchain Layer:</strong> Real escrow transactions executed via UniRent Wallet are verifiable on the public MST Testnet block explorer (Chain ID 91562037). Historical prototype entries are tagged accordingly.
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'Deposit', 'Payment', 'Refund'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer capitalize ${
              filterType === type
                ? 'bg-[#3157C8] text-white border-[#3157C8]'
                : 'bg-white text-[#687386] border-[#E5E8EF] hover:bg-slate-50'
            }`}
          >
            {type === 'all' ? 'All Transactions' : `${type}s`}
          </button>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-[#E5E8EF] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-[#E5E8EF] text-[#687386] font-semibold">
              <tr>
                <th className="py-3.5 px-4">Tx Reference</th>
                <th className="py-3.5 px-4">Item Name</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Escrow Status</th>
                <th className="py-3.5 px-4">MST Testnet Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E8EF] text-[#202938]">
              {filtered.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-medium text-[#3157C8]">
                    {tx.reference}
                  </td>
                  <td className="py-3.5 px-4 font-medium max-w-[200px] truncate">
                    {tx.itemName}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 font-medium text-[#687386]">
                      {tx.type.includes('Refund') || tx.type.includes('Payout') ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-[#16845B]" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#3157C8]" />
                      )}
                      <span>{tx.type}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold">
                    {formatINR(tx.amount)}
                  </td>
                  <td className="py-3.5 px-4 text-[#687386]">
                    {tx.date}
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant={getStatusVariant(tx.status)} size="sm">
                      {tx.status}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px]">
                    {tx.blockchainTxHash && tx.blockchainTxHash.startsWith('0x') ? (
                      <a
                        href={EXPLORER_TX_URL(tx.blockchainTxHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#3157C8] hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                        title={tx.blockchainTxHash}
                      >
                        <span>{tx.blockchainTxHash.slice(0, 8)}...{tx.blockchainTxHash.slice(-6)}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="bg-slate-100 text-[#687386] px-2 py-0.5 rounded border border-slate-200">
                        {tx.blockchainTxHash || 'Prototype record'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
