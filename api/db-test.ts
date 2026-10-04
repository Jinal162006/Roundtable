import { neon } from "@neondatabase/serverless";

export default async function handler(req: any, res: any) {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    const result = await sql`
      SELECT NOW() AS current_time
    `;

    return res.status(200).json({
      success: true,
      message: "Neon connection working",
      databaseTime: result[0].current_time,
    });
  } catch (error) {
    console.error("Database connection error:", error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Database error",
    });
  }
}