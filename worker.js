const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const ROOM_TTL = 86400;
const MAX_TURNS = 80;

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === "/api/health") {
        return json({ ok: true, service: "THE LAST LETTER" }, 200, corsHeaders);
      }

      if (!env.ROOMS) {
        return json({ error: "Binding KV ROOMS belum dikonfigurasi." }, 500, corsHeaders);
      }

      if (path === "/api/create" && request.method === "POST") {
        return await createRoom(request, env, corsHeaders);
      }

      if (path === "/api/join" && request.method === "POST") {
        return await joinRoom(request, env, corsHeaders);
      }

      if (path === "/api/room" && request.method === "GET") {
        return await getRoom(url, env, corsHeaders);
      }

      if (path === "/api/talk" && request.method === "POST") {
        return await talkToSuspect(request, env, corsHeaders);
      }

      if (path === "/api/accuse" && request.method === "POST") {
        return await accuse(request, env, corsHeaders);
      }

      return json({ error: "Endpoint tidak ditemukan." }, 404, corsHeaders);
    } catch (error) {
      return json(
        { error: error?.message || "Terjadi kesalahan pada server." },
        500,
        corsHeaders
      );
    }
  }
};

/* =========================
   HTTP RESPONSE
========================= */

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("Data permintaan tidak valid.");
  }
}

/* =========================
   AI HELPERS
========================= */

