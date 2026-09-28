# UniRent Blockchain — Frontend Integration Guide

## Network Configuration

| Field | Value |
|-------|-------|
| Network Name | MST Testnet |
| RPC URL | `https://testnetrpc.mstblockchain.com` |
| Chain ID | `4545` |
| Currency Symbol | `tMSTC` |
| Explorer | `https://testnet.mstscan.com` |

---

## BridgeKey Wallet Connection

```typescript
// src/hooks/useWallet.ts
import { ethers, BrowserProvider } from "ethers";

const MST_TESTNET = {
  chainId: "0x11C1", // 4545 in hex
  chainName: "MST Testnet",
  nativeCurrency: { name: "tMSTC", symbol: "tMSTC", decimals: 18 },
  rpcUrls: ["https://testnetrpc.mstblockchain.com"],
  blockExplorerUrls: ["https://testnet.mstscan.com"],
};

export async function connectWallet() {
  if (!window.ethereum) throw new Error("BridgeKey not installed");

  // Request accounts
  await window.ethereum.request({ method: "eth_requestAccounts" });

  // Switch / add MST Testnet
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MST_TESTNET.chainId }],
    });
  } catch (err: any) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [MST_TESTNET],
      });
    } else throw err;
  }

  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const balance = await provider.getBalance(address);

  return { provider, signer, address, balance };
}
```

---

## Contract Hook

After deploying, replace `CONTRACT_ADDRESS` with the value in `deployments/mst-testnet.json`.

```typescript
// src/hooks/useRentalEscrow.ts
import { ethers, BrowserProvider, Contract } from "ethers";
import ABI from "../../blockchain/artifacts/contracts/RentalEscrow.sol/RentalEscrow.json";

const CONTRACT_ADDRESS = "<address from deployments/mst-testnet.json>";

export function useRentalEscrow(signer: ethers.Signer) {
  return new Contract(CONTRACT_ADDRESS, ABI.abi, signer);
}
```

---

## Contract Function Signatures

### Write Functions (require wallet approval)

```typescript
// Create rental (called by item owner)
createRental(
  renter: string,           // renter wallet address
  itemRef: string,          // your internal item ID
  rentAmount: bigint,       // in wei  (use ethers.parseEther)
  depositAmount: bigint,    // in wei
  durationSeconds: bigint   // rental period
): Promise<ContractTransaction>

// Book and lock funds (called by renter, msg.value = rent + deposit)
bookAndDeposit(rentalId: bigint): Promise<ContractTransaction>
// Pass value: { value: rentAmount + depositAmount }

// Confirm handover (called by both parties separately)
confirmHandover(rentalId: bigint): Promise<ContractTransaction>

// Confirm return (called by both parties separately)
confirmReturn(rentalId: bigint): Promise<ContractTransaction>

// Raise dispute (Active or Returning state)
raiseDispute(rentalId: bigint): Promise<ContractTransaction>

// Cancel before booking (owner only)
cancelBeforeBooking(rentalId: bigint): Promise<ContractTransaction>

// Cancel after booking, pre-handover (owner anytime, renter after 3d timeout)
cancelAfterBooking(rentalId: bigint): Promise<ContractTransaction>

// Safety refund after 7-day handover timeout
timeoutRefund(rentalId: bigint): Promise<ContractTransaction>
```

### Read Functions (free)

```typescript
getRental(rentalId: bigint): Promise<RentalStruct>
getRentalState(rentalId: bigint): Promise<number>  // maps to RentalState enum
totalRentals(): Promise<bigint>
contractBalance(): Promise<bigint>
```

---

## State Enum

```typescript
enum RentalState {
  Created = 0,
  Booked = 1,
  Active = 2,
  Returning = 3,
  Settled = 4,
  Cancelled = 5,
  Disputed = 6,
}
```

---

## Listening to Events

```typescript
contract.on("RentalCreated", (rentalId, owner, renter, itemRef, rent, deposit, duration) => {
  console.log(`Rental ${rentalId} created`);
});

contract.on("FundsDeposited", (rentalId, renter, total) => {
  console.log(`Funds locked: ${ethers.formatEther(total)} tMSTC`);
});

contract.on("RentalSettled", (rentalId, owner, renter, rent, deposit) => {
  console.log(`Rental ${rentalId} settled`);
});
```

---

## Frontend Workflow (Happy Path)

```
1. connectWallet()                          → verify chain ID === 4545
2. owner.createRental(renter, itemRef, ...) → tx confirmed → get rentalId from event
3. renter.bookAndDeposit(rentalId, {value}) → funds locked
4. owner.confirmHandover(rentalId)          → handover step 1
5. renter.confirmHandover(rentalId)         → rental goes Active
6. [rental period elapses]
7. renter.confirmReturn(rentalId)           → return step 1
8. owner.confirmReturn(rentalId)            → auto-settlement triggered
9. Listen for RentalSettled event           → show confirmed tx hash
```

> **Never mark a transaction successful before `tx.wait()` resolves.**

---

## Payment Notes

- `tMSTC` is the native gas token on MST Testnet — no ERC-20 approval needed.
- Use `ethers.parseEther("1")` to convert human-readable amounts to wei.
- Display balances with `ethers.formatEther(balance)`.
- Get testnet tokens at: https://faucet.masterstroke.academy

---

## ABI & Address Location

After deployment:
- **ABI**: `blockchain/artifacts/contracts/RentalEscrow.sol/RentalEscrow.json`
- **Address + network info**: `blockchain/deployments/mst-testnet.json`
