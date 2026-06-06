<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card style="width: min(440px, 100vw - 32px)">
      <q-card-section class="q-pb-sm">
        <div class="text-h6">How to play</div>
      </q-card-section>
      <q-separator />
      <q-card-section class="text-body2 scroll" style="max-height: min(70vh, 520px)">
        <p class="q-ma-none q-mb-md">
          Dungeon Runner is a single-player (multi-bot) push-your-luck game based on 
          <a
            href="https://iellogames.com/games/welcome-to-the-dungeon/"
            target="_blank"
            rel="noreferrer"
            class="dr-help-link"
            >Welcome to the Dungeon</a
          >
          by IELLO games. You control one seat; everyone else is an AI opponent.
          Win the match by scoring two successful dungeon runs before your rivals do.
        </p>

        <p class="text-subtitle2 text-weight-medium q-mb-xs q-mt-none">Setup</p>
        <p class="q-ma-none q-mb-md">
          Choose how many players are at the table (two to four). You always occupy one seat; fill the rest with random
          bots or trained AI models, then tap <strong>Start match</strong>. Seat order is shuffled each match.
        </p>
        <p class="q-ma-none q-mb-md">
          In each round the runner will pick an adventurer from the available classes. The adventurer will have a starting 
          HP and equipment. You can click any equipment tile at any time—including spent or sacrificed pieces—to read what it does.
        </p>

        <p class="text-subtitle2 text-weight-medium q-mb-xs">Bidding</p>
        <p class="q-ma-none q-mb-sm">
          Each round begins in the bidding phase. Players take turns in seat order. On your turn you either
          <strong>pass</strong> or <strong>draw</strong> from the deck.
        </p>
        <p class="q-ma-none q-mb-sm">
          Drawing reveals a monster only to you. You must then either <strong>add it to the dungeon pile</strong> (building the
          lane the runner will face) or <strong>sacrifice equipment</strong> to discard that card instead, giving up the
          gear permanently.
        </p>
        <p class="q-ma-none q-mb-sm">
          To sacrifice, tap <strong>Sacrifice equipment</strong>. Legally sacrificable pieces on the table highlight with a
          red border. Tap a highlighted piece to read its full description, then tap <strong>Sacrifice</strong> to confirm.
          Tap <strong>Cancel</strong> to leave sacrifice mode without discarding, or <strong>Continue</strong> in the
          description to compare other pieces. You must cancel sacrifice mode before you can add the monster to the dungeon.
        </p>
        <p class="q-ma-none q-mb-md">
          Passing drops you out for this round. When every active player except one has passed, the remaining player
          becomes the <strong>runner</strong> and the match moves to the dungeon phase. The dungeon pile is whatever
          everyone added during bidding.
        </p>

        <p class="text-subtitle2 text-weight-medium q-mb-xs">Dungeon run</p>
        <p class="q-ma-none q-mb-sm">
          The runner works through the dungeon pile one monster at a time. Your HP for the run is  based on your 
          adventurer's starting HP and the equipment you have in play.
        </p>
        <p class="q-ma-none q-mb-sm">
          If you have Vorpal equipment in play when the dungeon run starts, you must declare a species before the
          first monster is revealed. A card picker shows every roster species—tap a card to select it, then tap
          <strong>Confirm</strong> to declare. With memory aid on, cards may show how many of that species you added
          to dungeon piles during bidding (only when the count is greater than zero). You cannot dismiss this picker;
          see the Vorpal Sword or Dagger description for the full rules.
        </p>
        <p class="q-ma-none q-mb-sm">
          Reveal and resolve each monster in order. Most of the time, advancing through the dungeon is automatic. However, 
          sometimes you'll have the option (or be required) to choose an action from the equipment buttons at the bottom.
        </p>
        <p class="q-ma-none q-mb-sm">
          If you are unable to defeat the monster with your available equipment, it will deal damage to you equal to its strength.
        </p>
        <p class="q-ma-none q-mb-md">
          Clear every monster in the pile to succeed. If the runner’s HP hits zero before the pile is cleared, the run
          fails.
        </p>

        <p class="text-subtitle2 text-weight-medium q-mb-xs">Scoring and winning</p>
        <p class="q-ma-none q-mb-sm">
          Track each seat’s progress above the board: checkmarks are successful runs, X marks are failures. A successful
          run awards that seat one win toward the match. A failed run costs the runner one life (each seat starts with
          two).
        </p>
        <p class="q-ma-none q-mb-sm">
          First seat to <strong>two wins</strong> ends the match in their favor. A seat with no lives left is eliminated;
          if only one seat remains, that seat wins regardless of win count.
        </p>
        <p class="q-ma-none q-mb-md">
          After every runs, the runner (win or lose)  picks the adventurer for the next bidding round, then bidding starts 
          again with a fresh deck and empty dungeon pile.
        </p>

        <p class="text-subtitle2 text-weight-medium q-mb-xs">Playing the game</p>
        <p class="q-ma-none q-mb-md">
          When it is your seat’s turn, legal moves appear as buttons below the board. Bots act on their own. Use the
          header refresh icon to abandon the current match and return to setup; match settings (animation pace and memory
          aids) live behind the gear icon during play.
        </p>

        <p class="text-subtitle2 text-weight-medium q-mb-xs">About the game</p>
        <p class="q-ma-none q-mb-md">
          This game is a work in progress. The current version is a proof of concept. 
          It is not endorsed or certified by IELLO games, nor is it a commercial product. This game exists 
          as a personal research project in which I am exploring the training of AI agents to play the game. All rights to 
          the game are reserved by IELLO games and I owe them a great debt of gratitude for creating such a wonderful game.
        </p>
        <p class="q-ma-none q-mb-md">
          The two kinds of bot available are a random bot and a neural network bot. The random bot is a simple bot that 
          essentially just makes random moves, with some simple heuristics to make its behaviors more human-like. 
        </p>
        <p class="q-ma-none q-mb-md">
          The neural network bot is a more sophisticated bot that is trained to play the game using a neural network.  
          The network was originally trained using simple reinforcement learning and will continue to be trained using 
          data from the games you play against it. It's not very good yet, but it's getting better all the time.
        </p>
        <p class="q-ma-none q-mb-md">
          New versions of the network will be released periodically. You can select the version you want to use in the 
          match settings. By default, the latest version will be used.
        </p>
        <p class="q-ma-none q-mb-md">
          All of the code for this game is open source and available on GitHub. Click to view the code for 
          <a
            href="https://github.com/enmaku/portfolio-site"
            target="_blank"
            rel="noreferrer"
            class="dr-help-link"
            >this site</a
          >
          or
          <a
            href="https://github.com/enmaku/dungeon-runner"
            target="_blank"
            rel="noreferrer"
            class="dr-help-link"
            >the neural network model</a
          >.
        </p>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])
</script>

<style scoped lang="scss">
@use 'sass:color';

.dr-help-link {
  color: color.adjust($primary, $lightness: 38%);
  text-decoration: none;

  &:hover {
    color: color.adjust($primary, $lightness: 48%);
    text-decoration: underline;
  }
}
</style>
