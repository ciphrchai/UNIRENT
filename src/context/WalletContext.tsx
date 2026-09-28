/**
 * WalletContext — global wallet state for UniRent.
 * Wraps connect/disconnect logic and exposes wallet state to all components.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  WalletState,
  INITIAL_WALLET_STATE,
  connectWallet,
  refreshBalance,
  isWalletAvailable,
  WalletError,
  parseWalletError,
} from '../blockchain/wallet';
import { MST_NETWORK } from '../blockchain/config';

interface WalletContextType {
  wallet: WalletState;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshWalletBalance: () => Promise<void>;
  error: string | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wallet, setWallet] = useState<WalletState>(INITIAL_WALLET_STATE);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listenerAttached = useRef(false);

  const disconnect = useCallback(() => {
    setWallet(INITIAL_WALLET_STATE);
    setError(null);
  }, []);

  const connect = useCallback(async () => {
    if (!isWalletAvailable()) {
      setError('No EVM wallet detected. Please install BridgeKey or MetaMask.');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const state = await connectWallet();
      setWallet(state);
    } catch (err) {
      const we = err instanceof WalletError ? err : parseWalletError(err);
      setError(we.message);
    } finally {
      setConnecting(false);
    }
  }, []);

  const refreshWalletBalance = useCallback(async () => {
    if (!wallet.provider || !wallet.address) return;
    try {
      const balance = await refreshBalance(wallet.provider, wallet.address);
      setWallet((prev) => ({ ...prev, balance }));
    } catch {
      // silently ignore balance refresh failures
    }
  }, [wallet.provider, wallet.address]);

  // Attach wallet event listeners once
  useEffect(() => {
    if (!isWalletAvailable() || listenerAttached.current) return;
    listenerAttached.current = true;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (wallet.connected) {
        // Re-connect to update state with new account
        connect();
      }
    };

    const handleChainChanged = () => {
      // Page reload is the safest response to chain change
      window.location.reload();
    };

    window.ethereum?.on('accountsChanged', handleAccountsChanged);
    window.ethereum?.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [connect, disconnect, wallet.connected]);

  // Check if already connected on mount (user previously authorized)
  useEffect(() => {
    if (!isWalletAvailable()) return;
    window.ethereum!
      .request({ method: 'eth_accounts' })
      .then((accounts: string[]) => {
        if (accounts.length > 0) {
          connect();
        }
      })
      .catch(() => {/* not connected */});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WalletContext.Provider
      value={{ wallet, connecting, connect, disconnect, refreshWalletBalance, error }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
};

/** Returns true if wallet is connected and on MST Testnet */
export const useIsReadyForTx = (): boolean => {
  const { wallet } = useWallet();
  return wallet.connected && wallet.isCorrectNetwork;
};

/** Returns correct network name for display */
export const MST_NETWORK_NAME = MST_NETWORK.chainName;
