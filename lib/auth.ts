// Username + password の組み合わせを Supabase Auth (email+password) にマッピングする。
// Supabase Authはメール必須なので、内部的に username@AUTH_DOMAIN を生成して使う。
const DOMAIN = process.env.NEXT_PUBLIC_AUTH_DOMAIN || "muscleyamato.local";

export function usernameToEmail(username: string) {
  const u = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!u) throw new Error("ユーザー名は半角英数字で入力してください");
  return `${u}@${DOMAIN}`;
}
