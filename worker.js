
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
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}

function makeId(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function cleanName(value) {
  return String(value || "").trim().slice(0, 24);
}

function fallbackCase(category) {
  const chosen = CATEGORIES[category] ? category : "theft";
  const suspects = [
    { id: "s1", name: "Raka Pradipta", role: "Manajer", description: "Mengelola lokasi kejadian dan mengaku pulang lebih awal." },
    { id: "s2", name: "Nadia Putri", role: "Pegawai", description: "Pegawai lama yang mengetahui rutinitas orang-orang di lokasi." },
    { id: "s3", name: "Dimas Arya", role: "Pengunjung", description: "Mengaku berada dekat lokasi, tetapi keterangannya berubah." },
    { id: "s4", name: "Sinta Maharani", role: "Saksi", description: "Orang terakhir yang mengaku melihat kejadian." }
  ];

  const cases = {
    murder: {
      title: "Malam Terakhir di Rumah Arunika",
      description: "Pemilik galeri ditemukan meninggal di ruang kerjanya. Tidak ada kerusakan pada pintu, sementara empat orang memberikan alibi yang belum sepenuhnya cocok.",
      evidence: ["Jam dinding berhenti pada pukul 21.15.", "Ada gelas minuman di meja kerja.", "Sebuah catatan menunjukkan janji pertemuan malam itu."],
      culpritId: "s2",
      explanation: "Nadia menyembunyikan waktu kedatangannya. Catatan pertemuan dan keterangannya yang berubah menunjukkan bahwa ia memiliki kesempatan yang tidak ia akui."
    },
    robbery: {
      title: "Perampokan di Galeri Arunika",
      description: "Sebuah koleksi bernilai tinggi lenyap dari galeri terkunci. Alarm sempat mati selama beberapa menit dan hanya empat orang diketahui berada di sekitar gedung.",
      evidence: ["Alarm berhenti mencatat aktivitas selama tujuh menit.", "Jejak sepatu ditemukan di lorong servis.", "Kunci cadangan tidak berada di tempat penyimpanan."],
      culpritId: "s1",
      explanation: "Raka mengetahui sistem keamanan dan waktu pergantian penjaga. Alibinya tidak cocok dengan catatan alarm."
    },
    kidnapping: {
      title: "Pesan dari Kamar Kosong",
      description: "Seorang mahasiswa menghilang setelah menerima pesan misterius. Barang-barangnya tertinggal, sementara empat orang terakhir memberikan keterangan berbeda.",
      evidence: ["Ponsel korban menerima pesan pukul 20.40.", "Kamera merekam kendaraan yang tidak dikenal.", "Satu halaman dari buku catatan korban hilang."],
      culpritId: "s3",
      explanation: "Dimas mengetahui isi pesan yang seharusnya hanya diketahui orang dekat korban. Keterangannya tentang waktu juga berubah."
    },
    fraud: {
      title: "Laporan yang Tidak Seimbang",
      description: "Dana sebuah yayasan tidak sesuai dengan laporan keuangan. Empat orang memiliki akses ke dokumen, tetapi masing-masing memberikan penjelasan berbeda.",
      evidence: ["Ada dua versi laporan dengan angka berbeda.", "Sebuah transaksi tidak memiliki bukti pendukung.", "Dokumen revisi dibuat setelah jam kerja."],
      culpritId: "s1",
      explanation: "Raka memiliki akses untuk mengubah laporan. Waktu revisi dokumen bertentangan dengan keterangannya."
    },
    missing: {
      title: "Jejak yang Terputus",
      description: "Seorang fotografer tidak pulang setelah perjalanan terakhirnya. Kamera ditemukan di sebuah penginapan, dengan empat orang terkait perjalanan tersebut.",
      evidence: ["Kamera korban menyimpan satu foto yang belum dikirim.", "Tiket perjalanan memiliki perubahan waktu.", "Buku tamu mencatat nama yang berbeda."],
      culpritId: "s4",
      explanation: "Sinta mengetahui lokasi terakhir korban tetapi tidak mengungkapkannya sejak awal. Keterangan buku tamu menunjukkan bahwa ia berada di sana."
    },
    theft: {
      title: "Arsip yang Menghilang",
      description: "Sebuah dokumen penting hilang dari kantor tertutup. Tidak ada kerusakan pada pintu, dan empat orang memiliki alasan untuk mengakses ruangan.",
      evidence: ["Kartu akses digunakan setelah jam kantor.", "Laci arsip ditemukan terbuka.", "Catatan penjaga menunjukkan pergantian jadwal yang tidak biasa."],
      culpritId: "s3",
      explanation: "Dimas mengaku sudah pergi sebelum kartu akses digunakan. Catatan waktu membantah alibinya."
    },
    blackmail: {
      title: "Surat Tanpa Nama",
      description: "Seseorang mengirim surat ancaman untuk membuka rahasia sebuah keluarga. Empat orang memiliki informasi yang bisa digunakan untuk menekan mereka.",
      evidence: ["Surat dibuat menggunakan mesin cetak kantor.", "Amplop tidak memiliki alamat pengirim.", "Sebuah foto lama diselipkan bersama surat."],
      culpritId: "s2",
      explanation: "Nadia memiliki akses ke mesin cetak dan mengetahui detail foto yang tidak pernah diumumkan."
    }
  };

  return { category: chosen, ...cases[chosen], suspects };
}

async function generateCase(env, requestedCategory) {
  const keys = Object.keys(CATEGORIES);
  const category = CATEGORIES[requestedCategory]
    ? requestedCategory
    : keys[Math.floor(Math.random() * keys.length)];

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        {
          role: "system",
          content: "Kamu penulis kasus misteri detektif berbahasa Indonesia. Keluarkan JSON valid saja."
        },
        {
          role: "user",
          content: `Buat kasus fiksi kategori ${CATEGORIES[category]}.
Buat kasus yang bisa dipecahkan dengan menalar bukti dan alibi. Tanpa detail grafis.
Tepat 4 tersangka dengan ID s1, s2, s3, s4. Tepat satu pelaku.
Buat 3-5 barang bukti. Jangan membocorkan pelaku dalam deskripsi, alibi, atau bukti.
Jawaban wajib berupa JSON tanpa markdown dengan struktur:
{
"title":"judul kasus",
"description":"ringkasan tanpa mengungkap pelaku",
"suspects":[
{"id":"s1","name":"nama","role":"peran","description":"alibi atau informasi awal"},
{"id":"s2","name":"nama","role":"peran","description":"alibi atau informasi awal"},
{"id":"s3","name":"nama","role":"peran","description":"alibi atau informasi awal"},
{"id":"s4","name":"nama","role":"peran","description":"alibi atau informasi awal"}
],
"evidence":["bukti 1","bukti 2","bukti 3"],
"culpritId":"s1",
"explanation":"penjelasan solusi yang menghubungkan bukti dengan pelaku"
}`
        }
      ],
      max_tokens: 1800,
      temperature: 0.75
    });

    const raw = String(result.response || result.output_text || "");
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("AI tidak menghasilkan JSON");

    const data = JSON.parse(raw.slice(start, end + 1));
    const ids = ["s1", "s2", "s3", "s4"];
    if (!data.title || !data.description ||
        !Array.isArray(data.suspects) || data.suspects.length !== 4 ||
        !Array.isArray(data.evidence) || !ids.includes(data.culpritId) ||
        !data.suspects.some(s => s.id === data.culpritId)) {
      throw new Error("Struktur kasus tidak valid");
    }

    data.category = category;
    data.suspects = data.suspects.map((s, i) => ({
      id: ids[i],
      name: String(s.name || `Tersangka ${i + 1}`).slice(0, 80),
      role: String(s.role || "Tersangka").slice(0, 50),
      description: String(s.description || "Belum memberikan keterangan.").slice(0, 500)
    }));
    data.evidence = data.evidence.slice(0, 5).map(x => String(x).slice(0, 500));
    data.explanation = String(data.explanation || "Petunjuk dan alibi mengungkap pelaku.");
    return data;
  } catch (error) {
    console.error("Case generation:", error.message);
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
  await env.ROOMS.put(`room:${room.code}`, JSON.stringify(room), {
    expirationTtl: ROOM_TTL
  });
}

