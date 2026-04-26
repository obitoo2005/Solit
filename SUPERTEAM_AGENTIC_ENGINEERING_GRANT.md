# Solit - Agentic Engineering Grant Application

> Generated: April 26, 2026
> Grant link: https://superteam.fun/earn/grants/agentic-engineering
> Grant amount shown on listing: 200 USDG
> AI transcript exported to project root: `./codex-session.jsonl`

## Step 1: Basics

**Project Title**
> Solit

**Live Demo**
> https://solit-sandy.vercel.app

**One Line Description**
> A group expense app that turns "who owes whom" into real onchain settlement in USDC or SOL, including one-signature atomic payouts to multiple friends.

**TG username**
> t.me/obitoo2005

**Wallet Address**
> 52avYqiagB4wYsuNPZGQ3peQ3vfTVE2bGyr9aM64b53P

## Step 2: Details

**Project Details**
> Solit exists because the current bill-splitting stack is incomplete. Apps like Splitwise are good at tracking balances, but the actual repayment still happens somewhere else: bank transfer, Venmo, cash, or a long chain of reminders in a group chat. That is annoying for local groups and much worse for international ones, where geography, banking rails, and fees become part of the product experience.
>
> Solit combines the coordination layer and the settlement layer in one app. Users create groups, add expenses, choose equal or custom splits, attach receipts, comment on specific items, and get realtime updates as the group changes. When it is time to settle, the app computes the minimum-transfer plan and executes repayment directly on Solana in USDC or SOL.
>
> The core differentiator is atomic bundle settlement. If one person owes multiple friends, Solit can package those transfers into one transaction so the user signs once and clears every balance in one onchain action. That is hard to do with traditional fintech products without becoming a custodian. On Solana, it is a natural consumer feature because fees are low enough, confirmation is fast enough, and multi-instruction transactions are first-class.
>
> The product is already meaningfully built, not just scoped. The current app supports wallet sign-in, invite links, group management, payer selection, custom splits, receipt uploads, comments, recurring expenses, realtime notifications, USDC settlement, SOL settlement with live conversion, and preflight checks that stop doomed transactions before signing. The grant would help push the product from a strong devnet implementation into a hardened public mainnet release.

**Deadline**
> May 8, 2026 (Asia/Calcutta) - target public mainnet launch

**Proof of Work**
> Live deployed app: https://solit-sandy.vercel.app
> Primary repo: https://github.com/obitoo2005/Solit
>
> This is not a concept-only application. The product is shipped, deployed on Vercel, and reviewable end-to-end on Solana devnet by anyone with a Phantom wallet. The repo already shows shipped product depth and continued iteration. Recent commits include:
> - `97981af` fix settle preflight flow so failed attempts reject clearly instead of auto-airdrop behavior
> - `62f12a9` add in-app SOL airdrop preflight plus improved send/receive UX
> - `caa7af2` add pre-flight balance checks to block doomed transactions
> - `46eff6f` replace native confirm dialogs with styled async confirmation flow
> - `7be6017` ship emoji tags, comments, notifications with realtime, and recurring expenses
> - `37b5a29` add SOL settlement option alongside USDC
> - `aef89be` ship payer picker, edit/delete, self-leave, balance cards, settle-all, and receipts
>
> The current README documents working product behavior, including:
> - One-signature atomic settle-all flow for multiple recipients
> - USDC SPL transfers with associated token account creation
> - SOL transfers with live USD conversion preview
> - Supabase-backed realtime notifications, comments, and receipts
> - Cluster-aware Solana flow with devnet/mainnet switching
>
> Prior shipped work that supports execution credibility:
> - Grave live app: https://grave-psi.vercel.app
> - Grave repo: https://github.com/obitoo2005/grave
> - Grave docs: https://www.notion.so/Grave-3309700c7cf58098a948f98bd087876d
>
> AI-assisted development proof attached:
> - `./codex-session.jsonl`

**Personal X Profile**
> x.com/satouweb3

**Personal GitHub Profile**
> github.com/obitoo2005

**Colosseum Crowdedness Score**
> 223 — moderately crowded (generated via the colosseum-copilot skill from solana.new). Screenshot uploaded to the same Drive folder as this document.
>
> Closest comparable projects surfaced by Copilot include Tangerii, Chipin, Fatira, WeSplit, and Ledger & Pay. That confirms the category is real, but it also sharpens Solit's wedge: most comparable apps focus on bill tracking or basic onchain settlement, while Solit is centered on direct settlement in USDC or SOL with atomic multi-recipient repayment in one signed transaction.
>
> For the form submission, I will attach the Copilot screenshot via a public Google Drive link.

**AI Session Transcript**
> Attach `./codex-session.jsonl` from the project root as proof of AI-assisted development.

## Step 3: Milestones

**Goals and Milestones**
> Milestone 1 - by May 1, 2026
> - Tighten Supabase RLS policies for production use
> - Complete mainnet configuration review for USDC mint and settlement paths
> - Run end-to-end smoke tests for single-recipient and settle-all flows
>
> Milestone 2 - by May 4, 2026
> - Improve first-time onboarding for non-crypto-native users
> - Add clearer empty-wallet and insufficient-balance guidance
> - Polish mobile interaction flows around send, receive, and settlement
>
> Milestone 3 - by May 7, 2026
> - Complete launch checklist for production deployment and monitoring
> - Prepare launch assets, demo walkthrough, and community distribution
> - Verify mainnet settlement with real low-value transactions
>
> Milestone 4 - by May 8, 2026
> - Public mainnet launch
> - Publish demo and onboarding materials
> - Start collecting real settlement usage data from first users

**Primary KPI**
> Number of unique wallets that complete at least one onchain settlement in Solit within 30 days of launch.

**Final tranche checkbox**
> Confirmed. For the final tranche, I will submit the Colosseum project link, GitHub repo, and AI subscription receipt.

## Submission Notes

**Files to attach**
> - `./codex-session.jsonl`
> - Colosseum Crowdedness Score screenshot uploaded to a public Drive link
> - This application draft

**Submission link**
> https://superteam.fun/earn/grants/agentic-engineering

## Final Checks

- Confirm the Telegram, wallet, X handle, and deadline are still current.
- Verify the Drive folder is set to "Anyone with the link can view" so reviewers can open the Crowdedness Score screenshot and the codex-session.jsonl without access requests.
- Open https://solit-sandy.vercel.app in incognito on a phone before submitting to confirm the latest fixes (logo, drawer, branded confirms, send/receive modals) are deployed.
