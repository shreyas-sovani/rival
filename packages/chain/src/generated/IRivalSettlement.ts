// GENERATED — do not edit
export const iRivalSettlementAbi = [
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
        "name": "intentHash",
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
        "name": "intentHash",
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
  }
] as const;
