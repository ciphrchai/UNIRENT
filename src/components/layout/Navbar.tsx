import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  PlusCircle,
  Wallet,
  ShieldCheck,
  User,
  Settings as SettingsIcon,
  Clock,
  Layers,
  FileQuestion,
  LogOut,
} from 'lucide-react';
import { StorageService } from '../../services/storageService';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { useToast } from '../common/ToastContext';
import { useWallet } from '../../context/WalletContext';
import { switchToMSTNetwork } from '../../blockchain/wallet';
import { MST_NETWORK } from '../../blockchain/config';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const currentUser = StorageService.getCurrentUser();
  const walletBalance = StorageService.getWalletBalance();
  const location = useLocation();
  const { showToast } = useToast();
  const { wallet, connecting, connect } = useWallet();

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Marketplace', path: '/marketplace' },
    { label: 'My Rentals', path: '/my-rentals' },
    { label: 'My Listings', path: '/my-listings' },
    { label: 'Transactions', path: '/transactions' },
    { label: 'Disputes', path: '/disputes' },
  ];

  const isActive = (path: string) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  const handleSimulatedAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthModalOpen(false);
    showToast(`Logged in successfully as ${currentUser.name}!`, 'success');
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#E5E8EF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg bg-[#3157C8] flex items-center justify-center text-white font-bold text-base shadow-xs group-hover:bg-[#2446A8] transition-colors">
                  U
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg tracking-tight text-[#202938]">
                    UniRent
                  </span>
                  <span className="text-[10px] text-[#687386] tracking-wider uppercase -mt-1 font-medium">
                    Campus P2P
                  </span>
                </div>
              </Link>

              {/* Desktop Nav Links */}
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive(link.path)
                        ? 'text-[#3157C8] bg-blue-50/70 font-semibold'
                        : 'text-[#687386] hover:text-[#202938] hover:bg-slate-50'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Right section: Wallet + List Item + Profile */}
            <div className="hidden md:flex items-center gap-3">
              {/* Web3 Wallet Connection / MST Testnet Indicator */}
              {!wallet.connected ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={connect}
                  isLoading={connecting}
                  className="gap-1.5 text-xs text-[#3157C8] border-[#3157C8]/40 hover:bg-blue-50"
                >
                  <Wallet className="w-3.5 h-3.5 text-[#3157C8]" />
                  <span>Connect Wallet</span>
                </Button>
              ) : !wallet.isCorrectNetwork ? (
                <button
                  onClick={switchToMSTNetwork}
                  title={`Connected to chain ID ${wallet.chainId}. Click to switch to MST Testnet (Chain ID ${MST_NETWORK.chainId}).`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer animate-pulse"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span>Wrong Network (Switch to MST)</span>
                </button>
              ) : (
                <Link
                  to="/settings"
                  title={`Connected: ${wallet.address} on ${MST_NETWORK.chainName}`}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 border border-[#E5E8EF] text-[#202938] hover:bg-slate-100 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-semibold text-[#202938]">{wallet.balance}</span>
                  <span className="text-[#687386] text-[11px]">tMSTC</span>
                  <span className="text-[#CBD5E1]">|</span>
                  <span className="font-mono text-[11px] text-[#3157C8]">
                    {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                  </span>
                </Link>
              )}

              {/* List Item CTA */}
              <Link to="/create-listing">
                <Button size="sm" variant="secondary" className="gap-1.5">
                  <PlusCircle className="w-4 h-4 text-[#3157C8]" />
                  <span>List Item</span>
                </Button>
              </Link>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-1 pl-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-[#E5E8EF] transition-colors"
                >
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-full object-cover border border-[#E5E8EF]"
                  />
                  <span className="text-xs font-medium text-[#202938] max-w-[100px] truncate">
                    {currentUser.name}
                  </span>
                </button>

                {profileDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setProfileDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-52 bg-white border border-[#E5E8EF] rounded-xl shadow-lg z-20 py-1.5 animate-fade-in text-left">
                      <div className="px-3.5 py-2 border-b border-[#E5E8EF]">
                        <p className="text-xs font-semibold text-[#202938]">{currentUser.name}</p>
                        <p className="text-[11px] text-[#687386] truncate">{currentUser.email}</p>
                      </div>
                      <Link
                        to="/profile"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2 px-3.5 py-2 text-xs text-[#202938] hover:bg-slate-50"
                      >
                        <User className="w-3.5 h-3.5 text-[#687386]" />
                        <span>Profile & Reputation</span>
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2 px-3.5 py-2 text-xs text-[#202938] hover:bg-slate-50"
                      >
                        <SettingsIcon className="w-3.5 h-3.5 text-[#687386]" />
                        <span>Account & Settings</span>
                      </Link>
                      <div className="border-t border-[#E5E8EF] my-1" />
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          showToast('Logged out of demo session.', 'info');
                        }}
                        className="flex items-center gap-2 w-full px-3.5 py-2 text-xs text-[#C94C4C] hover:bg-rose-50/60"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Mobile menu trigger */}
            <div className="flex md:hidden items-center gap-2">
              <Link to="/create-listing">
                <Button size="sm" variant="primary">
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>List</span>
                </Button>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-[#687386] hover:text-[#202938] rounded-lg border border-[#E5E8EF]"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E5E8EF] bg-white px-4 pt-3 pb-6 space-y-2">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg mb-3 border border-[#E5E8EF]">
              <div className="flex items-center gap-2.5">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div>
                  <p className="text-xs font-semibold text-[#202938]">{currentUser.name}</p>
                  <p className="text-[11px] text-[#687386]">{currentUser.college}</p>
                </div>
              </div>
              <div className="text-right">
                {!wallet.connected ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={connect}
                    isLoading={connecting}
                    className="text-xs py-1 px-2.5"
                  >
                    Connect Wallet
                  </Button>
                ) : !wallet.isCorrectNetwork ? (
                  <button
                    onClick={switchToMSTNetwork}
                    className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-300 px-2 py-1 rounded"
                  >
                    Switch to MST (91562037)
                  </button>
                ) : (
                  <div>
                    <p className="text-[10px] text-[#687386]">MST Testnet</p>
                    <p className="text-xs font-semibold text-[#3157C8]">{wallet.balance} tMSTC</p>
                  </div>
                )}
              </div>
            </div>

            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive(link.path)
                    ? 'text-[#3157C8] bg-blue-50 font-semibold'
                    : 'text-[#687386] hover:bg-slate-50'
                }`}
              >
                {link.label}
              </Link>
            ))}

            <div className="border-t border-[#E5E8EF] pt-2 mt-2 space-y-1">
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm text-[#687386] hover:bg-slate-50"
              >
                Profile & Campus ID
              </Link>
              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm text-[#687386] hover:bg-slate-50"
              >
                Settings & Testnet
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Simulated Auth Modal */}
      <Modal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        title={authMode === 'login' ? 'Student Sign In' : 'Create Student Account'}
        maxWidth="sm"
      >
        <form onSubmit={handleSimulatedAuth} className="space-y-4">
          <p className="text-xs text-[#687386]">
            UniRent uses authenticated .edu email addresses for student verification.
          </p>
          <Input
            label="Campus Email (.edu)"
            type="email"
            defaultValue="student.a@campus.edu"
            required
            placeholder="student@university.edu"
          />
          <Input
            label="Password"
            type="password"
            defaultValue="••••••••"
            required
          />
          <div className="text-xs text-[#687386] bg-slate-50 p-2.5 rounded-lg border border-[#E5E8EF]">
            <strong>Demo Notice:</strong> Authentication is simulated. Real OAuth and SSO will be enabled in future phases.
          </div>
          <Button type="submit" variant="primary" className="w-full">
            {authMode === 'login' ? 'Sign In to UniRent' : 'Register Account'}
          </Button>
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="text-xs text-[#3157C8] hover:underline"
            >
              {authMode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
