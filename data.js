/* 資料檔：人工水晶體、術後用藥、衛教、常見問題。
   醫師可直接修改這個檔案，或在 App 的「醫師設定」裡調整。
   水晶體價格來源：新光醫院官網「健保自付差額品項－特殊功能人工水晶體」113 年 9 月版。 */
window.APP_DATA = {
  appName: '新眼光',
  tagline: '白內障手術，重見新光',
  hospital: {
    name: '新光醫院 眼科',
    logo: 'img/skh-logo.svg',
    phone: '02-2833-2211',
    eyeExt: '2568'
  },
  priceSource: '新光醫院官網公告（113 年 9 月版）',
  nhiPay: 2744,
  femtoPrice: 68000,   /* 飛秒雷射每眼自費金額（新台幣） */

  /* far / inter / near：0–3，不戴眼鏡時該距離的清晰程度
     halo：0–3，夜間光暈眩光的機會
     diff：每眼自付差額（新台幣） */
  iols: [
    {
      id: 'rao100c', name: 'RayOne RAO100C', zh: '健保單焦點人工水晶體', maker: 'Rayner（英國）',
      type: '單焦點（健保）', typeKey: 'mono', toric: false, diffractive: false, aspheric: false,
      far: 3, inter: 1, near: 0, halo: 0, diff: 0,
      oneLine: '健保全額給付，看遠清楚，看近、用電腦要戴眼鏡。',
      pros: ['健保全額給付，不需自付差額', '光暈眩光少', '眼睛有其他疾病時也能使用'],
      cons: ['只有一個焦距，看近或看遠其中一種需要戴眼鏡', '球面設計，夜間對比略遜於非球面水晶體', '沒有散光矯正']
    },
    {
      id: 'icb00', name: 'TECNIS Eyhance ICB00', zh: '添視明增視型人工水晶體', maker: 'AMO／嬌生（美國）',
      type: '增視型單焦點', typeKey: 'monoplus', toric: false, diffractive: false, aspheric: true,
      far: 3, inter: 2, near: 1, halo: 0, diff: 40000,
      oneLine: '看遠清楚，中距離（電腦、儀表板）比一般單焦點好，夜間品質接近單焦點。',
      pros: ['中距離視力比一般單焦點好', '光暈眩光少，適合常夜間開車的人', '非球面設計，對比敏感度佳'],
      cons: ['看手機、看書多半仍需老花眼鏡', '沒有散光矯正（有散光請選 DIU）']
    },
    {
      id: 'diu', name: 'TECNIS Eyhance Toric II DIU', zh: '添視明增視型第二代散光矯正人工水晶體', maker: 'AMO／嬌生（美國）',
      type: '增視型單焦點＋散光矯正', typeKey: 'monoplus', toric: true, diffractive: false, aspheric: true,
      far: 3, inter: 2, near: 1, halo: 0, diff: 55000,
      oneLine: '增視型加上散光矯正：看遠、中距離好，同時處理散光。',
      pros: ['同時矯正角膜散光', '中距離視力比一般單焦點好', '光暈眩光少，適合常夜間開車的人'],
      cons: ['看手機、看書多半仍需老花眼鏡', '散光軸度若術後轉位，可能需要調整']
    },
    {
      id: 'lucidis', name: 'Lucidis', zh: '路西斯人工水晶體（非球面＋焦距延伸）', maker: 'SAV-IOL（瑞士）',
      type: '延伸焦段 EDOF', typeKey: 'edof', toric: false, diffractive: false, aspheric: true,
      far: 3, inter: 3, near: 2, halo: 1, diff: 60000,
      oneLine: '遠到中距離連續清楚，近距離堪用，光暈比繞射式多焦點少。',
      pros: ['遠、中距離連續清楚，近距離有一定功能', '折射式設計，光暈眩光比繞射式多焦點少', '腦部適應較快'],
      cons: ['看很小的字或長時間閱讀可能仍需輕度老花眼鏡', '沒有散光矯正（有散光請選散光款）', '效果受瞳孔大小影響']
    },
    {
      id: 'lucidis_t', name: 'Lucidis Toric', zh: '路西斯散光人工水晶體', maker: 'SAV-IOL（瑞士）',
      type: '延伸焦段 EDOF＋散光矯正', typeKey: 'edof', toric: true, diffractive: false, aspheric: true,
      far: 3, inter: 3, near: 2, halo: 1, diff: 90000,
      oneLine: '延伸焦段加上散光矯正：遠到中距離連續清楚，同時處理散光。',
      pros: ['同時矯正角膜散光', '遠、中距離連續清楚，近距離有一定功能', '光暈眩光比繞射式多焦點少'],
      cons: ['看很小的字可能仍需輕度老花眼鏡', '價格較高']
    },
    {
      id: 'lentis', name: 'Oculentis LENTIS Toric', zh: '藍提視多焦點散光人工水晶體', maker: 'Oculentis／Teleon（德國）',
      type: '區域折射多焦點＋散光矯正', typeKey: 'edof', toric: true, diffractive: false, aspheric: true,
      far: 3, inter: 2, near: 2, halo: 1, diff: 60000,
      oneLine: '上區看遠、下區看近的折射式設計，光損失少，同時矯正散光。',
      pros: ['同時矯正角膜散光', '折射式雙區域設計，光損失少，光暈眩光較少', '遠、近距離兼顧'],
      cons: ['近距離清晰度依型號加入度而定', '水晶體需位置居中，偏位會影響效果']
    },
    {
      id: 'liberty', name: 'Liberty', zh: '利伯特三焦點老花矯正人工水晶體', maker: 'Medicontur（匈牙利）',
      type: '三焦點', typeKey: 'multi', toric: false, diffractive: true, aspheric: true,
      far: 3, inter: 2, near: 3, halo: 2, diff: 85000,
      oneLine: '遠、中、近三個焦點，看手機看書多半不用眼鏡；夜間可能有光暈。',
      pros: ['遠、中、近都能看，擺脫眼鏡機會高', '只有 7 圈繞射環，光暈比一般三焦點少'],
      cons: ['夜間看燈光可能有光暈、眩光，需要時間適應', '對比敏感度略低於單焦點', '黃斑部、視神經有疾病時通常不建議', '沒有散光矯正']
    },
    {
      id: 'synergy', name: 'TECNIS Synergy', zh: '添視明視能及優視藍老花矯正人工水晶體', maker: 'AMO／嬌生（美國）',
      type: '全焦段（多焦點＋延伸焦段）', typeKey: 'multi', toric: false, diffractive: true, aspheric: true,
      far: 3, inter: 3, near: 3, halo: 3, diff: 85000,
      oneLine: '遠到近（約 33 公分）連續清楚，最有機會完全不戴眼鏡；夜間光暈較明顯。',
      pros: ['遠、中、近連續清楚，擺脫眼鏡機會最高', '可過濾紫光，暗處近距離表現佳'],
      cons: ['夜間光暈、眩光、星芒較常見，常夜間開車者要慎選', '對比敏感度略低於單焦點', '黃斑部、視神經有疾病時通常不建議', '沒有散光矯正']
    }
  ],

  /* 術後用藥預設值。freq 可用：Q1H、Q2H、Q3H、QID、TID、BID、QD、HS
     days：用到術後第幾天，0 表示依醫師指示 */
  meds: [
    {
      id: 'cravit', name: 'Cravit 可樂必妥', say: '可樂必妥，抗生素眼藥水', short: 'Cravit', generic: 'Levofloxacin 0.5% 眼藥水', kind: '抗生素', form: 'drop',
      freq: 'QID', days: 0, enabled: true, group: 'antibiotic', order: 1, color: '#2f6fb3',
      photo: 'drug-photos/cravit.jpg',
      look: '粉紅色瓶蓋，透明瓶身，標籤上有黃色和桃紅色色塊。',
      what: '抗生素眼藥水，預防手術後細菌感染。',
      tips: ['每次 1 滴', '和其他藥水間隔 5 分鐘', '就算眼睛不紅不痛，也要點到醫師說可以停為止']
    },
    {
      id: 'vigamox', name: 'Vigamox', say: 'Vigamox，抗生素眼藥水', short: 'Vigamox', generic: 'Moxifloxacin 0.5% 眼藥水', kind: '抗生素', form: 'drop',
      freq: 'QID', days: 0, enabled: false, group: 'antibiotic', order: 1, color: '#8a6d3b',
      photo: 'drug-photos/vigamox.jpg',
      what: '抗生素眼藥水，預防手術後細菌感染。和 Cravit 二選一，依醫師開立。',
      tips: ['每次 1 滴', '和其他藥水間隔 5 分鐘', '就算眼睛不紅不痛，也要點到醫師說可以停為止']
    },
    {
      id: 'predforte', name: 'Pred Forte 倍力特', say: '倍力特，消炎眼藥水', short: 'Pred Forte', generic: 'Prednisolone acetate 1% 眼用懸浮液', kind: '類固醇消炎', form: 'drop',
      freq: 'Q2H', days: 0, enabled: true, group: 'steroid', order: 2, shake: true, color: '#c62828',
      photo: 'drug-photos/predforte.jpg',
      look: '白色瓶身、白色瓶蓋，紙盒是紅白兩色。',
      what: '類固醇消炎眼藥水，減輕手術後的發炎、紅腫。',
      tips: ['使用前一定要先搖勻，因為藥水是懸浮液，會沉澱', '每次 1 滴，醒著的時候每 2 小時點一次', '不可自己突然停藥，醫師會視情況慢慢減少次數', '長期使用可能讓眼壓升高，請按時回診量眼壓', '存放在 25℃ 以下']
    },
    {
      id: 'winacort', name: 'Winacort 溫拿可通眼藥膏', say: '溫拿可通，眼藥膏', short: 'Winacort', generic: 'Neomycin＋Triamcinolone 眼用軟膏', kind: '消炎＋抗生素藥膏', form: 'ointment',
      freq: 'HS', days: 0, enabled: true, group: 'ointment', order: 3, color: '#6a4c93',
      photo: 'drug-photos/winacort.jpg',
      look: '白色軟管，有橘紅色線條，印著「溫拿可通 眼用軟膏」。',
      what: '含抗生素與類固醇的眼藥膏，睡前使用，夜間持續消炎、預防感染。',
      tips: ['睡前使用，擠約 1 公分到下眼瞼內側', '藥膏一定排在所有藥水之後，最後才用', '用完視線會暫時模糊，是正常的']
    }
  ],

  dropSteps: [
    '點藥前先用肥皂洗手。',
    '頭稍微後仰，用手指輕輕把下眼瞼往下拉，形成一個小口袋。',
    '眼睛往上看，把藥水滴進下眼瞼的口袋，1 滴就夠。瓶口不要碰到眼睛或睫毛。',
    '輕輕閉上眼睛 1 到 2 分鐘，不要用力擠眼或眨眼。',
    '兩種藥水之間間隔 5 分鐘；藥膏最後才用。'
  ],

  stages: [
    { key: 'pre', title: '手術前', when: '手術前', items: ['完成術前檢查與人工水晶體度數測量', '和醫師討論人工水晶體種類、是否使用飛秒雷射', '平常吃的藥（尤其抗凝血劑、攝護腺用藥）請主動告訴醫師', '手術當天請家屬陪同，不要自己開車或騎車'] },
    { key: 'd0', title: '手術當天', when: '第 0 天', items: ['手術後眼睛會蓋著紗布和眼罩，請不要自己拆開', '當天不用點藥，回家多休息', '可以正常吃飯，避免用力咳嗽、用力解便', '輕微異物感、流眼淚是常見的；劇烈疼痛、噁心嘔吐請立刻回急診'] },
    { key: 'd1', title: '術後第 1 天回診', when: '第 1 天', items: ['回診時由醫護人員拆開紗布，檢查傷口與眼壓', '拆紗布後開始點藥，照 App 的時間表', '睡覺時戴上硬式眼罩，避免無意間壓到或揉到眼睛'] },
    { key: 'w1', title: '術後第 1 週', when: '第 2–7 天', items: ['不要揉眼睛，睡覺戴眼罩', '洗臉用擰乾的毛巾擦，洗頭請仰躺由他人協助，水不要進眼睛', '盡量不要彎腰低頭、不要提重物、不要用力憋氣', '外出可戴太陽眼鏡，避免風沙和強光', '依約回診'] },
    { key: 'm1', title: '術後 1 個月內', when: '第 2–4 週', items: ['繼續按時點藥，醫師會逐步減少次數', '不游泳、不泡溫泉、不做劇烈運動', '暫時不化眼妝', '視力會慢慢穩定，約 1 個月後再評估是否需要配眼鏡'] }
  ],

  redflags: [
    '視力突然變差，或像有黑影、布簾遮住',
    '眼睛劇烈疼痛，或越來越痛',
    '眼睛越來越紅',
    '黃綠色分泌物明顯增加',
    '突然出現大量飛蚊、閃光',
    '頭痛合併噁心、嘔吐',
    '眼睛被撞到或用力揉到'
  ],

  faq: [
    { q: '手術後可以搭飛機嗎？', a: '一般白內障手術眼內沒有灌入氣體，搭飛機不會影響傷口。建議至少完成術後第 1 天回診再出發，旅途中要能按時點藥，並且趕得上後續回診。' },
    { q: '什麼時候可以洗臉、洗頭、洗澡？', a: '術後第 1 週不要讓水進到眼睛。洗臉用擰乾的毛巾擦拭；洗頭請用仰躺的方式由他人協助；洗澡脖子以下可以照常。' },
    { q: '為什麼不能彎腰低頭、提重物？', a: '彎腰低頭、提重物、用力憋氣都會讓眼壓暫時升高，可能影響傷口癒合。術後 1 到 2 週請盡量避免，撿東西時蹲下來拿。咳嗽、便秘也請先處理。' },
    { q: '紗布和眼罩什麼時候拆？', a: '手術後的紗布請不要自己拆，隔天回診時由醫護人員拆開。之後睡覺時戴硬式眼罩約 1 週，避免睡夢中壓到或揉到眼睛。' },
    { q: '什麼時候開始點藥？', a: '手術當天不用點。隔天回診拆紗布後開始，依照 App「點藥」頁面的時間表。' },
    { q: '兩三種藥要怎麼排順序？', a: '先點藥水，每種間隔 5 分鐘；藥膏最後才用。Pred Forte 是懸浮液，點之前要先搖勻。' },
    { q: '忘記點藥怎麼辦？', a: '想起來就補點。如果已經接近下一次點藥時間，就跳過這次，不要一次點兩倍的量。' },
    { q: '可以看電視、滑手機、看書嗎？', a: '可以，用眼不會傷害傷口。眼睛痠澀時休息一下即可。' },
    { q: '眼睛紅紅的、有異物感、會流眼淚，正常嗎？', a: '術後幾天有輕微的紅、異物感、流淚、畏光都很常見，會慢慢改善。如果越來越紅、越來越痛或視力變差，請立刻回診。' },
    { q: '什麼時候可以開車、騎車？', a: '等視力穩定、醫師回診確認後再開車。剛手術完兩眼度數可能不平衡，距離感會變差。' },
    { q: '什麼時候可以運動？', a: '散步隨時可以。慢跑、健身等較劇烈的運動建議 2 到 4 週後；游泳、泡溫泉至少等 1 個月。' },
    { q: '可以化妝、染髮、燙髮嗎？', a: '眼妝建議停 2 到 4 週。染髮、燙髮的藥劑可能流進眼睛，建議 1 個月後再做。' },
    { q: '什麼時候可以配新眼鏡？', a: '度數大約術後 1 個月穩定，屆時由醫師驗光後再配。' },
    { q: '手術後看東西偏藍、特別亮，正常嗎？', a: '正常。混濁的水晶體換成透明的人工水晶體後，進入眼睛的光線變多，顏色也比較鮮豔，通常幾週內會習慣。' },
    { q: '白內障會再長回來嗎？', a: '不會。但少數人術後數月到數年，放人工水晶體的囊袋會變混濁（後發性白內障），視力又變模糊，門診用雷射處理即可，不需再開刀。' },
    { q: '另一眼什麼時候可以開？', a: '由醫師依第一眼恢復情況安排，通常間隔 1 到數週。' }
  ]
};
