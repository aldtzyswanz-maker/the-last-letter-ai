
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

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });

function makeId(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function makePlayerId() {
  return crypto.randomUUID();
}

function cleanName(value) {
  return String(value || "").trim().slice(0, 24);
}

function fallbackCase(category) {
  const actualCategory = CATEGORIES[category] ? category : "theft";

  const suspects = [
    {
      id: "s1",
      name: "Raka Pradipta",
      role: "Manajer",
      description: "Mengelola tempat kejadian dan mengaku pulang lebih awal."
    },
    {
      id: "s2",
      name: "Nadia Putri",
      role: "Pegawai",
      description: "Pegawai lama yang mengetahui rutinitas semua orang."
    },
    {
      id: "s3",
      name: "Dimas Arya",
      role: "Pengunjung",
      description: "Mengaku berada di dekat lokasi, tetapi keterangannya berubah."
    },
    {
      id: "s4",
      name: "Sinta Maharani",
      role: "Saksi",
      description: "Orang terakhir yang mengaku melihat kejadian."
    }
  ];

  const templates = {
    murder: {
      title: "Malam Terakhir di Rumah Arunika",
      description: "Seorang pemilik galeri ditemukan meninggal di ruang kerjanya. Pintu tidak rusak dan empat orang memberikan alibi yang belum sepenuhnya cocok.",
      evidence: [
        "Jam dinding berhenti pada pukul 21.15.",
        "Ada gelas minuman di meja kerja.",
        "Sebuah catatan menunjukkan janji pertemuan malam itu."
      ],
      culpritId: "s2",
      explanation: "Nadia menyembunyikan waktu kedatangannya. Catatan pertemuan dan keterangannya yang berubah menunjukkan bahwa ia memiliki kesempatan yang tidak ia akui."
    },
    robbery: {
      title: "Perampokan di Galeri Arunika",
      description: "Sebuah koleksi bernilai tinggi lenyap dari galeri yang terkunci. Alarm sempat mati beberapa menit, dan hanya empat orang diketahui berada di sekitar gedung.",
      evidence: [
        "Alarm berhenti mencatat aktivitas selama tujuh menit.",
        "Jejak sepatu ditemukan di lorong servis.",
        "Kunci cadangan tidak berada di tempat penyimpanan."
      ],
      culpritId: "s1",
      explanation: "Raka mengetahui sistem keamanan dan waktu pergantian penjaga. Alibinya tidak cocok dengan catatan alarm."
    },
    kidnapping: {
      title: "Pesan dari Kamar Kosong",
      description: "Seorang mahasiswa menghilang setelah menerima pesan misterius. Barang-barangnya tertinggal, sementara empat orang terakhir memberikan keterangan berbeda.",
      evidence: [
        "Ponsel korban menerima pesan pada pukul 20.40.",
        "Kamera merekam kendaraan yang tidak dikenal.",
        "Satu halaman dari buku catatan korban hilang."
      ],
      culpritId: "s3",
      explanation: "Dimas mengetahui pesan yang seharusnya hanya diketahui oleh orang yang dekat dengan korban. Keterangannya tentang waktu juga berubah."
    },
    fraud: {
      title: "Laporan yang Tidak Seimbang",
      description: "Dana sebuah yayasan tidak sesuai dengan laporan keuangan. Empat orang memiliki akses ke dokumen, tetapi masing-masing memberikan penjelasan berbeda.",
      evidence: [
        "Ada dua versi laporan dengan angka berbeda.",
        "Sebuah transaksi tidak memiliki bukti pendukung.",
        "Dokumen revisi dibuat setelah jam kerja."
      ],
      culpritId: "s1",
      explanation: "Raka memiliki akses untuk mengubah laporan. Waktu revisi dokumen bertentangan dengan keterangannya."
    },
    missing: {
      title: "Jejak yang Terputus",
      description: "Seorang fotografer tidak pulang setelah perjalanan terakhirnya. Kamera ditemukan di sebuah penginapan, dengan empat orang terkait perjalanan tersebut.",
      evidence: [
        "Kamera korban menyimpan satu foto yang belum dikirim.",
        "Tiket perjalanan memiliki perubahan waktu.",
        "Buku tamu mencatat nama yang berbeda."
      ],
      culpritId: "s4",
      explanation: "Sinta mengetahui lokasi terakhir korban tetapi tidak mengungkapkannya sejak awal. Keterangan buku tamu memperlihatkan bahwa ia berada di sana."
    },
    theft: {
      title: "Arsip yang Menghilang",
      description: "Sebuah dokumen penting hilang dari kantor tertutup. Tidak ada kerusakan pada pintu, dan empat orang memiliki alasan untuk mengakses ruangan.",
      evidence: [
        "Kartu akses digunakan setelah jam kantor.",
        "Laci arsip ditemukan terbuka.",
        "Catatan penjaga menunjukkan pergantian jadwal yang tidak biasa."
      ],
      culpritId: "s3",
      explanation: "Dimas mengaku sudah pergi sebelum kartu akses digunakan. Catatan waktu membantah alibinya."
    },
    blackmail: {
      title: "Surat Tanpa Nama",
      description: "Seseorang mengirim surat ancaman untuk membuka rahasia sebuah keluarga. Empat orang memiliki informasi yang bisa digunakan untuk menekan mereka.",
      evidence: [
        "Surat dibuat menggunakan mesin cetak kantor.",
        "Amplop tidak memiliki alamat pengirim.",
        "Sebuah foto lama diselipkan bersama surat."
      ],
      culpritId: "s2",
      explanation: "Nadia memiliki akses ke mesin cetak dan mengetahui detail foto yang tidak pernah diumumkan."
    }
  };

  return {
    category: actualCategory,
    title: templates[actualCategory].title,
    description: templates[actualCategory].description,
    suspects,
    evidence: templates[actualCategory].evidence,
    culpritId: templates[actualCategory].culpritId,
    explanation: templates[actualCategory].explanation
  };
}

async function generateCase(env, category) {
  const chosen = CATEGORIES[category] ? category : null;
  const actualCategory = chosen || Object.keys(CATEGORIES)[
    Math.floor(Math.random() * Object.keys(CATEGORIES).length)
  ];

  const prompt = `Buat satu kasus misteri detektif berbahasa Indonesia.
Kategori wajib: ${CATEGORIES[actualCategory]}.
Buat kasus fiksi yang konsisten, dapat dipecahkan dari petunjuk dan alibi.
Jangan membuat deskripsi grafis. Kasus tidak boleh selesai sebelum pemain menuduh.
Buat tepat 4 tersangka. Tepat satu tersangka adalah pelaku atau pihak yang bertanggung jawab.
Setiap tersangka memiliki id s1, s2, s3, atau s4.
Setiap tersangka punya nama, role, description yang memuat alibi atau informasi awal.
Buat 3 sampai 5 barang bukti.
Pastikan petunjuk dan alibi memungkinkan pemain menalar jawaban.
Jangan mengungkap pelaku atau penjelasannya dalam description, suspects, atau evidence.
Kembalikan JSON valid saja, tanpa markdown, dengan struktur:
{
  "title":"judul",
  "description":"ringkasan kasus tanpa membocorkan pelaku",
  "suspects":[
    {"id":"s1","name":"nama","role":"peran","description":"alibi atau informasi awal"}
  ],
  "evidence":["petunjuk 1","petunjuk 2","petunjuk 3"],
  "culpritId":"s1",
  "explanation":"penjelasan solusi dan hubungan bukti dengan pelaku"
}`;

  try {
    const response = await env.AI.run(MODEL, {
      messages: [
        {
          role: "system",
          content: "Kamu adalah penulis misteri detektif. Jawab dengan JSON valid saja."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 1800,
      temperature: 0.8
    });

    const raw = response.response || response.output_text || "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("AI tidak mengembalikan JSON");

    const parsed = JSON.parse(raw.slice(start, end + 1));
    const validIds = ["s1", "s2", "s3", "s4"];

    if (
      !parsed.title ||
      !parsed.description ||
      !Array.isArray(parsed.suspects) ||
      parsed.suspects.length !== 4 ||
      !Array.isArray(parsed.evidence) ||
      !validIds.includes(parsed.culpritId) ||
      !parsed.suspects.some(s => s.id === parsed.culpritId)
    ) {
      throw new Error("Struktur kasus dari AI tidak valid");
    }

    parsed.category = actualCategory;
    parsed.suspects = parsed.suspects.map((s, i) => ({
      id: validIds.includes(s.id) ? s.id : validIds[i],
      name: String(s.name || `Tersangka ${i + 1}`).slice(0, 80),
      role: String(s.role || "Tersangka").slice(0, 60),
      description: String(s.description || "Belum ada keterangan.").slice(0, 500)
    }));
    parsed.evidence = parsed.evidence.slice(0, 5).map(e =>
      String(e).slice(0, 500)
    );
    parsed.explanation = String(parsed.explanation || "Petunjuk dan alibi mengungkap pelaku.");

    return parsed;
  } catch (error) {
    console.error("Case generation failed:", error.message);
    return fallbackCase(actualCategory);
  }
}

function publicRoom(room) {
  const copy = structuredClone(room);

  // Jangan pernah mengirim jawaban sebelum kasus selesai.
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
  let exists = true;

  for (let i = 0; i < 5 && exists; i++) {
    code = makeId(6);
    exists = Boolean(await env.ROOMS.get(`room:${code}`));
  }

  if (exists) return json({ error: "Gagal membuat kode ruang. Coba lagi." }, 500);

  const caseData = await generateCase(env, category);
  const playerId = makePlayerId();

  const room = {
    code,
    category: caseData.category,
    createdAt: Date.now(),
    players: [{ id: playerId, name }],
    case: caseData,
    messages: [{
      playerId: "system",
      playerName: "Sistem",
      text: `Kasus dimulai: ${caseData.title}`
    }],
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

  if (!name || !code) {
    return json({ error: "Nama dan kode ruang wajib diisi." }, 400);
  }

  const room = await loadRoom(env, code);
  if (!room) return json({ error: "Ruang tidak ditemukan atau sudah kedaluwarsa." }, 404);
  if (room.verdict) return json({ error: "Kasus ini sudah selesai." }, 400);

  if (room.players.length >= 2) {
    return json({ error: "Ruang sudah penuh." }, 400);
  }

  const playerId = makePlayerId();
  room.players.push({ id: playerId, name });
  room.messages.push({
    playerId: "system",
    playerName: "Sistem",
    text: `${name} bergabung dengan penyelidikan.`
  });

  await saveRoom(env, room);
  return json({ roomCode: code, playerId, room: publicRoom(room) });
}

function playerInRoom(room, playerId) {
  return room.players.some(p => p.id === playerId);
}

async function getRoom(request, env) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get("code") || "").toUpperCase();
  const playerId = url.searchParams.get("playerId");

  const room = await loadRoom(env, code);
  if (!room) return json({ error: "Ruang tidak ditemukan." }, 404);
  if (!playerInRoom(room, playerId)) {
    return json({ error: "Kamu bukan anggota ruang ini." }, 403);
  }

  return json({ room: publicRoom(room) });
}

async function talk(env, body) {
  const code = String(body.roomCode || "").toUpperCase();
  const playerId = String(body.playerId || "");
  const text = String(body.text || "").trim().slice(0, 500);

  if (!text) return json({ error: "Pertanyaan tidak boleh kosong." }, 400);

  const room = await loadRoom(env, code);
  if (!room) return json({ error: "Ruang tidak ditemukan." }, 404);
  if (!playerInRoom(room, playerId)) return json({ error: "Akses ditolak." }, 403);
  if (room.verdict) return json({ error: "Kasus sudah selesai." }, 400);
  if (room.turns >= MAX_TURNS) return json({ error: "Batas interogasi tercapai." }, 400);

  const player = room.players.find(p => p.id === playerId);
  const suspects = room.case.suspects;
  const target = suspects.find(s =>
    text.toLowerCase().includes(s.name.toLowerCase())
  ) || suspects[0];

  room.messages.push({
    playerId,
    playerName: player.name,
    suspectName: target.name,
    text
  });

  const history = room.messages.slice(-14).map(m => ({
    role: m.playerId === "system" ? "assistant" :
      (m.suspectName ? "assistant" : "user"),
    content: `${m.playerName || "Sistem"}: ${m.text}`
  }));

  const prompt = `Kamu memerankan tersangka fiksi bernama ${target.name}.
Kasus: ${room.case.title}
Ringkasan: ${room.case.description}
Peran dan alibi tersangka: ${target.description}
Bukti publik: ${room.case.evidence.join("; ")}
Pertanyaan terbaru detektif: ${text}

Jawab dalam bahasa Indonesia, 1-3 kalimat, tetap sesuai karakter dan alibi.
Jangan mengungkap pelaku secara langsung hanya karena ditanya.
Jangan mengarang bukti baru yang bertentangan dengan fakta kasus.
Jika pertanyaan tidak menyebut nama tersangka lain, jawab sebagai ${target.name}.`;

  let answer = "Aku tidak yakin bisa menjawab itu. Ada bagian kejadian yang tidak kuingat dengan jelas.";

  try {
    const result = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: prompt },
        ...history
      ],
      max_tokens: 180,
      temperature: 0.65
    });
    answer = String(result.response || result.output_text || answer).trim().slice(0, 1000);
  } catch (error) {
    console.error("Interrogation failed:", error.message);
  }

  room.messages.push({
    playerId: `suspect:${target.id}`,
    playerName: target.name,
    suspectName: target.name,
    text: answer
  });

  room.turns++;
  await saveRoom(env, room);
  return json({ ok: true, answer });
}

