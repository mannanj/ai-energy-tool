import { sign } from "../worker/auth";

const secret = process.env.SESSION_SECRET;
if (!secret) { console.error("SESSION_SECRET is required (security find-generic-password -a $USER -s ai-energy-tool-session-secret -w)"); process.exit(1); }
const exp = Math.floor(Date.now() / 1000) + 3600;
const gate = await sign({ g: 1, exp }, secret);
const session = await sign({ id: "e2e", firstName: "E2E", lastName: "Test", email: "e2e@example.invalid", color: "#888888", exp }, secret);
console.log(`aet_gate=${encodeURIComponent(gate)}; aet_session=${encodeURIComponent(session)}`);
