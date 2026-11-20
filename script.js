// =============================================================================
// script.js
// -----------------------------------------------------------------------------
// Game logic for War.
//
// How a game plays out (one button / click / Space / Enter per step):
//   1. READY       : "Flip Card"   -> both sides flip their top card.
//                                     Higher card wins both cards.
//   2. WAR         : "Go to War!"  -> only happens when the cards MATCH.
//                                     Each side lays up to 3 cards face down,
//                                     then flips one more. Higher card wins
//                                     EVERYTHING on the table. (If those match
//                                     too, there is another war.)
//   3. ROUND_OVER  : "Next Round"  -> clears the table, back to step 1.
//   4. GAME_OVER   : "Play Again"  -> someone ran out of cards; start fresh.
// =============================================================================

import Deck, { createCardBackHTML } from "./deck.js"

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------

// Converts a card's value (text) into a number so cards can be compared.
// Higher number wins. Aces are high (14), so they beat Kings.
const CARD_VALUE_MAP = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
}

// How many cards each side lays face down when there is a war.
const CARDS_FACE_DOWN_IN_WAR = 3

// The most cards drawn side by side on the table for one player. In a long
// chain of wars the oldest cards are folded into a single face-down stack
// (with a "+N" badge) so the cards never run off the screen.
const MAX_VISIBLE_CARDS = 5

// The four steps the game can be in (see the list at the top of this file).
const PHASE = {
  READY: "ready",
  WAR: "war",
  ROUND_OVER: "round-over",
  GAME_OVER: "game-over"
}

// The label shown on the main button for each phase.
const BUTTON_LABELS = {
  [PHASE.READY]: "Flip Card",
  [PHASE.WAR]: "Go to War!",
  [PHASE.ROUND_OVER]: "Next Round",
  [PHASE.GAME_OVER]: "Play Again"
}

// -----------------------------------------------------------------------------
// Page elements (all defined in index.html)
// -----------------------------------------------------------------------------
const table = document.querySelector(".table")                          // the whole card table (clickable)
const actionButton = document.querySelector(".action-btn")              // the main game button
const computerCardSlot = document.querySelector(".computer-card-slot")  // where the computer's cards appear
const playerCardSlot = document.querySelector(".player-card-slot")      // where the player's cards appear
const computerDeckElement = document.querySelector(".computer-deck")    // the computer's face-down pile
const playerDeckElement = document.querySelector(".player-deck")        // the player's face-down pile
const statusBox = document.querySelector(".status")                     // the message box in the middle
const statusMain = document.querySelector(".status-main")               // its headline
const statusDetail = document.querySelector(".status-detail")           // its details
const statusScreenReader = document.querySelector(".status-sr")         // extra text only screen readers get

// -----------------------------------------------------------------------------
// Game state (these change as the game is played)
// -----------------------------------------------------------------------------
// playerDeck / computerDeck : each side's hand, as a Deck
// phase    : which step of the game we are on (one of PHASE)
// pile     : every card currently on the table this round (both sides, face up
//            AND face down). The winner of the round takes all of them.
// warCount : how many wars have happened in the current round (0 = a normal
//            round). Only used to choose the wording of the messages.
let playerDeck, computerDeck, phase
let pile = []
let warCount = 0

// -----------------------------------------------------------------------------
// Input: mouse, touch and keyboard
// -----------------------------------------------------------------------------

// Clicking or tapping anywhere on the table moves the game forward.
table.addEventListener("click", () => {
  advance()
  // Keep keyboard focus on the main button so Space/Enter keep working
  // right after a mouse click.
  actionButton.focus({ preventScroll: true })
})

// The main button does the same thing. Because it is a real <button>, it
// already works with Tab, Space and Enter without any extra code.
actionButton.addEventListener("click", advance)

// Safety net: if nothing on the page has keyboard focus yet (for example the
// page just loaded), Space or Enter still plays. We only do this when focus is
// on the page itself, so Space/Enter on the "Back to Games" link or the button
// behave normally.
document.addEventListener("keydown", event => {
  const isPlayKey = event.key === " " || event.key === "Enter"
  if (isPlayKey && !event.repeat && event.target === document.body) {
    event.preventDefault() // stop Space from scrolling the page
    advance()
  }
})

// -----------------------------------------------------------------------------
// Game flow
// -----------------------------------------------------------------------------

// Start the very first game as soon as the page loads.
startGame()

// Called for every click / tap / key press. Does whatever the NEXT step is.
function advance() {
  switch (phase) {
    case PHASE.GAME_OVER:
      startGame()
      break
    case PHASE.ROUND_OVER:
      clearTable()
      break
    case PHASE.WAR:
      playWar()
      break
    default:
      flipCards()
  }
}

