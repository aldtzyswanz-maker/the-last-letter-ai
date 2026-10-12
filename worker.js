
const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const ROOM_TTL = 86400;
const MAX_TURNS = 80;

const CATEGORIES = {
  murder: "pembunuhan",
  robbery: "perampokan",
  kidnapping: "penculikan",
  fraud: "penipuan",
  missing: "orang hilang",
  theft: "pencurian",
  blackmail: "pemerasan"
};

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: HEADERS
  });
}

function makeId(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }

  return result;
}

function cleanName(value) {
  return String(value || "").trim().slice(0, 24);
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/*
 * Kasus cadangan ketika AI gagal.
 * Nama, peran, judul, dan susunan tersangka divariasikan.
 * Petunjuk utama secara eksplisit berkaitan dengan pelaku.
 */
function fallbackCase(category) {
  const chosen = CATEGORIES[category] ? category : "theft";

  const people = [
    ["Adrian Mahesa", "Arsiparis"],
    ["Keisya Anindita", "Jurnalis"],
    ["Bima Prakoso", "Teknisi"],
    ["Nadine Larasati", "Kurator"],
    ["Rafi Dirgantara", "Akuntan"],
    ["Maya Puspitasari", "Fotografer"],
    ["Daffa Wicaksana", "Petugas keamanan"],
    ["Intan Permata", "Asisten pribadi"],
    ["Farel Ramadhan", "Pengelola gedung"],
    ["Celine Adelia", "Peneliti"],
    ["Rangga Pratama", "Kurir"],
    ["Vania Oktaviani", "Sekretaris"],
    ["Gilang Saputra", "Mekanik"],
    ["Aurel Maharani", "Manajer acara"],
    ["Reza Firmansyah", "Analis keuangan"],
    ["Shania Putri", "Resepsionis"],
    ["Naufal Akbar", "Pengacara"],
    ["Tiara Kusuma", "Dokumentator"],
    ["Farhan Maulana", "Petugas laboratorium"],
    ["Zahra Amalia", "Pemilik usaha"],
    ["Dion Kurniawan", "Staf operasional"],
    ["Livia Maharani", "Konsultan"],
    ["Arkan Pradipta", "Pengelola koleksi"],
    ["Nisa Rahmadani", "Koordinator"]
  ];

  const selectedPeople = shuffle(people).slice(0, 4);
  const culpritIndex = Math.floor(Math.random() * 4);
  const culpritId = `s${culpritIndex + 1}`;
  const culprit = selectedPeople[culpritIndex];

  const storyTemplates = {
    murder: {
      titles: [
        "Rahasia di Balik Pintu Terkunci",
        "Malam Sunyi di Gedung Arunika",
        "Jam Terakhir Sang Kolektor",
        "Bayangan di Ruang Kerja"
      ],
      description:
        "Seorang kolektor ditemukan meninggal di ruang kerjanya. Tidak ada kerusakan pada pintu. Empat orang berada di gedung malam itu, tetapi catatan waktu dan keterangan mereka tidak sepenuhnya cocok.",
      object: "catatan akses ruang kerja",
      clue: `Catatan akses menunjukkan bahwa kartu milik ${culprit[0]} digunakan di ruang kerja pada waktu kejadian, bertentangan dengan alibinya.`,
      explanation: `${culprit[0]} adalah pelaku. Catatan akses menempatkannya di ruang kerja saat kejadian, sedangkan alibinya menyatakan bahwa ia berada di tempat lain.`
    },
    robbery: {
      titles: [
        "Perampokan di Galeri Senja",
        "Koleksi yang Menghilang",
        "Tujuh Menit Tanpa Alarm",
        "Pencurian di Ruang Pamer"
      ],
      description:
        "Sebuah koleksi berharga hilang dari ruangan terkunci. Alarm sempat terputus dan empat orang yang berada di sekitar gedung memberikan keterangan berbeda.",
      object: "catatan sistem keamanan",
      clue: `Log keamanan mencatat penggunaan kode akses milik ${culprit[0]} ketika alarm dinonaktifkan, meskipun ia mengaku tidak berada di gedung.`,
      explanation: `${culprit[0]} adalah pelaku. Log keamanan menghubungkan kode aksesnya dengan waktu alarm dinonaktifkan, bertentangan dengan alibinya.`
    },
    kidnapping: {
      titles: [
        "Pesan Terakhir dari Kamar Kosong",
        "Jejak di Jalan Berkabut",
        "Hilang Sebelum Tengah Malam",
        "Telepon yang Tidak Terjawab"
      ],
      description:
        "Seseorang menghilang setelah menerima pesan misterius. Ponselnya tertinggal dan empat orang terakhir yang berhubungan dengannya memberikan keterangan berbeda.",
      object: "rekaman pesan dan waktu pertemuan",
      clue: `${culprit[0]} mengetahui detail waktu pertemuan rahasia yang tidak diumumkan kepada orang lain. Catatan waktu juga bertentangan dengan keterangannya.`,
      explanation: `${culprit[0]} terlibat dalam penculikan. Informasi tentang pertemuan rahasia dan ketidaksesuaian waktu keterangannya menghubungkannya dengan kejadian tersebut.`
    },
    fraud: {
      titles: [
        "Angka yang Tidak Pernah Cocok",
        "Laporan Keuangan Ganda",
        "Transaksi di Balik Layar",
        "Rahasia Buku Kas"
      ],
      description:
        "Dana sebuah organisasi tidak sesuai dengan laporan. Sejumlah dokumen direvisi setelah jam kerja dan empat orang memiliki akses ke berkas keuangan.",
      object: "riwayat revisi dokumen",
      clue: `Riwayat dokumen menunjukkan perubahan yang dilakukan melalui akun ${culprit[0]} setelah jam kerja, meskipun ia menyangkal mengakses laporan tersebut.`,
      explanation: `${culprit[0]} melakukan kecurangan. Riwayat revisi menghubungkan akunnya dengan perubahan laporan yang tidak dapat dijelaskan oleh alibinya.`
    },
    missing: {
      titles: [
        "Foto Terakhir Sebelum Menghilang",
        "Perjalanan yang Terputus",
        "Jejak di Penginapan Lama",
        "Catatan dari Tempat Sunyi"
      ],
      description:
        "Seorang fotografer tidak kembali dari perjalanan terakhirnya. Kamera ditemukan di penginapan dan catatan perjalanan menunjukkan perubahan rencana yang belum terjelaskan.",
      object: "catatan perjalanan",
      clue: `Catatan perjalanan menghubungkan ${culprit[0]} dengan lokasi terakhir korban pada waktu yang bertentangan dengan keterangannya.`,
      explanation: `${culprit[0]} menyembunyikan keterlibatannya dalam hilangnya korban. Catatan perjalanan menempatkannya di lokasi terakhir korban, tidak sesuai dengan alibinya.`
    },
    theft: {
      titles: [
        "Arsip yang Menghilang",
        "Kunci di Ruang Kosong",
        "Pencurian Setelah Jam Kerja",
        "Dokumen dari Laci Ketiga"
      ],
      description:
        "Sebuah dokumen penting hilang dari ruangan terkunci. Tidak ada kerusakan pada pintu dan empat orang memiliki akses ke area tersebut.",
      object: "catatan kartu akses",
      clue: `Catatan kartu akses menunjukkan bahwa kartu milik ${culprit[0]} membuka ruangan setelah jam kerja, bertentangan dengan pengakuannya.`,
      explanation: `${culprit[0]} mencuri dokumen tersebut. Catatan akses menghubungkan kartunya dengan ruangan saat dokumen menghilang, sementara alibinya tidak cocok.`
    },
    blackmail: {
      titles: [
        "Surat Tanpa Nama",
        "Rahasia di Dalam Amplop",
        "Foto yang Tidak Boleh Terungkap",
        "Ancaman dari Balik Pintu"
      ],
      description:
        "Sebuah surat ancaman diterima oleh sebuah keluarga. Surat itu berisi informasi pribadi dan foto lama. Empat orang memiliki akses ke informasi tersebut.",
      object: "riwayat pencetakan surat",
      clue: `Riwayat pencetakan menghubungkan surat itu dengan akun ${culprit[0]}, meskipun ia menyangkal pernah mencetaknya.`,
      explanation: `${culprit[0]} mengirim surat ancaman. Riwayat pencetakan menghubungkan akun miliknya dengan surat tersebut, bertentangan dengan keterangannya.`
    }
  };

  const template = storyTemplates[chosen];
  const title = pick(template.titles);

  const suspects = selectedPeople.map((person, index) => {
    const id = `s${index + 1}`;

    return {
      id,
      name: person[0],
      role: person[1],
      description:
        id === culpritId
          ? `Mengaku tidak terlibat. ${person[1]} yang memiliki akses atau informasi terkait kejadian.`
          : `Mengaku tidak terlibat dan menyatakan tidak mengetahui detail penting kejadian.`
    };
  });

  return {
    category: chosen,
    title,
    description: template.description,
    suspects,
    evidence: [
      template.clue,
      `Catatan ${template.object} perlu dicocokkan dengan waktu yang disebutkan para saksi.`,
      "Keterangan waktu dari setidaknya dua orang tidak sepenuhnya cocok."
    ],
    culpritId,
    explanation: template.explanation
  };
}

function extractJson(raw) {
  const text = String(raw || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("Respons AI tidak berisi objek JSON.");
  }

  return JSON.parse(text.slice(start, end + 1));
}

function validateCase(data) {
  const ids = ["s1", "s2", "s3", "s4"];

  if (
    !data ||
    typeof data.title !== "string" ||
    !data.title.trim() ||
    typeof data.description !== "string" ||
    !data.description.trim() ||
    !Array.isArray(data.suspects) ||
    data.suspects.length !== 4 ||
    !Array.isArray(data.evidence) ||
    data.evidence.length < 3 ||
    !ids.includes(data.culpritId) ||
    typeof data.explanation !== "string" ||
    !data.explanation.trim()
  ) {
    throw new Error("Struktur kasus tidak valid.");
  }

  const suspects = data.suspects.map(s => ({
    id: String(s?.id || ""),
    name: String(s?.name || "").trim(),
    role: String(s?.role || "").trim(),
    description: String(s?.description || "").trim()
  }));

  if (suspects.some(s =>
    !ids.includes(s.id) ||
    !s.name ||
    !s.role ||
    !s.description
  )) {
    throw new Error("Data tersangka tidak lengkap.");
  }

  if (new Set(suspects.map(s => s.id)).size !== 4) {
    throw new Error("ID tersangka duplikat.");
  }

  if (new Set(suspects.map(s => s.name.toLowerCase())).size !== 4) {
    throw new Error("Nama tersangka duplikat.");
  }

  if (!suspects.some(s => s.id === data.culpritId)) {
    throw new Error("Pelaku tidak ditemukan dalam daftar.");
  }

  const byId = Object.fromEntries(suspects.map(s => [s.id, s]));

  const evidence = data.evidence
    .filter(x => typeof x === "string" && x.trim())
    .slice(0, 5)
    .map(x => x.trim().slice(0, 500));

  if (evidence.length < 3) {
    throw new Error("Barang bukti kurang dari tiga.");
  }

  return {
    title: data.title.trim().slice(0, 160),
    description: data.description.trim().slice(0, 1000),
    suspects: ids.map(id => ({
      id,
      name: byId[id].name.slice(0, 80),
      role: byId[id].role.slice(0, 50),
      description: byId[id].description.slice(0, 500)
    })),
    evidence,
    culpritId: data.culpritId,
    explanation: data.explanation.trim().slice(0, 2000)
  };
}

async function generateCase(env, requestedCategory) {
  const keys = Object.keys(CATEGORIES);
  const category = CATEGORIES[requestedCategory]
    ? requestedCategory
    : pick(keys);

  const caseSeed = crypto.randomUUID();

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        {
          role: "system",
          content: `Kamu penulis misteri detektif profesional berbahasa Indonesia.
Keluarkan satu objek JSON valid tanpa markdown.
Buat misteri orisinal yang bisa dipecahkan secara logis.
Pastikan petunjuk, alibi, pelaku, dan solusi konsisten.`
        },
        {
          role: "user",
          content: `Buat kasus kategori "${CATEGORIES[category]}".

Kode variasi cerita: ${caseSeed}

Aturan:
- Buat judul dan alur yang spesifik serta berbeda.
- Tepat empat tersangka dengan ID s1, s2, s3, s4.
- Empat nama lengkap dan peran yang berbeda.
- Tepat satu pelaku.
- Buat 3-5 bukti yang benar-benar relevan.
- Setidaknya dua bukti harus membantu membedakan pelaku dari tersangka lain.
- Alibi setiap tersangka harus spesifik.
- Penjelasan akhir harus membuktikan keterlibatan pelaku menggunakan bukti yang tersedia.
- Jangan membuat bukti yang menyatakan pelaku secara langsung dalam deskripsi awal.
- Jangan gunakan detail grafis.
- Jangan menyalin judul atau cerita generik yang biasa digunakan.

Struktur wajib:
{
  "title": "judul",
  "description": "ringkasan tanpa membocorkan pelaku",
  "suspects": [
    {"id":"s1","name":"nama","role":"peran","description":"alibi"},
    {"id":"s2","name":"nama","role":"peran","description":"alibi"},
    {"id":"s3","name":"nama","role":"peran","description":"alibi"},
    {"id":"s4","name":"nama","role":"peran","description":"alibi"}
  ],
  "evidence": ["bukti 1","bukti 2","bukti 3"],
  "culpritId": "s1",
  "explanation": "solusi logis"
}`
        }
      ],
      max_tokens: 1800,
      temperature: 0.9
    });

    const raw = String(result.response || result.output_text || "");

    console.log("CASE AI RAW RESPONSE:", raw);

    const parsed = extractJson(raw);
    const validated = validateCase(parsed);

    console.log("CASE GENERATION SUCCESS:", {
      category,
      title: validated.title,
      suspectNames: validated.suspects.map(s => s.name)
    });

    return { category, ...validated };
  } catch (error) {
    console.error("CASE GENERATION FAILED:", {
      category,
      message: error?.message || String(error)
    });

    return fallbackCase(category);
  }
}

