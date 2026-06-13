// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EnergyTrade
 * @notice Escrow-based settlement for peer-to-peer energy trades.
 *
 * Flow:
 *   1. Buyer calls createTrade(seller, units, pricePerUnit) sending units*pricePerUnit wei.
 *      Funds are held in escrow by this contract.
 *   2. Seller (or an authorized oracle) calls confirmTrade(id) once energy is delivered.
 *   3. Anyone calls releasePayment(id) to transfer the escrowed funds to the seller.
 *      (Only callable after confirmation.)
 *   4. If never confirmed, the buyer can cancelTrade(id) to refund the escrow.
 */
contract EnergyTrade {
    enum Status { Created, Confirmed, Paid, Cancelled }

    struct Trade {
        uint256 id;
        address buyer;
        address seller;
        uint256 units;          // energy units (e.g. integer kWh)
        uint256 pricePerUnit;   // wei per unit
        uint256 amount;         // total escrowed wei (units * pricePerUnit)
        Status status;
        uint256 createdAt;
    }

    uint256 public nextTradeId;
    mapping(uint256 => Trade) public trades;

    event TradeCreated(
        uint256 indexed id,
        address indexed buyer,
        address indexed seller,
        uint256 units,
        uint256 pricePerUnit,
        uint256 amount
    );
    event TradeConfirmed(uint256 indexed id);
    event PaymentReleased(uint256 indexed id, address indexed seller, uint256 amount);
    event TradeCancelled(uint256 indexed id);

    modifier tradeExists(uint256 id) {
        require(trades[id].buyer != address(0), "Trade does not exist");
        _;
    }

    /**
     * @notice Buyer creates a trade and escrows payment.
     * @dev msg.value must equal units * pricePerUnit.
     */
    function createTrade(
        address seller,
        uint256 units,
        uint256 pricePerUnit
    ) external payable returns (uint256) {
        require(seller != address(0), "Invalid seller");
        require(seller != msg.sender, "Buyer cannot be seller");
        require(units > 0, "Units must be > 0");
        require(pricePerUnit > 0, "Price must be > 0");

        uint256 amount = units * pricePerUnit;
        require(msg.value == amount, "Incorrect escrow amount");

        uint256 id = nextTradeId++;
        trades[id] = Trade({
            id: id,
            buyer: msg.sender,
            seller: seller,
            units: units,
            pricePerUnit: pricePerUnit,
            amount: amount,
            status: Status.Created,
            createdAt: block.timestamp
        });

        emit TradeCreated(id, msg.sender, seller, units, pricePerUnit, amount);
        return id;
    }

    /**
     * @notice Seller confirms energy delivery.
     */
    function confirmTrade(uint256 id) external tradeExists(id) {
        Trade storage t = trades[id];
        require(msg.sender == t.seller, "Only seller can confirm");
        require(t.status == Status.Created, "Trade not in Created state");

        t.status = Status.Confirmed;
        emit TradeConfirmed(id);
    }

    /**
     * @notice Release escrowed funds to the seller after confirmation.
     */
    function releasePayment(uint256 id) external tradeExists(id) {
        Trade storage t = trades[id];
        require(t.status == Status.Confirmed, "Trade not confirmed");

        t.status = Status.Paid;
        uint256 amount = t.amount;

        (bool ok, ) = payable(t.seller).call{value: amount}("");
        require(ok, "Payment transfer failed");

        emit PaymentReleased(id, t.seller, amount);
    }

    /**
     * @notice Buyer cancels an unconfirmed trade and is refunded the escrow.
     */
    function cancelTrade(uint256 id) external tradeExists(id) {
        Trade storage t = trades[id];
        require(msg.sender == t.buyer, "Only buyer can cancel");
        require(t.status == Status.Created, "Can only cancel Created trades");

        t.status = Status.Cancelled;
        uint256 amount = t.amount;

        (bool ok, ) = payable(t.buyer).call{value: amount}("");
        require(ok, "Refund transfer failed");

        emit TradeCancelled(id);
    }

    /**
     * @notice Read a trade's full state.
     */
    function getTrade(uint256 id)
        external
        view
        tradeExists(id)
        returns (
            uint256 tradeId,
            address buyer,
            address seller,
            uint256 units,
            uint256 pricePerUnit,
            uint256 amount,
            Status status,
            uint256 createdAt
        )
    {
        Trade storage t = trades[id];
        return (t.id, t.buyer, t.seller, t.units, t.pricePerUnit, t.amount, t.status, t.createdAt);
    }
}