// Set up a new game: shuffle, deal half the deck to each side, reset the table.
function startGame() {
  const deck = new Deck() // a fresh, ordered 52-card deck
  deck.shuffle()

  // Split the shuffled deck down the middle. Math.ceil rounds up in case the
  // deck ever had an odd number of cards (with 52 it is exactly 26 each).
  const deckMidpoint = Math.ceil(deck.numberOfCards / 2)
  playerDeck = new Deck(deck.cards.slice(0, deckMidpoint))
  computerDeck = new Deck(deck.cards.slice(deckMidpoint, deck.numberOfCards))
  pile = []
  warCount = 0

  clearTable()
}

// Clear the table, refresh the card counts and get ready for the next round.
// Runs at the start of a game and after every round.
function clearTable() {
  computerCardSlot.replaceChildren()
  playerCardSlot.replaceChildren()
  updateDeckCount()
  setPhase(PHASE.READY)
  // Report each side's OWN card count. (Early on both sides have 26, but as
  // the game goes on the counts differ, so we can't use one number for both.)
  setStatus(
    "ready",
    "Your move",
    `You have ${countCards(playerDeck.numberOfCards)}. The computer has ${countCards(computerDeck.numberOfCards)}.`
  )
}

// Step 1 of a round: both sides flip their top card.
function flipCards() {
  warCount = 0 // a brand new round, so no wars yet
  flipFaceUp()
}

// Step 2 (only after a tie): the war itself.
function playWar() {
  warCount++

  // The orange "tie" glow from the previous flip is no longer needed.
  table.querySelectorAll(".tie").forEach(card => card.classList.remove("tie"))

  // Each side lays its face-down cards on the table...
  layFaceDown(playerDeck, playerCardSlot)
  layFaceDown(computerDeck, computerCardSlot)

  // ...then flips one more card to decide the war.
  flipFaceUp()
}

// Each side lays up to 3 cards face down. It always keeps at least one card
// back so it still has a card to flip for the war (so a player with only 2
// cards lays just 1 face down, and a player with 1 card lays none).
function layFaceDown(deck, slot) {
  const count = Math.min(CARDS_FACE_DOWN_IN_WAR, deck.numberOfCards - 1)
  for (let i = 0; i < count; i++) {
    pile.push(deck.pop())              // the card goes onto the table pile...
    appendCard(slot, createCardBackHTML()) // ...and a face-down card is drawn
  }
}

// Both sides take their top card, show it, and work out who won.
function flipFaceUp() {
  const playerCard = playerDeck.pop()
  const computerCard = computerDeck.pop()

  // Both cards are now on the table.
  pile.push(playerCard, computerCard)
  appendCard(playerCardSlot, playerCard.getHTML())
  appendCard(computerCardSlot, computerCard.getHTML())

  // The deck counts drop because the cards have left each hand.
  updateDeckCount()

  if (isRoundWinner(playerCard, computerCard)) {
    markWinner("player")
    awardPile("player", playerCard, computerCard)
  } else if (isRoundWinner(computerCard, playerCard)) {
    markWinner("computer")
    awardPile("computer", playerCard, computerCard)
  } else {
    startWar(playerCard, computerCard)
  }
}

// The two flipped cards match, so it is war... unless one side has no cards
// left to fight with.
function startWar(playerCard, computerCard) {
  // Glow both matching cards so the tie is easy to spot.
  playerCardSlot.lastElementChild.classList.add("tie")
  computerCardSlot.lastElementChild.classList.add("tie")

  const tiedText = `Your ${playerCard.name} matches the computer's ${computerCard.name}.`

  // A side that has run out of cards cannot continue the war and loses.
  if (isGameOver(playerDeck) || isGameOver(computerDeck)) {
    if (isGameOver(playerDeck) && isGameOver(computerDeck)) {
      // Extremely rare: both sides used their very last card on the tie.
      setPhase(PHASE.GAME_OVER)
      setStatus(
        "game-tie",
        "It's a tie game!",
        `${tiedText} Neither side has any cards left for the war.`
      )
      return
    }

    const winner = isGameOver(playerDeck) ? "computer" : "player"
    const loserName = winner === "player" ? "The computer" : "You"
    awardPile(winner, playerCard, computerCard, `${tiedText} ${loserName} can't continue the war because there are no cards left.`)
    return
  }

  // Normal case: wait for the player to start the war.
  setPhase(PHASE.WAR)
  setStatus(
    "war",
    "War!",
    `${tiedText} Each side lays down up to ${CARDS_FACE_DOWN_IN_WAR} cards face down, then flips one more.`
  )
}

