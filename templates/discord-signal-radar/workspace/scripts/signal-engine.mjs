#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "from", "have", "just", "not", "are", "was", "were",
  "but", "you", "your", "our", "out", "all", "can", "will", "would", "could", "should", "about",
  "into", "what", "when", "where", "who", "how", "why", "there", "their", "they", "them", "then",
  "than", "some", "more", "most", "other", "only", "also", "very", "much", "make", "made", "like",
  "think", "know", "really", "sure", "yeah", "yep", "nope", "lol", "lmao", "haha", "omg", "imo",
  "tbh", "rn", "one", "two", "use", "using", "used", "get", "got", "has", "had", "been", "being",
  "bir", "bu", "şu", "ve", "ile", "için", "ama", "fakat", "çok", "daha", "gibi", "olan", "olarak",
  "var", "yok", "ben", "sen", "biz", "siz", "onlar", "mi", "mı", "mu", "mü", "da", "de", "ki", "ne"
]);

const NOISE_PATTERNS = [
  /^(?:(?:lol+|lmao+|haha+|hehe+|omg|oof|fair|nice|cool|neat|sweet|same|second|agreed|true|facts|based|yep|yup|nope|ty|thx|thanks|\+1|👀|🔥|🦞|🍤)[!.,?\s]*)+$/iu
];

