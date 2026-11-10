import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyzeChannelSlice,
  parseDiscordBrowserCapture
} from "../templates/discord-signal-radar/workspace/scripts/signal-engine.mjs";

const SAMPLE_DISCORD_BROWSER_TEXT = `
Patrick Erichsen [CLAW], Rol simgesi, OpenClaw Foundation — 01:00
wondering how folks feel about just ripping out all the non-openclaw parts to make it simpler for us to use
eg no profiles/openclaw.yml to specify openclaw specific things
Mitchell Etzel [CLAW], Rol simgesi, Clawkeeper — 01:00
I think it makes sense for now. Build it first then make it cross compatible
Json [CLAW], Rol simgesi, OpenClaw Foundation — 01:01
I'm gonna serve you as an amaebi nigiri in a omakase
Krill — 01:03
Oof, fair.
Jacqueline Henriksen (Ritz) [CLAW], Rol simgesi, Clawkeeper — 01:03
second
Patrick Erichsen [CLAW], Rol simgesi, OpenClaw Foundation — 01:06
the goal here was more to define a common standard for file format across all the agent products like us, grok bot, eve, etc
but way too ambitious and just makes our own spec hard to understand
Patrick Erichsen [CLAW], Rol simgesi, OpenClaw Foundation — 01:10
okay so i did forget that part of the intention behind profiles/openclaw.yml was to put all the ugly config into there so that CLAW.md stays more readable.
Holger Gruenhagen — 03:36
Two things I hit while publishing, in case they save someone time: ClawHub CLI 0.25.1 rejects an empty automations: [] in CLAW.md, so drop the key if you have no schedules.
Alex Dev — 03:38
Anyone tried handoff-coordinator or clawhandoff for multi-agent A2A git verification yet?
Sam Reviewer — 03:39
@mertinGo quick question on the Stage-2 PR gate!
`;

test("parses browser Discord text, filters noise, merges 2-hour interrupted debate, and detects pivots + personal signals", () => {
  const parsed = parseDiscordBrowserCapture(SAMPLE_DISCORD_BROWSER_TEXT, "clawtributors");
  assert.equal(parsed.length, 10);

  const report = analyzeChannelSlice({
    rawInput: SAMPLE_DISCORD_BROWSER_TEXT,
    channelKey: "clawtributors",
    watchlist: {
      handles: ["mertinGo", "MertBasar0"],
      projects: ["clawhandoff", "handoff-coordinator"],
      relatedTopics: ["a2a", "stage-2"]
    }
  });

  assert.equal(report.shouldNotify, true);
  assert.ok(report.noiseFilteredCount >= 2, "Expected short banter/reactions to be filtered");

  // Personal radar catches both direct @mertinGo mention (P1) and untagged clawhandoff/handoff-coordinator mention (P2)
  assert.equal(report.personalSignals.length, 2);
  assert.equal(report.personalSignals[0].tier, "direct_mention");
  assert.deepEqual(report.personalSignals[0].matchedTerms, ["mertingo"]);
  assert.equal(report.personalSignals[1].tier, "own_project");
  assert.ok(report.personalSignals[1].matchedTerms.includes("clawhandoff"));

  // Patrick's 01:00, 01:06, and 01:10 messages about profiles/openclaw.yml & CLAW.md cluster together despite banter in between
  const openclawProfileCluster = report.discussions.find((d) =>
    d.topicKeywords.some((k) => k.includes("openclaw.yml") || k.includes("claw.md"))
  );
  assert.ok(openclawProfileCluster, "Expected a unified discussion cluster for profiles/openclaw.yml");
  assert.ok(openclawProfileCluster.messageCount >= 3, "Expected interrupted messages to merge into one topic");
  assert.ok(
    openclawProfileCluster.evolution.pivotsAndShifts.length >= 1,
    "Expected 'i did forget' pivot to be captured in evolution.pivotsAndShifts"
  );
});

test("cursor watermark skips already-summarized messages and suppresses notification when only noise arrives", () => {
  const firstRun = analyzeChannelSlice({
    rawInput: SAMPLE_DISCORD_BROWSER_TEXT,
    channelKey: "clawtributors",
    watchlist: { handles: ["mertinGo"] }
  });
  assert.equal(firstRun.unreadMessages, 10);

  const appendedWithOnlyNoise = `${SAMPLE_DISCORD_BROWSER_TEXT}\nRandom User — 03:45\nlol\nAnother User — 03:46\nsecond\n`;
  const secondRun = analyzeChannelSlice({
    rawInput: appendedWithOnlyNoise,
    channelKey: "clawtributors",
    watchlist: { handles: ["mertinGo"] },
    cursors: { clawtributors: firstRun.proposedCursor }
  });

  assert.equal(secondRun.unreadMessages, 2);
  assert.equal(secondRun.noiseFilteredCount, 2);
  assert.equal(secondRun.discussions.length, 0);
  assert.equal(secondRun.personalSignals.length, 0);
  assert.equal(secondRun.shouldNotify, false, "Quiet/banter-only delta must set shouldNotify=false for NO_REPLY");
});

test("ingests discrawl --json messages rows and detects indirect relatedTopics signals", () => {
  const discrawlRows = [
    {
      id: "190001",
      channel_name: "architecture",
      author_name: "Alice",
      created_at: "2026-11-10T01:00:00Z",
      content: "Has anyone compared Agent2Agent task continuation with ACP stdio sessions?"
    },
    {
      id: "190002",
      channel_name: "architecture",
      author_name: "Bob",
      created_at: "2026-11-10T01:12:00Z",
      reply_to_id: "190001",
      content: "Actually in hindsight A2A contextId alone isn't enough when a task stays input_required."
    }
  ];

  const report = analyzeChannelSlice({
    rawInput: discrawlRows,
    channelKey: "architecture",
    watchlist: {
      handles: ["mertinGo"],
      projects: ["clawhandoff"],
      relatedTopics: ["agent2agent", "acp"]
    }
  });

  assert.equal(report.personalSignals.length, 1);
  assert.equal(report.personalSignals[0].tier, "related_work");
  assert.equal(report.discussions.length, 1);
  assert.equal(report.discussions[0].messageCount, 2);
  assert.equal(report.discussions[0].evolution.pivotsAndShifts.length, 1);
});

test("parses real multi-line Discord DOM ol.innerText with continuation timestamps, server tags, and reaction footers", () => {
  const domInnerText = [
    "Patrick Erichsen\u00a0[CLAW],\u00a0",
    "Sunucu Etiketi: CLAW",
    "CLAW",
    "OpenClaw Foundation",
    " — ",
    "04:06",
    "10 Kasım 2026 Salı 04:06",
    "First message in DOM innerText",
    "1",
    "Tepki Ekle",
    "[",
    "04:07",
    "]",
    "10 Kasım 2026 Salı 04:07",
    "Continuation message without repeated h3 author",
    "roboclaw",
    "Crustaceans",
    "DOĞRULANMIŞ UYGULAMA",
    "UYG",
    " — ",
    "05:09",
    "10 Kasım 2026 Salı 05:09",
    "Mert — Handoff Coordinator listed on ClawHub!"
  ].join("\n");

  const parsed = parseDiscordBrowserCapture(domInnerText, "focus-week");
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].author, "Patrick Erichsen");
  assert.equal(parsed[1].author, "Patrick Erichsen");
  assert.equal(parsed[1].content, "Continuation message without repeated h3 author");
  assert.equal(parsed[2].author, "roboclaw");
});
