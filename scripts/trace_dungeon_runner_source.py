#!/usr/bin/env python3
import argparse
import json
import pathlib
import random
import sys

import numpy as np
import tensorflow as tf


def main() -> int:
  parser = argparse.ArgumentParser()
  parser.add_argument("--repo-root", required=True)
  parser.add_argument("--weights", required=True)
  parser.add_argument("--seed", type=int, required=True)
  parser.add_argument("--players", type=int, default=4)
  parser.add_argument("--max-steps", type=int, default=20)
  parser.add_argument("--hero", default="WARRIOR")
  args = parser.parse_args()

  repo_root = pathlib.Path(args.repo_root).resolve()
  weights_path = pathlib.Path(args.weights).resolve()
  if not weights_path.exists():
    print(json.dumps({"error": f"weights not found: {weights_path}"}))
    return 1

  sys.path.insert(0, str(repo_root / "src"))
  import dungeon_runner.actions as A  # noqa: WPS433
  from dungeon_runner.catalog import default_monster_deck_list, make_deck_instance_ids  # noqa: WPS433
  from dungeon_runner.match import ALL_SPECIES, Match, MatchPhase  # noqa: WPS433
  from dungeon_runner.rl import actions_codec, observation  # noqa: WPS433
  from dungeon_runner.rl.model import PolicyValueModel  # noqa: WPS433
  from dungeon_runner.types_core import AdventurerKind  # noqa: WPS433

  model = PolicyValueModel(obs_dim=observation.OBS_DIM, n_actions=actions_codec.N_ACTIONS)
  model(
    tf.zeros((1, observation.OBS_DIM), dtype=tf.float32),
    tf.ones((1, actions_codec.N_ACTIONS), dtype=tf.float32),
    training=False,
  )
  model.load_weights(str(weights_path))

  rng = random.Random(int(args.seed))
  base_defs = default_monster_deck_list()
  fixed_deck = make_deck_instance_ids(base_defs, start_id=0)
  hero_name = str(args.hero).upper()
  try:
    hero = AdventurerKind[hero_name]
  except KeyError:
    print(json.dumps({"error": f"unsupported hero: {args.hero}"}))
    return 1
  m = Match.new(int(args.players), rng, hero, start_seat=0, monster_deck=fixed_deck)
  trace = []
  initial_seat_order = [int(i) for i in range(int(args.players))]
  initial_active_seat = int(m.active_seat)
  previous_own_add_lengths = {player.seat: len(player.own_pile_adds) for player in m.players}
  for step in range(int(args.max_steps)):
    if m.phase is MatchPhase.ENDED:
      break
    legal = m.legal_actions()
    if not legal:
      break
    seat = m.active_seat
    obs = observation.build_observation(m, seat)
    d_snap = dungeon_snapshot(m, seat, obs)
    mask = actions_codec.legal_mask(m)
    logits_masked = model(
      tf.constant(obs[None, :], dtype=tf.float32),
      tf.constant(mask[None, :], dtype=tf.float32),
      training=False,
    )[0].numpy()[0]
    picked_index = int(np.argmax(logits_masked))
    action = actions_codec.decode_index(m, picked_index)
    if action is None or action not in legal:
      action = sorted(list(legal), key=repr)[0]
    appended_species = None
    prev_len = previous_own_add_lengths.get(seat, 0)
    current_len = len(m.players[seat].own_pile_adds)
    if current_len > prev_len:
      appended_species = m.players[seat].own_pile_adds[-1].value
    previous_own_add_lengths[seat] = current_len
    trace.append(
      {
        "step": step,
        "phase": m.phase.name,
        "seat": int(seat),
        "picked_index": picked_index,
        "action": format_action(A, action),
        "observation": obs.tolist(),
        "legal_actions": sorted([format_action(A, item) for item in legal]),
        "top_legal": build_top_legal(actions_codec, m, logits_masked),
        "deck_len": len(m.monster_deck),
        "pending_species": m.pending_card.species.value if m.pending_card is not None else None,
        "appended_species": appended_species,
        "passed_seats": [pl.seat for pl in m.players if pl.has_passed_bid and not pl.eliminated],
        "own_pile_counts": own_pile_counts(m, seat, ALL_SPECIES),
        "dungeon_snapshot": d_snap,
      }
    )
    m.apply(action)

  print(
    json.dumps(
      {
        "initial_seat_order": initial_seat_order,
        "initial_active_seat": initial_active_seat,
        "trace": trace,
      }
    )
  )
  return 0


def format_action(A, action):
  if isinstance(action, A.PassBid):
    return "PASS"
  if isinstance(action, A.DrawCard):
    return "DRAW"
  if isinstance(action, A.AddToDungeon):
    return "ADD_TO_DUNGEON"
  if isinstance(action, A.SacrificeEquipment):
    return f"SACRIFICE({action.equipment_id})"
  if isinstance(action, A.ChooseNextAdventurer):
    return f"CHOOSE_NEXT_ADVENTURER({action.hero.name})"
  if isinstance(action, A.DeclareVorpal):
    return f"DECLARE_VORPAL({action.target_species.value})"
  if isinstance(action, A.RevealOrContinue):
    return "REVEAL_OR_CONTINUE"
  if isinstance(action, A.UseFireAxe):
    return "USE_FIRE_AXE"
  if isinstance(action, A.DeclineFireAxe):
    return "DECLINE_FIRE_AXE"
  if isinstance(action, A.UsePolymorph):
    return "USE_POLYMORPH"
  if isinstance(action, A.DeclinePolymorph):
    return "DECLINE_POLYMORPH"
  return type(action).__name__


def build_top_legal(actions_codec, match, logits_masked):
  mask = actions_codec.legal_mask(match)
  legal_indices = [i for i, value in enumerate(mask.tolist()) if value > 0]
  ranked = sorted(legal_indices, key=lambda index: float(logits_masked[index]), reverse=True)[:5]
  return [{"index": int(index), "logit": float(logits_masked[index])} for index in ranked]


def dungeon_snapshot(m, seat, obs):
  """Fields aligned with rl/observation._dungeon_block + seat context for parity debugging."""
  dcur = m.d_current
  sub = m.dungeon_sub
  return {
    "phase": m.phase.name,
    "active_seat": int(m.active_seat),
    "runner_seat": int(m.runner_seat) if m.runner_seat is not None else None,
    "dungeon_sub": sub.name if sub is not None else None,
    "d_current_species": dcur.species.value if dcur is not None else None,
    "d_hp": int(m.d_hp),
    "d_remaining_len": len(m.d_remaining),
    "dungeon_pile_len": len(m.dungeon_pile),
    "d_poly_spent": bool(m.d_poly_spent),
    "d_axe_spent": bool(m.d_axe_spent),
    "d_in_play_sorted": sorted(m.d_in_play),
    "center_equipment_count": len(m.center_equipment),
    "obs_dungeon_slice": [float(x) for x in obs[69:87].tolist()] if obs.shape[0] >= 87 else [],
  }


def own_pile_counts(match, seat, species):
  species_order = [sp.value for sp in species]
  counts = {key: 0 for key in species_order}
  for species in match.players[seat].own_pile_adds:
    counts[species.value] = min(2, counts[species.value] + 1)
  return counts


if __name__ == "__main__":
  raise SystemExit(main())
