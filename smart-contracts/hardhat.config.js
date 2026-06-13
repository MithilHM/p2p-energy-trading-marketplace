require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // In-process Hardhat network (used by tests)
    hardhat: {},
    // Standalone node started via `npm run node` / docker-compose
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};
