import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/common/ToastContext';
import { WalletProvider } from './context/WalletContext';
import { Layout } from './components/layout/Layout';

// 12 Pages
import { Home } from './pages/Home';
import { Marketplace } from './pages/Marketplace';
import { ItemDetails } from './pages/ItemDetails';
import { CreateListing } from './pages/CreateListing';
import { Checkout } from './pages/Checkout';
import { BookingConfirmation } from './pages/BookingConfirmation';
import { MyRentals } from './pages/MyRentals';
import { MyListings } from './pages/MyListings';
import { Transactions } from './pages/Transactions';
import { Disputes } from './pages/Disputes';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <WalletProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              {/* Page 1: Home / Landing */}
              <Route index element={<Home />} />

              {/* Page 2: Marketplace */}
              <Route path="marketplace" element={<Marketplace />} />

              {/* Page 3: Item Details */}
              <Route path="item/:id" element={<ItemDetails />} />

              {/* Page 4: Create Listing */}
              <Route path="create-listing" element={<CreateListing />} />

              {/* Page 5: Booking / Checkout */}
              <Route path="checkout/:id" element={<Checkout />} />

              {/* Page 6: Booking Confirmation */}
              <Route path="booking-confirmation/:bookingId" element={<BookingConfirmation />} />

              {/* Page 7: My Rentals */}
              <Route path="my-rentals" element={<MyRentals />} />

              {/* Page 8: My Listings */}
              <Route path="my-listings" element={<MyListings />} />

              {/* Page 9: Transaction History */}
              <Route path="transactions" element={<Transactions />} />

              {/* Page 10: Disputes */}
              <Route path="disputes" element={<Disputes />} />

              {/* Page 11: Profile */}
              <Route path="profile" element={<Profile />} />

              {/* Page 12: Settings */}
              <Route path="settings" element={<Settings />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </ToastProvider>
  );
};

export default App;
