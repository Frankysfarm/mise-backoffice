import { createHmac } from "node:crypto"

const secret = process.argv[2]
const role = process.argv[3]
if (!secret || !role) throw new Error("usage: local-jwt.mjs secret role")

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url")
const header = encode({ alg: "HS256", typ: "JWT" })
const payload = encode({
  iss: "mise-test-lab",
  sub: `testlab-${role}`,
  role,
  iat: 1_700_000_000,
  exp: 1_900_000_000,
})
const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")
process.stdout.write(`${header}.${payload}.${signature}`)
