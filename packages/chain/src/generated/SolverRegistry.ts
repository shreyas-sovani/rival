// GENERATED — do not edit
export const solverRegistryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "depositToken_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "depositAmount_",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "names_",
        "type": "address",
        "internalType": "contract IRivalNames"
      },
      {
        "name": "house_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "LISTING_TERM",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "depositAmount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "depositToken",
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
    "name": "exit",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "house",
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
    "name": "isListed",
    "inputs": [
      {
        "name": "solver",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "listed",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "labelOf",
    "inputs": [
      {
        "name": "solver",
        "type": "address",
        "internalType": "address"
      }
    ],
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
    "name": "names",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IRivalNames"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "onFill",
    "inputs": [
      {
        "name": "solver",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "maker",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "improvementBps",
        "type": "int32",
        "internalType": "int32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "ownsAny",
    "inputs": [
      {
        "name": "solver",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "labelHashes",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      }
    ],
    "outputs": [
      {
        "name": "ok",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "register",
    "inputs": [
      {
        "name": "label",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setSettlement",
    "inputs": [
      {
        "name": "settlement_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "settlement",
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
    "name": "settlementLocked",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "stats",
    "inputs": [
      {
        "name": "solver",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct Stats",
        "components": [
          {
            "name": "fills",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "makers",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "sumImprovementBps",
            "type": "int128",
            "internalType": "int128"
          },
          {
            "name": "lastFill",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "syncRecords",
    "inputs": [
      {
        "name": "solver",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "error",
    "name": "LabelUnavailable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Unauthorized",
    "inputs": []
  }
] as const;
