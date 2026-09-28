export type Category = 'Electronics' | 'Books' | 'Academic' | 'Photography' | 'Sports' | 'Other';

export type ItemCondition = 'Like New' | 'Excellent' | 'Good' | 'Fair';

export type RentalStatus = 'Upcoming' | 'Active' | 'Completed' | 'Cancelled';

export type DisputeStatus = 'Under Review' | 'Evidence Required' | 'Resolved' | 'Closed';

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  college: string;
  major: string;
  avatar: string;
  rating: number;
  reviewsCount: number;
  responseTime: string;
  walletAddress: string;
  itemsRentedCount: number;
  itemsListedCount: number;
  joinedDate: string;
}

export interface RentalItem {
  id: string;
  title: string;
  category: Category;
  description: string;
  dailyPrice: number;
  securityDeposit: number;
  condition: ItemCondition;
  location: string;
  isAvailable: boolean;
  ownerId: string;
  ownerName: string;
  ownerCollege: string;
  ownerAvatar: string;
  ownerRating: number;
  imageUrl: string;
  featured?: boolean;
  createdAt: string;
  rentalTerms?: string[];
}

export interface RentalBooking {
  id: string;
  itemId: string;
  itemTitle: string;
  itemImage: string;
  category: Category;
  ownerName: string;
  ownerCollege: string;
  ownerAvatar: string;
  renterId: string;
  startDate: string;
  endDate: string;
  days: number;
  dailyRate: number;
  rentalFee: number;
  securityDeposit: number;
  totalAmount: number;
  status: RentalStatus;
  createdAt: string;
  bookingRef: string;
  // On-Chain MST Testnet integration fields
  onChainRentalId?: number;
  blockchainTxHash?: string;
  ownerWalletAddress?: string;
  renterWalletAddress?: string;
  ownerHandoverConfirmed?: boolean;
  renterHandoverConfirmed?: boolean;
  ownerReturnConfirmed?: boolean;
  renterReturnConfirmed?: boolean;
  onChainState?: number;
}

export interface TransactionRecord {
  id: string;
  reference: string;
  itemName: string;
  type: 'Rental Payment' | 'Deposit Escrow' | 'Deposit Refund' | 'Rental Payout';
  amount: number;
  date: string;
  status: 'Completed' | 'Pending Escrow' | 'Refunded' | 'Released';
  blockchainTxHash?: string;
  isRealOnChain?: boolean;
  rentalId?: number;
}

export interface DisputeRecord {
  id: string;
  rentalRef: string;
  itemTitle: string;
  raisedBy: string;
  opponentName: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  evidenceFiles?: string[];
  createdAt: string;
  updatedAt: string;
}