const PIVOT_PATTERNS = [
  /\b(?:in hindsight|actually|i did forget|forgot that|wait|scratch that|instead of|turns out|on second thought|changed? my mind|decided to|let'?s go with|we should keep|premature)\b/i,
  /\b(?:aslında|vazgeçtim|unutmuşum|sonradan fark ettim|bunun yerine|karar verdik|değiştirdik)\b/i
];

const ACTION_OR_WARNING_PATTERNS = [
  /\b(?:rejects?|breaks?|broken|bug|error|warning|heads[- ]up|save someone time|watch out|regression|published|shipped|released|blocked)\b/i,
  /\b(?:hata|uyarı|dikkat|kırılıyor|yayınladım|çözdüm|engel)\b/i
];

export function stableAnchorId(channelKey, author, timestamp, content) {
  const sample = `${channelKey}|${author.trim().toLowerCase()}|${String(timestamp ?? "").trim()}|${content.trim().slice(0, 160)}`;
  return `anc_${createHash("sha256").update(sample).digest("hex").slice(0, 16)}`;
}

export function extractTokens(text) {
  const cleaned = String(text ?? "")
    .replace(/https?:\/\/\S+/gi, " ")
    .toLowerCase();
  const matches = cleaned.match(/[a-z0-9çğıöşü_./:-]{3,}/giu) ?? [];
  const tokens = new Set();
  for (const raw of matches) {
    const token = raw.replace(/^[:./_-]+|[:./_-]+$/g, "");
    if (token.length < 3 || STOPWORDS.has(token) || /^\d+$/.test(token)) continue;
    tokens.add(token);
  }
  return tokens;
}

export function isLowSignalChatter(content, hasPersonalHit = false) {
  if (hasPersonalHit) return false;
  const trimmed = String(content ?? "").trim();
  if (!trimmed) return true;
  if (/https?:\/\//i.test(trimmed) || /`[^`]+`/.test(trimmed)) return false;
  if (NOISE_PATTERNS.some((re) => re.test(trimmed))) return true;
  const tokens = extractTokens(trimmed);
  return trimmed.length < 22 && tokens.size <= 1;
}

/**
 * Parse copied/extracted Discord Web text, multi-line ol[data-list-id="chat-messages"].innerText,
 * or ARIA snapshot text into normalized messages.
 */
export function parseDiscordBrowserCapture(rawText, channelKey = "browser-channel") {
  const rawLines = String(rawText ?? "").replace(/\r\n/g, "\n").split("\n");
  // Pre-normalize multi-line Discord DOM innerText into single-line headers:
  // Pattern 1: Author lines ... \n " — " \n "04:06" \n "10 Kasım 2026 Salı 04:06"
  // Pattern 2 (continuation message by same author): "[" \n "04:07" \n "]" \n "10 Kasım 2026 Salı 04:07"
  const lines = [];
  let lastHeaderAuthor = "unknown";
  for (let i = 0; i < rawLines.length; i += 1) {
    const trimmed = rawLines[i].trim();
    if (
      trimmed === "[" &&
      /^\d{1,2}:\d{2}$/.test((rawLines[i + 1] ?? "").trim()) &&
      (rawLines[i + 2] ?? "").trim() === "]"
    ) {
      const hm = rawLines[i + 1].trim();
      lines.push(`${lastHeaderAuthor} — ${hm}`);
      i += 2;
      if (isStandaloneDateLine(rawLines[i + 1])) i += 1;
      continue;
    }
    if (trimmed === "—" && /^\d{1,2}:\d{2}$/.test((rawLines[i + 1] ?? "").trim())) {
      const hm = rawLines[i + 1].trim();
      // Walk backward over badge/role lines in `lines` to recover the author line
      let authorCandidate = "";
      while (lines.length > 0) {
        const prev = lines[lines.length - 1].trim();
        if (!prev || isBadgeOrRoleLine(prev)) {
          lines.pop();
          continue;
        }
        authorCandidate = cleanAuthorName(lines.pop());
        break;
      }
      if (authorCandidate) lastHeaderAuthor = authorCandidate;
      lines.push(`${lastHeaderAuthor} — ${hm}`);
      i += 1;
      if (isStandaloneDateLine(rawLines[i + 1])) i += 1;
      continue;
    }
    if (trimmed === "Tepki Ekle" || trimmed === "Add Reaction") {
      // Remove reaction count line(s) right above "Tepki Ekle" / "Add Reaction"
      while (lines.length > 0 && /^\d{1,3}$/.test(lines[lines.length - 1].trim())) {
        lines.pop();
      }
      continue;
    }
    lines.push(rawLines[i]);
  }

  const headerRe = /^([^—\n]{1,64}?)\s*(?:\[[^\]]+\],?\s*)?(?:Rol simgesi,[^\n—]+?)?\s*—\s*(\d{1,2}:\d{2}|(?:Today|Yesterday|Bugün|Dün)[^\n]{0,20}|\d{1,2}[./]\d{1,2}[./]\d{2,4}[^\n]{0,16})\s*$/u;
  const messages = [];
  let current = null;
  let pendingReplyTo = null;

  const flush = () => {
    if (!current) return;
    // Strip trailing inline reply-preview pair (@User on its own short line without punctuation + preview line)
    // that Discord DOM innerText places immediately above the NEXT message's author header.
    while (
      current.lines.length >= 3 &&
      /^@[A-Za-z0-9_.-]{2,32}$/u.test(current.lines[current.lines.length - 2].trim())
    ) {
      const targetLine = current.lines[current.lines.length - 2].trim();
      pendingReplyTo = cleanAuthorName(targetLine.slice(1));
      current.lines.splice(current.lines.length - 2, 2);
    }
    const content = current.lines
      .filter(
        (line) =>
          !/^(?:Görsel|Image|UYG|APP|BOT|Yanıtla|Reply|İlet|Forward|Başlık Oluştur|Create Thread|Daha Fazla|More|Tepki vermek için tıkla|Click to react|:[a-z0-9_+-]+:|\[[^\]]{1,8}\],?)$/iu.test(
            line.trim()
          ) &&
          !isStandaloneDateLine(line) &&
          !isBadgeOrRoleLine(line.trim())
      )
      .join("\n")
      .replace(/\(düzenlendi\)|\(edited\)/giu, "")
      .trim();
    if (content) {
      messages.push({
        id: stableAnchorId(channelKey, current.author, current.timestamp, content),
        channel: channelKey,
        author: current.author,
        timestamp: current.timestamp,
        replyToAuthor: current.replyToAuthor,
        content
      });
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const replyMatch = line.match(/^\s*(?:Replying to|Yanıtlanan:?)\s*@?([^\n:]{1,48})/iu);
    if (replyMatch) {
      pendingReplyTo = cleanAuthorName(replyMatch[1]);
      continue;
    }
    const headerMatch = line.match(headerRe);
    if (headerMatch) {
      const nextReply = pendingReplyTo;
      pendingReplyTo = null;
      flush();
      const resolvedReply = pendingReplyTo ?? nextReply;
      pendingReplyTo = null;
      current = {
        author: cleanAuthorName(headerMatch[1]),
        timestamp: headerMatch[2].trim(),
        replyToAuthor: resolvedReply,
        lines: []
      };
      continue;
    }
    if (current) {
      current.lines.push(line);
    }
  }
  flush();
  return messages;
}

function isStandaloneDateLine(line) {
  const t = String(line ?? "").trim();
  if (!t) return false;
  return /^(?:\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+\d{4}(?:\s+[A-Za-zÇĞİÖŞÜçğıöşü]+)?(?:\s+\d{1,2}:\d{2})?|(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}.*)$/u.test(
    t
  );
}

function isBadgeOrRoleLine(trimmed) {
  return (
    /^(?:Sunucu Etiketi|Server Tag):/iu.test(trimmed) ||
    /^(?:CLAW|EM—|OpenClaw Foundation|Clawkeeper|Clawtributors|Shell Society|Crustaceans|Doğrulanmış Uygulama|DOĞRULANMIŞ UYGULAMA|DOĞRULANMIŞ|Verified App|VERIFIED APP|UYG|APP|BOT)$/iu.test(
      trimmed
    ) ||
    /^\[[^\]]{1,12}\],?$/.test(trimmed)
  );
}