async function askAI(env, prompt, maxTokens = 450) {
  if (!env.AI) {
    throw new Error("Binding AI belum dikonfigurasi di Cloudflare.");
  }

  const result = await env.AI.run(MODEL, {
    messages: [
      {
        role: "system",
        content:
          "Kamu adalah AI narator game misteri berbahasa Indonesia. " +
          "Ikuti instruksi dengan ketat. Jangan mengungkap rahasia pelaku " +
          "kepada pemain sebelum tahap akhir. Jangan membuat fakta yang " +
          "bertentangan dengan berkas kasus."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: maxTokens,
    temperature: 0.3
  });

  const text = result?.response ?? result?.result?.response;

  if (typeof text !== "string" || !text.trim()) {
    throw new Error("AI tidak memberikan jawaban.");
  }

  return text.trim();
}

function extractJSON(text) {
  if (typeof text !== "string") {
    throw new Error("Respons AI bukan teks.");
  }

  let cleaned = text
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start !== -1 && end > start) {
    return JSON.parse(cleaned.slice(start, end + 1));
  }

  throw new Error("AI tidak menghasilkan JSON lengkap.");
}

function validateCase(data) {
  if (!data || typeof data !== "object") return false;
  if (typeof data.title !== "string" || !data.title.trim()) return false;
  if (typeof data.intro !== "string" || !data.intro.trim()) return false;
  if (!Array.isArray(data.suspects) || data.suspects.length !== 4) return false;

  const ids = new Set();
  const names = new Set();

  for (const suspect of data.suspects) {
    if (!suspect || typeof suspect !== "object") return false;
    if (typeof suspect.name !== "string" || !suspect.name.trim()) return false;
    if (typeof suspect.role !== "string" || !suspect.role.trim()) return false;
    if (typeof suspect.alibi !== "string" || !suspect.alibi.trim()) return false;
    if (typeof suspect.motive !== "string" || !suspect.motive.trim()) return false;
    if (typeof suspect.secret !== "string" || !suspect.secret.trim()) return false;

    const id = String(suspect.id || "");
    const name = suspect.name.trim().toLowerCase();

    if (!id || ids.has(id) || names.has(name)) return false;

    ids.add(id);
    names.add(name);
  }

  const culprit = data.suspects.find(
    suspect => suspect.id === data.culprit_id
  );

  if (!culprit) return false;

  if (!Array.isArray(data.evidence) || data.evidence.length < 3) return false;

  for (const item of data.evidence) {
    if (!item || typeof item.title !== "string" || !item.title.trim()) {
      return false;
    }

    if (
      typeof item.description !== "string" ||
      !item.description.trim()
    ) {
      return false;
    }
  }

  return typeof data.explanation === "string" && data.explanation.trim().length > 0;
}

function normalizeCase(data) {
  const suspects = data.suspects.map((suspect, index) => ({
    id: `s${index + 1}`,
    name: suspect.name.trim(),
    role: suspect.role.trim(),
    alibi: suspect.alibi.trim(),
    motive: suspect.motive.trim(),
    secret: suspect.secret.trim()
  }));

  const originalCulprit = data.suspects.find(
    suspect => suspect.id === data.culprit_id
  );

  const culpritIndex = data.suspects.indexOf(originalCulprit);

  return {
    title: data.title.trim(),
    intro: data.intro.trim(),
    suspects,
    evidence: data.evidence.map(item => ({
      title: item.title.trim(),
      description: item.description.trim(),
      source: "Berkas kasus"
    })),
    explanation: data.explanation.trim(),
    culprit_id: `s${culpritIndex + 1}`
  };
}

function fallbackCase() {
  return {
    title: "Surat Terakhir di Rumah Arunika",
    intro:
      "Pada pukul 21.30, kolektor bernama Adrian ditemukan meninggal " +
      "di ruang kerjanya setelah sebuah acara makan malam pribadi. " +
      "Sebuah surat terakhir ditemukan di mejanya, tetapi bagian penting " +
      "surat itu telah hilang. Empat orang berada di rumah tersebut malam itu. " +
      "Periksa alibi, motif, dan petunjuk dengan saksama.",
    suspects: [
      {
        id: "s1",
        name: "Nadia",
        role: "Asisten pribadi",
        alibi: "Mengaku sedang merapikan dokumen di ruang arsip.",
        motive: "Adrian berencana memecatnya setelah menemukan dokumen yang hilang.",
        secret: "Nadia menyembunyikan salinan surat karena takut dituduh mencurinya."
      },
      {
        id: "s2",
        name: "Bima",
        role: "Mitra bisnis",
        alibi: "Mengaku menerima telepon di teras rumah.",
        motive: "Ia memiliki sengketa keuangan dengan Adrian.",
        secret: "Bima berbohong tentang waktu teleponnya, tetapi tidak melakukan pembunuhan."
      },
      {
        id: "s3",
        name: "Clara",
        role: "Adik korban",
        alibi: "Mengaku berada di ruang tamu sepanjang malam.",
        motive: "Ia merasa hak warisnya telah diambil oleh Adrian.",
        secret: "Clara sempat bertengkar dengan Adrian sore itu."
      },
      {
        id: "s4",
        name: "Raka",
        role: "Pengelola rumah",
        alibi: "Mengaku sedang memeriksa generator di belakang rumah.",
        motive: "Adrian mengetahui Raka menjual barang milik rumah tanpa izin.",
        secret: "Raka adalah pelaku. Ia memanfaatkan pengetahuannya tentang rumah untuk masuk ke ruang kerja tanpa menarik perhatian."
      }
    ],
    evidence: [
      {
        title: "Surat yang Terpotong",
        description: "Bagian terakhir surat Adrian hilang. Bekas robekan masih baru.",
        source: "Meja ruang kerja"
      },
      {
        title: "Catatan Waktu",
        description: "Jam dinding ruang kerja berhenti pada pukul 21.15, tetapi jam itu pernah rusak sebelumnya.",
        source: "Ruang kerja"
      },
      {
        title: "Jejak Tanah",
        description: "Ada tanah lembap di dekat pintu belakang, meskipun lantai di bagian lain rumah kering.",
        source: "Pintu belakang"
      }
    ],
    explanation:
      "Raka adalah pelaku. Ia mengetahui akses belakang rumah dan memanfaatkan tugasnya untuk menjelaskan keberadaannya di sekitar ruang kerja. Motifnya berkaitan dengan barang-barang yang dijual tanpa izin. Petunjuk tanah lembap dan kesempatan yang dimilikinya mendukung kesimpulan tersebut."
  };
}

async function generateCase(env) {
  const prompt = `
Buat satu kasus misteri detektif orisinal berbahasa Indonesia untuk game dua pemain.

Keluaran WAJIB berupa satu objek JSON valid saja. Jangan gunakan markdown, code fence, atau teks sebelum/sesudah JSON.

Buat kasus yang masuk akal, punya petunjuk yang dapat dianalisis, dan dapat dipecahkan dari alibi, motif, rahasia, serta bukti. Tepat empat tersangka dan tepat satu pelaku. Setiap tersangka harus punya nama berbeda.

Struktur wajib:
{
  "title": "judul kasus",
  "intro": "narasi pembuka kasus",
  "culprit_id": "c1",
  "suspects": [
    {
      "id": "c1",
      "name": "nama",
      "role": "peran",
      "alibi": "alibi",
      "motive": "motif",
      "secret": "rahasia"
    },
    {
      "id": "c2",
      "name": "nama",
      "role": "peran",
      "alibi": "alibi",
      "motive": "motif",
      "secret": "rahasia"
    },
    {
      "id": "c3",
      "name": "nama",
      "role": "peran",
      "alibi": "alibi",
      "motive": "motif",
      "secret": "rahasia"
    },
    {
      "id": "c4",
      "name": "nama",
      "role": "peran",
      "alibi": "alibi",
      "motive": "motif",
      "secret": "rahasia"
    }
  ],
  "evidence": [
    {"title": "judul bukti", "description": "deskripsi bukti"},
    {"title": "judul bukti", "description": "deskripsi bukti"},
    {"title": "judul bukti", "description": "deskripsi bukti"},
    {"title": "judul bukti", "description": "deskripsi bukti"}
  ],
  "explanation": "penjelasan lengkap mengapa pelaku adalah orang tersebut"
}

Aturan:
- culprit_id harus sama dengan id tersangka yang benar-benar pelaku.
- Tersangka yang tidak bersalah juga boleh berbohong atau menyembunyikan rahasia, tetapi rahasianya jangan membuat mereka menjadi pelaku kedua.
- Bukti harus relevan dan tidak saling bertentangan.
- Penjelasan akhir harus cocok dengan alibi, motif, rahasia, dan bukti.
- Gunakan teks yang cukup rinci agar setiap tersangka terasa berbeda.
- Pastikan JSON lengkap dan semua tanda kutip serta kurung ditutup.
`.trim();

  let lastError;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const requestPrompt = attempt === 0
        ? prompt
        : prompt +
          "\n\nPERBAIKAN: Respons sebelumnya gagal divalidasi. " +
          "Buat ulang seluruh JSON dari awal. Pastikan tepat empat tersangka, " +
          "culprit_id cocok dengan salah satu ID, minimal tiga bukti, " +
          "dan seluruh JSON valid serta lengkap.";

      // Batas output kasus dinaikkan menjadi 2048 token.
      const raw = await askAI(env, requestPrompt, 2048);
      const parsed = extractJSON(raw);

      if (!validateCase(parsed)) {
        throw new Error("Struktur JSON kasus tidak memenuhi format.");
      }

      return normalizeCase(parsed);
    } catch (error) {
      lastError = error;
    }
  }

  console.error("Generate kasus gagal setelah retry:", lastError);
  return fallbackCase();
}

