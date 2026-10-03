import { neon } from "@neondatabase/serverless";

type Profile = { name: string; birthdate: string; email: string; phone: string; imageUrl: string };

const sql = neon(process.env.DATABASE_URL!);
let initialized = false;

async function ensureSchema() {
  if (initialized) return;
  await sql`CREATE TABLE IF NOT EXISTS roundtable_profiles (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Maya Chen',
    birthdate DATE,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS roundtable_rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    participant_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'waiting'
  )`;
  await sql`CREATE TABLE IF NOT EXISTS roundtable_room_participants (
    room_id TEXT NOT NULL REFERENCES roundtable_rooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'purple',
    role TEXT NOT NULL DEFAULT 'Participant',
    status TEXT NOT NULL DEFAULT 'Listening',
    PRIMARY KEY (room_id, name)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS roundtable_transcript_entries (
    room_id TEXT NOT NULL REFERENCES roundtable_rooms(id) ON DELETE CASCADE,
    entry_order INTEGER NOT NULL,
    time TEXT NOT NULL,
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    color TEXT NOT NULL,
    text TEXT NOT NULL,
    confidence TEXT NOT NULL,
    current_entry BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (room_id, entry_order)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS roundtable_feedback (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`INSERT INTO roundtable_rooms (id, name, type, description, participant_count, status)
    VALUES
      ('room-product-sync', 'Product sync · Q3', 'Meeting', 'A focused conversation about the next quarter.', 4, 'active'),
      ('room-classroom-demo', 'Classroom demo', 'Classroom', '', 0, 'waiting')
    ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO roundtable_room_participants (room_id, name, initials, color, role, status)
    VALUES
      ('room-product-sync', 'Maya Chen', 'MC', 'purple', 'Host', 'Speaking'),
      ('room-product-sync', 'Jordan Lee', 'JL', 'blue', 'Participant', 'Listening'),
      ('room-product-sync', 'Ravi Patel', 'RP', 'orange', 'Participant', 'Listening'),
      ('room-product-sync', 'Sofia Kim', 'SK', 'green', 'Participant', 'Listening')
    ON CONFLICT (room_id, name) DO NOTHING`;
  await sql`INSERT INTO roundtable_transcript_entries (room_id, entry_order, time, name, initials, color, text, confidence, current_entry)
    VALUES
      ('room-product-sync', 1, '10:31:04', 'Maya Chen', 'MC', 'purple', 'I think we have a clear opportunity to simplify the onboarding flow.', '98%', TRUE),
      ('room-product-sync', 2, '10:31:18', 'Jordan Lee', 'JL', 'blue', 'Agreed. The first experience should make the value obvious within a few seconds.', '96%', FALSE),
      ('room-product-sync', 3, '10:31:32', 'Ravi Patel', 'RP', 'orange', 'What if we bring the live room preview into that first step?', '93%', FALSE),
      ('room-product-sync', 4, '10:31:49', 'Sofia Kim', 'SK', 'green', 'That could work well, especially for teams joining from multiple devices.', '97%', FALSE)
    ON CONFLICT (room_id, entry_order) DO NOTHING`;
  await sql`UPDATE roundtable_rooms SET participant_count = (
    SELECT COUNT(*) FROM roundtable_room_participants WHERE room_id = roundtable_rooms.id
  )`;
  initialized = true;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}

export default async function hello(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    if (path === "/profile" && request.method === "GET") {
      const rows = await sql`SELECT name, birthdate, email, phone, image_url AS "imageUrl" FROM roundtable_profiles WHERE user_id = 'demo-user'`;
      return json(rows[0] ?? { name: "Maya Chen", birthdate: "", email: "", phone: "", imageUrl: "" });
    }
    if (path === "/profile" && request.method === "POST") {
      const profile = await request.json() as Profile;
      const rows = await sql`INSERT INTO roundtable_profiles (user_id, name, birthdate, email, phone, image_url)
        VALUES ('demo-user', ${profile.name.trim()}, ${profile.birthdate || null}, ${profile.email.trim()}, ${profile.phone.trim()}, ${profile.imageUrl || ""})
        ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, birthdate = EXCLUDED.birthdate, email = EXCLUDED.email, phone = EXCLUDED.phone, image_url = EXCLUDED.image_url, updated_at = NOW()
        RETURNING name, birthdate, email, phone, image_url AS "imageUrl"`;
      return json(rows[0]);
    }
    if (path === "/rooms/delete" && request.method === "POST") {
      const { roomId } = await request.json() as { roomId?: string };
      if (!roomId) return json({ error: "Room ID is required." }, 400);
      await sql`DELETE FROM roundtable_rooms WHERE id = ${roomId}`;
      return json({ ok: true });
    }
    if (path === "/feedback" && request.method === "POST") {
      const feedback = await request.json() as { name?: string; email?: string; message?: string };
      if (!feedback.message?.trim()) return json({ error: "Feedback message is required." }, 400);
      if (!feedback.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(feedback.email.trim())) return json({ error: "A valid email address is required." }, 400);
      const name = feedback.name?.trim() || "Anonymous";
      const email = feedback.email.trim();
      const message = feedback.message.trim();
      await sql`INSERT INTO roundtable_feedback (name, email, message)
        VALUES (${name}, ${email}, ${message})`;
      return json({ ok: true });
    }
    if (path === "/rooms" && request.method === "GET") {
      const rows = await sql`SELECT id, name, type, description, created_at AS "createdAt", participant_count AS "participantCount", status
        FROM roundtable_rooms ORDER BY created_at DESC`;
      const participantRows = await sql`SELECT room_id AS "roomId", name, initials, color, role, status
        FROM roundtable_room_participants ORDER BY name`;
      const transcriptRows = await sql`SELECT room_id AS "roomId", time, name, initials, color, text, confidence, current_entry AS "current"
        FROM roundtable_transcript_entries ORDER BY room_id, entry_order`;
      return json(rows.map(room => ({ ...room, createdAt: new Date(room.createdAt).toLocaleDateString(), participants: participantRows.filter(participant => participant.roomId === room.id), transcript: transcriptRows.filter(entry => entry.roomId === room.id) })));
    }
    if (path === "/rooms" && request.method === "POST") {
      const room = await request.json() as { id?: string; name?: string; type?: string; description?: string };
      if (!room.id?.trim() || !room.name?.trim() || !room.type?.trim()) return json({ error: "Room name and type are required." }, 400);
      const rows = await sql`INSERT INTO roundtable_rooms (id, name, type, description)
        VALUES (${room.id.trim()}, ${room.name.trim()}, ${room.type.trim()}, ${room.description?.trim() || ""})
        RETURNING id, name, type, description, created_at AS "createdAt", participant_count AS "participantCount", status`;
      return json({ ...rows[0], createdAt: "Just now", participants: [], transcript: [] });
    }
    if (path === "/rooms/status" && request.method === "POST") {
      const { roomId, status } = await request.json() as { roomId?: string; status?: string };
      if (!roomId || !["waiting", "active", "ended"].includes(status || "")) return json({ error: "Room ID and valid status are required." }, 400);
      await sql`UPDATE roundtable_rooms SET status = ${status} WHERE id = ${roomId}`;
      return json({ ok: true });
    }
    if (path === "/rooms/participants" && request.method === "POST") {
      const participant = await request.json() as { roomId?: string; name?: string; initials?: string; color?: string };
      if (!participant.roomId?.trim() || !participant.name?.trim()) return json({ error: "Room and participant are required." }, 400);
      await sql`INSERT INTO roundtable_room_participants (room_id, name, initials, color)
        VALUES (${participant.roomId.trim()}, ${participant.name.trim()}, ${participant.initials?.trim() || participant.name.trim().split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase()}, ${participant.color || "purple"})
        ON CONFLICT (room_id, name) DO NOTHING`;
      await sql`UPDATE roundtable_rooms SET participant_count = (SELECT COUNT(*) FROM roundtable_room_participants WHERE room_id = ${participant.roomId.trim()}) WHERE id = ${participant.roomId.trim()}`;
      return json({ ok: true });
    }
    if (path === "/rooms/transcript" && request.method === "POST") {
      const entry = await request.json() as { roomId?: string; time?: string; name?: string; initials?: string; color?: string; text?: string; confidence?: string; current?: boolean };
      if (!entry.roomId?.trim() || !entry.time?.trim() || !entry.name?.trim() || !entry.text?.trim()) return json({ error: "Room, speaker, time, and transcript text are required." }, 400);
      const nextOrder = await sql`SELECT COALESCE(MAX(entry_order), 0) + 1 AS "entryOrder" FROM roundtable_transcript_entries WHERE room_id = ${entry.roomId.trim()}`;
      await sql`INSERT INTO roundtable_transcript_entries (room_id, entry_order, time, name, initials, color, text, confidence, current_entry)
        VALUES (${entry.roomId.trim()}, ${nextOrder[0].entryOrder}, ${entry.time.trim()}, ${entry.name.trim()}, ${entry.initials?.trim() || entry.name.trim().split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase()}, ${entry.color || "purple"}, ${entry.text.trim()}, ${entry.confidence?.trim() || ""}, ${entry.current === true})`;
      return json({ ok: true });
    }
    if (path === "/chat" && request.method === "POST") {
      const { question, roomId, roomName, roomType, participantCount } = await request.json() as { question?: string; roomId?: string; roomName?: string; roomType?: string; participantCount?: number };
      if (!question?.trim()) return json({ error: "Question is required." }, 400);
      if (!roomId?.trim()) return json({ error: "Meeting context is required." }, 400);
      return json({ answer: `I’m answering in the context of “${roomName || roomId}” (${roomType || "meeting"}, ${participantCount ?? 0} participants). Once the transcript service is connected, I’ll use this meeting’s transcript and decisions to answer: “${question.trim()}”` });
    }
    return json({ error: "Not found." }, 404);
  } catch (error) {
    console.error("Roundtable API error", error);
    return json({ error: "The Roundtable service is temporarily unavailable." }, 500);
  }
}
