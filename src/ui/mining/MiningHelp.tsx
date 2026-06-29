/** 遊び方ヘルプ（常設・ホバー不要）。操作・三択・★・鉱石・ツリー・熟練度・転生をまとめて説明。 */
export function MiningHelp({ onClose }: { onClose: () => void }) {
  const sections: { icon: string; title: string; body: string }[] = [
    { icon: '✋', title: '手動 / ⚙️ 自動', body: '手動はクリックで猫を誘導し、3択も自分で選ぶ＝火力100%。自動はおまかせで進むが火力が下がる（放置ツリーで100%まで回復）。右上のボタンで切替。' },
    { icon: '🎲', title: '3択（レベルアップ）', body: '武器や強化を選んで取得。レア=効果2倍、エピック=おまけ強化つき（目利き🔎で出やすくなる）。自動モードや放置時の3択は完全ランダム＝持ち込みは運。特殊効果(貫通/範囲)は3択には付かず、すべて転生ツリーで取る。' },
    { icon: '⛏️', title: '採掘と硬さ', body: 'ブロックは深い階・拠点から遠いほど・上位の素材ほど固い（暗いほど固い）。硬さは幾何級数で増えるので、火力を伸ばし続けないと先へ進めない。' },
    { icon: '🪙', title: 'コイン（走行限定）', body: '採掘で貯まるコインで、目利き🔎・採掘ブースト🔥・全体強化(俊足/強欲/幸運)を購入。転生でリセットされる、その走行だけの強化。' },
    { icon: '💎', title: '鉱石8段階（永続）', body: '土→石→石炭→銅→鉄→銀→金→宝石の8段階。深い階ほど上位が出る。転生しても消えず、転生ツリーの素材になる。精錬で下位8個→上位1個。' },
    { icon: '🌳', title: '転生ツリー（素材・階層制）', body: '武器ごとのスキルツリーを素材で解放。階層を一定数買うと次の階層が解禁され、要求される素材の質と量が上がる。特殊系(範囲💠/射程📏/貫通➡️/固有✨)は上位素材＆割増。武器の解放=鉄、放置ツリー=銀。' },
    { icon: '⭐', title: '★＝全体ダメージ強化', body: '★は転生でまとめてもらえる（レベルアップ・階降りで貯まる）。用途は全体ダメージ強化ひとつ＝全武器の威力が上がる。コストは段々上がるので、深く潜って★を稼ぐほど伸びる。' },
    { icon: '🗡️', title: '熟練度（武器ごと・永続）', body: 'その走行で一定以上のダメージを出した武器は、転生で熟練度+1（少しダメージUP）。必要ダメージは熟練が上がるほど高くなる＝浅い周回連打では伸びず、深く潜るほど伸びる。' },
    { icon: '🔄', title: '転生', body: '階・レベル・コインはリセット。鉱石・★・恒久強化・熟練度は保持。1階深くまで潜れるようになるたび、転生して恒久強化を進める“周回”が基本のループ。' },
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
