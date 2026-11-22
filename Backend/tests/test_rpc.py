from backend.rpc.pool import RPCPool


def test_rpc_pool_prefers_healthy_low_latency_endpoint():
    pool = RPCPool(
        [
            {
                "url": "https://slow.example",
                "network": "mainnet-beta",
                "status": "DEGRADED",
                "latency_ms": 10,
            },
            {
                "url": "https://fast.example",
                "network": "mainnet-beta",
                "status": "OK",
                "latency_ms": 25,
                "successes": 4,
            },
        ]
    )

    picked = pool.pick("mainnet-beta")
    assert picked is not None
    assert picked.url == "https://fast.example"