/**
 * Public Sepolia fields for the evidence page.
 * `runnerUrl` stays in deployments/sepolia.json and is not imported here.
 * That placeholder must not ship in the static bundle.
 */
export const publicDeployment = {
  commit: "5f38777993bfdc76858f8487e0fc0659a54c2736",
  hook: {
    address: "0xb17a547082836fDF87001c1DE031fA8A2D391080",
    flagBitsHex: "0x1080",
  },
  tokens: {
    tWETH: "0x45E6a5bD3be4D00E7Be57287D7d25De3F833253d",
    tUSDC: "0x571c992873D31310B11Bf6bF6B44f2748B4bce8C",
  },
  pools: {
    A: {
      poolId: "0xd302ad11d027e1897d14162ac1d7a583a7c48a12a547a25c12c9bb1da504f13f",
      fee: 500,
      tickSpacing: 10,
    },
    B: {
      poolId: "0xc990bf9d3e98afd98afafdad812369a1b8dd6822622f49cf9f7a312701c0549b",
      fee: 3000,
      tickSpacing: 60,
    },
  },
  settlement: "0xdD66D017e4B4FfF51aBEf2f559C68065D4FD9850",
  registry: "0x6AD5C78fA2278d397Bb7e04e1e2266Cc39a1109E",
  names: "0xC20a61e830bB91A69C1B6BCcd607299152aDE797",
  uniswapSolvers: ["0xDBe8a61e1A4cDd767FfA7C822C242B8E85414e17"],
  arkivWriterAddresses: [] as string[],
  ens: {
    parentLabel: "rival",
    solversRegistry: "0xCEec9D7ADcad00e4D842283d9526E75C9440b36f",
    universalResolverV2: "0x0000000000000000000000000000000000000000",
    ethRegistrar: "0x0000000000000000000000000000000000000000",
    ethRegistry: "0x0000000000000000000000000000000000000000",
    rootRegistry: "0x0000000000000000000000000000000000000000",
  },
  solvers: [
    {
      label: "atlas",
      address: "0xD2aA21AF4faa840Dea890DB2C6649AACF2C80Ff3",
      strategy: "sprint",
    },
  ],
};
