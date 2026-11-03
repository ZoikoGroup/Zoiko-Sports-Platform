// Mock data for the dashboard. Swap these for API calls when the backend is ready.

export type Team = { code: string; name: string; colors: [string, string] };

export const TEAMS = {
  whu: { code: "WHU", name: "West Ham United", colors: ["#7a263a", "#1bb1e7"] },
  lev: { code: "LEV", name: "Bayer Leverkusen", colors: ["#e32221", "#111111"] },
  atm: { code: "ATM", name: "Atletico Madrid", colors: ["#cb3524", "#272e61"] },
  eib: { code: "EIB", name: "Eibar", colors: ["#0b2e7a", "#a6192e"] },
  vll: { code: "VLL", name: "Real Valladolid", colors: ["#5b2c83", "#ffffff"] },
  mll: { code: "MLL", name: "Mallorca", colors: ["#e20613", "#000000"] },
  leg: { code: "LEG", name: "Leganes", colors: ["#1d4f9c", "#ffffff"] },
  ala: { code: "ALA", name: "Alaves", colors: ["#0761af", "#ffffff"] },
  vil: { code: "VIL", name: "Villarreal", colors: ["#fde92b", "#005187"] },
  ath: { code: "ATH", name: "Athletic Bilbao", colors: ["#ee2523", "#ffffff"] },
  bet: { code: "BET", name: "Real Betis", colors: ["#0bb363", "#ffffff"] },
  sev: { code: "SEV", name: "Sevilla", colors: ["#d71920", "#ffffff"] },
  ars: { code: "ARS", name: "Arsenal", colors: ["#ef0107", "#ffffff"] },
  che: { code: "CHE", name: "Chelsea", colors: ["#034694", "#ffffff"] },
  liv: { code: "LIV", name: "Liverpool", colors: ["#c8102e", "#00b2a9"] },
  mci: { code: "MCI", name: "Manchester City", colors: ["#6cabdd", "#1c2c5b"] },
  mbg: { code: "MBG", name: "Mohun Bagan", colors: ["#7a1f2b", "#0b6e4f"] },
  ebg: { code: "EBG", name: "East Bengal", colors: ["#d0112b", "#f6c700"] },
  hof: { code: "TSG", name: "TSG 1899 Hoffenheim", colors: ["#1961b5", "#ffffff"] },
  bvb: { code: "BVB", name: "Borussia Dortmund", colors: ["#fde100", "#000000"] },
  fcb: { code: "FCB", name: "Bayern Munich", colors: ["#dc052d", "#0066b2"] },
  juv: { code: "JUV", name: "Juventus", colors: ["#111111", "#ffffff"] },
  int: { code: "INT", name: "Inter", colors: ["#0068a8", "#111111"] },
} satisfies Record<string, Team>;

export type League = { slug: string; name: string; code: string; color: string; country: string; flag: [string, string, string] };

export const LEAGUES: League[] = [
  { slug: "premier-league", name: "Premier League", code: "PL", color: "#3d195b", country: "England", flag: ["#ffffff", "#ce1124", "#ffffff"] },
  { slug: "i-league", name: "I-League", code: "IL", color: "#f08c00", country: "India", flag: ["#ff9933", "#ffffff", "#138808"] },
  { slug: "laliga", name: "LaLiga", code: "LL", color: "#ee3524", country: "Spain", flag: ["#c60b1e", "#ffc400", "#c60b1e"] },
  { slug: "bundesliga", name: "Bundesliga", code: "BL", color: "#d20515", country: "Germany", flag: ["#000000", "#dd0000", "#ffce00"] },
  { slug: "serie-a", name: "Serie A", code: "SA", color: "#008fd7", country: "Italy", flag: ["#009246", "#ffffff", "#ce2b37"] },
];

export type Club = { slug: string; team: Team; league: string; founded: number; stadium: string };

export const CLUBS: Club[] = [
  { slug: "tsg-hoffenheim", team: TEAMS.hof, league: "bundesliga", founded: 1899, stadium: "PreZero Arena" },
  { slug: "borussia-dortmund", team: TEAMS.bvb, league: "bundesliga", founded: 1909, stadium: "Signal Iduna Park" },
  { slug: "arsenal", team: TEAMS.ars, league: "premier-league", founded: 1886, stadium: "Emirates Stadium" },
  { slug: "villarreal", team: TEAMS.vil, league: "laliga", founded: 1923, stadium: "Estadio de la Cerámica" },
];

export type MatchStatus = "live" | "finished" | "scheduled";

export type Match = {
  id: string;
  league: string;
  time: string;
  date: string;
  home: Team;
  away: Team;
  status: MatchStatus;
  score?: string;
  minute?: number;
  tipsters: string[];
};

