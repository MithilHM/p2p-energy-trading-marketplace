const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const EnergyTrade = await hre.ethers.getContractFactory("EnergyTrade");
  const energyTrade = await EnergyTrade.deploy();
  await energyTrade.waitForDeployment();

  const address = await energyTrade.getAddress();
  console.log(`EnergyTrade deployed to: ${address}`);

  // Write deployment info to a shared file so the blockchain-service can pick
  // up the address and ABI without manual copy-paste.
  const artifact = await hre.artifacts.readArtifact("EnergyTrade");
  const deployment = {
    address,
    abi: artifact.abi,
    network: hre.network.name,
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "EnergyTrade.json"),
    JSON.stringify(deployment, null, 2)
  );
  console.log(`Deployment info written to deployments/EnergyTrade.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
