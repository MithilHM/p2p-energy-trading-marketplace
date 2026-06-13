const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EnergyTrade", function () {
  let energyTrade, buyer, seller, other;
  const units = 20n;
  const pricePerUnit = ethers.parseUnits("1", "gwei"); // wei per unit
  const amount = units * pricePerUnit;

  beforeEach(async function () {
    [buyer, seller, other] = await ethers.getSigners();
    const EnergyTrade = await ethers.getContractFactory("EnergyTrade");
    energyTrade = await EnergyTrade.deploy();
    await energyTrade.waitForDeployment();
  });

  async function createTrade() {
    return energyTrade
      .connect(buyer)
      .createTrade(seller.address, units, pricePerUnit, { value: amount });
  }

  describe("createTrade", function () {
    it("creates a trade and escrows funds", async function () {
      await expect(createTrade())
        .to.emit(energyTrade, "TradeCreated")
        .withArgs(0, buyer.address, seller.address, units, pricePerUnit, amount);

      const t = await energyTrade.getTrade(0);
      expect(t.buyer).to.equal(buyer.address);
      expect(t.seller).to.equal(seller.address);
      expect(t.units).to.equal(units);
      expect(t.status).to.equal(0); // Created

      expect(await ethers.provider.getBalance(await energyTrade.getAddress())).to.equal(amount);
    });

    it("reverts when escrow amount is wrong", async function () {
      await expect(
        energyTrade
          .connect(buyer)
          .createTrade(seller.address, units, pricePerUnit, { value: amount - 1n })
      ).to.be.revertedWith("Incorrect escrow amount");
    });

    it("reverts when buyer equals seller", async function () {
      await expect(
        energyTrade
          .connect(buyer)
          .createTrade(buyer.address, units, pricePerUnit, { value: amount })
      ).to.be.revertedWith("Buyer cannot be seller");
    });
  });

  describe("confirmTrade", function () {
    it("lets the seller confirm", async function () {
      await createTrade();
      await expect(energyTrade.connect(seller).confirmTrade(0))
        .to.emit(energyTrade, "TradeConfirmed")
        .withArgs(0);
      expect((await energyTrade.getTrade(0)).status).to.equal(1); // Confirmed
    });

    it("reverts when a non-seller confirms", async function () {
      await createTrade();
      await expect(
        energyTrade.connect(other).confirmTrade(0)
      ).to.be.revertedWith("Only seller can confirm");
    });
  });

  describe("releasePayment", function () {
    it("pays the seller after confirmation", async function () {
      await createTrade();
      await energyTrade.connect(seller).confirmTrade(0);

      const before = await ethers.provider.getBalance(seller.address);
      await energyTrade.connect(other).releasePayment(0); // anyone can trigger
      const after = await ethers.provider.getBalance(seller.address);

      expect(after - before).to.equal(amount);
      expect((await energyTrade.getTrade(0)).status).to.equal(2); // Paid
    });

    it("reverts if not confirmed", async function () {
      await createTrade();
      await expect(
        energyTrade.connect(other).releasePayment(0)
      ).to.be.revertedWith("Trade not confirmed");
    });
  });

  describe("cancelTrade", function () {
    it("refunds the buyer for an unconfirmed trade", async function () {
      await createTrade();
      await expect(energyTrade.connect(buyer).cancelTrade(0))
        .to.emit(energyTrade, "TradeCancelled")
        .withArgs(0);
      expect((await energyTrade.getTrade(0)).status).to.equal(3); // Cancelled
    });

    it("reverts when cancelling a confirmed trade", async function () {
      await createTrade();
      await energyTrade.connect(seller).confirmTrade(0);
      await expect(
        energyTrade.connect(buyer).cancelTrade(0)
      ).to.be.revertedWith("Can only cancel Created trades");
    });
  });
});
