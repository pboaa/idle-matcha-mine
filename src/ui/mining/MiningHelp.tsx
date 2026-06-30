/** 遊び方ヘルプ（常設・ホバー不要）。操作・走行グリッド・★・恒久グリッド・転生をまとめて説明。 */
export function MiningHelp({ onClose }: { onClose: () => void }) {
  const sections: { icon: string; title: string; body: string }[] = [
    { icon: '🗡️', title: '開始武器を選ぶ', body: 'つるはし⛏️は常時装備。それに加えて1種類の武器を選んで潜る。選べる武器は転生で★を使って増やす（🔄転生パネル）。' },
    { icon: '✋', title: '手動 / ⚙️ 自動', body: '手動はクリックで猫を誘導し、走行グリッドも自分で選ぶ＝火力100%。自動はおまかせで進むが火力が下がる（放置ツリーで100%まで回復）。右上のボタンで切替。' },
    { icon: '🎁', title: '走行グリッド（その周だけ）', body: 'レベルアップごとに「解放権」が1つ増え、脇の走行グリッドのマスを1つ解放できる＝一時強化。中身は毎走ランダム、未到達は隠れていて、隣を取ると現れる。コイン🪙でマス即時解放やリロールも可能。転生でリセット。' },
    { icon: '⛏️', title: '採掘と硬さ', body: 'ブロックは深い階・拠点から遠いほど・上位の鉱石ほど固い（暗いほど固い）。硬さは幾何級数で増えるので、火力を伸ばし続けないと先へ進めない。' },
    { icon: '⭐', title: '★ポイント（転生で貯まる）', body: 'レベルアップ・階降りで貯まり、転生でまとめて★残高に。★は恒久グリッドのマス解放と、武器の解放に使う消費ポイント。深く潜るほど多く貯まる。' },
    { icon: '🌳', title: '恒久グリッド（★・階層制）', body: '武器ごと＆全体(🌐)のスキルグリッドを★で解放。階層を一定数買うと次の階層が解禁され、★コストは段々上がる（深い/外周/特殊ほど高い）＝全部は上げ切れないので選んで伸ばす。取った後も薄く残って見える。' },
    { icon: '🔄', title: '転生', body: '階・レベル・コイン・走行グリッドはリセット。★残高・恒久グリッド・解放済み武器は保持。深く潜れるようになるたび転生して恒久強化を進める“周回”が基本のループ。' },
  ];
  return (
    <div className="flex max-h-[88vh] w-[32rem] flex-col gap-2 overflow-y-auto rounded-2xl bg-stone-900 p-4 shadow-2xl ring-1 ring-stone-700">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-100">❓ 遊び方</h2>
        <button onClick={onClose} className="rounded-md bg-stone-700 px-2 py-0.5 text-xs text-stone-200 hover:bg-stone-600">✕ 閉じる</button>
      </div>
      <div className="flex flex-col gap-1.5">
        {sections.map((s) => (
          <div key={s.title} className="rounded-lg bg-stone-800/60 p-2 ring-1 ring-stone-700/60">
            <div className="text-[12px] font-bold text-amber-200">{s.icon} {s.title}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-stone-300">{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