export const MATCHES: Match[] = [
  { id: "m1", league: "laliga", time: "4:30", date: "28 Aug", home: TEAMS.atm, away: TEAMS.eib, status: "live", score: "2:3", minute: 67, tipsters: ["Dolly Krista", "Richa Pinto", "Micky Larcko"] },
  { id: "m2", league: "laliga", time: "3:02", date: "29 Aug", home: TEAMS.vll, away: TEAMS.mll, status: "scheduled", tipsters: ["Aria Stone", "Leo Park", "Nia Cole"] },
  { id: "m3", league: "laliga", time: "3:02", date: "29 Aug", home: TEAMS.leg, away: TEAMS.ala, status: "scheduled", tipsters: ["Omar Haddad", "Mia Lopez", "Raj Mehta"] },
  { id: "m4", league: "laliga", time: "3:02", date: "29 Aug", home: TEAMS.vil, away: TEAMS.ath, status: "scheduled", tipsters: ["Sara Kim", "Tom Reyes", "Ivy Chen"] },
  { id: "m5", league: "laliga", time: "1:15", date: "27 Aug", home: TEAMS.bet, away: TEAMS.sev, status: "finished", score: "1:1", tipsters: ["Max Kembli", "Dolly Krista", "Leo Park"] },
  { id: "m6", league: "premier-league", time: "5:30", date: "28 Aug", home: TEAMS.ars, away: TEAMS.che, status: "live", score: "1:0", minute: 34, tipsters: ["Leo Park", "Nia Cole", "Ivy Chen"] },
  { id: "m7", league: "premier-league", time: "8:00", date: "30 Aug", home: TEAMS.liv, away: TEAMS.mci, status: "scheduled", tipsters: ["Raj Mehta", "Sara Kim", "Dolly Krista"] },
  { id: "m8", league: "i-league", time: "7:00", date: "29 Aug", home: TEAMS.mbg, away: TEAMS.ebg, status: "scheduled", tipsters: ["Raj Mehta", "Richa Pinto", "Omar Haddad"] },
  { id: "m9", league: "bundesliga", time: "2:30", date: "27 Aug", home: TEAMS.hof, away: TEAMS.bvb, status: "finished", score: "2:2", tipsters: ["Tom Reyes", "Aria Stone", "Mia Lopez"] },
  { id: "m10", league: "bundesliga", time: "6:30", date: "31 Aug", home: TEAMS.fcb, away: TEAMS.hof, status: "scheduled", tipsters: ["Micky Larcko", "Leo Park", "Sara Kim"] },
  { id: "m11", league: "serie-a", time: "7:45", date: "30 Aug", home: TEAMS.juv, away: TEAMS.int, status: "scheduled", tipsters: ["Ivy Chen", "Omar Haddad", "Nia Cole"] },
];

export const FOLLOWING = [
  "Dolly Krista", "Richa Pinto", "Micky Larcko", "Aria Stone", "Leo Park",
  "Nia Cole", "Omar Haddad", "Mia Lopez", "Raj Mehta", "Sara Kim",
];

export const BALANCE_SERIES = [
  { label: "Oct 1", value: 412 }, { label: "Oct 2", value: 448 }, { label: "Oct 3", value: 421 },
  { label: "Oct 4", value: 436 }, { label: "Oct 5", value: 402 }, { label: "Oct 6", value: 431 },
  { label: "Oct 7", value: 455 }, { label: "Oct 8", value: 418 }, { label: "Oct 9", value: 396 },
  { label: "Oct 10", value: 409 }, { label: "Oct 11", value: 384 }, { label: "Oct 12", value: 441 },
  { label: "Oct 13", value: 427 }, { label: "Oct 14", value: 470 }, { label: "Oct 15", value: 452 },
  { label: "Oct 16", value: 489.87 },
];

export const NOTIFICATIONS = [
  { name: "Dolly Krista", text: "+2,568 profit on Football", time: "4:20pm", tone: "success" as const },
  { name: "Richa Pinto", text: "+1,546 profit on Horse Racing", time: "4:12pm", tone: "success" as const },
  { name: "Micky Larcko", text: "New tip: Atletico vs Eibar", time: "3:58pm", tone: "info" as const },
  { name: "Aria Stone", text: "Requested payout of 320", time: "3:41pm", tone: "warn" as const },
];

export const KPIS = [
  { label: "Total users", value: 48210, delta: 12.4, suffix: "" },
  { label: "Tips today", value: 1864, delta: 6.1, suffix: "" },
  { label: "Revenue", value: 92.4, delta: -2.3, suffix: "k" },
  { label: "Win rate", value: 67.8, delta: 3.2, suffix: "%" },
];

export const TIPSTERS = [
  { name: "Dolly Krista", specialty: "Football · LaLiga", winRate: 78, profit: 2568, followers: 12840, streak: 7 },
  { name: "Richa Pinto", specialty: "Horse Racing", winRate: 71, profit: 1546, followers: 9310, streak: 4 },
  { name: "Micky Larcko", specialty: "Football · Premier League", winRate: 69, profit: 1204, followers: 8122, streak: 3 },
  { name: "Aria Stone", specialty: "Tennis", winRate: 66, profit: 980, followers: 6450, streak: 2 },
  { name: "Leo Park", specialty: "Football · Bundesliga", winRate: 64, profit: 812, followers: 5980, streak: 5 },
  { name: "Nia Cole", specialty: "Basketball", winRate: 62, profit: 640, followers: 4210, streak: 1 },
  { name: "Omar Haddad", specialty: "Football · Serie A", winRate: 61, profit: 522, followers: 3870, streak: 2 },
  { name: "Raj Mehta", specialty: "Cricket · I-League", winRate: 59, profit: 410, followers: 3105, streak: 0 },
];