function publicRoom(room) {
  const copy = structuredClone(room);

  if (!copy.verdict) {
    delete copy.case.culpritId;
    delete copy.case.explanation;
  }

  return copy;
}

async function loadRoom(env, code) {
  const raw = await env.ROOMS.get(`room:${code}`);
  return raw ? JSON.parse(raw) : null;
}

async function saveRoom(env, room) {
  await env.ROOMS.put(
    `room:${room.code}`,
    JSON.stringify(room),
    { expirationTtl: ROOM_TTL }
  );
}

async function createRoom(env, body) {
  const name = cleanName(body.name);

  if (!name) {
    return json({ error: "Nama detektif wajib diisi." }, 400);
  }

  const category = CATEGORIES[body.category]
    ? body.category
    : "random";

  let code;

  for (let i = 0; i < 8; i++) {
    code = makeId();

    if (!(await env.ROOMS.get(`room:${code}`))) break;
  }

  const caseData = await generateCase(env, category);
  const playerId = crypto.randomUUID();

  const room = {
    code,
    category: caseData.category,
    createdAt: Date.now(),
    players: [{ id: playerId, name }],
    case: caseData,
    messages: [],
    turns: 0,
    accusations: [],
    verdict: null
  };

  await saveRoom(env, room);

  return json({
    roomCode: code,
    playerId,
    room: publicRoom(room)
  });
}

