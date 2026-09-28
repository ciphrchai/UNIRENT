import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const MST_RPC_URL = process.env.MST_RPC_URL ?? "https://testnetrpc.mstblockchain.com";
// Real chain ID reported by https://testnetrpc.mstblockchain.com is 91562037.
// Keep this driven by .env so it can be updated without touching source code.
const MST_CHAIN_ID = Number(process.env.MST_CHAIN_ID ?? 91562037);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    "mst-testnet": {
      url: MST_RPC_URL,
      chainId: MST_CHAIN_ID,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