// Give every card on the table to the winner, then announce the result.
// `forcedDetail` is optional: used when the game ends because someone cannot
// continue a war, so the message explains why.
function awardPile(winner, playerCard, computerCard, forcedDetail) {
  const winnerDeck = winner === "player" ? playerDeck : computerDeck
  const loserDeck = winner === "player" ? computerDeck : playerDeck
  const cardsWon = pile.length

  // Shuffle the won cards before putting them at the bottom of the winner's
  // hand. Without this, the cards always come back in the same order, and the
  // game can repeat forever without anyone winning.
  const wonCards = new Deck([...pile])
  wonCards.shuffle()
  wonCards.cards.forEach(card => winnerDeck.push(card))
  pile = []

  updateDeckCount()

  // Build the messages.
  const roundWord = warCount > 0 ? "war" : "round"
  const whoWins = winner === "player" ? "You win" : "The computer wins"
  const whoCollects = winner === "player" ? "You collect" : "The computer collects"
  const cardsDetail = winner === "player"
    ? `Your ${playerCard.name} beats the computer's ${computerCard.name}.`
    : `The computer's ${computerCard.name} beats your ${playerCard.name}.`
  const countsForScreenReaders =
    `You now have ${countCards(playerDeck.numberOfCards)}. The computer has ${countCards(computerDeck.numberOfCards)}.`

  // Wording for "<The computer has> / <You have> no cards left."
  const loserSubject = winner === "player" ? "The computer has" : "You have"

  // Did the loser just run out of cards? Then the whole game is over.
  if (isGameOver(loserDeck)) {
    setPhase(PHASE.GAME_OVER)
    setStatus(
      winner === "player" ? "game-win" : "game-lose",
      winner === "player" ? "You win the game!" : "You lose the game.",
      forcedDetail ?? `${cardsDetail} ${loserSubject} no cards left.`,
      countsForScreenReaders
    )
  } else {
    setPhase(PHASE.ROUND_OVER)
    setStatus(
      winner === "player" ? "win" : "lose",
      `${whoWins} the ${roundWord}!`,
      `${cardsDetail} ${whoCollects} ${countCards(cardsWon)}.`,
      countsForScreenReaders
    )
  }
}

// -----------------------------------------------------------------------------
// Drawing the table
// -----------------------------------------------------------------------------

// Add a card to one side of the table. If that side already shows
// MAX_VISIBLE_CARDS cards, the oldest cards are folded into one face-down
// stack at the far left, labeled with how many cards it hides ("+2", "+5"...).
function appendCard(slot, cardElement) {
  slot.appendChild(cardElement)
  if (slot.children.length <= MAX_VISIBLE_CARDS) return

  // Create the face-down stack the first time it is needed.
  if (!slot.firstElementChild.classList.contains("stack")) {
    const stack = createCardBackHTML()
    stack.classList.add("stack")
    stack.dataset.hidden = "0"
    slot.prepend(stack)
  }

  // Fold the oldest visible cards into the stack until everything fits.
  const stack = slot.firstElementChild
  let hidden = Number(stack.dataset.hidden)
  while (slot.children.length > MAX_VISIBLE_CARDS) {
    stack.nextElementSibling.remove()
    hidden++
  }
  stack.dataset.hidden = String(hidden)
  stack.dataset.count = `+${hidden}` // styles.css shows this as a badge
}

// Highlight the winning card (gold glow) and dim the losing card.
function markWinner(winner) {
  const winningSlot = winner === "player" ? playerCardSlot : computerCardSlot
  const losingSlot = winner === "player" ? computerCardSlot : playerCardSlot
  winningSlot.lastElementChild.classList.add("winner")
  losingSlot.lastElementChild.classList.add("loser")
}

// Refresh the card counts on the two face-down piles (the number you can see
// and the label screen readers read out).
function updateDeckCount() {
  showDeckCount(computerDeckElement, "Computer deck", computerDeck.numberOfCards)
  showDeckCount(playerDeckElement, "Your deck", playerDeck.numberOfCards)
}

function showDeckCount(deckElement, name, count) {
  deckElement.querySelector(".deck-count").textContent = count
  deckElement.setAttribute("aria-label", `${name}: ${countCards(count)}`)
}

// Change the step the game is on, and update the main button to match
// (its label, and data-phase so styles.css can color it, e.g. red for war).
function setPhase(newPhase) {
  phase = newPhase
  actionButton.textContent = BUTTON_LABELS[newPhase]
  actionButton.dataset.phase = newPhase
}

// Update the message box in the middle of the table.
//   kind          : ready / win / lose / war / game-win / game-lose / game-tie
//                   (styles.css colors the message based on this)
//   main          : the headline
//   detail        : the sentence underneath
//   screenReader  : optional extra text only screen readers will hear
// The box is an aria-live region, so screen readers announce the change.
function setStatus(kind, main, detail, screenReader = "") {
  statusBox.dataset.kind = kind
  statusMain.textContent = main
  statusDetail.textContent = detail
  statusScreenReader.textContent = screenReader
}

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------

// Turns a number into "1 card" or "26 cards" (correct singular/plural).
function countCards(number) {
  return `${number} ${number === 1 ? "card" : "cards"}`
}

// True if cardOne is strictly higher than cardTwo (equal cards return false).
// Looks up each card's number in CARD_VALUE_MAP.
function isRoundWinner(cardOne, cardTwo) {
  return CARD_VALUE_MAP[cardOne.value] > CARD_VALUE_MAP[cardTwo.value]
}

// A hand with no cards left means that side is out of the game.
function isGameOver(deck) {
  return deck.numberOfCards === 0
}
