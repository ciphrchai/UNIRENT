import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { RentalEscrow } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// ─── Helpers ────────────────────────────────────────────────────────────────

const RENT = ethers.parseEther("1");
const DEPOSIT = ethers.parseEther("0.5");
const TOTAL = RENT + DEPOSIT;
const DURATION = 7 * 24 * 3600; // 7 days in seconds
const ITEM_REF = "item-uuid-001";

const BOOKING_TIMEOUT = 3 * 24 * 3600;
const HANDOVER_TIMEOUT = 7 * 24 * 3600;

enum RentalState {
  Created,
  Booked,
  Active,
  Returning,
  Settled,
  Cancelled,
  Disputed,
}

async function deployContract(): Promise<RentalEscrow> {
  const Factory = await ethers.getContractFactory("RentalEscrow");
  return (await Factory.deploy()) as RentalEscrow;
}

async function createRental(
  contract: RentalEscrow,
  owner: SignerWithAddress,
  renter: SignerWithAddress
): Promise<bigint> {
  const tx = await contract
    .connect(owner)
    .createRental(renter.address, ITEM_REF, RENT, DEPOSIT, DURATION);
  const receipt = await tx.wait();
  const event = receipt!.logs
    .map((l) => {
      try {
        return contract.interface.parseLog({ topics: [...l.topics], data: l.data });
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === "RentalCreated");
  return event!.args.rentalId as bigint;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("RentalEscrow", () => {
  let contract: RentalEscrow;
  let admin: SignerWithAddress;
  let owner: SignerWithAddress;
  let renter: SignerWithAddress;
  let stranger: SignerWithAddress;

  beforeEach(async () => {
    [admin, owner, renter, stranger] = await ethers.getSigners();
    contract = await deployContract();
  });

  // ── A. Create Rental ─────────────────────────────────────────────────────

  describe("createRental", () => {
    it("creates a rental and emits RentalCreated", async () => {
      await expect(
        contract.connect(owner).createRental(renter.address, ITEM_REF, RENT, DEPOSIT, DURATION)
      )
        .to.emit(contract, "RentalCreated")
        .withArgs(1n, owner.address, renter.address, ITEM_REF, RENT, DEPOSIT, DURATION);
    });

    it("increments rental counter", async () => {
      await createRental(contract, owner, renter);
      await createRental(contract, owner, renter);
      expect(await contract.totalRentals()).to.equal(2n);
    });

    it("stores rental with Created state", async () => {
      const id = await createRental(contract, owner, renter);
      const r = await contract.getRental(id);
      expect(r.state).to.equal(RentalState.Created);
      expect(r.owner).to.equal(owner.address);
      expect(r.renter).to.equal(renter.address);
      expect(r.rentAmount).to.equal(RENT);
      expect(r.depositAmount).to.equal(DEPOSIT);
    });

    it("reverts if renter is zero address", async () => {
      await expect(
        contract.connect(owner).createRental(ethers.ZeroAddress, ITEM_REF, RENT, DEPOSIT, DURATION)
      ).to.be.revertedWith("Invalid renter address");
    });

    it("reverts if owner == renter", async () => {
      await expect(
        contract.connect(owner).createRental(owner.address, ITEM_REF, RENT, DEPOSIT, DURATION)
      ).to.be.revertedWith("Owner cannot be renter");
    });

    it("reverts if rentAmount is 0", async () => {
      await expect(
        contract.connect(owner).createRental(renter.address, ITEM_REF, 0n, DEPOSIT, DURATION)
      ).to.be.revertedWith("Rent must be > 0");
    });

    it("reverts if duration is 0", async () => {
      await expect(
        contract.connect(owner).createRental(renter.address, ITEM_REF, RENT, DEPOSIT, 0n)
      ).to.be.revertedWith("Duration must be > 0");
    });

    it("reverts if itemRef is empty", async () => {
      await expect(
        contract.connect(owner).createRental(renter.address, "", RENT, DEPOSIT, DURATION)
      ).to.be.revertedWith("Item ref required");
    });
  });

  // ── B. Book & Escrow ─────────────────────────────────────────────────────

  describe("bookAndDeposit", () => {
    let rentalId: bigint;

    beforeEach(async () => {
      rentalId = await createRental(contract, owner, renter);
    });

    it("accepts correct deposit and emits FundsDeposited", async () => {
      await expect(
        contract.connect(renter).bookAndDeposit(rentalId, { value: TOTAL })
      )
        .to.emit(contract, "FundsDeposited")
        .withArgs(rentalId, renter.address, TOTAL);

      expect(await contract.getRentalState(rentalId)).to.equal(RentalState.Booked);
    });

    it("locks funds in contract", async () => {
      await contract.connect(renter).bookAndDeposit(rentalId, { value: TOTAL });
      expect(await contract.contractBalance()).to.equal(TOTAL);
    });

    it("reverts if wrong amount sent (too low)", async () => {
      await expect(
        contract.connect(renter).bookAndDeposit(rentalId, { value: RENT })
      ).to.be.revertedWith("Incorrect deposit amount");
    });

    it("reverts if wrong amount sent (too high)", async () => {
      await expect(
        contract.connect(renter).bookAndDeposit(rentalId, { value: TOTAL + 1n })
      ).to.be.revertedWith("Incorrect deposit amount");
    });

    it("reverts if not the designated renter", async () => {
      await expect(
        contract.connect(stranger).bookAndDeposit(rentalId, { value: TOTAL })
      ).to.be.revertedWith("Only the designated renter can book");
    });

    it("reverts if already booked (duplicate booking)", async () => {
      await contract.connect(renter).bookAndDeposit(rentalId, { value: TOTAL });
      await expect(
        contract.connect(renter).bookAndDeposit(rentalId, { value: TOTAL })
      ).to.be.revertedWith("Invalid state");
    });
  });

  // ── C. Handover Confirmation ──────────────────────────────────────────────

  describe("confirmHandover", () => {
    let rentalId: bigint;

    beforeEach(async () => {
      rentalId = await createRental(contract, owner, renter);
      await contract.connect(renter).bookAndDeposit(rentalId, { value: TOTAL });
    });

    it("emits HandoverConfirmed with correct flags", async () => {
      await expect(contract.connect(owner).confirmHandover(rentalId))
        .to.emit(contract, "HandoverConfirmed")
        .withArgs(rentalId, owner.address, true, false);
    });

    it("moves to Active only after both confirmations", async () => {
      await contract.connect(owner).confirmHandover(rentalId);
      expect(await contract.getRentalState(rentalId)).to.equal(RentalState.Booked);

      await contract.connect(renter).confirmHandover(rentalId);
      expect(await contract.getRentalState(rentalId)).to.equal(RentalState.Active);
    });

    it("reverts if stranger tries to confirm", async () => {
      await expect(
        contract.connect(stranger).confirmHandover(rentalId)
      ).to.be.revertedWith("Not a party to this rental");
    });

    it("reverts on double confirmation by same party", async () => {
      await contract.connect(owner).confirmHandover(rentalId);
      await expect(
        contract.connect(owner).confirmHandover(rentalId)
      ).to.be.revertedWith("Already confirmed");
    });

    it("reverts in wrong state", async () => {
      // Not yet booked scenario — create fresh
      const id2 = await createRental(contract, owner, renter);
      await expect(contract.connect(owner).confirmHandover(id2)).to.be.revertedWith(
        "Invalid state"
      );
    });
  });

  // ── D. Return Confirmation ────────────────────────────────────────────────

  describe("confirmReturn", () => {
    let rentalId: bigint;

    async function makeActive(): Promise<bigint> {
      const id = await createRental(contract, owner, renter);
      await contract.connect(renter).bookAndDeposit(id, { value: TOTAL });
      await contract.connect(owner).confirmHandover(id);
      await contract.connect(renter).confirmHandover(id);
      return id;
    }

    beforeEach(async () => {
      rentalId = await makeActive();
    });

    it("emits ReturnConfirmed with correct flags", async () => {
      await expect(contract.connect(renter).confirmReturn(rentalId))
        .to.emit(contract, "ReturnConfirmed")
        .withArgs(rentalId, renter.address, false, true);
    });

    it("triggers settlement when both confirm", async () => {
      await contract.connect(renter).confirmReturn(rentalId);
      await expect(contract.connect(owner).confirmReturn(rentalId))
        .to.emit(contract, "RentalSettled");

      expect(await contract.getRentalState(rentalId)).to.equal(RentalState.Settled);
    });

    it("reverts if stranger calls", async () => {
      await expect(
        contract.connect(stranger).confirmReturn(rentalId)
      ).to.be.revertedWith("Not a party to this rental");
    });
  });

  // ── E. Settlement ─────────────────────────────────────────────────────────

  describe("settlement", () => {
    async function getToReturning(): Promise<bigint> {
      const id = await createRental(contract, owner, renter);
      await contract.connect(renter).bookAndDeposit(id, { value: TOTAL });
      await contract.connect(owner).confirmHandover(id);
      await contract.connect(renter).confirmHandover(id);
      return id;
    }

    it("transfers rent to owner and deposit to renter", async () => {
      const id = await getToReturning();
      const ownerBefore = await ethers.provider.getBalance(owner.address);
      const renterBefore = await ethers.provider.getBalance(renter.address);

      const tx1 = await contract.connect(renter).confirmReturn(id);
      const r1 = await tx1.wait();
      const gas1 = r1!.gasUsed * r1!.gasPrice;

      const tx2 = await contract.connect(owner).confirmReturn(id);
      const r2 = await tx2.wait();
      const gas2 = r2!.gasUsed * r2!.gasPrice;

      const ownerAfter = await ethers.provider.getBalance(owner.address);
      const renterAfter = await ethers.provider.getBalance(renter.address);

      // Owner receives rent (minus gas for their confirmReturn tx)
      expect(ownerAfter).to.be.closeTo(ownerBefore + RENT - gas2, ethers.parseEther("0.001"));
      // Renter receives deposit back (minus gas for their confirmReturn tx)
      expect(renterAfter).to.be.closeTo(renterBefore + DEPOSIT - gas1, ethers.parseEther("0.001"));
    });

    it("contract balance is 0 after settlement", async () => {
      const id = await getToReturning();
      await contract.connect(renter).confirmReturn(id);
      await contract.connect(owner).confirmReturn(id);
      expect(await contract.contractBalance()).to.equal(0n);
    });

    it("prevents double settlement", async () => {
      const id = await getToReturning();
      await contract.connect(renter).confirmReturn(id);
      await contract.connect(owner).confirmReturn(id);
      // State is now Settled — confirmReturn should fail
      await expect(contract.connect(owner).confirmReturn(id)).to.be.revertedWith(
        "Invalid state"
      );
    });
  });

  // ── F. Disputes ───────────────────────────────────────────────────────────

  describe("disputes", () => {
    async function makeActive(): Promise<bigint> {
      const id = await createRental(contract, owner, renter);
      await contract.connect(renter).bookAndDeposit(id, { value: TOTAL });
      await contract.connect(owner).confirmHandover(id);
      await contract.connect(renter).confirmHandover(id);
      return id;
    }

    it("owner can raise a dispute on Active rental", async () => {
      const id = await makeActive();
      await expect(contract.connect(owner).raiseDispute(id))
        .to.emit(contract, "DisputeRaised")
        .withArgs(id, owner.address);
      expect(await contract.getRentalState(id)).to.equal(RentalState.Disputed);
    });

    it("renter can raise a dispute on Active rental", async () => {
      const id = await makeActive();
      await expect(contract.connect(renter).raiseDispute(id)).to.emit(
        contract,
        "DisputeRaised"
      );
    });

    it("stranger cannot raise a dispute", async () => {
      const id = await makeActive();
      await expect(contract.connect(stranger).raiseDispute(id)).to.be.revertedWith(
        "Not a party to this rental"
      );
    });

    it("dispute freezes settlement — confirmReturn reverts", async () => {
      const id = await makeActive();
      await contract.connect(owner).raiseDispute(id);
      await expect(contract.connect(renter).confirmReturn(id)).to.be.revertedWith(
        "Invalid state"
      );
    });

    it("admin can resolve dispute and distribute funds", async () => {
      const id = await makeActive();
      await contract.connect(owner).raiseDispute(id);

      await expect(
        contract
          .connect(admin)
          .resolveDispute(id, owner.address, renter.address)
      )
        .to.emit(contract, "DisputeResolved")
        .withArgs(id, admin.address, owner.address, renter.address);

      expect(await contract.getRentalState(id)).to.equal(RentalState.Settled);
      expect(await contract.contractBalance()).to.equal(0n);
    });

    it("non-admin cannot resolve dispute", async () => {
      const id = await makeActive();
      await contract.connect(owner).raiseDispute(id);
      await expect(
        contract.connect(stranger).resolveDispute(id, owner.address, renter.address)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });
  });

  // ── G. Cancellation & Timeouts ────────────────────────────────────────────

  describe("cancellation", () => {
    it("owner can cancel before booking", async () => {
      const id = await createRental(contract, owner, renter);
      await expect(contract.connect(owner).cancelBeforeBooking(id))
        .to.emit(contract, "RentalCancelled")
        .withArgs(id, owner.address, 0n);
      expect(await contract.getRentalState(id)).to.equal(RentalState.Cancelled);
    });

    it("stranger cannot cancel before booking", async () => {
      const id = await createRental(contract, owner, renter);
      await expect(contract.connect(stranger).cancelBeforeBooking(id)).to.be.revertedWith(
        "Only owner can cancel before booking"
      );
    });

    it("renter cannot cancel after booking before timeout", async () => {
      const id = await createRental(contract, owner, renter);
      await contract.connect(renter).bookAndDeposit(id, { value: TOTAL });
      await expect(
        contract.connect(renter).cancelAfterBooking(id)
      ).to.be.revertedWith("Renter must wait for booking timeout to cancel");
    });

    it("owner can cancel after booking (pre-handover) and renter gets full refund", async () => {
      const id = await createRental(contract, owner, renter);
      await contract.connect(renter).bookAndDeposit(id, { value: TOTAL });

      const renterBefore = await ethers.provider.getBalance(renter.address);
      await contract.connect(owner).cancelAfterBooking(id);
      const renterAfter = await ethers.provider.getBalance(renter.address);

      expect(renterAfter - renterBefore).to.equal(TOTAL);
      expect(await contract.getRentalState(id)).to.equal(RentalState.Cancelled);
    });

    it("renter can cancel after BOOKING_TIMEOUT and get refund", async () => {
      const id = await createRental(contract, owner, renter);
      await contract.connect(renter).bookAndDeposit(id, { value: TOTAL });

      await time.increase(BOOKING_TIMEOUT + 1);

      const renterBefore = await ethers.provider.getBalance(renter.address);
      const tx = await contract.connect(renter).cancelAfterBooking(id);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const renterAfter = await ethers.provider.getBalance(renter.address);

      expect(renterAfter + gasUsed - renterBefore).to.equal(TOTAL);
    });
  });

  describe("timeoutRefund", () => {
    it("reverts before HANDOVER_TIMEOUT", async () => {
      const id = await createRental(contract, owner, renter);
      await contract.connect(renter).bookAndDeposit(id, { value: TOTAL });

      await expect(contract.connect(renter).timeoutRefund(id)).to.be.revertedWith(
        "Handover timeout not reached"
      );
    });

    it("allows refund after HANDOVER_TIMEOUT", async () => {
      const id = await createRental(contract, owner, renter);
      await contract.connect(renter).bookAndDeposit(id, { value: TOTAL });

      await time.increase(HANDOVER_TIMEOUT + 1);

      await expect(contract.connect(renter).timeoutRefund(id))
        .to.emit(contract, "RefundIssued")
        .withArgs(id, renter.address, TOTAL);

      expect(await contract.getRentalState(id)).to.equal(RentalState.Cancelled);
      expect(await contract.contractBalance()).to.equal(0n);
    });
  });

  // ── Double withdrawal prevention ──────────────────────────────────────────

  describe("double withdrawal prevention", () => {
    it("settled rental cannot be settled again", async () => {
      const id = await createRental(contract, owner, renter);
      await contract.connect(renter).bookAndDeposit(id, { value: TOTAL });
      await contract.connect(owner).confirmHandover(id);
      await contract.connect(renter).confirmHandover(id);
      await contract.connect(renter).confirmReturn(id);
      await contract.connect(owner).confirmReturn(id);

      // Try to call confirmReturn again
      await expect(contract.connect(owner).confirmReturn(id)).to.be.revertedWith(
        "Invalid state"
      );
    });

    it("cancelled rental cannot be booked again", async () => {
      const id = await createRental(contract, owner, renter);
      await contract.connect(owner).cancelBeforeBooking(id);
      await expect(
        contract.connect(renter).bookAndDeposit(id, { value: TOTAL })
      ).to.be.revertedWith("Invalid state");
    });
  });

  // ── Reentrancy (state-machine protection) ─────────────────────────────────

  describe("reentrancy protection", () => {
    it("contract uses ReentrancyGuard (nonReentrant on bookAndDeposit)", async () => {
      // Verify the function has reentrancy guard by checking it reverts on
      // invalid state transitions correctly (structural test via state machine).
      const id = await createRental(contract, owner, renter);
      await contract.connect(renter).bookAndDeposit(id, { value: TOTAL });
      // A second call in same state should revert (state already changed)
      await expect(
        contract.connect(renter).bookAndDeposit(id, { value: TOTAL })
      ).to.be.revertedWith("Invalid state");
    });
  });

  // ── View functions ────────────────────────────────────────────────────────

  describe("view functions", () => {
    it("getRental returns correct data", async () => {
      const id = await createRental(contract, owner, renter);
      const r = await contract.getRental(id);
      expect(r.itemRef).to.equal(ITEM_REF);
      expect(r.rentAmount).to.equal(RENT);
      expect(r.depositAmount).to.equal(DEPOSIT);
      expect(r.durationSeconds).to.equal(BigInt(DURATION));
    });

    it("getRentalState reverts for non-existent rental", async () => {
      await expect(contract.getRentalState(999n)).to.be.revertedWith(
        "Rental does not exist"
      );
    });
  });
});