async function joinRoom(env, body) {
  const name = cleanName(body.name);
  const code = String(body.roomCode || "").trim().toUpperCase();

  if (!name || !code) {
    return json({ error: "Nama dan kode ruang wajib diisi." }, 400);
  }

  const room = await loadRoom(env, code);

  if (!room) {
    return json({ error: "Ruang tidak ditemukan atau sudah kedaluwarsa." }, 404);
  }

  if (room.verdict) {
    return json({ error: "Kasus ini sudah selesai." }, 400);
  }

  if (room.players.length >= 2) {
    return json({ error: "Ruang sudah penuh." }, 400);
  }

  const playerId = crypto.randomUUID();
  room.players.push({ id: playerId, name });

  await saveRoom(env, room);

  return json({
    roomCode: code,
    playerId,
    room: publicRoom(room)
  });
}

async function getRoom(request, env) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get("code") || "").toUpperCase();
  const playerId = url.searchParams.get("playerId");
  const room = await loadRoom(env, code);

  if (!room) {
    return json({ error: "Ruang tidak ditemukan." }, 404);
  }

  if (!room.players.some(p => p.id === playerId)) {
    return json({ error: "Kamu bukan anggota ruang ini." }, 403);
  }

  return json({ room: publicRoom(room) });
}

async function talk(env, body) {
  const code = String(body.roomCode || "").toUpperCase();
  const playerId = String(body.playerId || "");
  const suspectId = String(body.suspectId || "");
  const text = String(body.text || "").trim().slice(0, 500);

  if (!text) {
    return json({ error: "Pertanyaan tidak boleh kosong." }, 400);
  }

  const room = await loadRoom(env, code);

  if (!room) return json({ error: "Ruang tidak ditemukan." }, 404);

  if (!room.players.some(p => p.id === playerId)) {
    return json({ error: "Akses ditolak." }, 403);
  }

  if (room.verdict) {
    return json({ error: "Kasus sudah selesai." }, 400);
  }

  if (room.turns >= MAX_TURNS) {
    return json({ error: "Batas interogasi tercapai." }, 400);
  }

  const suspect = room.case.suspects.find(s => s.id === suspectId);

  if (!suspect) {
    return json({ error: "Tersangka tidak valid." }, 400);
  }

  const player = room.players.find(p => p.id === playerId);

  const history = room.messages
    .filter(m => m.suspectId === suspectId)
    .slice(-12)
    .map(m => ({
      role: m.kind === "answer" ? "assistant" : "user",
      content: m.text
    }));

  room.messages.push({
    kind: "question",
    playerId,
    playerName: player.name,
    suspectId,
    suspectName: suspect.name,
    text,
    at: Date.now()
  });

  room.turns++;

  let answer =
    "Aku perlu memikirkan kembali kejadian itu. Aku tidak ingat semuanya dengan jelas.";

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        {
          role: "system",
          content: `Kamu memerankan tersangka fiksi bernama ${suspect.name}.
Peran: ${suspect.role}.
Keterangan dan alibi: ${suspect.description}
Kasus: ${room.case.title}.
Ringkasan: ${room.case.description}
Bukti publik: ${room.case.evidence.join("; ")}
Jawab dalam bahasa Indonesia, 1-3 kalimat.
Pertahankan alibi dan karakter secara konsisten.
Jangan mengarang fakta yang bertentangan dengan informasi kasus.
Jangan membocorkan solusi atau mengaku sebagai pelaku tanpa alasan cerita.
Jangan mengaku mengetahui informasi yang tidak diketahui karaktermu.`
        },
        ...history,
        { role: "user", content: text }
      ],
      max_tokens: 180,
      temperature: 0.65
    });

    answer = String(
      result.response || result.output_text || answer
    ).trim().slice(0, 1000);
  } catch (error) {
    console.error("INTERROGATION FAILED:", error?.message || error);
  }

  room.messages.push({
    kind: "answer",
    playerId: `suspect:${suspectId}`,
    playerName: suspect.name,
    suspectId,
    suspectName: suspect.name,
    text: answer,
    at: Date.now()
  });

  await saveRoom(env, room);

  return json({ ok: true, answer });
}

