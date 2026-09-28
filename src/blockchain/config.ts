/**
 * UniRent Blockchain Configuration
 * MST Testnet — chain ID 91562037
 * All contract interaction uses the user's BridgeKey/EVM wallet — no private keys here.
 */

export const MST_NETWORK = {
  chainId: 91562037,
  chainIdHex: '0x5745F15' as const,
  chainName: 'MST Testnet',
  rpcUrl: 'https://testnetrpc.mstblockchain.com',
  nativeCurrency: {
    name: 'tMSTC',
    symbol: 'tMSTC',
    decimals: 18,
  },
  blockExplorerUrls: ['https://testnet.mstscan.com'],
} as const;

/** Deployed RentalEscrow contract address on MST Testnet */
export const CONTRACT_ADDRESS = '0x66BBe2EFe1CbE4D08216e2909bc5012d1F28149B';

/** Minimal ABI — only functions and events used by the frontend */
export const RENTAL_ESCROW_ABI = [
  // Views
  'function getRental(uint256 rentalId) view returns (tuple(uint256 id, address owner, address renter, string itemRef, uint256 rentAmount, uint256 depositAmount, uint256 durationSeconds, uint256 bookedAt, uint8 state, bool ownerHandoverConfirmed, bool renterHandoverConfirmed, bool ownerReturnConfirmed, bool renterReturnConfirmed))',
  'function getRentalState(uint256 rentalId) view returns (uint8)',
  'function totalRentals() view returns (uint256)',
  'function contractBalance() view returns (uint256)',

  // Write
  'function createRental(address renter, string itemRef, uint256 rentAmount, uint256 depositAmount, uint256 durationSeconds) returns (uint256)',
  'function bookAndDeposit(uint256 rentalId) payable',
  'function confirmHandover(uint256 rentalId)',
  'function confirmReturn(uint256 rentalId)',
  'function raiseDispute(uint256 rentalId)',
  'function cancelBeforeBooking(uint256 rentalId)',
  'function cancelAfterBooking(uint256 rentalId)',
  'function timeoutRefund(uint256 rentalId)',

  // Events
  'event RentalCreated(uint256 indexed rentalId, address indexed owner, address indexed renter, string itemRef, uint256 rentAmount, uint256 depositAmount, uint256 durationSeconds)',
  'event FundsDeposited(uint256 indexed rentalId, address indexed renter, uint256 totalDeposited)',
  'event HandoverConfirmed(uint256 indexed rentalId, address indexed confirmedBy, bool ownerConfirmed, bool renterConfirmed)',
  'event ReturnConfirmed(uint256 indexed rentalId, address indexed confirmedBy, bool ownerConfirmed, bool renterConfirmed)',
  'event RentalSettled(uint256 indexed rentalId, address indexed owner, address indexed renter, uint256 rentPaid, uint256 depositRefunded)',
  'event RentalCancelled(uint256 indexed rentalId, address indexed cancelledBy, uint256 refundAmount)',
  'event DisputeRaised(uint256 indexed rentalId, address indexed raisedBy)',
  'event DisputeResolved(uint256 indexed rentalId, address indexed resolvedBy, address rentRecipient, address depositRecipient)',
  'event RefundIssued(uint256 indexed rentalId, address indexed recipient, uint256 amount)',
] as const;

/** On-chain RentalState enum matching Solidity */
export enum RentalState {
  Created = 0,
  Booked = 1,
  Active = 2,
  Returning = 3,
  Settled = 4,
  Cancelled = 5,
  Disputed = 6,
}

export const RENTAL_STATE_LABELS: Record<RentalState, string> = {
  [RentalState.Created]: 'Created',
  [RentalState.Booked]: 'Booked',
  [RentalState.Active]: 'Active',
  [RentalState.Returning]: 'Returning',
  [RentalState.Settled]: 'Settled',
  [RentalState.Cancelled]: 'Cancelled',
  [RentalState.Disputed]: 'Disputed',
};

export const EXPLORER_TX_URL = (hash: string) =>
  `${MST_NETWORK.blockExplorerUrls[0]}/tx/${hash}`;

export const EXPLORER_ADDR_URL = (address: string) =>
  `${MST_NETWORK.blockExplorerUrls[0]}/address/${address}`;