/* =========================
   ROOM STORAGE
========================= */

function roomKey(code) {
  return `room:${code}`;
}

async function saveRoom(env, room) {
  room.updatedAt = Date.now();

  await env.ROOMS.put(
    roomKey(room.code),
    JSON.stringify(room),
    { expirationTtl: ROOM_TTL }
  );
}

async function loadRoom(env, code) {
  const normalized = String(code || "").trim().toUpperCase();

  if (!normalized) {
    throw new Error("Kode room wajib diisi.");
  }

  const raw = await env.ROOMS.get(roomKey(normalized));

  if (!raw) {
    throw new Error("Room tidak ditemukan atau sudah kedaluwarsa.");
  }

  return JSON.parse(raw);
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
}

function makeId() {
  return crypto.randomUUID();
}

function safePlayerName(name) {
  const value = String(name || "").trim().slice(0, 24);

  if (!value) throw new Error("Nama pemain wajib diisi.");

  return value;
}

function publicRoom(room) {
  return {
    code: room.code,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    players: room.players,
    case: {
      title: room.case.title,
      intro: room.case.intro,
      suspects: room.case.suspects.map(suspect => ({
        id: suspect.id,
        name: suspect.name,
        role: suspect.role
      }))
    },
    messages: room.messages,
    evidence: room.evidence,
    accusations: room.accusations,
    verdict: room.verdict,
    turnCount: room.turnCount
  };
}

