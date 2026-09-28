/**
 * RentalEscrow contract interaction helpers.
 * All writes require a JsonRpcSigner from the user's connected wallet.
 * Reads use a BrowserProvider (no signature needed).
 */

import { Contract, BrowserProvider, JsonRpcSigner, ethers } from 'ethers';
import { CONTRACT_ADDRESS, RENTAL_ESCROW_ABI, RentalState } from './config';
import { parseWalletError } from './wallet';

export interface OnChainRental {
  id: bigint;
  owner: string;
  renter: string;
  itemRef: string;
  rentAmount: bigint;
  depositAmount: bigint;
  durationSeconds: bigint;
  bookedAt: bigint;
  state: RentalState;
  ownerHandoverConfirmed: boolean;
  renterHandoverConfirmed: boolean;
  ownerReturnConfirmed: boolean;
  renterReturnConfirmed: boolean;
}

export interface TxResult {
  hash: string;
  explorerUrl: string;
}

function getReadContract(provider: BrowserProvider): Contract {
  return new Contract(CONTRACT_ADDRESS, RENTAL_ESCROW_ABI, provider);
}

function getWriteContract(signer: JsonRpcSigner): Contract {
  return new Contract(CONTRACT_ADDRESS, RENTAL_ESCROW_ABI, signer);
}

// ── Read calls (free, no wallet approval) ────────────────────────────────────

export async function fetchRental(
  provider: BrowserProvider,
  rentalId: bigint
): Promise<OnChainRental> {
  const contract = getReadContract(provider);
  const r = await contract.getRental(rentalId);
  return {
    id: r.id,
    owner: r.owner,
    renter: r.renter,
    itemRef: r.itemRef,
    rentAmount: r.rentAmount,
    depositAmount: r.depositAmount,
    durationSeconds: r.durationSeconds,
    bookedAt: r.bookedAt,
    state: Number(r.state) as RentalState,
    ownerHandoverConfirmed: r.ownerHandoverConfirmed,
    renterHandoverConfirmed: r.renterHandoverConfirmed,
    ownerReturnConfirmed: r.ownerReturnConfirmed,
    renterReturnConfirmed: r.renterReturnConfirmed,
  };
}

export async function fetchRentalState(
  provider: BrowserProvider,
  rentalId: bigint
): Promise<RentalState> {
  const contract = getReadContract(provider);
  const state = await contract.getRentalState(rentalId);
  return Number(state) as RentalState;
}

export async function fetchTotalRentals(provider: BrowserProvider): Promise<bigint> {
  const contract = getReadContract(provider);
  return await contract.totalRentals();
}

export async function fetchContractBalance(provider: BrowserProvider): Promise<string> {
  const contract = getReadContract(provider);
  const balanceBn: bigint = await contract.contractBalance();
  return ethers.formatEther(balanceBn);
}

// ── Write calls (require wallet approval) ────────────────────────────────────

/**
 * Item owner creates a rental agreement.
 * Returns the rentalId from the RentalCreated event.
 */
export async function createRental(
  signer: JsonRpcSigner,
  params: {
    renter: string;
    itemRef: string;
    rentAmountWei: bigint;
    depositAmountWei: bigint;
    durationSeconds: bigint;
  }
): Promise<{ rentalId: bigint; txHash: string }> {
  try {
    const contract = getWriteContract(signer);
    const tx = await contract.createRental(
      params.renter,
      params.itemRef,
      params.rentAmountWei,
      params.depositAmountWei,
      params.durationSeconds
    );
    const receipt = await tx.wait();
    if (!receipt || receipt.status === 0) throw new Error('Transaction failed on-chain');

    // Extract rentalId from RentalCreated event
    const iface = new ethers.Interface(RENTAL_ESCROW_ABI as unknown as string[]);
    let rentalId = 0n;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === 'RentalCreated') {
          rentalId = parsed.args.rentalId as bigint;
          break;
        }
      } catch {
        // skip non-matching logs
      }
    }

    return { rentalId, txHash: receipt.hash };
  } catch (err) {
    throw parseWalletError(err);
  }
}

/**
 * Renter deposits rent + security deposit to lock the booking.
 * totalWei must equal rentAmount + depositAmount exactly.
 */
