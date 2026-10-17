import type { Redis } from "ioredis";

export const hotClickCountKey = (linkId: string) => {
  if (!/^[a-f\d]{24}$/i.test(linkId))
    throw new Error("Invalid click counter link ID");
  return `stats:link:${linkId.toLowerCase()}`;
};
const validateBase = (base: number) => {
  if (!Number.isSafeInteger(base) || base < 0)
    throw new Error("Invalid click counter baseline");
};
const prelude = `
local current = tonumber(redis.call('HGET', KEYS[#KEYS], 'hits') or '0')
if not current or current < 0 or current > 9007199254740991 or current ~= math.floor(current) then return redis.error_reply('invalid click counter') end
local base = tonumber(ARGV[1])
local count = math.max(current, base)
`;
const readScript =
  prelude +
  `
redis.call('HSET', KEYS[1], 'hits', string.format('%.0f', count))
return string.format('%.0f', count)
`;
export async function readHotClickCount(
  store: Pick<Redis, "eval">,
  linkId: string,
  base: number,
): Promise<number> {
  validateBase(base);
  const value = Number(
    await store.eval(readScript, 1, hotClickCountKey(linkId), base),
  );
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Invalid click counter response");
  return value;
}
export const countedClickScript =
  prelude +
  `
local id = redis.call('XADD', KEYS[1], '*', unpack(ARGV, 2))
redis.call('HSET', KEYS[2], 'hits', string.format('%.0f', math.min(9007199254740991, count + 1)))
return id
`;
const incrementScript =
  prelude +
  `
redis.call('HSET', KEYS[1], 'hits', string.format('%.0f', math.min(9007199254740991, count + 1)))
return 1
`;
export async function incrementUntrackedClickCount(
  store: Pick<Redis, "eval">,
  linkId: string,
  base: number,
): Promise<void> {
  validateBase(base);
  await store.eval(incrementScript, 1, hotClickCountKey(linkId), base);
}
