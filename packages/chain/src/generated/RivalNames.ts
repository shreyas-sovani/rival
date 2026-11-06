// GENERATED — do not edit
export const rivalNamesAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "registry_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "ens_",
        "type": "address",
        "internalType": "contract IStandardRegistry"
      },
      {
        "name": "resolver_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "SOLVER_ROLE_BITMAP",
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
    "name": "ens",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IStandardRegistry"
      }
    ],
    "stateMutability": "view"
  },
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
    "name": "ownerOf",
    "inputs": [
      {
        "name": "tokenId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
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
    "name": "protocolRecord",
    "inputs": [
      {
        "name": "solver",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
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
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
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
    "name": "resolver",
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