export async function bookAndDeposit(
  signer: JsonRpcSigner,
  rentalId: bigint,
  totalWei: bigint
): Promise<TxResult> {
  try {
    const contract = getWriteContract(signer);
    const tx = await contract.bookAndDeposit(rentalId, { value: totalWei });
    const receipt = await tx.wait();
    if (!receipt || receipt.status === 0) throw new Error('Transaction failed on-chain');
    return {
      hash: receipt.hash,
      explorerUrl: `https://testnet.mstscan.com/tx/${receipt.hash}`,
    };
  } catch (err) {
    throw parseWalletError(err);
  }
}

export async function confirmHandover(
  signer: JsonRpcSigner,
  rentalId: bigint
): Promise<TxResult> {
  try {
    const contract = getWriteContract(signer);
    const tx = await contract.confirmHandover(rentalId);
    const receipt = await tx.wait();
    if (!receipt || receipt.status === 0) throw new Error('Transaction failed on-chain');
    return { hash: receipt.hash, explorerUrl: `https://testnet.mstscan.com/tx/${receipt.hash}` };
  } catch (err) {
    throw parseWalletError(err);
  }
}

export async function confirmReturn(
  signer: JsonRpcSigner,
  rentalId: bigint
): Promise<TxResult> {
  try {
    const contract = getWriteContract(signer);
    const tx = await contract.confirmReturn(rentalId);
    const receipt = await tx.wait();
    if (!receipt || receipt.status === 0) throw new Error('Transaction failed on-chain');
    return { hash: receipt.hash, explorerUrl: `https://testnet.mstscan.com/tx/${receipt.hash}` };
  } catch (err) {
    throw parseWalletError(err);
  }
}

export async function raiseDispute(
  signer: JsonRpcSigner,
  rentalId: bigint
): Promise<TxResult> {
  try {
    const contract = getWriteContract(signer);
    const tx = await contract.raiseDispute(rentalId);
    const receipt = await tx.wait();
    if (!receipt || receipt.status === 0) throw new Error('Transaction failed on-chain');
    return { hash: receipt.hash, explorerUrl: `https://testnet.mstscan.com/tx/${receipt.hash}` };
  } catch (err) {
    throw parseWalletError(err);
  }
}

export async function cancelAfterBooking(
  signer: JsonRpcSigner,
  rentalId: bigint
): Promise<TxResult> {
  try {
    const contract = getWriteContract(signer);
    const tx = await contract.cancelAfterBooking(rentalId);
    const receipt = await tx.wait();
    if (!receipt || receipt.status === 0) throw new Error('Transaction failed on-chain');
    return { hash: receipt.hash, explorerUrl: `https://testnet.mstscan.com/tx/${receipt.hash}` };
  } catch (err) {
    throw parseWalletError(err);
  }
}

export async function cancelBeforeBooking(
  signer: JsonRpcSigner,
  rentalId: bigint
): Promise<TxResult> {
  try {
    const contract = getWriteContract(signer);
    const tx = await contract.cancelBeforeBooking(rentalId);
    const receipt = await tx.wait();
    if (!receipt || receipt.status === 0) throw new Error('Transaction failed on-chain');
    return { hash: receipt.hash, explorerUrl: `https://testnet.mstscan.com/tx/${receipt.hash}` };
  } catch (err) {
    throw parseWalletError(err);
  }
}

/** Parse tMSTC amount (decimal string) to wei BigInt */
export function parseToWei(amount: string): bigint {
  return ethers.parseEther(amount);
}

/** Format wei BigInt to tMSTC decimal string */
export function formatFromWei(wei: bigint): string {
  return ethers.formatEther(wei);
}

/**
 * Standard testnet exchange rate: 1000 INR = 1.0 tMSTC (1 INR = 1e15 wei).
 * Keeps student escrow amounts easily payable with testnet faucet grants (5-10 tMSTC).
 */
export function inrToWei(inr: number): bigint {
  return BigInt(Math.max(1, Math.round(inr))) * 1000000000000000n;
}

export function weiToMSTC(wei: bigint): string {
  return ethers.formatEther(wei);
}
