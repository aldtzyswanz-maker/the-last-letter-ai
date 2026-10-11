const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return new Response(null, { headers: cors });
    try {
      if (url.pathname === "/api/health")
        return json({ ok: true, ai: !!env.AI, storage: !!env.ROOMS });
      if (!url.pathname.startsWith("/api/"))
        return json({ error: "Endpoint tidak ditemukan" }, 404);

      if (url.pathname === "/api/create" && request.method === "POST") {
        const b = await request.json();
        const name = validName(b.name);
        const code = makeCode();
        const mystery = await generateCase(env, b.caseType || "random");
        const room = {
          code,
          createdAt: Date.now(),
          players: [{ id: String(b.playerId || ""), name }],
          case: mystery,
          messages: [
            {
              name: "ARSIP KASUS",
              kind: "system",
              text: `Kasus dibuka. ${mystery.introduction}\n\nKalian dapat menginterogasi tersangka dengan mengetik pertanyaan sendiri. Fakta inti kasus sudah ditetapkan; jawaban karakter harus konsisten dengan fakta tersebut.`,
            },
          ],
          evidence: [],
          verdict: null,
          turns: 0,
          accusations: {},
        };
        await saveRoom(env, room);
        return json({ code });
      }

      if (url.pathname === "/api/join" && request.method === "POST") {
        const b = await request.json(),
          code = String(b.code || "").toUpperCase(),
          room = await getRoom(env, code);
        if (!room)
          return json(
            { error: "Ruang tidak ditemukan atau sudah kedaluwarsa." },
            404
          );
        const id = String(b.playerId || "");
        if (!room.players.some((p) => p.id === id)) {
          if (room.players.length >= 2)
            return json(
              { error: "Ruang ini sudah penuh (maksimal 2 detektif)." },
              409
            );
          room.players.push({ id, name: validName(b.name) });
          room.messages.push({
            name: "ARSIP KASUS",
            kind: "system",
            text: `${validName(b.name)} bergabung dalam penyelidikan.`,
          });
          await saveRoom(env, room);
        }
        return json({ ok: true });
      }

      if (url.pathname === "/api/room" && request.method === "GET") {
        const code = String(url.searchParams.get("code") || "").toUpperCase(),
          room = await getRoom(env, code);
        if (!room)
          return json(
            { error: "Ruang tidak ditemukan. Buat ruang baru." },
            404
          );
        return json({ room: publicRoom(room) });
      }

      if (url.pathname === "/api/talk" && request.method === "POST") {
        const b = await request.json(),
          room = await getRoom(env, String(b.code || "").toUpperCase());
        if (!room) return json({ error: "Ruang tidak ditemukan." }, 404);
        if (!room.players.some((p) => p.id === String(b.playerId || "")))
          return json({ error: "Kamu belum bergabung di ruang ini." }, 403);
        if (room.turns >= 80)
          return json(
            {
              error: "Batas 80 giliran AI per ruang tercapai. Buat kasus baru.",
            },
            429
          );
        const name = validName(b.name),
          message = String(b.message || "")
            .trim()
            .slice(0, 700),
          target = String(b.target || "team");
        if (!message) return json({ error: "Pertanyaan kosong." }, 400);
        room.messages.push({
          name,
          kind: "user",
          text:
            (target === "team"
              ? "[Catatan tim] "
              : "[Kepada " + suspectName(room.case, target) + "] ") + message,
        });
        room.turns++;
        if (target === "team") {
          const answer = await askAI(
            env,
            `Kamu adalah partner detektif dalam game misteri. Kasus: ${JSON.stringify(
              room.case.public_summary
            )}. Bukti ditemukan: ${JSON.stringify(
              room.evidence
            )}. Pemain berkata: ${message}. Jawab sebagai partner detektif dalam bahasa Indonesia, 2-4 kalimat. Jangan mengungkap rahasia pelaku yang belum dibuktikan. Jangan mengarang bukti baru; sarankan langkah investigasi yang masuk akal.`
          );
          room.messages.push({ name: "PARTNER AI", kind: "ai", text: answer });
        } else {
          const suspect = room.case.suspects.find((s) => s.id === target);
          if (!suspect)
            return json({ error: "Pilih karakter yang valid." }, 400);
          const transcript = room.messages
            .slice(-12)
            .map((m) => `${m.name}: ${m.text}`)
            .join("\n");
          const answer = await askAI(
            env,
            `Kamu memerankan karakter fiksi bernama ${
              suspect.name
            } dalam permainan detektif. Jawab langsung sebagai karakter itu, bahasa Indonesia, 1-5 kalimat.\nFAKTA KASUS RAHASIA (jangan pernah mengungkap bagian ini secara langsung kecuali karakter ini secara masuk akal mau mengaku atau pemain menunjukkan bukti kuat): ${JSON.stringify(
              room.case.secret
            )}\nPROFIL DAN PENGETAHUAN KARAKTER: ${JSON.stringify(
              suspect
            )}\nBUKTI YANG SUDAH DITEMUKAN: ${JSON.stringify(
              room.evidence
            )}\nRIWAYAT TERBARU: ${transcript}\nPERTANYAAN PEMAIN: ${message}\nAturan: pertahankan kepribadian dan konsistensi. Jika pelaku, boleh mengelak atau berbohong, tetapi jangan ubah fakta inti. Jika tidak bersalah, jangan otomatis mengaku. Jangan menciptakan bukti fisik baru. Jika pertanyaan menunjukkan bukti kuat, respons emosional sewajarnya.`
          );
          room.messages.push({ name: suspect.name, kind: "ai", text: answer });
          const extracted = await extractEvidence(
            env,
            room.case,
            message,
            answer,
            suspect.name,
            room.evidence
          );
          if (extracted && !room.evidence.some((e) => e.id === extracted.id)) {
            room.evidence.push({ ...extracted, by: name });
            room.messages.push({
              name: "ARSIP KASUS",
              kind: "system",
              text: `Catatan baru ditambahkan: ${extracted.title}`,
            });
          }
        }
        await saveRoom(env, room);
        return json({ ok: true });
      }

      if (url.pathname === "/api/accuse" && request.method === "POST") {
        const b = await request.json(),
          room = await getRoom(env, String(b.code || "").toUpperCase());
        if (!room) return json({ error: "Ruang tidak ditemukan." }, 404);
        const playerId = String(b.playerId || ""),
          player = room.players.find((p) => p.id === playerId);
        if (!player) return json({ error: "Kamu belum bergabung." }, 403);
        if (room.verdict)
          return json({ error: "Kasus ini sudah selesai." }, 409);
        if (room.players.length < 2)
          return json(
            {
              error:
                "Tunggu sampai partner bergabung sebelum mengunci pilihan.",
            },
            409
          );
        const suspect = room.case.suspects.find(
          (s) => s.id === String(b.accused || "")
        );
        if (!suspect) return json({ error: "Pilih tersangka." }, 400);

        room.accusations ||= {};
        room.accusations[playerId] = {
          playerId,
          playerName: player.name,
          accused: suspect.id,
          updatedAt: Date.now(),
        };
        const p1 = room.accusations[room.players[0].id];
        const p2 = room.accusations[room.players[1].id];

        if (!p1 || !p2 || p1.accused !== p2.accused) {
          await saveRoom(env, room);
          return json({
            ok: true,
            waiting: true,
            disagreement: !!(p1 && p2 && p1.accused !== p2.accused),
            message:
              p1 && p2 && p1.accused !== p2.accused
                ? "Pilihan kalian berbeda. Diskusikan bukti dan ubah pilihan sampai sama."
                : "Pilihan tersimpan. Menunggu partner memilih tersangka.",
          });
        }

        // Only evaluate once, when both players' current choices match.
        const culpritId = room.case.secret.culprit_id;
        const correct = p1.accused === culpritId;
        const culpritName =
          room.case.secret.culprit_name ||
          room.case.suspects.find((s) => s.id === culpritId)?.name ||
          "Pelaku";
        room.verdict = correct
          ? `BENAR! Kalian tepat menangkap ${culpritName}. ${String(
              room.case.secret.motive ||
                room.case.secret.truth ||
                "Kasus berhasil dipecahkan."
            ).slice(0, 220)}`
          : `SALAH! ${
              suspect.name
            } bukan pelakunya. Pelaku sebenarnya adalah ${culpritName}. ${String(
              room.case.secret.motive ||
                "Terus periksa bukti pada kasus berikutnya."
            ).slice(0, 180)}`;
        room.messages.push({
          name: "ARSIP KASUS",
          kind: "system",
          text: "Kedua detektif sepakat pada tersangka. Kasus telah dievaluasi.",
        });
        await saveRoom(env, room);
        return json({ ok: true, waiting: false, verdict: room.verdict });
      }

      return json({ error: "Endpoint tidak ditemukan" }, 404);
    } catch (e) {
      return json({ error: e?.message || "Kesalahan server" }, 500);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...cors,
      "Cache-Control": "no-store",
    },
  });
}
function validName(s) {
  return (
    String(s || "Detektif")
      .replace(/[<>\n\r]/g, "")
      .trim()
      .slice(0, 24) || "Detektif"
  );
}
function makeCode() {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]
  ).join("");
}
function suspectName(c, id) {
  return c.suspects.find((s) => s.id === id)?.name || "karakter";
}
async function getRoom(env, code) {
  if (!/^[A-Z0-9]{6}$/.test(code)) return null;
  const raw = await env.ROOMS.get("room:" + code);
  if (!raw) return null;
  const room = JSON.parse(raw);
  if (Date.now() - room.createdAt > 86400000) {
    await env.ROOMS.delete("room:" + code);
    return null;
  }
  return room;
}
async function saveRoom(env, room) {
  await env.ROOMS.put("room:" + room.code, JSON.stringify(room), {
    expirationTtl: 86400,
  });
}
function publicRoom(r) {
  return {
    code: r.code,
    createdAt: r.createdAt,
    players: r.players,
    case: {
      title: r.case.title,
      introduction: r.case.introduction,
      public_summary: r.case.public_summary,
      suspects: r.case.suspects.map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        public_info: s.public_info,
      })),
    },
    messages: r.messages.slice(-120),
    evidence: r.evidence,
    verdict: r.verdict,
    turns: r.turns,
    accusations: Object.fromEntries(
      (r.players || []).map((p) => {
        const a = r.accusations?.[p.id];
        return [
          p.id,
          a
            ? {
                playerId: a.playerId,
                playerName: a.playerName,
                accused: a.accused,
              }
            : null,
        ];
      })
    ),
  };
}
async function askAI(env, prompt) {
  if (!env.AI)
    throw new Error(
      "Binding AI belum diatur. Ikuti README untuk konfigurasi Cloudflare Workers AI."
    );
  const out = await env.AI.run(MODEL, {
    messages: [
      {
        role: "system",
        content:
          "Kamu adalah mesin narasi game misteri yang konsisten. Tulis hanya teks yang diminta, tanpa markdown berlebihan.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 450,
    temperature: 0.65,
  });
  return String(
    out?.response ||
      out?.result?.response ||
      "Karakter itu terdiam sejenak. Coba tanyakan dengan cara lain."
  ).trim();
}

async function generateCase(env, type) {
  const prompt = `Buat kasus misteri orisinal untuk permainan detektif kooperatif, bahasa Indonesia. Jenis yang diminta: ${type}. Jika random, pilih satu: pembunuhan, pencurian, orang hilang, konspirasi, pemerasan. Buat tepat 4 tersangka. Tetapkan tepat satu pelaku dari empat tersangka dan satu solusi rahasia konsisten: motif, kronologi, apa yang benar-benar terjadi, alibi palsu, serta 3-5 fakta/bukti yang bisa ditemukan. Hindari detail grafis. Kembalikan JSON VALID saja dengan skema: {"title":"judul singkat","introduction":"pengantar 2-3 kalimat tanpa membocorkan solusi","public_summary":"ringkasan tanpa solusi","suspects":[{"id":"s1","name":"nama","role":"peran","public_info":"info publik singkat","personality":"kepribadian","knowledge":"apa yang karakter ketahui","secret":"rahasia pribadi","is_guilty":false}],"secret":{"culprit_id":"s1","culprit_name":"nama","motive":"motif","timeline":"kronologi","truth":"solusi lengkap","facts":["fakta 1","fakta 2","fakta 3"],"evidence_ideas":[{"title":"bukti","detail":"arti bukti"}]}}. Pastikan tepat satu suspect is_guilty true. Jangan memasukkan secret ke introduction/public_summary.`;
  const raw = await askAI(env, prompt);
  let parsed = parseJSON(raw);
  if (
    !parsed ||
    !Array.isArray(parsed.suspects) ||
    parsed.suspects.length !== 4 ||
    !parsed.secret
  )
    return fallbackCase(type);
  parsed.suspects = parsed.suspects.map((s, i) => ({
    ...s,
    id: "s" + (i + 1),
    name: String(s.name || "Tersangka " + (i + 1)),
    role: String(s.role || "Saksi"),
    public_info: String(s.public_info || "Memiliki hubungan dengan kasus."),
    personality: String(s.personality || "Waspada"),
    knowledge: String(s.knowledge || ""),
    secret: String(s.secret || ""),
    is_guilty: !!s.is_guilty,
  }));
  let culprit =
    parsed.suspects.find((s) => s.id === parsed.secret.culprit_id) ||
    parsed.suspects.find((s) => s.is_guilty);
  if (!culprit) culprit = parsed.suspects[0];
  parsed.suspects = parsed.suspects.map((s) => ({
    ...s,
    is_guilty: s.id === culprit.id,
  }));
  parsed.secret.culprit_id = culprit.id;
  parsed.secret.culprit_name = culprit.name;
  parsed.secret.motive = String(
    parsed.secret.motive || "Motif akan terungkap dari bukti kasus."
  );
  parsed.secret.truth = String(
    parsed.secret.truth || "Kasus dipecahkan berdasarkan bukti yang ditemukan."
  );
  return parsed;
}
function parseJSON(s) {
  try {
    return JSON.parse(
      s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    );
  } catch {
    const a = s.indexOf("{"),
      b = s.lastIndexOf("}");
    if (a >= 0 && b > a)
      try {
        return JSON.parse(s.slice(a, b + 1));
      } catch {}
    return null;
  }
}
function fallbackCase(type) {
  return {
    title: "Misteri Jam yang Terhenti",
    introduction:
      "Saat badai memutus listrik di penginapan tua, sebuah jam antik dan surat penting menghilang. Empat orang memberi kesaksian yang tidak sepenuhnya cocok.",
    public_summary:
      "Jam antik terakhir terlihat pukul 21.00. Surat yang hilang berisi informasi yang dapat mengubah kepemilikan penginapan.",
    suspects: [
      {
        id: "s1",
        name: "Mira",
        role: "Pengelola penginapan",
        public_info: "Menguasai kunci ruang utama.",
        personality: "Tegas",
        knowledge: "Melihat lampu lorong berkedip.",
        secret: "Mengubah catatan inventaris.",
        is_guilty: false,
      },
      {
        id: "s2",
        name: "Raka",
        role: "Tamu lama",
        public_info: "Punya perselisihan dengan pemilik.",
        personality: "Defensif",
        knowledge: "Mendengar langkah di tangga.",
        secret: "Berutang kepada pemilik.",
        is_guilty: true,
      },
      {
        id: "s3",
        name: "Seno",
        role: "Teknisi",
        public_info: "Memeriksa panel listrik malam itu.",
        personality: "Tenang",
        knowledge: "Listrik padam dari panel belakang.",
        secret: "Menyembunyikan kerusakan kecil.",
        is_guilty: false,
      },
      {
        id: "s4",
        name: "Lila",
        role: "Penulis surat",
        public_info: "Menulis dokumen yang hilang.",
        personality: "Cermat",
        knowledge: "Surat itu memiliki segel khusus.",
        secret: "Menulis salinan surat.",
        is_guilty: false,
      },
    ],
    secret: {
      culprit_id: "s2",
      culprit_name: "Raka",
      motive: "Raka ingin menghilangkan surat yang membuktikan utangnya.",
      timeline:
        "Raka mengambil jam untuk mengalihkan perhatian dan menyembunyikan surat sebelum listrik padam.",
      truth:
        "Raka mencuri surat karena isinya membuktikan utangnya. Jam antik dipindahkan sebagai pengalih perhatian.",
      facts: [
        "Jam berhenti karena baterainya dicabut, bukan karena listrik padam.",
        "Ada serat kain biru di dekat lemari surat.",
        "Raka mengenakan mantel biru dan mengaku tidak mendekati lemari.",
      ],
      evidence_ideas: [
        { title: "Baterai jam", detail: "Jam dihentikan secara sengaja." },
        {
          title: "Serat kain biru",
          detail: "Menghubungkan seseorang dengan lemari surat.",
        },
      ],
    },
  };
}
async function extractEvidence( env, c, question, answer, suspectName, evidence ) {
  const raw = await askAI(
    env,
    `Tentukan apakah interogasi ini mengungkap bukti atau petunjuk konkret yang layak dicatat. Fakta rahasia kasus: ${JSON.stringify(
      c.secret
    )}. Pertanyaan: ${question}. Jawaban ${suspectName}: ${answer}. Bukti yang sudah ada: ${JSON.stringify(
      evidence
    )}. Jika ada petunjuk konkret yang sesuai fakta inti dan belum tercatat, keluarkan JSON {"id":"evidence-key-singkat","title":"judul","detail":"penjelasan singkat yang benar-benar didukung dialog"}. Jika tidak ada, keluarkan {}. Jangan mengarang bukti fisik baru. JSON saja.`
  );
  const p = parseJSON(raw);
  if (!p?.title || !p?.detail) return null;
  p.id = String(
    p.id || p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  ).slice(0, 50);
  return {
    id: p.id,
    title: String(p.title).slice(0, 100),
    detail: String(p.detail).slice(0, 300),
  };
       }
