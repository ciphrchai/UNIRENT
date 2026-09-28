// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RentalEscrow
 * @notice Escrow contract for UniRent student-to-student item rentals.
 * @dev Manages rent payment + security deposit lockup, dual confirmations,
 *      settlement, disputes, cancellations, and timeouts.
 *
 * DISPUTE RESOLUTION LIMITATION:
 * On-chain dispute resolution is intentionally minimal. The platform admin
 * (contract owner) resolves disputes off-chain and then calls resolveDispute()
 * to release funds. Full decentralised arbitration is out of scope for MVP.
 */
contract RentalEscrow is ReentrancyGuard, Ownable {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum RentalState {
        Created,      // Agreement created by owner
        Booked,       // Renter deposited funds
        Active,       // Both parties confirmed handover
        Returning,    // Both parties confirmed return – awaiting settlement
        Settled,      // Rent paid to owner, deposit refunded to renter
        Cancelled,    // Cancelled before handover
        Disputed      // Dispute raised – funds frozen
    }

    struct Rental {
        uint256 id;
        address payable owner;       // item owner
        address payable renter;      // item renter
        string  itemRef;             // off-chain item reference (UUID / slug)
        uint256 rentAmount;          // in wei
        uint256 depositAmount;       // in wei
        uint256 durationSeconds;     // agreed rental period
        uint256 bookedAt;            // timestamp when funds were deposited
        RentalState state;
        bool ownerHandoverConfirmed;
        bool renterHandoverConfirmed;
        bool ownerReturnConfirmed;
        bool renterReturnConfirmed;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    uint256 private _rentalCounter;

    /// @dev rentalId => Rental
    mapping(uint256 => Rental) public rentals;

    /// Timeout after which renter can cancel and get a refund if handover was
    /// never both-confirmed (e.g. 7 days).
    uint256 public constant HANDOVER_TIMEOUT = 7 days;

    /// Timeout after Booked with no handover from owner side (safety valve).
    uint256 public constant BOOKING_TIMEOUT = 3 days;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event RentalCreated(
        uint256 indexed rentalId,
        address indexed owner,
        address indexed renter,
        string  itemRef,
        uint256 rentAmount,
        uint256 depositAmount,
        uint256 durationSeconds
    );

    event FundsDeposited(
        uint256 indexed rentalId,
        address indexed renter,
        uint256 totalDeposited
    );

    event HandoverConfirmed(
        uint256 indexed rentalId,
        address indexed confirmedBy,
        bool ownerConfirmed,
        bool renterConfirmed
    );

    event ReturnConfirmed(
        uint256 indexed rentalId,
        address indexed confirmedBy,
        bool ownerConfirmed,
        bool renterConfirmed
    );

    event RentalSettled(
        uint256 indexed rentalId,
        address indexed owner,
        address indexed renter,
        uint256 rentPaid,
        uint256 depositRefunded
    );

    event RentalCancelled(
        uint256 indexed rentalId,
        address indexed cancelledBy,
        uint256 refundAmount
    );

    event DisputeRaised(
        uint256 indexed rentalId,
        address indexed raisedBy
    );

    event DisputeResolved(
        uint256 indexed rentalId,
        address indexed resolvedBy,
        address rentRecipient,
        address depositRecipient
    );

    event RefundIssued(
        uint256 indexed rentalId,
        address indexed recipient,
        uint256 amount
    );

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyParty(uint256 rentalId) {
        Rental storage r = rentals[rentalId];
        require(
            msg.sender == r.owner || msg.sender == r.renter,
            "Not a party to this rental"
        );
        _;
    }

    modifier inState(uint256 rentalId, RentalState expected) {
        require(rentals[rentalId].state == expected, "Invalid state");
        _;
    }

    modifier rentalExists(uint256 rentalId) {
        require(rentals[rentalId].id != 0, "Rental does not exist");
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() Ownable(msg.sender) {}

    // -------------------------------------------------------------------------
    // A. Create Rental
    // -------------------------------------------------------------------------

    /**
     * @notice Item owner creates a rental agreement for a specific renter.
     * @param renter      Wallet address of the renter.
     * @param itemRef     Off-chain item identifier (no PII).
     * @param rentAmount  Rent in wei.
     * @param depositAmount Security deposit in wei.
     * @param durationSeconds Agreed rental period in seconds.
     * @return rentalId   Unique ID for this rental.
     */
    function createRental(
        address payable renter,
        string calldata itemRef,
        uint256 rentAmount,
        uint256 depositAmount,
        uint256 durationSeconds
    ) external returns (uint256 rentalId) {
        require(renter != address(0), "Invalid renter address");
        require(renter != msg.sender, "Owner cannot be renter");
        require(rentAmount > 0, "Rent must be > 0");
        require(durationSeconds > 0, "Duration must be > 0");
        require(bytes(itemRef).length > 0, "Item ref required");

        _rentalCounter++;
        rentalId = _rentalCounter;

        rentals[rentalId] = Rental({
            id: rentalId,
            owner: payable(msg.sender),
            renter: renter,
            itemRef: itemRef,
            rentAmount: rentAmount,
            depositAmount: depositAmount,
            durationSeconds: durationSeconds,
            bookedAt: 0,
            state: RentalState.Created,
            ownerHandoverConfirmed: false,
            renterHandoverConfirmed: false,
            ownerReturnConfirmed: false,
            renterReturnConfirmed: false
        });

        emit RentalCreated(
            rentalId,
            msg.sender,
            renter,
            itemRef,
            rentAmount,
            depositAmount,
            durationSeconds
        );
    }

    // -------------------------------------------------------------------------
    // B. Book & Escrow
    // -------------------------------------------------------------------------

    /**
     * @notice Renter deposits rent + security deposit to lock the agreement.
     * @dev msg.value must equal rentAmount + depositAmount exactly.
     */
    function bookAndDeposit(uint256 rentalId)
        external
        payable
        nonReentrant
        rentalExists(rentalId)
        inState(rentalId, RentalState.Created)
    {
        Rental storage r = rentals[rentalId];
        require(msg.sender == r.renter, "Only the designated renter can book");
        uint256 required = r.rentAmount + r.depositAmount;
        require(msg.value == required, "Incorrect deposit amount");

        r.state = RentalState.Booked;
        r.bookedAt = block.timestamp;

        emit FundsDeposited(rentalId, msg.sender, msg.value);
    }

    // -------------------------------------------------------------------------
    // C. Handover Confirmation
    // -------------------------------------------------------------------------

    /**
     * @notice Both parties must confirm item handover for rental to go Active.
     */
    function confirmHandover(uint256 rentalId)
        external
        rentalExists(rentalId)
        inState(rentalId, RentalState.Booked)
        onlyParty(rentalId)
    {
        Rental storage r = rentals[rentalId];

        if (msg.sender == r.owner) {
            require(!r.ownerHandoverConfirmed, "Already confirmed");
            r.ownerHandoverConfirmed = true;
        } else {
            require(!r.renterHandoverConfirmed, "Already confirmed");
            r.renterHandoverConfirmed = true;
        }

        emit HandoverConfirmed(
            rentalId,
            msg.sender,
            r.ownerHandoverConfirmed,
            r.renterHandoverConfirmed
        );

        if (r.ownerHandoverConfirmed && r.renterHandoverConfirmed) {
            r.state = RentalState.Active;
        }
    }

    // -------------------------------------------------------------------------
    // D. Return Confirmation
    // -------------------------------------------------------------------------

    /**
     * @notice Both parties must confirm return to trigger settlement.
     */
    function confirmReturn(uint256 rentalId)
        external
        rentalExists(rentalId)
        inState(rentalId, RentalState.Active)
        onlyParty(rentalId)
    {
        Rental storage r = rentals[rentalId];

        if (msg.sender == r.owner) {
            require(!r.ownerReturnConfirmed, "Already confirmed");
            r.ownerReturnConfirmed = true;
        } else {
            require(!r.renterReturnConfirmed, "Already confirmed");
            r.renterReturnConfirmed = true;
        }

        emit ReturnConfirmed(
            rentalId,
            msg.sender,
            r.ownerReturnConfirmed,
            r.renterReturnConfirmed
        );

        if (r.ownerReturnConfirmed && r.renterReturnConfirmed) {
            r.state = RentalState.Returning;
            _settle(rentalId);
        }
    }

    // -------------------------------------------------------------------------
    // E. Settlement (internal)
    // -------------------------------------------------------------------------

    function _settle(uint256 rentalId) internal nonReentrant {
        Rental storage r = rentals[rentalId];
        require(r.state == RentalState.Returning, "Not in returning state");

        // Checks-Effects-Interactions
        r.state = RentalState.Settled;

        uint256 rent = r.rentAmount;
        uint256 deposit = r.depositAmount;
        address payable ownerAddr = r.owner;
        address payable renterAddr = r.renter;

        emit RentalSettled(rentalId, ownerAddr, renterAddr, rent, deposit);

        // Transfer rent to owner
        (bool sentOwner,) = ownerAddr.call{value: rent}("");
        require(sentOwner, "Owner transfer failed");

        // Return deposit to renter
        if (deposit > 0) {
            (bool sentRenter,) = renterAddr.call{value: deposit}("");
            require(sentRenter, "Renter deposit refund failed");
        }
    }

    // -------------------------------------------------------------------------
    // F. Disputes
    // -------------------------------------------------------------------------

    /**
     * @notice Either party raises a dispute, freezing escrow settlement.
     * @dev Only callable when rental is Active or Returning.
     */
    function raiseDispute(uint256 rentalId)
        external
        rentalExists(rentalId)
        onlyParty(rentalId)
    {
        Rental storage r = rentals[rentalId];
        require(
            r.state == RentalState.Active || r.state == RentalState.Returning,
            "Can only dispute active or returning rentals"
        );

        r.state = RentalState.Disputed;
        emit DisputeRaised(rentalId, msg.sender);
    }

    /**
     * @notice Platform admin resolves a dispute by specifying fund recipients.
     * @dev Off-chain evidence is evaluated externally; this function executes
     *      the resolution on-chain after admin decision.
     * @param rentRecipient    Address that receives the rent portion.
     * @param depositRecipient Address that receives the deposit portion.
     */
    function resolveDispute(
        uint256 rentalId,
        address payable rentRecipient,
        address payable depositRecipient
    )
        external
        onlyOwner
        rentalExists(rentalId)
        inState(rentalId, RentalState.Disputed)
        nonReentrant
    {
        require(rentRecipient != address(0), "Invalid rent recipient");
        require(depositRecipient != address(0), "Invalid deposit recipient");

        Rental storage r = rentals[rentalId];

        // Checks-Effects-Interactions
        r.state = RentalState.Settled;

        uint256 rent = r.rentAmount;
        uint256 deposit = r.depositAmount;

        emit DisputeResolved(rentalId, msg.sender, rentRecipient, depositRecipient);

        if (rent > 0) {
            (bool ok1,) = rentRecipient.call{value: rent}("");
            require(ok1, "Rent transfer failed");
            emit RefundIssued(rentalId, rentRecipient, rent);
        }

        if (deposit > 0) {
            (bool ok2,) = depositRecipient.call{value: deposit}("");
            require(ok2, "Deposit transfer failed");
            emit RefundIssued(rentalId, depositRecipient, deposit);
        }
    }

    // -------------------------------------------------------------------------
    // G. Cancellation & Timeouts
    // -------------------------------------------------------------------------

    /**
     * @notice Cancel a rental that has not yet been booked (before deposit).
     *         Only the owner can cancel a Created rental.
     */
    function cancelBeforeBooking(uint256 rentalId)
        external
        rentalExists(rentalId)
        inState(rentalId, RentalState.Created)
    {
        Rental storage r = rentals[rentalId];
        require(msg.sender == r.owner, "Only owner can cancel before booking");

        r.state = RentalState.Cancelled;
        emit RentalCancelled(rentalId, msg.sender, 0);
    }

    /**
     * @notice Cancel after booking but before handover is fully confirmed.
     *         Either party can cancel; renter gets full refund.
     *         After BOOKING_TIMEOUT the renter can always cancel for safety.
     */
    function cancelAfterBooking(uint256 rentalId)
        external
        rentalExists(rentalId)
        inState(rentalId, RentalState.Booked)
        onlyParty(rentalId)
        nonReentrant
    {
        Rental storage r = rentals[rentalId];

        // Owner can cancel any time pre-handover; renter can cancel if timeout
        if (msg.sender == r.renter) {
            require(
                block.timestamp >= r.bookedAt + BOOKING_TIMEOUT,
                "Renter must wait for booking timeout to cancel"
            );
        }
        // Owner can cancel immediately pre-handover (item no longer available)

        uint256 refund = r.rentAmount + r.depositAmount;
        r.state = RentalState.Cancelled;

        emit RentalCancelled(rentalId, msg.sender, refund);
        emit RefundIssued(rentalId, r.renter, refund);

        (bool ok,) = r.renter.call{value: refund}("");
        require(ok, "Refund transfer failed");
    }

    /**
     * @notice Safety timeout: if handover never fully confirmed after
     *         HANDOVER_TIMEOUT, either party can trigger a full refund.
     */
    function timeoutRefund(uint256 rentalId)
        external
        rentalExists(rentalId)
        inState(rentalId, RentalState.Booked)
        onlyParty(rentalId)
        nonReentrant
    {
        Rental storage r = rentals[rentalId];
        require(
            block.timestamp >= r.bookedAt + HANDOVER_TIMEOUT,
            "Handover timeout not reached"
        );

        uint256 refund = r.rentAmount + r.depositAmount;
        r.state = RentalState.Cancelled;

        emit RentalCancelled(rentalId, msg.sender, refund);
        emit RefundIssued(rentalId, r.renter, refund);

        (bool ok,) = r.renter.call{value: refund}("");
        require(ok, "Timeout refund failed");
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getRental(uint256 rentalId)
        external
        view
        returns (Rental memory)
    {
        return rentals[rentalId];
    }

    function getRentalState(uint256 rentalId)
        external
        view
        rentalExists(rentalId)
        returns (RentalState)
    {
        return rentals[rentalId].state;
    }

    function totalRentals() external view returns (uint256) {
        return _rentalCounter;
    }

    /// @notice Emergency view: contract balance (should equal sum of escrowed funds).
    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
