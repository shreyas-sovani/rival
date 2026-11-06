// GENERATED — do not edit
export const iRivalNamesAbi = [
  {
    "type": "function",
    "name": "issue",
    "inputs": [
      {
        "name": "label",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "solver",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "expiry",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "renew",
    "inputs": [
      {
        "name": "solver",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "expiry",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "syncRecords",
    "inputs": [
      {
        "name": "solver",
        "type": "address",
        "internalType": "address"
      },
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
        "name": "avgImprovementBps",
        "type": "int256",
        "internalType": "int256"
      },
      {
        "name": "lastFill",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "tokenIdOf",
    "inputs": [
      {
        "name": "solver",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "unregister",
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
