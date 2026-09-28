import type { RentalItem, StudentProfile, RentalBooking, TransactionRecord, DisputeRecord } from '../types';
import { mockItems, mockStudents, mockBookings, mockTransactions, mockDisputes } from '../data/mockData';

const KEYS = {
  ITEMS: 'unirent_items_v2',
  STUDENTS: 'unirent_students_v2',
  CURRENT_USER: 'unirent_current_user_v2',
  BOOKINGS: 'unirent_bookings_v2',
  TRANSACTIONS: 'unirent_transactions_v2',
  DISPUTES: 'unirent_disputes_v2',
  WALLET_BALANCE: 'unirent_wallet_balance_v2',
};

function getStored<T>(key: string, fallback: T): T {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

export const StorageService = {
  init() {
    if (!localStorage.getItem(KEYS.ITEMS)) {
      setStored(KEYS.ITEMS, mockItems);
    }
    if (!localStorage.getItem(KEYS.STUDENTS)) {
      setStored(KEYS.STUDENTS, mockStudents);
    }
    if (!localStorage.getItem(KEYS.CURRENT_USER)) {
      setStored(KEYS.CURRENT_USER, mockStudents[0]);
    }
    if (!localStorage.getItem(KEYS.BOOKINGS)) {
      setStored(KEYS.BOOKINGS, mockBookings);
    }
    if (!localStorage.getItem(KEYS.TRANSACTIONS)) {
      setStored(KEYS.TRANSACTIONS, mockTransactions);
    }
    if (!localStorage.getItem(KEYS.DISPUTES)) {
      setStored(KEYS.DISPUTES, mockDisputes);
    }
    if (!localStorage.getItem(KEYS.WALLET_BALANCE)) {
      setStored(KEYS.WALLET_BALANCE, 15000);
    }
  },

  getCurrentUser(): StudentProfile {
    this.init();
    return getStored(KEYS.CURRENT_USER, mockStudents[0]);
  },

  updateCurrentUser(profile: Partial<StudentProfile>): StudentProfile {
    const current = this.getCurrentUser();
    const updated = { ...current, ...profile };
    setStored(KEYS.CURRENT_USER, updated);
    return updated;
  },

  getItems(): RentalItem[] {
    this.init();
    return getStored(KEYS.ITEMS, mockItems);
  },

  getItemById(id: string): RentalItem | undefined {
    return this.getItems().find((item) => item.id === id);
  },

  addItem(newItem: Omit<RentalItem, 'id' | 'createdAt'>): RentalItem {
    const items = this.getItems();
    const item: RentalItem = {
      ...newItem,
      id: `item-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    const updated = [item, ...items];
    setStored(KEYS.ITEMS, updated);

    // Update user listed count
    const user = this.getCurrentUser();
    this.updateCurrentUser({ itemsListedCount: user.itemsListedCount + 1 });

    return item;
  },

  updateItem(id: string, updates: Partial<RentalItem>): RentalItem | null {
    const items = this.getItems();
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...updates };
    setStored(KEYS.ITEMS, items);
    return items[index];
  },

  removeItem(id: string): boolean {
    const items = this.getItems();
    const filtered = items.filter((i) => i.id !== id);
    setStored(KEYS.ITEMS, filtered);
    const user = this.getCurrentUser();
    if (user.itemsListedCount > 0) {
      this.updateCurrentUser({ itemsListedCount: user.itemsListedCount - 1 });
    }
    return true;
  },

  getBookings(): RentalBooking[] {
    this.init();
    return getStored(KEYS.BOOKINGS, mockBookings);
  },

  getBookingById(id: string): RentalBooking | undefined {
    return this.getBookings().find((b) => b.id === id || b.bookingRef === id);
  },

  createBooking(params: {
    item: RentalItem;
    startDate: string;
    endDate: string;
    days: number;
    rentalFee: number;
    securityDeposit: number;
    totalAmount: number;
    onChainRentalId?: number;
    blockchainTxHash?: string;
    ownerWalletAddress?: string;
    renterWalletAddress?: string;
  }): RentalBooking {
    const bookings = this.getBookings();
    const currentUser = this.getCurrentUser();
    const bookingRef = `UR-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const newBooking: RentalBooking = {
      id: `book-${Date.now()}`,
      bookingRef,
      itemId: params.item.id,
      itemTitle: params.item.title,
      itemImage: params.item.imageUrl,
      category: params.item.category,
      ownerName: params.item.ownerName,
      ownerCollege: params.item.ownerCollege,
      ownerAvatar: params.item.ownerAvatar,
      renterId: currentUser.id,
      startDate: params.startDate,
      endDate: params.endDate,
      days: params.days,
      dailyRate: params.item.dailyPrice,
      rentalFee: params.rentalFee,
      securityDeposit: params.securityDeposit,
      totalAmount: params.totalAmount,
      status: 'Upcoming',
      createdAt: new Date().toISOString().split('T')[0],
      onChainRentalId: params.onChainRentalId,
      blockchainTxHash: params.blockchainTxHash,
      ownerWalletAddress: params.ownerWalletAddress,
      renterWalletAddress: params.renterWalletAddress,
    };

    setStored(KEYS.BOOKINGS, [newBooking, ...bookings]);

    // Record transactions
    const txs = this.getTransactions();
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    if (params.blockchainTxHash) {
      // Real MST Testnet Escrow Lock transaction
      const escrowTx: TransactionRecord = {
        id: `tx-${Date.now()}-1`,
        reference: `TX-${Math.floor(10000 + Math.random() * 90000)}-MST`,
        itemName: params.item.title,
        type: 'Deposit Escrow',
        amount: params.totalAmount,
        date: nowStr,
        status: 'Completed',
        blockchainTxHash: params.blockchainTxHash,
        isRealOnChain: true,
        rentalId: params.onChainRentalId,
      };
      setStored(KEYS.TRANSACTIONS, [escrowTx, ...txs]);
    } else {
      const depositTx: TransactionRecord = {
        id: `tx-${Date.now()}-1`,
        reference: `TX-${Math.floor(10000 + Math.random() * 90000)}-UR`,
        itemName: params.item.title,
        type: 'Deposit Escrow',
        amount: params.securityDeposit,
        date: nowStr,
        status: 'Pending Escrow',
        blockchainTxHash: 'MST: Local Prototype Booking',
      };
      const rentTx: TransactionRecord = {
        id: `tx-${Date.now()}-2`,
        reference: `TX-${Math.floor(10000 + Math.random() * 90000)}-UR`,
        itemName: params.item.title,
        type: 'Rental Payment',
        amount: params.rentalFee,
        date: nowStr,
        status: 'Pending Escrow',
        blockchainTxHash: 'MST: Local Prototype Booking',
      };
      setStored(KEYS.TRANSACTIONS, [depositTx, rentTx, ...txs]);
    }

    // Update user rented count
    this.updateCurrentUser({ itemsRentedCount: currentUser.itemsRentedCount + 1 });

    return newBooking;
  },

  updateBookingStatus(id: string, status: RentalBooking['status']): void {
    const bookings = this.getBookings();
    const updated = bookings.map((b) => (b.id === id ? { ...b, status } : b));
    setStored(KEYS.BOOKINGS, updated);
  },

  updateBooking(id: string, updates: Partial<RentalBooking>): RentalBooking | null {
    const bookings = this.getBookings();
    const index = bookings.findIndex((b) => b.id === id || b.bookingRef === id);
    if (index === -1) return null;
    bookings[index] = { ...bookings[index], ...updates };
    setStored(KEYS.BOOKINGS, bookings);
    return bookings[index];
  },

  addTransaction(tx: TransactionRecord): void {
    const txs = this.getTransactions();
    setStored(KEYS.TRANSACTIONS, [tx, ...txs]);
  },

  getTransactions(): TransactionRecord[] {
    this.init();
    return getStored(KEYS.TRANSACTIONS, mockTransactions);
  },

  getDisputes(): DisputeRecord[] {
    this.init();
    return getStored(KEYS.DISPUTES, mockDisputes);
  },

  createDispute(params: {
    rentalRef: string;
    itemTitle: string;
    reason: string;
    description: string;
    evidenceFiles?: string[];
  }): DisputeRecord {
    const disputes = this.getDisputes();
    const currentUser = this.getCurrentUser();
    const newDispute: DisputeRecord = {
      id: `disp-${Date.now()}`,
      rentalRef: params.rentalRef,
      itemTitle: params.itemTitle,
      raisedBy: `${currentUser.name} (Renter)`,
      opponentName: 'Counterparty Student',
      reason: params.reason,
      description: params.description,
      status: 'Under Review',
      evidenceFiles: params.evidenceFiles || [],
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    setStored(KEYS.DISPUTES, [newDispute, ...disputes]);
    return newDispute;
  },

  getWalletBalance(): number {
    this.init();
    return getStored(KEYS.WALLET_BALANCE, 15000);
  },

  setWalletBalance(balance: number): void {
    setStored(KEYS.WALLET_BALANCE, balance);
  },
};
