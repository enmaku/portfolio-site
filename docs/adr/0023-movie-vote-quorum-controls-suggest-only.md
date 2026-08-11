# Movie Vote quorum controls are suggest-only

Once **voting phase** starts, the **host** cannot change **quorum requirement** or use **host participant removal** / **clear guests**. A required voter who disconnects mid-vote blocks **results phase** until they reconnect and submit a **ranking**—there is no in-product eject escape hatch.

We preferred a frozen voter set after the room has committed to ballots over letting the host rewrite who must cast while rankings are in flight. The cost is intentional stuckness until reconnect (or everyone abandons the room). **Quorum controls** remain available throughout **suggest phase**, which is when the dead-phone exclusion failure actually needs host intervention.
