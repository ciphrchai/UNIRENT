
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying RentalEscrow...");
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "tMSTC");

  if (balance === 0n) {
    throw new Error(
      "Deployer has 0 balance. Get tMSTC from https://faucet.masterstroke.academy"
    );
  }

  const RentalEscrow = await ethers.getContractFactory("RentalEscrow");
  const contract = await RentalEscrow.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("RentalEscrow deployed to:", address);

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "../deployments");

  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const artifact = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        "../artifacts/contracts/RentalEscrow.sol/RentalEscrow.json"
      ),
      "utf8"
    )
  );

  const deploymentInfo = {
    network: "mst-testnet",
    chainId: Number(process.env.MST_CHAIN_ID ?? 91562037),
    rpcUrl: "https://testnetrpc.mstblockchain.com",
    explorerUrl: "https://testnet.mstscan.com",
    contractName: "RentalEscrow",
    address,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    nativeCurrency: {
      name: "tMSTC",
      symbol: "tMSTC",
      decimals: 18,
    },
    abi: artifact.abi,
  };

  const outFile = path.join(deploymentsDir, "mst-testnet.json");

  fs.writeFileSync(outFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("Deployment info saved to:", outFile);
  console.log(
    "Explorer:",
    `https://testnet.mstscan.com/address/${address}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});