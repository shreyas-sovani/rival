// GENERATED — do not edit
export const iSolverRegistryAbi = [
  {
    "type": "function",
    "name": "exit",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
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
        "name": "settlement",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
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
  }
] as const;
