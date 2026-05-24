// 外部の監視サービス（UptimeRobot等）から定期pingを受けて
// Vercel Function を温め続けるためのエンドポイント。
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, ts: Date.now() });
}