function cleanAuthorName(raw) {
  return String(raw ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s*(?:Sunucu Etiketi|Server Tag):.*$/iu, "")
    .replace(/(?:Doğrulanmış Uygulama|Verified App|UYG|APP|BOT).*$/u, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/Rol simgesi.*$/iu, "")
    .replace(/[,:\s]+$/g, "")
    .trim();
}

export function normalizeInputMessages(payload, channelKey = "general") {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return normalizeInputMessages(JSON.parse(trimmed), channelKey);
    }
    return parseDiscordBrowserCapture(payload, channelKey);
  }
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.messages)
        ? payload.messages
        : [];
  let lastKnownAuthor = "unknown";
  return rows
    .map((row) => {
      const channel = String(row.channel ?? row.channel_name ?? row.channel_id ?? channelKey);
      const rawAuthor = row.author ?? row.author_name ?? row.username;
      const cleaned = rawAuthor ? cleanAuthorName(rawAuthor) : "";
      const author = cleaned || lastKnownAuthor;
      if (cleaned) lastKnownAuthor = cleaned;
      const timestamp = String(row.timestamp ?? row.created_at ?? "");
      const content = String(row.content ?? row.text ?? "").trim();
      const id = String(row.id ?? row.message_id ?? stableAnchorId(channel, author, timestamp, content));
      const replyContext = row.replyContext ? String(row.replyContext) : null;
      const inferredReplyAuthor =
        row.replyToAuthor
          ? cleanAuthorName(row.replyToAuthor)
          : replyContext?.startsWith("@")
            ? cleanAuthorName(replyContext.slice(1).split(/\s{2,}|\n/)[0]?.split(" ").slice(0, 3).join(" "))
            : null;
      return {
        id,
        channel,
        author,
        timestamp,
        replyToId: row.replyToId ?? row.reply_to_id ?? row.referenced_message_id ?? null,
        replyToAuthor: inferredReplyAuthor,
        url: row.url ?? null,
        content
      };
    })
    .filter((msg) => msg.content.length > 0);
}

export function filterSinceCursor(messages, channelCursor) {
  if (!channelCursor) return messages;
  const seenSet = new Set(channelCursor.recentIds ?? []);
  if (channelCursor.lastId) {
    const idx = messages.findIndex((m) => m.id === channelCursor.lastId);
    if (idx >= 0) {
      return messages.slice(idx + 1).filter((m) => !seenSet.has(m.id));
    }
  }
  return messages.filter((m) => !seenSet.has(m.id));
}