async function accuse(env, body) {
  const code = String(body.roomCode || "").toUpperCase();
  const playerId = String(body.playerId || "");
  const suspectId = String(body.suspectId || "");

  const room = await loadRoom(env, code);
  if (!room) return json({ error: "Ruang tidak ditemukan." }, 404);
  if (!playerInRoom(room, playerId)) return json({ error: "Akses ditolak." }, 403);
  if (room.verdict) return json({ error: "Kasus sudah selesai." }, 400);
  if (room.players.length < 2) {
    return json({ error: "Tunggu temanmu bergabung sebelum menuduh." }, 400);
  }
  if (!room.case.suspects.some(s => s.id === suspectId)) {
    return json({ error: "Tersangka tidak valid." }, 400);
  }
  if (room.accusations.some(a => a.playerId === playerId)) {
    return json({ error: "Kamu sudah mengirim tuduhan." }, 400);
  }

  const player = room.players.find(p => p.id === playerId);
  room.accusations.push({
    playerId,
    playerName: player.name,
    suspectId,
    suspectName: room.case.suspects.find(s => s.id === suspectId).name,
    at: Date.now()
  });

  if (room.accusations.length >= 2) {
    const culprit = room.case.suspects.find(s => s.id === room.case.culpritId);
    const allCorrect = room.accusations.every(a => a.suspectId === room.case.culpritId);

    room.verdict = {
      culpritId: room.case.culpritId,
      culpritName: culprit ? culprit.name : "Tidak diketahui",
      explanation: room.case.explanation,
      allCorrect,
      accusations: room.accusations.map(a => ({
        playerName: a.playerName,
        suspectName: a.suspectName,
        correct: a.suspectId === room.case.culpritId
      }))
    };

    room.messages.push({
      playerId: "system",
      playerName: "Sistem",
      text: `Penyelidikan selesai. Pelaku adalah ${room.verdict.culpritName}.`
    });
  }

  await saveRoom(env, room);
  return json({ ok: true, room: publicRoom(room) });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/health") {
        return json({ ok: true, service: "THE LAST LETTER" });
      }

      if (url.pathname === "/api/room" && request.method === "GET") {
        return await getRoom(request, env);
      }

      if (request.method !== "POST") {
        return json({ error: "Endpoint tidak ditemukan." }, 404);
      }

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
