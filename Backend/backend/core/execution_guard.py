from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


class SimulationAlreadyConsumed(ValueError):
    """Raised when an execution simulation is reused or not in a sendable state."""


def claim_simulation_once(simulation: dict[str, Any], *, claimed_at: str | None = None) -> dict[str, Any]:
    """Mark one simulation as claimed before signing/broadcasting.

    Callers must serialize this operation with their process lock and persist the
    vault immediately after the mutation. A claimed simulation is intentionally
    not reusable, including after a downstream failure, to avoid accidental
    duplicate sends from retries.
    """
    if simulation.get("state") != "SIMULATED":
        raise SimulationAlreadyConsumed("A successful, unused simulation is required")
    if simulation.get("execution_claimed_at"):
        raise SimulationAlreadyConsumed("This simulation has already been consumed")
    simulation["execution_claimed_at"] = claimed_at or datetime.now(timezone.utc).isoformat()
    return simulation