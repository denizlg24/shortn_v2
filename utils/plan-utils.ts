export type SubscriptionsType = 'free'|'basic'|'plus'|'pro';

export const allowed_links : Record<SubscriptionsType,number> = {
    'free':3,
    'basic':25,
    'plus':50,
    'pro':-1
}

export const allowed_qr_codes: Record<SubscriptionsType,number> = {
    'free':3,
    'basic':25,
    'plus':50,
    'pro':-1
}