function requirePlayer(room, playerId) {
  const player = room.players.find(item => item.id === playerId);

  if (!player) {
    throw new Error("Pemain tidak terdaftar di room ini.");
  }

  return player;
}

function findSuspect(room, suspectId) {
  const suspect = room.case.suspects.find(item => item.id === suspectId);

  if (!suspect) throw new Error("Tersangka tidak ditemukan.");

  return suspect;
}

/* =========================
   CREATE / JOIN / ROOM
========================= */

async function createRoom(request, env, headers) {
  const body = await readBody(request);
  const name = safePlayerName(body.name);

  const caseData = await generateCase(env);

  let code;
  let existing;

  for (let i = 0; i < 5; i++) {
    code = makeCode();
    existing = await env.ROOMS.get(roomKey(code));
    if (!existing) break;
  }

  if (existing) {
    throw new Error("Gagal membuat kode room. Coba lagi.");
  }

  const playerId = makeId();

  const room = {
    code,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players: [{ id: playerId, name }],
    case: caseData,
    messages: [],
    evidence: caseData.evidence.map((item, index) => ({
      id: `ev${index + 1}`,
      title: item.title,
      description: item.description,
      source: item.source || "Berkas kasus"
    })),
    accusations: {},
    verdict: null,
    turnCount: 0
  };

  await saveRoom(env, room);

  return json({
    room: publicRoom(room),
    playerId
  }, 200, headers);
}

async function joinRoom(request, env, headers) {
  const body = await readBody(request);
  const name = safePlayerName(body.name);
  const room = await loadRoom(env, body.code);

  if (room.verdict) {
    throw new Error("Kasus ini sudah selesai. Buat room baru untuk memulai lagi.");
  }

  const alreadyJoined = room.players.find(
    player => player.name.toLowerCase() === name.toLowerCase()
  );

  if (alreadyJoined) {
    throw new Error("Nama itu sudah dipakai di room ini. Gunakan nama berbeda.");
  }

  if (room.players.length >= 2) {
    throw new Error("Room sudah penuh. Maksimal dua pemain.");
  }

  const playerId = makeId();

  room.players.push({ id: playerId, name });
  room.messages.push({
    type: "system",
    text: `${name} bergabung ke investigasi.`,
    timestamp: Date.now()
  });

  await saveRoom(env, room);

  return json({
    room: publicRoom(room),
    playerId
  }, 200, headers);
}

async function getRoom(url, env, headers) {
  const code = url.searchParams.get("code");
  const playerId = url.searchParams.get("playerId");

  const room = await loadRoom(env, code);
  requirePlayer(room, playerId);

  return json({ room: publicRoom(room) }, 200, headers);
}

/* =========================
   INTERROGATION
========================= */

function countSentences(text) {
  const matches = String(text || "").match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return matches ? matches.filter(part => part.trim()).length : 0;
}

