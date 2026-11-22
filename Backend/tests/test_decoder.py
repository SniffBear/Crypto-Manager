from backend.core.transaction_decoder import decode_transaction


def test_decode_transfer_and_token_changes():
    tx = {
        "slot": 123,
        "blockTime": 456,
        "transaction": {
            "signatures": ["sig"],
            "message": {
                "accountKeys": [
                    {"pubkey": "wallet", "signer": True},
                    {"pubkey": "recipient", "signer": False},
                ],
                "instructions": [
                    {
                        "programId": "11111111111111111111111111111111",
                        "parsed": {
                            "type": "transfer",
                            "info": {"source": "wallet", "destination": "recipient", "lamports": 1_000_000},
                        },
                    }
                ],
            },
        },
        "meta": {
            "fee": 5000,
            "preBalances": [10_000_000, 0],
            "postBalances": [8_995_000, 1_000_000],
            "preTokenBalances": [
                {
                    "accountIndex": 1,
                    "mint": "MINT",
                    "owner": "wallet",
                    "uiTokenAmount": {"amount": "100", "decimals": 0, "uiAmount": 100},
                }
            ],
            "postTokenBalances": [
                {
                    "accountIndex": 1,
                    "mint": "MINT",
                    "owner": "wallet",
                    "uiTokenAmount": {"amount": "150", "decimals": 0, "uiAmount": 150},
                }
            ],
            "err": None,
        },
    }

    decoded = decode_transaction(tx, wallet_address="wallet")
    assert decoded["event_type"] == "TRANSFER"
    assert decoded["fee_lamports"] == 5000
    assert decoded["token_changes"][0]["delta"] == 50
    assert decoded["counterparties"]