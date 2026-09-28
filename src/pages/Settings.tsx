import React, { useState } from 'react';
import {
  Bell,
  Wallet,
  Lock,
  LogOut,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { StorageService } from '../services/storageService';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { useToast } from '../components/common/ToastContext';
import { useWallet } from '../context/WalletContext';
import { MST_NETWORK, CONTRACT_ADDRESS, EXPLORER_ADDR_URL } from '../blockchain/config';
import { switchToMSTNetwork } from '../blockchain/wallet';
import { ExternalLink } from 'lucide-react';

export const Settings: React.FC = () => {
  const currentUser = StorageService.getCurrentUser();
  const { showToast } = useToast();
  const { wallet, connecting, connect, disconnect, refreshWalletBalance } = useWallet();
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  // Notification toggles
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [notifyHandover, setNotifyHandover] = useState(true);

  // Security
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Wallet
  const [isWalletConnected, setIsWalletConnected] = useState(true);
  const [isRequestingFaucet, setIsRequestingFaucet] = useState(false);

  const handleFaucetRequest = () => {
    setIsRequestingFaucet(true);
    setTimeout(() => {
      const newBal = walletBalance + 50;
      StorageService.setWalletBalance(newBal);
      setWalletBalance(newBal);
      setIsRequestingFaucet(false);
      showToast('50 Testnet MST tokens minted to your demo wallet!', 'success');
    }, 500);
  };

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      showToast('Please enter both current and new passwords.', 'error');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    showToast('Account security password updated.', 'success');
  };

  const handleLogout = () => {
    setIsLogoutDialogOpen(false);
    showToast('Logged out of demo session.', 'info');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#202938]">Platform & Account Settings</h1>
        <p className="text-xs text-[#687386] mt-0.5">
          Configure notification preferences, testnet wallet connections, and security credentials.
        </p>
      </div>

      {/* MST Blockchain Web3 Wallet Integration Section */}
      <div className="bg-white border border-[#E5E8EF] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-[#3157C8] rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#202938]">
                MST Blockchain Wallet (MST Testnet)
              </h3>
              <p className="text-xs text-[#687386]">
                Connected EVM wallet for rental deposit escrow, smart contract verification, and payouts.
              </p>
            </div>
          </div>
          <Badge variant={wallet.connected ? (wallet.isCorrectNetwork ? 'success' : 'danger') : 'neutral'}>
            {wallet.connected
              ? wallet.isCorrectNetwork
                ? 'Connected (MST Testnet)'
                : 'Wrong Network'
              : 'Disconnected'}
          </Badge>
        </div>

        {wallet.connected ? (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-[#E5E8EF] rounded-lg space-y-1">
                <span className="text-[#687386] block text-[11px]">Connected Wallet Address</span>
                <a
                  href={EXPLORER_ADDR_URL(wallet.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[#3157C8] font-medium break-all hover:underline inline-flex items-center gap-1"
                >
                  <span>{wallet.address}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
              <div className="p-3 bg-slate-50 border border-[#E5E8EF] rounded-lg space-y-1 sm:text-right">
                <span className="text-[#687386] block text-[11px]">Native tMSTC Balance</span>
                <span className="font-bold text-[#3157C8] text-base">{wallet.balance} tMSTC</span>
                <p className="text-[10px] text-[#687386]">Network: {MST_NETWORK.chainName} ({wallet.chainId})</p>
              </div>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200/50 rounded-lg text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-[11px] text-[#687386] block">Deployed RentalEscrow Smart Contract</span>
                <span className="font-mono font-bold text-[#202938]">{CONTRACT_ADDRESS}</span>
              </div>
              <a
                href={EXPLORER_ADDR_URL(CONTRACT_ADDRESS)}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[#3157C8] hover:underline inline-flex items-center gap-1 shrink-0"
              >
                <span>View Contract on Explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  setIsRefreshingBalance(true);
                  await refreshWalletBalance();
                  setIsRefreshingBalance(false);
                  showToast('Wallet balance refreshed from MST Testnet!', 'success');
                }}
                isLoading={isRefreshingBalance}
                className="gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#3157C8]" />
                <span>Refresh Balance</span>
              </Button>

              {!wallet.isCorrectNetwork && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    await switchToMSTNetwork();
                  }}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  Switch to MST Testnet (91562037)
                </Button>
              )}

              <a
                href="https://faucet.masterstroke.academy"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 border border-slate-200 text-[#202938] hover:bg-slate-200"
              >
                <span>Official tMSTC Faucet</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#687386]" />
              </a>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  disconnect();
                  showToast('Wallet disconnected from session.', 'info');
                }}
                className="text-xs text-[#C94C4C] hover:bg-rose-50"
              >
                Disconnect Wallet
              </Button>
            </div>
          </div>
        ) : (
          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                await connect();
              }}
              isLoading={connecting}
            >
              Connect BridgeKey / EVM Wallet
            </Button>
            <p className="text-xs text-[#687386]">
              Compatible with BridgeKey browser extension and MetaMask configured for MST Testnet (Chain ID 91562037).
            </p>
          </div>
        )}
      </div>

      {/* Notification Preferences */}
      <div className="bg-white border border-[#E5E8EF] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-[#3157C8] rounded-lg">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#202938]">Notification Channels</h3>
            <p className="text-xs text-[#687386]">
              Choose how you want to be notified about item booking requests and returns.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2 text-xs">
          <label className="flex items-center justify-between p-3 rounded-lg border border-[#E5E8EF] hover:bg-slate-50 cursor-pointer">
            <div>
              <p className="font-semibold text-[#202938]">Email Notifications</p>
              <p className="text-[#687386] text-[11px]">
                Receive instant emails for booking requests, returns, and escrow releases.
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={(e) => {
                setNotifyEmail(e.target.checked);
                showToast('Email notification preference saved.', 'info');
              }}
              className="text-[#3157C8] rounded focus:ring-[#3157C8]"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-[#E5E8EF] hover:bg-slate-50 cursor-pointer">
            <div>
              <p className="font-semibold text-[#202938]">SMS Handover Reminders</p>
              <p className="text-[#687386] text-[11px]">
                Receive text reminders 2 hours before scheduled on-campus return meetings.
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifySms}
              onChange={(e) => {
                setNotifySms(e.target.checked);
                showToast('SMS reminder preference saved.', 'info');
              }}
              className="text-[#3157C8] rounded focus:ring-[#3157C8]"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-[#E5E8EF] hover:bg-slate-50 cursor-pointer">
            <div>
              <p className="font-semibold text-[#202938]">In-App Escrow Activity</p>
              <p className="text-[#687386] text-[11px]">
                Notify when peer checks in an item or dispute mediation has updates.
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifyHandover}
              onChange={(e) => {
                setNotifyHandover(e.target.checked);
                showToast('Escrow notification preference saved.', 'info');
              }}
              className="text-[#3157C8] rounded focus:ring-[#3157C8]"
            />
          </label>
        </div>
      </div>

      {/* Security Credentials */}
      <div className="bg-white border border-[#E5E8EF] rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-[#3157C8] rounded-lg">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#202938]">Account Security</h3>
            <p className="text-xs text-[#687386]">
              Keep your student credential account safe and protected.
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordUpdate} className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Current Password"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              label="New Password"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-[#202938] cursor-pointer">
              <input
                type="checkbox"
                checked={twoFactorEnabled}
                onChange={(e) => {
                  setTwoFactorEnabled(e.target.checked);
                  showToast(
                    e.target.checked ? '2FA enabled on your student account.' : '2FA disabled.',
                    'info'
                  );
                }}
                className="text-[#3157C8] rounded focus:ring-[#3157C8]"
              />
              <span>Enable Two-Factor Authentication (2FA)</span>
            </label>

            <Button type="submit" variant="secondary" size="sm">
              Update Password
            </Button>
          </div>
        </form>
      </div>

      {/* Logout Section */}
      <div className="bg-white border border-[#E5E8EF] rounded-xl p-6 shadow-xs flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#202938]">Session Management</h3>
          <p className="text-xs text-[#687386]">
            Sign out of your active browser session on this device.
          </p>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setIsLogoutDialogOpen(true)}
          className="gap-1.5"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </Button>
      </div>

      {/* Logout Confirmation */}
      <ConfirmationDialog
        isOpen={isLogoutDialogOpen}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={handleLogout}
        title="Sign Out of UniRent"
        message="Are you sure you want to log out of your current session? You can sign right back in anytime using your .edu address."
        confirmText="Log Out"
        variant="danger"
      />
    </div>
  );
};