async function createRoom(env, body) {
  const name = cleanName(body.name);
  if (!name) return json({ error: "Nama detektif wajib diisi." }, 400);

  const category = CATEGORIES[body.category] ? body.category : "random";
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
  return json({ roomCode: code, playerId, room: publicRoom(room) });
}

async function joinRoom(env, body) {
  const name = cleanName(body.name);
  const code = String(body.roomCode || "").trim().toUpperCase();
  if (!name || !code) return json({ error: "Nama dan kode ruang wajib diisi." }, 400);

  const room = await loadRoom(env, code);
  if (!room) return json({ error: "Ruang tidak ditemukan atau sudah kedaluwarsa." }, 404);
  if (room.verdict) return json({ error: "Kasus ini sudah selesai." }, 400);
  if (room.players.length >= 2) return json({ error: "Ruang sudah penuh." }, 400);

  const playerId = crypto.randomUUID();
  room.players.push({ id: playerId, name });
  await saveRoom(env, room);
  return json({ roomCode: code, playerId, room: publicRoom(room) });
}

async function getRoom(request, env) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get("code") || "").toUpperCase();
  const playerId = url.searchParams.get("playerId");
  const room = await loadRoom(env, code);

  if (!room) return json({ error: "Ruang tidak ditemukan." }, 404);
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

  if (!text) return json({ error: "Pertanyaan tidak boleh kosong." }, 400);

  const room = await loadRoom(env, code);
  if (!room) return json({ error: "Ruang tidak ditemukan." }, 404);
  if (!room.players.some(p => p.id === playerId)) return json({ error: "Akses ditolak." }, 403);
  if (room.verdict) return json({ error: "Kasus sudah selesai." }, 400);
  if (room.turns >= MAX_TURNS) return json({ error: "Batas interogasi tercapai." }, 400);

  const suspect = room.case.suspects.find(s => s.id === suspectId);
  if (!suspect) return json({ error: "Tersangka tidak valid." }, 400);

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

  let answer = "Aku perlu memikirkan kembali kejadian itu. Aku tidak ingat semuanya dengan jelas.";
  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        {
          role: "system",
          content: `Kamu memerankan tersangka fiksi bernama ${suspect.name}.
Peran: ${suspect.role}. Keterangan awal dan alibi: ${suspect.description}
Kasus: ${room.case.title}. Ringkasan: ${room.case.description}
Bukti publik: ${room.case.evidence.join("; ")}
Jawab pertanyaan detektif dalam bahasa Indonesia, 1-3 kalimat.
Pertahankan karakter dan alibi secara konsisten. Jangan mengarang fakta yang bertentangan dengan informasi kasus.
Jangan mengungkap solusi atau mengaku sebagai pelaku tanpa alasan dalam cerita.
Jangan berpura-pura memiliki informasi yang tidak diketahui karakter.`
        },
        ...history,
        { role: "user", content: text }
      ],
      max_tokens: 180,
      temperature: 0.65
    });
    answer = String(result.response || result.output_text || answer).trim().slice(0, 1000);
  } catch (error) {
    console.error("Interrogation:", error.message);
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
  if (!room.players.some(p => p.id === playerId)) return json({ error: "Akses ditolak." }, 403);
  if (room.verdict) return json({ error: "Kasus sudah selesai." }, 400);
  if (room.players.length < 2) return json({ error: "Tunggu temanmu bergabung sebelum menuduh." }, 400);
  if (!room.case.suspects.some(s => s.id === suspectId)) return json({ error: "Tersangka tidak valid." }, 400);
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
    const culprit = room.case.suspects.find(s => s.id === room.case.culpritId);
    room.verdict = {
      culpritId: room.case.culpritId,
      culpritName: culprit?.name || "Tidak diketahui",
      explanation: room.case.explanation,
      allCorrect: room.accusations.every(a => a.suspectId === room.case.culpritId),
      accusations: room.accusations.map(a => ({
        playerName: a.playerName,
        suspectName: a.suspectName,
        correct: a.suspectId === room.case.culpritId
      }))
    };
  }

  await saveRoom(env, room);
  return json({ ok: true, room: publicRoom(room) });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        return json({ ok: true, service: "THE LAST LETTER" });
      }
      if (url.pathname === "/api/room" && request.method === "GET") {
        return await getRoom(request, env);
      }
      if (request.method !== "POST") return json({ error: "Endpoint tidak ditemukan." }, 404);

      const body = await request.json();
      if (url.pathname === "/api/create") return await createRoom(env, body);
      if (url.pathname === "/api/join") return await joinRoom(env, body);
      if (url.pathname === "/api/talk") return await talk(env, body);
      if (url.pathname === "/api/accuse") return await accuse(env, body);
      return json({ error: "Endpoint tidak ditemukan." }, 404);
    } catch (error) {
      console.error("Worker error:", error);
      return json({ error: "Terjadi kesalahan pada server. Coba lagi." }, 500);
    }
  }
};
