/**
 * The driving-safe boundary, stated in the UI rather than only in the docs.
 * Shown before a session starts — never during one.
 */
export function SafetyNotice() {
  return (
    <div className="rounded-2xl border border-state-paused/30 bg-state-paused/5 p-4">
      <p className="text-sm font-medium text-state-paused">行車安全提醒</p>
      <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted">
        <li>· 請在起步前完成設定並開始練習。</li>
        <li>· 行進間只需要說話，不需要看螢幕。</li>
        <li>· 需要操作手機時，請先安全停車。</li>
        <li>· 完整回顧會在結束後才顯示。</li>
      </ul>
    </div>
  );
}
