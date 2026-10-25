// Handles: 3 to 24 lowercase letters, digits and hyphens. Everyone starts with a made-up one, Reddit-style
// (plucky-puffin-42), until they pick their own.
export const HANDLE = /^[a-z0-9](?:[a-z0-9-]{1,22})[a-z0-9]$/;

// Short words, so adjective-noun-NN always fits in 24.
const ADJECTIVES = (
  "plucky brisk tidy nimble dapper keen mellow jaunty crafty sunny salty breezy cosy wily chirpy snappy spry bonny canny " +
  "droll grand lively merry rosy savvy steady swift thrifty wry zesty bold calm clever deft eager gentle handy jolly " +
  "lucky nifty perky quick quirky sharp shrewd sleek smug sound sturdy witty dreamy fuzzy lanky lofty misty " +
  "peppy proper rugged sly snug stout tame trusty wee"
).split(" ");
const NOUNS = (
  "otter heron magpie badger puffin wren hare fox robin finch curlew gannet kestrel seal stoat hedgehog owl rook " +
  "plum pear damson sloe bramble thistle clover fern nettle acorn turnip scone kettle teapot biscuit crumpet wellie " +
  "brolly satchel pebble lantern compass button thimble pickle muffin noodle walnut pancake sparrow lark gull " +
  "mackerel limpet cockle oyster spud parsnip radish leek cabbage barley oat pippin quill ladle spoon"
).split(" ");

const pick = <T>(xs: T[], random: () => number) => xs[Math.floor(random() * xs.length)]!;

export function funHandle(random: () => number = Math.random): string {
  return `${pick(ADJECTIVES, random)}-${pick(NOUNS, random)}-${10 + Math.floor(random() * 90)}`;
}
