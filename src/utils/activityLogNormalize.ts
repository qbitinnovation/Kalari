/** Client-safe activity log helpers (no Node fs / localStore). */

export const normalizeActivityLog = (log: any) => ({
  ...log,
  id: log?.id || log?._id,
  performed_at: log?.performed_at || log?.created_at || log?.updated_at || null,
});
