/**
 * Wallet connection and network management for UniRent.
 * Supports BridgeKey and any EIP-1193 compatible browser wallet.
 * No private keys stored here — all signing is done by the user's wallet.
 */

import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { MST_NETWORK } from './config';

export interface WalletState {
  connected: boolean;
  address: string;
  chainId: number;
  balance: string; // formatted tMSTC
  isCorrectNetwork: boolean;
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
}

export const INITIAL_WALLET_STATE: WalletState = {
  connected: false,
  address: '',
  chainId: 0,
  balance: '0',
  isCorrectNetwork: false,
  provider: null,
  signer: null,
};

/** Returns true if window.ethereum is available */
export function isWalletAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

/** Request wallet connection and return updated WalletState */
export async function connectWallet(): Promise<WalletState> {
  if (!isWalletAvailable()) {
    throw new WalletError(
      'NO_WALLET',
      'No EVM wallet detected. Please install BridgeKey or MetaMask.'
    );
  }

  // Request account access
  await window.ethereum!.request({ method: 'eth_requestAccounts' });

  const provider = new BrowserProvider(window.ethereum!);
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  // If not on MST Testnet, attempt to switch/add
  if (chainId !== MST_NETWORK.chainId) {
    await switchToMSTNetwork();
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const balanceBn = await provider.getBalance(address);
  const balance = formatMSTC(balanceBn);

  const finalNetwork = await provider.getNetwork();
  const finalChainId = Number(finalNetwork.chainId);

  return {
    connected: true,
    address,
    chainId: finalChainId,
    balance,
    isCorrectNetwork: finalChainId === MST_NETWORK.chainId,
    provider,
    signer,
  };
}

/** Attempt to switch wallet to MST Testnet; add it if not present */
export async function switchToMSTNetwork(): Promise<void> {
  if (!isWalletAvailable()) return;

  try {
    await window.ethereum!.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MST_NETWORK.chainIdHex }],
    });
  } catch (err: unknown) {
    const error = err as { code?: number };
    // 4902 = chain not added to wallet yet
    if (error.code === 4902) {
      await window.ethereum!.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: MST_NETWORK.chainIdHex,
            chainName: MST_NETWORK.chainName,
            nativeCurrency: MST_NETWORK.nativeCurrency,
            rpcUrls: [MST_NETWORK.rpcUrl],
            blockExplorerUrls: MST_NETWORK.blockExplorerUrls,
          },
        ],
      });
    } else {
      throw parseWalletError(err);
    }
  }
}

/** Refresh balance for a connected wallet */
export async function refreshBalance(provider: BrowserProvider, address: string): Promise<string> {
  const balanceBn = await provider.getBalance(address);
  return formatMSTC(balanceBn);
}

/** Format wei bigint to tMSTC string with 4 decimals */
export function formatMSTC(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  return eth.toFixed(4);
}

// ── Error handling ────────────────────────────────────────────────────────────

export type WalletErrorCode =
  | 'NO_WALLET'
  | 'USER_REJECTED'
  | 'WRONG_NETWORK'
  | 'INSUFFICIENT_FUNDS'
  | 'REVERT'
  | 'RPC_ERROR'
  | 'UNKNOWN';

export class WalletError extends Error {
  constructor(
    public code: WalletErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

/** Parse raw wallet / ethers errors into a user-friendly WalletError */
export function parseWalletError(err: unknown): WalletError {
  const e = err as { code?: number | string; message?: string; reason?: string; data?: { message?: string } };
  const msg = e?.reason || e?.data?.message || e?.message || 'Unknown error';

  if (e?.code === 4001 || (typeof e?.code === 'string' && e.code === 'ACTION_REJECTED')) {
    return new WalletError('USER_REJECTED', 'Transaction was rejected in wallet.');
  }
  if (typeof msg === 'string' && msg.toLowerCase().includes('insufficient')) {
    return new WalletError('INSUFFICIENT_FUNDS', 'Insufficient tMSTC balance for this transaction.');
  }
  if (typeof msg === 'string' && (msg.toLowerCase().includes('revert') || msg.toLowerCase().includes('invalid state'))) {
    return new WalletError('REVERT', `Contract reverted: ${msg}`);
  }
  if (e?.code === -32603 || e?.code === -32000) {
    return new WalletError('RPC_ERROR', `RPC error: ${msg}`);
  }

  return new WalletError('UNKNOWN', msg || 'An unexpected error occurred.');
}
