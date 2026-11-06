// GENERATED — do not edit
export const rivalSettlementAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "permit2_",
        "type": "address",
        "internalType": "contract IPermit2Min"
      },
      {
        "name": "oracle_",
        "type": "address",
        "internalType": "contract IRivalOracle"
      },
      {
        "name": "registry_",
        "type": "address",
        "internalType": "contract ISolverRegistry"
      },
      {
        "name": "pair",
        "type": "tuple",
        "internalType": "struct RivalSettlement.PairConfig",
        "components": [
          {
            "name": "key",
            "type": "tuple",
            "internalType": "struct PoolKey",
            "components": [
              {
                "name": "currency0",
                "type": "address",
                "internalType": "Currency"
              },
              {
                "name": "currency1",
                "type": "address",
                "internalType": "Currency"
              },
              {
                "name": "fee",
                "type": "uint24",
                "internalType": "uint24"
              },
              {
                "name": "tickSpacing",
                "type": "int24",
                "internalType": "int24"
              },
              {
                "name": "hooks",
                "type": "address",
                "internalType": "contract IHooks"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "CANCEL_TYPEHASH",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "NAME",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "VERSION",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "WITNESS_TYPE_STRING",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cancel",
    "inputs": [
      {
        "name": "i",
        "type": "tuple",
        "internalType": "struct Intent",
        "components": [
          {
            "name": "maker",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tokenIn",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tokenOut",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "amountIn",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "recipient",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "mode",
            "type": "uint8",
            "internalType": "enum Mode"
          },
          {
            "name": "baseOut",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "oracleWindow",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "startBps",
            "type": "int32",
            "internalType": "int32"
          },
          {
            "name": "floorBps",
            "type": "int32",
            "internalType": "int32"
          },
          {
            "name": "startTime",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "decaySecs",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "deadline",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "hardMinOut",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "gate",
            "type": "uint8",
            "internalType": "enum Gate"
          },
          {
            "name": "allowlistHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelBySig",
    "inputs": [
      {
        "name": "intentHash_",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "deadline",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "sig",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelDigest",
    "inputs": [
      {
        "name": "intentHash_",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "deadline",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "currency0",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "currency1",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "domainSeparator",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "fill",
    "inputs": [
      {
        "name": "i",
        "type": "tuple",
        "internalType": "struct Intent",
        "components": [
          {
            "name": "maker",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tokenIn",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tokenOut",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "amountIn",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "recipient",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "mode",
            "type": "uint8",
            "internalType": "enum Mode"
          },
          {
            "name": "baseOut",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "oracleWindow",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "startBps",
            "type": "int32",
            "internalType": "int32"
          },
          {
            "name": "floorBps",
            "type": "int32",
            "internalType": "int32"
          },
          {
            "name": "startTime",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "decaySecs",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "deadline",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "hardMinOut",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "gate",
            "type": "uint8",
            "internalType": "enum Gate"
          },
          {
            "name": "allowlistHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "makerSig",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "p",
        "type": "tuple",
        "internalType": "struct FillParams",
        "components": [
          {
            "name": "inputTo",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "useCallback",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "data",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "allowLabels",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "hooks",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "intentHash",
    "inputs": [
      {
        "name": "i",
        "type": "tuple",
        "internalType": "struct Intent",
        "components": [
          {
            "name": "maker",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tokenIn",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tokenOut",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "amountIn",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "recipient",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "mode",
            "type": "uint8",
            "internalType": "enum Mode"
          },
          {
            "name": "baseOut",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "oracleWindow",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "startBps",
            "type": "int32",
            "internalType": "int32"
          },
          {
            "name": "floorBps",
            "type": "int32",
            "internalType": "int32"
          },
          {
            "name": "startTime",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "decaySecs",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "deadline",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "hardMinOut",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "gate",
            "type": "uint8",
            "internalType": "enum Gate"
          },
          {
            "name": "allowlistHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "oracle",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IRivalOracle"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "permit2",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IPermit2Min"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "poolFee",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint24",
        "internalType": "uint24"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "poolKey",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct PoolKey",
        "components": [
          {
            "name": "currency0",
            "type": "address",
            "internalType": "Currency"
          },
          {
            "name": "currency1",
            "type": "address",
            "internalType": "Currency"
          },
          {
            "name": "fee",
            "type": "uint24",
            "internalType": "uint24"
          },
          {
            "name": "tickSpacing",
            "type": "int24",
            "internalType": "int24"
          },
          {
            "name": "hooks",
            "type": "address",
            "internalType": "contract IHooks"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registry",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract ISolverRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "requiredAt",
    "inputs": [
      {
        "name": "i",
        "type": "tuple",
        "internalType": "struct Intent",
        "components": [
          {
            "name": "maker",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tokenIn",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tokenOut",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "amountIn",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "recipient",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "mode",
            "type": "uint8",
            "internalType": "enum Mode"
          },
          {
            "name": "baseOut",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "oracleWindow",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "startBps",
            "type": "int32",
            "internalType": "int32"
          },
          {
            "name": "floorBps",
            "type": "int32",
            "internalType": "int32"
          },
          {
            "name": "startTime",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "decaySecs",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "deadline",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "hardMinOut",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "gate",
            "type": "uint8",
            "internalType": "enum Gate"
          },
          {
            "name": "allowlistHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "ts",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "required",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "curveBps",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "base",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "status",
    "inputs": [
      {
        "name": "intentHash_",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tickSpacing",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "int24",
        "internalType": "int24"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Cancelled",
    "inputs": [
      {
        "name": "intentHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "maker",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Filled",
    "inputs": [
      {
        "name": "intentHash",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "maker",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "solver",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "tokenIn",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "tokenOut",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "amountIn",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "amountOut",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "fairOut",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "fairOutAfterFee",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "improvementBps",
        "type": "int32",
        "indexed": false,
        "internalType": "int32"
      },
      {
        "name": "curveBps",
        "type": "int32",
        "indexed": false,
        "internalType": "int32"
      },
      {
        "name": "elapsed",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyFilled",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadParams",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadSignature",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BelowFloor",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Cancelled",
    "inputs": []
  },
  {
    "type": "error",
    "name": "DeliveryShort",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Expired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "GateFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAllowlisted",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotListed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotStarted",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OracleUnavailable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Reentrancy",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SelfFill",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Unauthorized",
    "inputs": []
  }
] as const;