async function talkToSuspect(request, env, headers) {
  const body = await readBody(request);
  const room = await loadRoom(env, body.code);

  const player = requirePlayer(room, body.playerId);

  if (room.verdict) {
    throw new Error("Kasus sudah selesai. Kamu tidak bisa melanjutkan interogasi.");
  }

  if (room.turnCount >= MAX_TURNS) {
    throw new Error("Batas percakapan kasus ini sudah tercapai.");
  }

  const suspect = findSuspect(room, body.suspectId);
  const question = String(body.question || "").trim().slice(0, 500);

  if (!question) throw new Error("Pertanyaan tidak boleh kosong.");

  room.turnCount += 1;

  room.messages.push({
    playerId: player.id,
    playerName: player.name,
    suspectId: suspect.id,
    suspectName: suspect.name,
    text: question,
    timestamp: Date.now()
  });

  const conversation = room.messages
    .filter(message => message.suspectId === suspect.id)
    .slice(-10)
    .map(message => {
      const speaker = message.playerId
        ? `Pemain ${message.playerName}`
        : suspect.name;

      return `${speaker}: ${message.text}`;
    })
    .join("\n");

  const prompt = `
Kamu memerankan tersangka bernama ${suspect.name} dalam game misteri detektif berbahasa Indonesia.

FAKTA RAHASIA KASUS:
Judul: ${room.case.title}
Latar: ${room.case.intro}
Nama kamu: ${suspect.name}
Peran: ${suspect.role}
Alibi: ${suspect.alibi}
Motif: ${suspect.motive}
Rahasia karakter: ${suspect.secret}

Riwayat percakapan:
${conversation}

Pertanyaan terbaru dari pemain:
${question}

ATURAN WAJIB:
- Jawab sebagai karakter ${suspect.name}, bukan sebagai narator.
- Jawaban harus tepat DUA kalimat, tidak lebih dan tidak kurang.
- Gunakan bahasa Indonesia yang alami.
- Setiap kalimat harus jelas dan relevan.
- Jangan mengungkap identitas pelaku secara langsung.
- Jangan mengarang fakta yang bertentangan dengan informasi kasus.
- Kamu boleh gugup, defensif, mengelak, atau menjawab jujur sesuai karakter.
- Jangan menambahkan label, penjelasan, daftar, atau kalimat ketiga.
`.trim();

  let answer;

  try {
    answer = await askAI(env, prompt, 100);
  } catch {
    answer = "Saya sudah menjelaskan apa yang saya ketahui tentang malam itu. " +
      "Kalau ada bukti baru, saya akan mencoba menjelaskannya.";
  }

  answer = answer.replace(/^["'\s]+|["'\s]+$/g, "").trim();

  // Jika model tidak mengikuti batas dua kalimat, gunakan jawaban aman.
  if (countSentences(answer) !== 2) {
    answer = "Saya sudah menjelaskan apa yang saya ketahui tentang malam itu. " +
      "Saya tidak bisa memastikan hal lain tanpa melihat bukti yang kamu miliki.";
  }

  room.messages.push({
    suspectId: suspect.id,
    suspectName: suspect.name,
    text: answer,
    timestamp: Date.now()
  });

  // Bukti yang sudah ada tetap menjadi sumber petunjuk resmi.
  // Interogasi tidak otomatis membuat fakta baru menjadi bukti resmi.
  await saveRoom(env, room);

  return json({
    answer,
    room: publicRoom(room)
  }, 200, headers);
}

/* =========================
   ACCUSATION / VERDICT
========================= */

async function accuse(request, env, headers) {
  const body = await readBody(request);
  const room = await loadRoom(env, body.code);

  const player = requirePlayer(room, body.playerId);

  if (room.verdict) {
    return json({
      message: "Kasus ini sudah selesai.",
      room: publicRoom(room)
    }, 200, headers);
  }

  const suspect = findSuspect(room, body.suspectId);
  const reason = String(body.reason || "").trim().slice(0, 500);

  room.accusations[player.id] = {
    suspectId: suspect.id,
    suspectName: suspect.name,
    reason,
    timestamp: Date.now()
  };

  const accusationList = Object.values(room.accusations);

  // Kasus baru diputuskan setelah kedua pemain mengirim tuduhan.
  if (room.players.length >= 2 && accusationList.length >= 2) {
    const culpritId = room.case.culprit_id;

    const correct = accusationList.every(
      accusation => accusation.suspectId === culpritId
    );

    const culprit = room.case.suspects.find(
      item => item.id === culpritId
    );

    room.verdict = {
      correct,
      culpritName: culprit?.name || "Tidak diketahui",
      explanation: room.case.explanation,
      accusations: accusationList.map(item => ({
        playerName: room.players.find(p => p.id === item.playerId)?.name
          || item.playerName
          || "Pemain",
        suspectName: item.suspectName,
        reason: item.reason
      })),
      timestamp: Date.now()
    };

    room.messages.push({
      type: "system",
      text: "Investigasi berakhir. Hasil akhir kasus telah dibuka.",
      timestamp: Date.now()
    });
  }

  await saveRoom(env, room);

  const message = room.verdict
    ? "Kedua pemain sudah memberikan tuduhan. Hasil kasus telah dibuka."
    : room.players.length < 2
      ? "Tuduhan dicatat. Tunggu pemain kedua bergabung dan memberikan tuduhan."
      : "Tuduhan kamu dicatat. Tunggu pemain lain memberikan tuduhannya.";

  return json({
    message,
    room: publicRoom(room)
  }, 200, headers);
                     }