export const HOT_TIPS = [
  { id: "t1", match: "m1", pick: "Over 4.5 goals", odds: 2.1, confidence: 82, tipster: "Dolly Krista", backers: 412 },
  { id: "t2", match: "m6", pick: "Arsenal to win", odds: 1.75, confidence: 74, tipster: "Micky Larcko", backers: 368 },
  { id: "t3", match: "m7", pick: "Both teams to score", odds: 1.62, confidence: 71, tipster: "Leo Park", backers: 301 },
  { id: "t4", match: "m10", pick: "Bayern −1.5", odds: 2.4, confidence: 64, tipster: "Leo Park", backers: 255 },
  { id: "t5", match: "m11", pick: "Under 2.5 goals", odds: 1.9, confidence: 61, tipster: "Omar Haddad", backers: 198 },
  { id: "t6", match: "m8", pick: "Mohun Bagan draw no bet", odds: 1.55, confidence: 58, tipster: "Raj Mehta", backers: 143 },
];

export const FEED = [
  { id: "f1", name: "Dolly Krista", time: "12 min ago", text: "Atletico pressing high all game. Eibar look tired after 60'. Riding the over.", match: "m1", pick: "Over 4.5 goals @ 2.10", likes: 214, comments: 38 },
  { id: "f2", name: "Micky Larcko", time: "40 min ago", text: "Arsenal unbeaten at home in 9. Chelsea missing two starting CBs. Easy call for me.", match: "m6", pick: "Arsenal to win @ 1.75", likes: 167, comments: 22 },
  { id: "f3", name: "Leo Park", time: "1 h ago", text: "Hoffenheim vs Dortmund ended 2:2 as called. Profit +312 on the day. Next up: Bayern.", match: "m9", pick: "BTTS ✔ settled", likes: 301, comments: 54 },
  { id: "f4", name: "Raj Mehta", time: "3 h ago", text: "Kolkata derby this weekend. Form says Bagan but derbies are derbies. Small stake only.", match: "m8", pick: "Bagan DNB @ 1.55", likes: 88, comments: 17 },
];

export type UserStatus = "active" | "suspended" | "pending";

export const USERS: { id: string; name: string; email: string; role: string; status: UserStatus; joined: string; tips: number }[] = [
  { id: "u1", name: "Dolly Krista", email: "dolly@zoikosports.com", role: "Tipster", status: "active", joined: "12 Jan 2026", tips: 482 },
  { id: "u2", name: "Richa Pinto", email: "richa@zoikosports.com", role: "Tipster", status: "active", joined: "03 Feb 2026", tips: 391 },
  { id: "u3", name: "Micky Larcko", email: "micky@zoikosports.com", role: "Tipster", status: "active", joined: "21 Feb 2026", tips: 344 },
  { id: "u4", name: "Aria Stone", email: "aria@example.com", role: "Member", status: "pending", joined: "29 Oct 2026", tips: 0 },
  { id: "u5", name: "Leo Park", email: "leo@zoikosports.com", role: "Moderator", status: "active", joined: "08 Mar 2026", tips: 205 },
  { id: "u6", name: "Nia Cole", email: "nia@example.com", role: "Member", status: "suspended", joined: "14 Apr 2026", tips: 37 },
  { id: "u7", name: "Omar Haddad", email: "omar@example.com", role: "Tipster", status: "active", joined: "02 May 2026", tips: 158 },
  { id: "u8", name: "Raj Mehta", email: "raj@example.com", role: "Member", status: "pending", joined: "01 Nov 2026", tips: 4 },
];

export type PayoutStatus = "pending" | "approved" | "rejected";

export const PAYOUTS: { id: string; name: string; amount: number; method: string; requested: string; status: PayoutStatus }[] = [
  { id: "PO-1042", name: "Aria Stone", amount: 320, method: "Bank transfer", requested: "03 Nov, 15:41", status: "pending" },
  { id: "PO-1041", name: "Dolly Krista", amount: 1250, method: "PayPal", requested: "03 Nov, 11:02", status: "pending" },
  { id: "PO-1040", name: "Leo Park", amount: 480, method: "Bank transfer", requested: "02 Nov, 18:20", status: "approved" },
  { id: "PO-1039", name: "Nia Cole", amount: 95, method: "Card", requested: "02 Nov, 09:13", status: "rejected" },
  { id: "PO-1038", name: "Micky Larcko", amount: 860, method: "PayPal", requested: "01 Nov, 21:47", status: "approved" },
  { id: "PO-1037", name: "Omar Haddad", amount: 210, method: "Bank transfer", requested: "01 Nov, 14:30", status: "pending" },
];

export const matchById = (id: string) => MATCHES.find((m) => m.id === id)!;
export const leagueBySlug = (slug: string) => LEAGUES.find((l) => l.slug === slug);
