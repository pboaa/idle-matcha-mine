/** 遊び方ヘルプ（常設・ホバー不要）。操作・走行グリッド・お宝図鑑・★・転生をまとめて説明。 */
export function MiningHelp({ onClose }: { onClose: () => void }) {
  const sections: { icon: string; title: string; body: string }[] = [
    { icon: '🗡️', title: '開始武器を選ぶ', body: 'つるはし⛏️は常時装備。それに加えて1種類の武器を選んで潜る。選べる武器は転生で★を使って増やす（🔄転生パネル）。' },
    { icon: '✋', title: '手動 / ⚙️ 自動', body: '手動はクリックで猫を誘導、自動はおまかせ移動。どちらも火力は同じ（自動でもペナルティなし）。右上のボタンで切替。' },
    { icon: '🎁', title: '走行グリッド（その周だけ・手動）', body: '脇の走行グリッドのマスをコイン🪙で手動解放＝一時強化。解放するほど少しずつ高くなる。中身は毎走ランダム、未到達は隠れていて隣を取ると現れる。コインが足りないと灰色で押せない。⏫一括で払えるだけまとめて、🔄でリロール。貫通・射程は出ない（武器の基本値）。上限まで埋めたら満タン（上限は図鑑が増えると伸びる）。転生でリセット。' },
    { icon: '📒', title: 'お宝図鑑（全100種・やり込み）', body: '採掘中にお宝が低確率でドロップ（同じお宝を何個でも集められる）。集めると永続ボーナス（火力/金運/採掘/会心/俊敏/学び/発掘）。重なるほど1個あたりの効果は弱まる（√）＝壊れない。転生しても消えない。最後のやり込み要素。' },
    { icon: '✦', title: 'レアは遠くに埋まってる', body: 'お宝のレア度は「遠さ・深さ」で決まる。拠点から遠いタイル・深い階ほどレアが出やすい。序盤は近くを掘ってノーマル中心、強くなって遠く/深くへ行けるとレアが集まる。掘る場所は毎周リセットされる。' },
    { icon: '⛏️', title: '採掘と硬さ', body: 'ブロックは深い階・拠点から遠いほど・上位の鉱石ほど固い（暗いほど固い）。硬さは幾何級数で増えるので、火力を伸ばし続けないと先へ進めない。' },
    { icon: '⭐', title: '★（転生で貯まる・2種の使い道）', body: 'レベルアップ・階降りで貯まり、転生で確定。①★残高＝武器の解放に使う消費ポイント。②累計★＝消費しても減らない総獲得★で、全体ダメージ倍率(×)が自動で上がる。' },
    { icon: '🔄', title: '転生', body: '階・レベル・コイン・走行グリッドはリセット。★残高・累計★・お宝図鑑・解放済み武器は保持。深く潜れるようになるたび転生して図鑑・武器を進める“周回”が基本のループ。' },
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