export function detectPersonalSignals(messages, watchlist = {}) {
  const handles = (watchlist.handles ?? []).map((s) => s.toLowerCase().replace(/^@/, "")).filter(Boolean);
  const projects = (watchlist.projects ?? []).map((s) => s.toLowerCase()).filter(Boolean);
  const relatedTopics = (watchlist.relatedTopics ?? []).map((s) => s.toLowerCase()).filter(Boolean);

  const ownMessageIds = new Set(
    messages
      .filter((m) => handles.some((h) => m.author.toLowerCase().includes(h)))
      .map((m) => m.id)
  );

  const hitsByMessageId = new Map();
  for (const msg of messages) {
    const authorLower = msg.author.toLowerCase();
    const isSelf = handles.some((h) => authorLower.includes(h));
    if (isSelf) continue;

    const textLower = msg.content.toLowerCase();
    const replyTargetLower = (msg.replyToAuthor ?? "").toLowerCase();

    const matchedHandles = handles.filter(
      (h) =>
        textLower.includes(`@${h}`) ||
        new RegExp(`\\b${escapeRegex(h)}\\b`, "i").test(msg.content) ||
        (replyTargetLower && replyTargetLower.includes(h)) ||
        (msg.replyToId && ownMessageIds.has(msg.replyToId))
    );
    if (matchedHandles.length > 0) {
      hitsByMessageId.set(msg.id, {
        tier: "direct_mention",
        priority: 1,
        matchedTerms: matchedHandles,
        message: msg
      });
      continue;
    }

    const matchedProjects = projects.filter((p) => textLower.includes(p));
    if (matchedProjects.length > 0) {
      hitsByMessageId.set(msg.id, {
        tier: "own_project",
        priority: 2,
        matchedTerms: matchedProjects,
        message: msg
      });
      continue;
    }

    const matchedTopics = relatedTopics.filter((t) => textLower.includes(t));
    if (matchedTopics.length > 0) {
      hitsByMessageId.set(msg.id, {
        tier: "related_work",
        priority: 3,
        matchedTerms: matchedTopics,
        message: msg
      });
    }
  }

  return [...hitsByMessageId.values()].sort((a, b) => a.priority - b.priority);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseMinutesHint(timestamp) {
  const iso = Date.parse(timestamp);
  if (!Number.isNaN(iso)) return Math.floor(iso / 60000);
  const hm = String(timestamp ?? "").match(/(\d{1,2}):(\d{2})/);
  if (!hm) return null;
  return Number(hm[1]) * 60 + Number(hm[2]);
}

export function clusterDiscussions(messages, personalHits = []) {
  const personalIds = new Set(personalHits.map((h) => h.message.id));
  const substantive = [];
  let noiseFilteredCount = 0;

  for (const msg of messages) {
    if (isLowSignalChatter(msg.content, personalIds.has(msg.id))) {
      noiseFilteredCount += 1;
      continue;
    }
    substantive.push({
      ...msg,
      tokens: extractTokens(msg.content),
      minutesHint: parseMinutesHint(msg.timestamp)
    });
  }

  const clusters = [];
  const messageClusterMap = new Map();

  // Compute document frequency across the slice so ubiquitous channel-theme words
  // (appearing in >35% of substantive messages when N>=8) do not merge unrelated subtopics.
  const docFreq = new Map();
  for (const msg of substantive) {
    for (const token of msg.tokens) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }
  const totalDocs = substantive.length;
  const isThemeStopword = (token) =>
    totalDocs >= 15 && (docFreq.get(token) ?? 0) / totalDocs > 0.3;

  for (const msg of substantive) {
    let bestCluster = null;
    let bestScore = 0;

    if (msg.replyToId && messageClusterMap.has(msg.replyToId)) {
      bestCluster = messageClusterMap.get(msg.replyToId);
      bestScore = 10;
    } else {
      for (const cluster of clusters) {
        if (cluster.channel !== msg.channel) continue;
        if (
          msg.minutesHint !== null &&
          cluster.lastMinutesHint !== null &&
          Math.abs(msg.minutesHint - cluster.lastMinutesHint) > 180
        ) {
          continue;
        }
        let sharedWeight = 0;
        let distinctiveSharedCount = 0;
        for (const token of msg.tokens) {
          if (isThemeStopword(token)) continue;
          if (cluster.tokenCounts.has(token)) {
            distinctiveSharedCount += 1;
            const idfBoost = totalDocs >= 15 ? Math.min(2.2, Math.log(1 + totalDocs / (docFreq.get(token) ?? 1))) : 1.0;
            const techBoost = token.includes("/") || token.includes(".") || token.includes("-") ? 2.2 : 1.0;
            sharedWeight += idfBoost * techBoost;
          }
        }
        const unionSize = new Set([...cluster.tokenCounts.keys(), ...msg.tokens]).size || 1;
        const jaccard = sharedWeight / Math.min(unionSize, 12);

        let score = sharedWeight >= 2 ? jaccard + sharedWeight * 0.18 : jaccard * 0.7;
        if (msg.replyToAuthor && cluster.participants.has(msg.replyToAuthor) && distinctiveSharedCount >= 1) {
          score += 0.45;
        }
        for (const participant of cluster.participants) {
          if (msg.content.toLowerCase().includes(`@${participant.toLowerCase()}`)) score += 0.45;
        }
        if (
          cluster.lastAuthor === msg.author &&
          msg.minutesHint !== null &&
          cluster.lastMinutesHint !== null &&
          Math.abs(msg.minutesHint - cluster.lastMinutesHint) <= 6 &&
          distinctiveSharedCount >= 1
        ) {
          score += 0.35;
        }

        if (score > bestScore) {
          bestScore = score;
          bestCluster = cluster;
        }
      }
    }

    if (!bestCluster || bestScore < 0.42) {
      bestCluster = {
        clusterId: `topic_${clusters.length + 1}`,
        channel: msg.channel,
        messages: [],
        participants: new Set(),
        tokenCounts: new Map(),
        firstTimestamp: msg.timestamp,
        lastTimestamp: msg.timestamp,
        lastMinutesHint: msg.minutesHint,
        lastAuthor: msg.author
      };
      clusters.push(bestCluster);
    }

    bestCluster.messages.push(msg);
    bestCluster.participants.add(msg.author);
    bestCluster.lastTimestamp = msg.timestamp || bestCluster.lastTimestamp;
    if (msg.minutesHint !== null) bestCluster.lastMinutesHint = msg.minutesHint;
    bestCluster.lastAuthor = msg.author;
    for (const token of msg.tokens) {
      bestCluster.tokenCounts.set(token, (bestCluster.tokenCounts.get(token) ?? 0) + 1);
    }
    messageClusterMap.set(msg.id, bestCluster);
  }

  const summarized = clusters.map((cluster) => {
    const topKeywords = [...cluster.tokenCounts.entries()]
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .slice(0, 6)
      .map(([word]) => word);

    const pivots = [];
    const warningsAndActions = [];
    let linkCount = 0;

    for (const m of cluster.messages) {
      if (PIVOT_PATTERNS.some((re) => re.test(m.content))) {
        pivots.push({ author: m.author, timestamp: m.timestamp, excerpt: m.content.slice(0, 240) });
      }
      if (ACTION_OR_WARNING_PATTERNS.some((re) => re.test(m.content))) {
        warningsAndActions.push({ author: m.author, timestamp: m.timestamp, excerpt: m.content.slice(0, 240) });
      }
      if (/https?:\/\//i.test(m.content)) linkCount += 1;
    }

    const personalMatches = personalHits.filter((h) =>
      cluster.messages.some((m) => m.id === h.message.id)
    );

    const importanceScore = Number(
      (
        cluster.messages.length * 1.4 +
        cluster.participants.size * 2.2 +
        pivots.length * 3.5 +
        warningsAndActions.length * 2.8 +
        linkCount * 1.2 +
        (personalMatches.length > 0 ? 6 : 0)
      ).toFixed(2)
    );

    const firstMsg = cluster.messages[0];
    const lastMsg = cluster.messages[cluster.messages.length - 1];

    return {
      clusterId: cluster.clusterId,
      channel: cluster.channel,
      topicKeywords: topKeywords,
      importanceScore,
      messageCount: cluster.messages.length,
      participants: [...cluster.participants],
      timeSpan: {
        firstTimestamp: cluster.firstTimestamp,
        lastTimestamp: cluster.lastTimestamp
      },
      personalSignalCount: personalMatches.length,
      evolution: {
        startedWith: {
          author: firstMsg.author,
          timestamp: firstMsg.timestamp,
          excerpt: firstMsg.content.slice(0, 260)
        },
        pivotsAndShifts: pivots,
        warningsAndOutcomes: warningsAndActions,
        latestState: {
          author: lastMsg.author,
          timestamp: lastMsg.timestamp,
          excerpt: lastMsg.content.slice(0, 260)
        }
      },
      messages: cluster.messages.map(({ tokens: _t, minutesHint: _m, ...clean }) => clean)
    };
  });

  summarized.sort((a, b) => b.importanceScore - a.importanceScore);
  return { noiseFilteredCount, discussions: summarized };
}

export function analyzeChannelSlice({
  rawInput,
  channelKey = "general",
  watchlist = {},
  cursors = {},
  minDigestImportance = 4.0
}) {
  const parsed = normalizeInputMessages(rawInput, channelKey);
  const unread = filterSinceCursor(parsed, cursors[channelKey]);
  const personalSignals = detectPersonalSignals(unread, watchlist);
  const { noiseFilteredCount, discussions } = clusterDiscussions(unread, personalSignals);

  const highValueDiscussions = discussions.filter(
    (d) => d.importanceScore >= minDigestImportance || d.personalSignalCount > 0
  );
  const shouldNotify = personalSignals.length > 0 || highValueDiscussions.length > 0;

  const nextCursor =
    parsed.length > 0
      ? {
          lastId: parsed[parsed.length - 1].id,
          lastTimestamp: parsed[parsed.length - 1].timestamp,
          updatedAt: new Date().toISOString(),
          recentIds: parsed.slice(-50).map((m) => m.id)
        }
      : cursors[channelKey] ?? null;

  return {
    channel: channelKey,
    totalParsedMessages: parsed.length,
    unreadMessages: unread.length,
    noiseFilteredCount,
    shouldNotify,
    personalSignals,
    discussions,
    proposedCursor: nextCursor
  };
}

function runCli(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args.set(token.slice(2), "true");
      } else {
        args.set(token.slice(2), next);
        i += 1;
      }
    }
  }

  const mode = args.get("mode") ?? "analyze";
  const configPath = resolve(args.get("config") ?? "state/config.json");
  const cursorsPath = resolve(args.get("cursors") ?? "state/cursors.json");
  const channelKey = args.get("channel") ?? "general";

  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
  const cursors = existsSync(cursorsPath) ? JSON.parse(readFileSync(cursorsPath, "utf8")) : { channels: {} };

  if (mode === "commit-cursor") {
    const analysisPath = resolve(args.get("analysis") ?? "");
    const analysis = JSON.parse(readFileSync(analysisPath, "utf8"));
    if (analysis.proposedCursor) {
      cursors.channels = cursors.channels ?? {};
      cursors.channels[analysis.channel] = analysis.proposedCursor;
      mkdirSync(dirname(cursorsPath), { recursive: true });
      writeFileSync(cursorsPath, `${JSON.stringify(cursors, null, 2)}\n`, "utf8");
    }
    process.stdout.write(`${JSON.stringify({ ok: true, channel: analysis.channel, cursor: analysis.proposedCursor })}\n`);
    return;
  }

  const inputPath = args.get("input");
  if (!inputPath) {
    process.stderr.write("Usage: node scripts/signal-engine.mjs --input <capture.txt|messages.json> [--channel <name>] [--config state/config.json] [--cursors state/cursors.json] [--out analysis.json]\n");
    process.exit(1);
  }
  const rawInput = readFileSync(resolve(inputPath), "utf8");
  const result = analyzeChannelSlice({
    rawInput,
    channelKey,
    watchlist: config.watchlist ?? {},
    cursors: cursors.channels ?? {},
    minDigestImportance: Number(config.minDigestImportance ?? 4.0)
  });

  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (args.get("out")) {
    const outFile = resolve(args.get("out"));
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, serialized, "utf8");
  }
  process.stdout.write(serialized);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("signal-engine.mjs")) {
  runCli(process.argv.slice(2));
}