async function accuse(env, body) {
  const code = String(body.roomCode || "").toUpperCase();
  const playerId = String(body.playerId || "");
  const suspectId = String(body.suspectId || "");

  const room = await loadRoom(env, code);

  if (!room) return json({ error: "Ruang tidak ditemukan." }, 404);

  if (!room.players.some(p => p.id === playerId)) {
    return json({ error: "Akses ditolak." }, 403);
  }

  if (room.verdict) {
    return json({ error: "Kasus sudah selesai." }, 400);
  }

  if (room.players.length < 2) {
    return json({
      error: "Tunggu temanmu bergabung sebelum menuduh."
    }, 400);
  }

  if (!room.case.suspects.some(s => s.id === suspectId)) {
    return json({ error: "Tersangka tidak valid." }, 400);
  }

  if (room.accusations.some(a => a.playerId === playerId)) {
    return json({ error: "Kamu sudah mengirim tuduhan." }, 400);
  }

  const player = room.players.find(p => p.id === playerId);
  const suspect = room.case.suspects.find(s => s.id === suspectId);

  room.accusations.push({
    playerId,
    playerName: player.name,
    suspectId,
    suspectName: suspect.name,
    at: Date.now()
  });

  if (room.accusations.length === 2) {
    const culprit = room.case.suspects.find(
      s => s.id === room.case.culpritId
    );

    room.verdict = {
      culpritId: room.case.culpritId,
      culpritName: culprit?.name || "Tidak diketahui",
      explanation: room.case.explanation,
      allCorrect: room.accusations.every(
        a => a.suspectId === room.case.culpritId
      ),
      accusations: room.accusations.map(a => ({
        playerName: a.playerName,
        suspectName: a.suspectName,
        correct: a.suspectId === room.case.culpritId
      }))
    };
  }

  await saveRoom(env, room);

  return json({
    ok: true,
    room: publicRoom(room)
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: HEADERS
      });
    }

    const url = new URL(request.url);

    try {
      if (
        url.pathname === "/api/health" &&
        request.method === "GET"
      ) {
        return json({
          ok: true,
          service: "THE LAST LETTER"
        });
      }

      if (
        url.pathname === "/api/room" &&
        request.method === "GET"
      ) {
        return await getRoom(request, env);
      }

      if (request.method !== "POST") {
        return json({ error: "Endpoint tidak ditemukan." }, 404);
      }

      let body;

      try {
        body = await request.json();
      } catch {
        return json({ error: "Body request bukan JSON yang valid." }, 400);
      }

      if (url.pathname === "/api/create") {
        return await createRoom(env, body);
      }

      if (url.pathname === "/api/join") {
        return await joinRoom(env, body);
      }

      if (url.pathname === "/api/talk") {
        return await talk(env, body);
      }

      if (url.pathname === "/api/accuse") {
        return await accuse(env, body);
      }

      return json({ error: "Endpoint tidak ditemukan." }, 404);
    } catch (error) {
      console.error("WORKER ERROR:", error);

      return json({
        error: "Terjadi kesalahan pada server. Coba lagi."
      }, 500);
    }
  }
};
