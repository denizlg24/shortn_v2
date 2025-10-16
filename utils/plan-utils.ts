export type SubscriptionsType = 'free' | 'basic' | 'plus' | 'pro';

export const allowed_links: Record<SubscriptionsType, number> = {
    'free': 3,
    'basic': 25,
    'plus': 50,
    'pro': -1
}

export const allowed_qr_codes: Record<SubscriptionsType, number> = {
    'free': 3,
    'basic': 25,
    'plus': 50,
    'pro': -1
}

export const getRelativeOrder = (a: SubscriptionsType, b: SubscriptionsType) => {
    switch (a) {
        case "free":
            if (b == 'free') {
                return 0;
            }
            return 1;
        case "basic":
            if (b == 'free') {
                return -1;
            }
            if (b == 'basic') {
                return 0;
            }
            return 1;
        case "plus":
            if (b == 'pro') {
                return 1;
            }
            if (b == 'plus') {
                return 0;
            }
            return -1;
        case "pro":
            if (b == 'pro') {
                return 0;
            }
            return -1;
    }
}