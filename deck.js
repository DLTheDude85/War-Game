// =============================================================================
// deck.js
// -----------------------------------------------------------------------------
// Defines the building blocks of the game:
//   - Deck : an ordered pile of cards (used for the full deck AND each
//            player's hand)
//   - Card : a single playing card that knows its name and how to draw itself
//   - createCardBackHTML() : builds a face-down card (used for the war piles)
// script.js imports everything it needs from this file.
// =============================================================================

// The four suits, written as unicode symbols so they can be printed directly
// on the cards.
const SUITS = ["♠", "♣", "♥", "♦"]

// Spoken/written names for each suit. Used to give every card a readable name
// such as "King of Hearts" (for screen readers and the on-screen messages).
const SUIT_NAMES = {
  "♠": "Spades",
  "♣": "Clubs",
  "♥": "Hearts",
  "♦": "Diamonds"
}

// The 13 card values in each suit, in order from Ace to King.
// Values are stored as text ("2", "J", ...). Their numeric strength for
// comparing cards lives in CARD_VALUE_MAP in script.js.
const VALUES = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K"
]

// Full names for the letter cards. Number cards don't need an entry because
// their name is just the number ("7", "10", ...).
const VALUE_NAMES = {
  A: "Ace",
  J: "Jack",
  Q: "Queen",
  K: "King"
}

// A Deck is just a list of cards (this.cards). The same class is used for the
// full 52-card deck and for each player's hand.
//
// Think of it like a pile on a table:
//   - pop()  takes the card from the TOP (the front of the array)
//   - push() puts a card on the BOTTOM (the end of the array)
export default class Deck {
  // If no list of cards is passed in, start with a fresh, ordered 52-card deck.
  // script.js passes in a list when it needs to build a half-deck (a hand) or
  // to shuffle a pile of won cards.
  constructor(cards = freshDeck()) {
    this.cards = cards
  }

  // How many cards are currently in this deck.
  // Used like a property: deck.numberOfCards  (no parentheses)
  get numberOfCards() {
    return this.cards.length
  }

  // Remove and return the top card (front of the array).
  // Note: despite the name, this uses shift(), not Array.pop(), so it takes
  // from the FRONT. Together with push() (adds to the END) the deck behaves
  // like a queue: first card in is the first card out.
  pop() {
    return this.cards.shift()
  }

  // Add a card to the bottom of the deck (end of the array).
  push(card) {
    this.cards.push(card)
  }

  // Randomly reorder the cards using the Fisher-Yates shuffle, which gives
  // every possible ordering an equal chance (unlike sorting with Math.random).
  shuffle() {
    // Walk backwards from the last card to the second card...
    for (let i = this.numberOfCards - 1; i > 0; i--) {
      // ...pick a random position from 0 up to and including i...
      const newIndex = Math.floor(Math.random() * (i + 1))
      // ...and swap the card at that position with the card at position i.
      const oldValue = this.cards[newIndex]
      this.cards[newIndex] = this.cards[i]
      this.cards[i] = oldValue
    }
  }
}

// A single playing card (for example the Queen of Hearts).
// Not exported: other files never create cards directly, they get them from
// a Deck.
class Card {
  constructor(suit, value) {
    this.suit = suit   // one of the SUITS symbols
    this.value = value // one of the VALUES strings
  }

  // Hearts and diamonds are red; spades and clubs are black.
  // The result is also used as a CSS class name (see .card.red / .card.black
  // in styles.css).
  get color() {
    return this.suit === "♣" || this.suit === "♠" ? "black" : "red"
  }

  // The card's full name in words, e.g. "King of Hearts" or "7 of Clubs".
  // `??` means "use the first value unless it is missing, then use the
  // second", so number cards fall back to their own number.
  get name() {
    const valueName = VALUE_NAMES[this.value] ?? this.value
    return `${valueName} of ${SUIT_NAMES[this.suit]}`
  }

  // Build the on-screen element for this card (face up) and return it.
  // script.js is responsible for adding it to the page.
  // The resulting HTML looks like:
  //   <div class="card face red" data-value="K ♥" role="img"
  //        aria-label="King of Hearts">♥</div>
  getHTML() {
    const cardDiv = document.createElement("div")
    // The big suit symbol in the middle of the card.
    cardDiv.textContent = this.suit
    // "card" gives the base look, "face" marks it as face-up (so the corner
    // labels are drawn), and "red"/"black" sets the text color.
    cardDiv.classList.add("card", "face", this.color)
    // The small value + suit label ("K ♥"). styles.css prints this in the
    // top-left and bottom-right corners using content: attr(data-value).
    cardDiv.dataset.value = `${this.value} ${this.suit}`
    // Screen readers treat the card as a single picture and read its name
    // instead of the symbols drawn on it.
    cardDiv.setAttribute("role", "img")
    cardDiv.setAttribute("aria-label", this.name)
    return cardDiv
  }
}

// Build a face-down card element (the patterned back of a card).
// It doesn't belong to any particular Card because nobody can see what it is.
// It is hidden from screen readers; the on-screen messages describe what is
// happening instead.
export function createCardBackHTML() {
  const backDiv = document.createElement("div")
  backDiv.classList.add("card", "card-back")
  backDiv.setAttribute("aria-hidden", "true")
  return backDiv
}

// Create a full, ordered 52-card deck: every value in every suit
// (4 suits x 13 values = 52 cards).
function freshDeck() {
  // For each suit...
  return SUITS.flatMap(suit => {
    // ...create one card for each value, then flatten all four groups of 13
    // into a single list of 52.
    return VALUES.map(value => {
      return new Card(suit, value)
    })
  })
}
