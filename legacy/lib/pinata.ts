"server only"

import env from "@/utils/env"
import { PinataSDK } from "pinata"

export const pinata = new PinataSDK({
    pinataJwt: `${env.PINATA_JWT}`,
    pinataGateway: `${env.PINATA_GATEWAY}`
})